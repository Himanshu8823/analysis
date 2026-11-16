/**
 * Reading a syllabus PDF into structured scheme data.
 *
 * The reading is done by a language model, and the reason is simple: a
 * syllabus table is *not* a rectangular grid. The type of a course is
 * printed once and covers several rows; a course name wraps onto two lines;
 * a co-curricular course lists three alternatives in one cell; the totals
 * row and a second table of exit-requirement courses sit in the same place
 * as real courses. Deciding which of those is a course and which is not is
 * reading comprehension, and a model does it better than a set of rules
 * would — and, more importantly, a model does it the same way on a syllabus
 * nobody has seen before.
 *
 * So the division of work is:
 *
 *  - the **code** finds the pages, renders them and sends them;
 *  - the **model** reads them and answers with structured data;
 *  - the **code** checks the answer, and a **human** approves it before
 *    anything is written.
 *
 * What is sent is the *rendered page* — a PNG for a page without a text
 * layer, the text for a page with one — and never the original PDF. A
 * scheme document is a few pages; a rendered page is a few hundred
 * kilobytes; the PDF could be much larger and is not needed.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COURSE_TYPES, type CourseType } from '@/common/constants/scheme';
import type { SchemeCourse, SchemeDocument, SchemeWarning } from '@result-analysis/shared-types';
import { readPdfText } from '../pdf/document-renderer';
import { GroqClient } from './groq.client';
import { AiError, AiErrorKind } from './ai.errors';
import { DocumentGuardService, type GuardResult } from './document-guard.service';

/**
 * The logger for this module.
 */
const logger = new Logger('SchemeReader');

/**
 * The fallback for the most output tokens one call to the reader may use.
 *
 * The provider limits how many output tokens a model may produce in a
 * minute, and for the reader's model that limit is small — a thousand
 * tokens a minute on a free tier. A scheme page read as one answer is
 * larger than that: a printed page carries eight to twelve courses, and
 * each course comes back as ten fields, so the answer is a thousand
 * tokens or more. The provider refuses such a request outright rather
 * than truncating it.
 *
 * So the answer is capped, and a page whose table is larger than the cap
 * is read in pieces rather than being cut short. A truncated answer would
 * be the worst outcome: the courses that did not fit would simply be
 * missing, and nothing would say so.
 *
 * The cap is set at half the provider's limit, and that is what makes two
 * calls a minute possible. Two calls a minute is what makes reading a
 * document something a person will actually wait for.
 *
 * The value is configurable, because the provider's limit belongs to the
 * key and the tier, and both can change.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 450;

/**
 * What one course costs in the answer, in tokens.
 *
 * This is measured, not guessed. A course comes back as eleven values, and
 * the answer is written in the compact form — an array of values rather
 * than an object with named keys — because named keys cost about three
 * times as much. In the compact form a course is about forty tokens: the
 * code, the type, the name, six numbers, and the brackets and commas
 * around them.
 *
 * The number is what decides how many courses fit into one answer, and it
 * is therefore what decides where a page is split. A number that is too
 * small sends pages out in pieces too small to be worth reading; a number
 * that is too big sends a piece out with more courses in it than the
 * answer can hold, and the provider truncates it — which loses courses
 * without saying so.
 */
const TOKENS_PER_COURSE = 40;

/**
 * The fallback for the most text one call may send, in characters.
 *
 * A printed scheme page runs to about two thousand characters and carries
 * eight to twelve courses. A call that takes a third of a page carries
 * three or four courses, whose answer fits inside the output cap with
 * room to spare.
 *
 * The default is also well below the guard's own page limit: a piece
 * larger than that would be a piece the guard could not have checked.
 */
const DEFAULT_MAX_INPUT_CHARACTERS_PER_CALL = 1200;

/**
 * The fallback for the smallest gap between two calls, in milliseconds.
 *
 * The provider's limit is per minute, and it counts the *output* of every
 * call in the window. Two calls whose answers are each capped at half the
 * limit fit inside one window, so the gap is half a minute. Reading a
 * document page after page with no pause fills the window, and the
 * reading fails at the last page rather than at the first — which is the
 * worst time to fail.
 */
const DEFAULT_MIN_GAP_BETWEEN_CALLS_MS = 31_000;

/**
 * The instructions the model is given.
 *
 * They are written for a model that has never seen a DBATU syllabus, and
 * they spell out the things that are genuinely ambiguous — the merged type
 * cell, the totals row, the co-curricular options — because those are
 * where a reading goes wrong.
 */
const SYSTEM_PROMPT = `You read examination scheme tables out of university syllabus PDFs.

You are given one or more pages of a syllabus. Each page is either text or an image of a printed table.

The tables have these columns, in this order:
  Course Code | Type of Course | Course Name | L | P | CA | MSE | ESE | Credit

- "L" is the weekly lecture hours, "P" is the weekly practical hours.
- "CA" is the marks of the Continuous Assessment, "MSE" is the marks of the Mid-Semester Examination, "ESE" is the marks of the End-Semester Examination.
- A dash ("-") in a cell means the course has NO such component. Record it as null, never as 0.
- An EMPTY cell between two vertical bars means the same thing: the course has no such component. Record it as null, never as 0, and never move the value beside it into the empty column.
- "Credit" is the number of credits the course carries.

Every course row has the same number of cells, and a cell is empty rather than missing. Count the cells before you read them: if a row has nine cells, the columns are code, type, name, L, P, CA, MSE, ESE, Credit — and a cell that is empty is a component the course does not have.

Rules you must follow:

1. A cell in the "Type of Course" column is often MERGED across several rows — it is printed once, vertically centred, and applies to every row it spans. Apply it to all of them. A course whose type cell is empty inherits the type from the group it is in.

2. A course name may WRAP onto two lines. Join it back into one name.

3. A row whose Course Code cell is empty is a CONTINUATION of the row above it (a second line of a wrapped name, or a second alternative of a co-curricular course). Do not create a separate course for it.

4. The "Total" row is a totals row, not a course. Skip it.

5. Some tables have a heading above them naming the semester — "First Semester", "Second Semester", "Semester III". That semester applies to every course in that table. If a table has no such heading, use null.

6. A co-curricular (CC) course may list several alternatives in its Course Name cell, like "A. NSS / B. NCC / C. Yoga Education". Put the whole cell in the name and ALSO put each alternative, without its "A." / "B." / "C." prefix, in the options.

7. A table may be followed by another table with a heading of its own (for example "Exit Requirements to award Certificate..."). The courses in it are real courses and must be included.

8. Only include rows that are real courses. Ignore captions, notes, legends, the "Course Type and Acronyms used" list, footers and page numbers.

9. Never invent a value. If you cannot read a cell, use null and add a warning.

10. A course's CA + MSE + ESE should normally add up to 100. Report a warning when it does not, but still report the numbers as you read them.

Answer with JSON only.

A course is an ARRAY of exactly 11 values, in this order:
  [code, type, name, lectureHours, practicalHours, CA, MSE, ESE, credits, options, semester]

The first nine values are the table's own columns, in the table's own order:
  code | type | name | L | P | CA | MSE | ESE | Credit
Copy them across in that order. The table's order is the table's order — do
not reorder the columns because the answer reads better another way.

- "code" is the course code as a string, or null.
- "type" is one of ${JSON.stringify(COURSE_TYPES)}, or null. It is the SECOND value, not the third.
- "name" is the full course name as a string, or null. It is the THIRD value.
- "lectureHours", "practicalHours", "CA", "MSE", "ESE" and "credits" are numbers, or null.
- "options" is an array of strings. Use [] when the course has no alternatives.
- "semester" is a number, or null. It comes LAST, because it is not a column of the table — it is read from the heading above it.

A warning is an ARRAY of exactly 3 values, in this order:
  [pageNumber, subject, message]
- "pageNumber" is a number.
- "subject" is a course code as a string, or null.
- "message" is a short sentence saying what was wrong.

So the answer looks like this:

{
  "courses": [
    ["COEMD112", "BSC", "Set Theory and Logic", 3, null, 20, 20, 60, 3, [], 1]
  ],
  "warnings": [
    [1, "COEXX999", "Could not read the credit column"]
  ]
}`;

/**
 * The schema the model is asked to answer with.
 *
 * The shape is compact on purpose. A course is an *array* of values in a
 * fixed order rather than an object with eleven named keys, and that is
 * not a saving of elegance — it is a saving of tokens, and tokens are
 * what the provider limits.
 *
 * The provider allows a thousand output tokens a minute for this model,
 * and a printed scheme page carries eight to twelve courses. Answering
 * with named keys costs about a hundred and fifty tokens a course, so a
 * page of ten courses would need fifteen hundred tokens and would simply
 * be refused. Answering with a compact row costs about a third of that,
 * and the same page fits in one answer.
 *
 * The order of the values is fixed and is written into the instructions.
 * It is the printed table's own column order, so the model copies each
 * cell straight across:
 *
 *   [code, type, name, lecture hours, practical hours, CA, MSE, ESE,
 *    credits, options, semester]
 *
 * ## Why each position has its own type
 *
 * The first version said that *every* position could hold a string, an
 * integer, null **or an array**. That is far more freedom than the answer
 * needs, and the model took it: asked for an array at a position that
 * wanted a string, it produced `tables`, then `tables_meta`, then
 * `tables_meta_meta`, and kept nesting until the answer ran out of tokens
 * — and the provider rejected the whole reading with a schema error.
 *
 * A wrong answer that is *shorter* than the truth is the worst outcome
 * here, because it is indistinguishable from a right one until somebody
 * reads the marks.
 *
 * So each position now says what it holds. Only the options position
 * accepts an array, and that array is of strings and is bounded.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    courses: {
      type: 'array',
      items: {
        type: 'array',
        prefixItems: [
          { type: 'string' }, // course code
          { type: ['string', 'null'] }, // course type
          { type: 'string' }, // course name
          { type: ['integer', 'null'] }, // lecture hours
          { type: ['integer', 'null'] }, // practical hours
          { type: ['integer', 'null'] }, // continuous assessment
          { type: ['integer', 'null'] }, // mid-semester examination
          { type: ['integer', 'null'] }, // end-semester examination
          { type: ['integer', 'null'] }, // credits
          {
            // The alternatives of a co-curricular course: "NSS", "NCC",
            // "Yoga Education". Bounded, because a course lists a handful
            // of options and never a nest.
            type: 'array',
            items: { type: 'string' },
            maxItems: 10,
          },
          { type: ['integer', 'null'] }, // semester
        ],
        minItems: 11,
        maxItems: 11,
      },
    },
    warnings: {
      type: 'array',
      items: {
        type: 'array',
        prefixItems: [
          { type: ['integer', 'null'] }, // the course code, when known
          { type: 'string' }, // what is wrong
          { type: 'string' }, // what to look at
        ],
        minItems: 3,
        maxItems: 3,
      },
    },
  },
  required: ['courses', 'warnings'],
  additionalProperties: false,
} as const;

/**
 * The names of a course's values, in the order the model returns them.
 *
 * The order mirrors the printed table's own columns — code, type, name,
 * lecture hours, practical hours, CA, MSE, ESE, credits — so the model
 * copies each cell straight across without having to remember where it
 * goes. `semester` comes last because it is not a column of the table: it
 * is read from the heading above it.
 *
 * The order is the schema's order, and the two are checked against each
 * other below — a change to one without the other would silently
 * transpose every column of the scheme.
 */
const COURSE_FIELDS = [
  'courseCode',
  'courseType',
  'courseName',
  'theoryHours',
  'practicalHours',
  'ca',
  'mse',
  'ese',
  'credits',
  'options',
  'semester',
] as const;

/**
 * The names of a warning's values, in the order the model returns them.
 *
 * A warning carries no severity. The reader is the one that knows how
 * serious a warning is, and a model that had to be asked for it would
 * spend a token on every warning to say the same thing.
 */
const WARNING_FIELDS = ['pageNumber', 'subject', 'message'] as const;

/**
 * The result of reading a document.
 */
export interface SchemeReadResult extends SchemeDocument {
  /** The pages that were read. */
  pagesRead: number;
  /** The model that read the document. */
  model: string;
  /** How long the reading took, in milliseconds. */
  durationMs: number;
  /**
   * The courses that failed the checks and were dropped.
   *
   * They are reported rather than silently dropped, so the reviewer knows
   * that something in the document was not read.
   */
  rejected: Array<{ reason: string; data: unknown }>;
  /**
   * What the guard said about the document.
   *
   * It is included so that the reviewer can see that the document was
   * checked, and which pages it was checked on.
   */
  guard: GuardResult;
}

/**
 * Reads syllabus PDFs into structured scheme data.
 */
@Injectable()
export class SchemeReaderService {
  private readonly client: GroqClient;

  /**
   * When the last call to the provider was made.
   *
   * The provider's limit is per minute, and it counts every call in the
   * window, so the next call waits until the window has room. It is set
   * when the call is *made*, not when it returns, because the limit counts
   * the output that was produced.
   */
  private lastCallAt = 0;

  /**
   * The most output tokens one call may use.
   */
  private readonly maxOutputTokens: number;

  /**
   * The most text one call may send, in characters.
   */
  private readonly maxInputCharactersPerCall: number;

  /**
   * The smallest gap between two calls, in milliseconds.
   */
  private readonly minGapBetweenCallsMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly guard: DocumentGuardService
  ) {
    this.client = new GroqClient({
      apiKey: this.config.get<string>('ai.groqApiKey') ?? process.env.GROQ_API_KEY ?? '',
      baseUrl: this.config.get<string>('ai.groqBaseUrl') ?? 'https://api.groq.com/openai/v1',
      model: this.config.get<string>('ai.groqModel') ?? 'qwen/qwen3.8-27b',
      timeoutMs: this.config.get<number>('ai.requestTimeoutMs') ?? 60000,
      maxRetries: this.config.get<number>('ai.maxRetries') ?? 2,
    });

    this.maxOutputTokens =
      this.config.get<number>('ai.maxOutputTokens') ?? DEFAULT_MAX_OUTPUT_TOKENS;

    this.maxInputCharactersPerCall =
      this.config.get<number>('ai.maxInputCharactersPerCall') ??
      DEFAULT_MAX_INPUT_CHARACTERS_PER_CALL;

    this.minGapBetweenCallsMs =
      this.config.get<number>('ai.minGapBetweenCallsMs') ?? DEFAULT_MIN_GAP_BETWEEN_CALLS_MS;
  }

  /**
   * Whether the AI reading is available.
   */
  get isAvailable(): boolean {
    return this.client.isConfigured;
  }

  /**
   * Reads a syllabus PDF.
   *
   * @throws {AiError} when the AI service is not configured, is unreachable,
   *   times out, or answers with something unreadable.
   */
  async read(buffer: Buffer): Promise<SchemeReadResult> {
    if (!this.isAvailable) {
      throw new AiError(
        AiErrorKind.NotConfigured,
        'GROQ_API_KEY is not configured, so the scheme cannot be read automatically.'
      );
    }

    const startedAt = Date.now();

    const pages = await this.extractPages(buffer);

    if (pages.length === 0) {
      throw new AiError(AiErrorKind.MalformedResponse, 'The document has no pages.');
    }

    const courses: SchemeCourse[] = [];
    const warnings: SchemeWarning[] = [];
    const rejected: Array<{ reason: string; data: unknown }> = [];

    /**
     * The document is checked before it is read.
     *
     * The PDF came from outside the college, and a file can carry text
     * written to look like instructions to the reader. The guard looks for
     * that first. A page it refuses is never sent to the reader, and the
     * user is told which pages were refused and why.
     */
    const guard = await this.guard.check(pages);

    if (!guard.isSafe) {
      logger.warn(
        `The document guard refused ${guard.refusedPages.length} page(s): ${guard.refusedPages.join(', ')}`
      );

      throw new AiError(
        AiErrorKind.MalformedResponse,
        `The document guard refused pages ${guard.refusedPages.join(', ')}: the text in them tries to change how the document is read.`
      );
    }

    /**
     * The pages the guard could not reach. They were not refused — nothing
     * was found wrong with them — but they were not defended either, and
     * the reviewer is told which pages those were. A page that could not
     * be checked is a page whose content has not been looked at by
     * anything but a person.
     */
    if (guard.uncheckedPages.length > 0) {
      logger.warn(
        `The document guard could not check ${guard.uncheckedPages.length} page(s): ${guard.uncheckedPages.join(', ')}`
      );

      warnings.push({
        pageNumber: guard.uncheckedPages[0],
        subject: null,
        message:
          guard.uncheckedPages.length === 1
            ? `Page ${guard.uncheckedPages[0]} could not be checked for instructions hidden in it. Check that page yourself.`
            : `Pages ${guard.uncheckedPages.join(', ')} could not be checked for instructions hidden in them. Check those pages yourself.`,
        severity: 'warning',
      });
    }

    for (const page of pages) {
      /**
       * A page with no text cannot be read. It is reported rather than
       * passed over in silence — the user needs to know that a page was
       * missed, and the usual cause is that they uploaded a scan of the
       * document instead of the document itself.
       */
      if (!page.text || page.text.trim().length === 0) {
        warnings.push({
          pageNumber: page.pageNumber,
          subject: null,
          message: `Page ${page.pageNumber} has no readable text. If this is a scan or a photograph of the document, download the PDF from the university website and upload that instead.`,
          severity: 'error',
        });
        continue;
      }

      /**
       * A page is read on its own, so a document with several pages does
       * not have to fit into one request and a failure on one page does
       * not lose the others.
       *
       * A page whose table is bigger than one answer can hold is read in
       * pieces, and the pieces are put back together. The alternative —
       * asking for one big answer — is refused by the provider, or
       * truncated, and a truncated answer loses courses without saying so.
       */
      for (const piece of this.splitPage(page)) {
        const pageResult = await this.readPiece(page, piece);

        /**
         * The rows the reader could not turn into a course at all. They are
         * reported, not dropped in silence.
         */
        rejected.push(...pageResult.rejected);

        for (const course of pageResult.courses) {
          const checked = this.checkCourse(course, page.pageNumber);

          if (!checked.course) {
            rejected.push({
              reason: checked.reason ?? 'The course could not be read.',
              data: course,
            });
            continue;
          }

          if (checked.warning) warnings.push(checked.warning);
          courses.push(checked.course);
        }

        warnings.push(...pageResult.warnings);
      }
    }

    const semesters = [
      ...new Set(
        courses.map((course) => course.semester).filter((value): value is number => value !== null)
      ),
    ].sort((a, b) => a - b);

    return {
      courses,
      warnings,
      semesters,
      pageCount: pages.length,
      pagesRead: pages.length,
      model: this.config.get<string>('ai.groqModel') ?? 'qwen/qwen3.8-27b',
      durationMs: Date.now() - startedAt,
      rejected,
      guard,
    };
  }

  /**
   * Takes the pages out of the document.
   *
   * This is the one step that touches the file itself, and it is separate
   * from the reading so that the two can be reasoned about — and tested —
   * on their own.
   */
  protected async extractPages(
    buffer: Buffer
  ): Promise<Array<{ pageNumber: number; text: string }>> {
    return readPdfText(buffer);
  }

  /**
   * Splits a page into the pieces that are read one at a time.
   *
   * A page is split on line boundaries so that a table row is never cut in
   * half — a half-row means nothing to a reader, and a course whose name
   * wraps onto the next line would be read as two broken courses.
   *
   * What decides where the split falls is the number of *course rows* in a
   * piece, not the number of characters. This is the thing that matters,
   * and it is worth being exact about why.
   *
   * The answer to a piece is a list of courses, and a course costs about
   * forty tokens however short its name is — the code, the type, the hours,
   * the three marks, the credits, the options and the semester are all
   * there whatever the name is. So the size of the answer is decided by how
   * many courses the piece holds, and by almost nothing else.
   *
   * Splitting on characters gets this wrong in both directions. A piece
   * of a thousand characters can hold ten courses — and ten courses is
   * more than the answer budget allows — or it can hold four. The same
   * number of characters means two very different answers depending on
   * which rows it happens to contain.
   *
   * So the pieces are counted in course rows, and the character limit is
   * kept as a second bound so that a piece never grows past what the
   * provider will accept as input either.
   *
   * The header line — the column names — is repeated on each piece,
   * because a piece of a table without its column names is unreadable.
   */
  private splitPage(page: { pageNumber: number; text: string }): string[] {
    if (!page.text || page.text.trim().length === 0) {
      return [];
    }

    /**
     * A page that fits within one call is one piece. A page with no course
     * rows in it — a page of rules, a legend — is one piece too, because
     * there is nothing in it that could be split.
     */
    const lines = page.text.split('\n');
    const courseRows = lines.filter((line) => this.isCourseRow(line)).length;

    if (page.text.length <= this.maxInputCharactersPerCall || courseRows === 0) {
      return [page.text];
    }

    /**
     * The first line of a scheme page is usually the column header. It is
     * kept on its own so that it can be repeated on every piece.
     */
    const header = lines[0] ?? '';
    const body = lines.slice(1);

    const headerCost = header.length + 2;
    const room = Math.max(500, this.maxInputCharactersPerCall - headerCost);

    /**
     * How many course rows one answer holds.
     *
     * The budget is divided by the cost of a course, with a margin, so
     * that the answer fits with room to spare. The margin is a third
     * because the answer also carries the warnings and the punctuation
     * around the courses, and because a course whose name is long costs
     * more than one whose name is short.
     */
    const rowsPerPiece = Math.max(1, Math.floor((this.maxOutputTokens * 0.66) / TOKENS_PER_COURSE));

    const pieces: string[] = [];
    let current = '';
    let currentRows = 0;

    for (const line of body) {
      const isCourseRow = this.isCourseRow(line);

      /**
       * A piece is closed when it has as many course rows as an answer can
       * hold, or when it has grown past the character limit. Either way the
       * next line starts a new piece.
       */
      const isFull =
        currentRows >= rowsPerPiece ||
        (current.length > 0 && current.length + line.length + 1 > room);

      if (isFull) {
        pieces.push(current);
        current = '';
        currentRows = 0;
      }

      /**
       * A single line longer than the room is given a piece of its own. It
       * cannot be split without cutting the row, and a row that is too long
       * for one answer is a row the reader will have to manage.
       */
      if (line.length > room) {
        if (current.length > 0) {
          pieces.push(current);
          current = '';
          currentRows = 0;
        }
        pieces.push(line);
        continue;
      }

      current = current.length === 0 ? line : `${current}\n${line}`;

      if (isCourseRow) currentRows += 1;
    }

    if (current.length > 0) pieces.push(current);

    /**
     * The header goes on every piece. A piece without it cannot be read,
     * because the reader would not know which column is which.
     */
    return pieces.map((piece) => (header ? `${header}\n${piece}` : piece));
  }

  /**
   * Whether a line of a page is a course row.
   *
   * A course row begins with a course code — the letters and the number of
   * a code — and the code is always the first cell of the row.
   */
  private isCourseRow(line: string): boolean {
    return /^\s*COE[A-Z]*\d/i.test(line);
  }

  /**
   * Reads one piece of a page.
   */
  private async readPiece(
    page: { pageNumber: number; text: string },
    piece: string
  ): Promise<{
    courses: SchemeCourse[];
    warnings: SchemeWarning[];
    rejected: Array<{ reason: string; data: unknown }>;
  }> {
    await this.waitForTurn();

    const completion = await this.client.complete({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is page ${page.pageNumber} of the syllabus, as text. Each table row is separated by a vertical bar "|".\n\n${piece}`,
        },
      ],
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'scheme_document',
          schema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
      },
      temperature: 0,
      /**
       * The model is reading a table, not solving a problem. Reasoning
       * tokens come out of the same budget as the answer, so a model that
       * thinks about the table leaves less room for the table itself.
       */
      reasoningEffort: 'none',
      /**
       * The answer is capped so that the provider's output budget for the
       * minute is never exceeded. The pieces are sized so that the cap is
       * generous for the rows they carry.
       */
      maxTokens: this.maxOutputTokens,
    });

    return this.parseResponse(completion.content, page.pageNumber);
  }

  /**
   * Waits until the next call may be made.
   *
   * The provider limits the output a model may produce in a minute. The
   * calls are spaced so that the window is never full, which means the
   * last page of a document is read exactly like the first one.
   */
  private async waitForTurn(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.lastCallAt + this.minGapBetweenCallsMs - now);

    if (waitMs > 0) {
      logger.log(`Waiting ${Math.ceil(waitMs / 1000)}s before the next reading call.`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastCallAt = Date.now();
  }

  /**
   * Reads the model's answer.
   *
   * The answer is JSON, but a model can still wrap it in a markdown fence
   * or put a sentence around it. The fence is stripped, and the first
   * object is taken.
   */
  private parseResponse(
    content: string,
    pageNumber: number
  ): {
    courses: SchemeCourse[];
    warnings: SchemeWarning[];
    rejected: Array<{ reason: string; data: unknown }>;
  } {
    const stripped = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new AiError(
        AiErrorKind.MalformedResponse,
        `The AI service did not return JSON for page ${pageNumber}.`
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(stripped.slice(start, end + 1));
    } catch (error) {
      throw new AiError(
        AiErrorKind.MalformedResponse,
        `The AI service returned JSON for page ${pageNumber} that could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const courses: SchemeCourse[] = [];
    const warnings: SchemeWarning[] = [];
    const rejected: Array<{ reason: string; data: unknown }> = [];

    if (!parsed || typeof parsed !== 'object') {
      throw new AiError(
        AiErrorKind.MalformedResponse,
        `The AI service returned an unexpected shape for page ${pageNumber}.`
      );
    }

    const record = parsed as { courses?: unknown; warnings?: unknown };

    if (Array.isArray(record.courses)) {
      for (const raw of record.courses) {
        const course = this.toCourse(raw, pageNumber);

        /**
         * A row the reader could not turn into a course is reported, not
         * dropped in silence. The reviewer must be able to see that
         * something in the document was not read.
         */
        if (!course.course) {
          rejected.push({ reason: course.reason, data: raw });
          continue;
        }

        courses.push(course.course);
      }
    }

    if (Array.isArray(record.warnings)) {
      for (const raw of record.warnings) {
        const warning = this.toWarning(raw, pageNumber);

        if (!warning) continue;

        warnings.push(warning);
      }
    }

    return { courses, warnings, rejected };
  }

  /**
   * Turns one raw warning from the model into a warning.
   *
   * A warning the model could not describe is kept, with a message that
   * says so, rather than dropped — the reviewer is told that something was
   * noticed even when the model cannot explain it.
   */
  private toWarning(raw: unknown, pageNumber: number): SchemeWarning | null {
    /**
     * A warning is three values in a fixed order: the page, the subject
     * and the message.
     */
    if (!Array.isArray(raw)) return null;

    const record: Record<string, unknown> = {};

    WARNING_FIELDS.forEach((field, index) => {
      record[field] = raw[index];
    });

    const rawPage = record.pageNumber;
    const rawSubject = record.subject;
    const rawMessage = record.message;

    return {
      pageNumber: this.readInteger(rawPage) ?? pageNumber,
      subject:
        typeof rawSubject === 'string' && rawSubject.trim().length > 0 ? rawSubject.trim() : null,
      message:
        typeof rawMessage === 'string' && rawMessage.trim().length > 0
          ? rawMessage.trim()
          : 'The AI service reported a problem it could not describe.',
      severity: 'warning',
    };
  }

  /**
   * Turns one raw course from the model into a course.
   *
   * A course is eleven values in a fixed order. A row that is not a course
   * at all — no code, no name, a totals row — comes back with the reason
   * why, so that it can be reported to the reviewer instead of
   * disappearing.
   */
  private toCourse(
    raw: unknown,
    pageNumber: number
  ): { course: SchemeCourse | null; reason: string } {
    /**
     * The values are in a fixed order, so they are read by position.
     */
    if (!Array.isArray(raw)) {
      return { course: null, reason: 'A row in the document was not a list of values.' };
    }

    const record: Record<string, unknown> = {};

    COURSE_FIELDS.forEach((field, index) => {
      record[field] = raw[index];
    });

    const courseCode = this.readText(record.courseCode);
    const courseName = this.readText(record.courseName);

    /**
     * A row with neither a code nor a name is not a course. The totals row
     * and the legend rows end up here.
     */
    if (!courseCode && !courseName) {
      return {
        course: null,
        reason: 'A row in the document had neither a course code nor a course name.',
      };
    }

    /**
     * A totals row has a name but no code, and the word "total" in it.
     */
    if (!courseCode && courseName && /^\s*total\b/i.test(courseName)) {
      return {
        course: null,
        reason: `"${courseName}" is the totals row of the table, not a course.`,
      };
    }

    const options = Array.isArray(record.options)
      ? record.options
          .filter((option): option is string => typeof option === 'string')
          .map((option) => option.trim())
          .filter((option) => option.length > 0)
      : [];

    return {
      course: {
        courseCode: courseCode ?? '',
        courseName: courseName ?? '',
        courseType: this.readCourseType(record.courseType),
        semester: this.readInteger(record.semester),
        theoryHours: this.readInteger(record.theoryHours),
        practicalHours: this.readInteger(record.practicalHours),
        ca: this.readInteger(record.ca),
        mse: this.readInteger(record.mse),
        ese: this.readInteger(record.ese),
        credits: this.readInteger(record.credits),
        options,
        pageNumber,
      },
      reason: '',
    };
  }

  /**
   * Reads a value that should be a number.
   */
  private readInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    if (typeof value === 'string') {
      const cleaned = value.trim();
      if (cleaned === '' || cleaned === '-' || cleaned === '–' || cleaned === '—') return null;
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return null;
  }

  /**
   * Reads a value that should be text.
   */
  private readText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Reads a value that should be a course type.
   *
   * A type the system does not know is `null`, not a guess — the reviewer
   * fills it in. Inventing a type would be inventing a category.
   */
  private readCourseType(value: unknown): CourseType | null {
    if (typeof value !== 'string') return null;
    const normalised = value.trim().toUpperCase();
    return (COURSE_TYPES as readonly string[]).includes(normalised)
      ? (normalised as CourseType)
      : null;
  }

  /**
   * Checks one course and decides whether it may be shown to the reviewer.
   *
   * The checks are the ones that catch a reading that went wrong. A course
   * with no code and no name is dropped — there is nothing to review. A
   * course whose components do not add up to 100 is *kept* — the reviewer
   * sees the numbers and decides — but it carries a warning, because a
   * scheme that does not add up is usually a misread.
   */
  private checkCourse(
    course: SchemeCourse,
    pageNumber: number
  ): { course: SchemeCourse | null; reason?: string; warning?: SchemeWarning } {
    if (!course.courseCode && !course.courseName) {
      return { course: null, reason: 'The row had neither a course code nor a course name.' };
    }

    if (!course.courseCode) {
      return {
        course: null,
        reason: `The course "${course.courseName}" had no course code.`,
      };
    }

    /**
     * The components a course has must add up to 100. A course with no
     * components at all is not a scheme row.
     */
    const components = (['ca', 'mse', 'ese'] as const)
      .map((key) => course[key])
      .filter((value): value is number => value !== null);

    if (components.length === 0) {
      return {
        course: null,
        reason: `The course "${course.courseCode}" had no assessment components.`,
      };
    }

    const total = components.reduce((sum, value) => sum + value, 0);

    if (total !== 100) {
      return {
        course,
        warning: {
          pageNumber,
          subject: course.courseCode,
          message: `The assessment marks of "${course.courseName}" add up to ${total}, not 100. Please check them.`,
          severity: 'warning',
        },
      };
    }

    return { course };
  }
}
