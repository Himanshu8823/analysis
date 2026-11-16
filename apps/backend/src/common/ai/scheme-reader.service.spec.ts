/**
 * Tests for the scheme reader.
 *
 * The reader is where a document becomes data, so the tests here are about
 * the two things that can go wrong: a model's answer being taken at face
 * value, and a row that should not be a subject being turned into one.
 *
 * The provider is faked at the HTTP boundary, and the PDF step is replaced
 * with the pages a test supplies. Everything between them — the guard, the
 * parsing, the validation — is the code that ships.
 */

import { ConfigService } from '@nestjs/config';
import { SchemeReaderService } from './scheme-reader.service';
import { DocumentGuardService } from './document-guard.service';
import { AiError, AiErrorKind } from './ai.errors';

/**
 * The answer the fake reader gives.
 */
let providerAnswer: unknown = { courses: [], warnings: [] };

/**
 * The score the fake guard gives.
 */
let guardScore = '0.0004';

/**
 * Replaces `fetch` with a fake that answers the way the real provider
 * would — a score for the guard, a document for the reader.
 */
function fakeProvider(): void {
  global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { model: string };

    /**
     * The two models are told apart by their id, which is how the real
     * provider tells them apart too.
     */
    const isGuard = body.model.includes('prompt-guard');
    const answer = isGuard ? guardScore : JSON.stringify(providerAnswer);

    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ model: body.model, choices: [{ message: { content: answer } }] }),
    };
  }) as unknown as typeof fetch;
}

/**
 * A reader whose pages are the ones the test supplies.
 */
class TestSchemeReader extends SchemeReaderService {
  constructor(
    config: ConfigService,
    guard: DocumentGuardService,
    private readonly pages: Array<{ pageNumber: number; text: string }>
  ) {
    super(config, guard);
  }

  protected override async extractPages(): Promise<Array<{ pageNumber: number; text: string }>> {
    return this.pages;
  }
}

/**
 * Builds the reader with a configuration that has a key.
 *
 * The gap between calls is set to nothing, so a test that reads a page in
 * pieces does not have to wait a minute between them.
 */
function buildReader(pages: Array<{ pageNumber: number; text: string }>): TestSchemeReader {
  const config = new ConfigService({
    ai: {
      groqApiKey: 'test-key',
      groqBaseUrl: 'https://api.groq.com/openai/v1',
      groqModel: 'qwen/qwen3.8-27b',
      groqGuardModel: 'meta-llama/llama-prompt-guard-2-86m',
      requestTimeoutMs: 60000,
      maxRetries: 0,
      maxOutputTokens: 450,
      maxInputCharactersPerCall: 1200,
      minGapBetweenCallsMs: 0,
      guardMinGapMs: 0,
    },
  });

  return new TestSchemeReader(config, new DocumentGuardService(config), pages);
}

/**
 * A page of text that looks like the DBATU first-semester table.
 */
const PAGE_TEXT =
  'COEMD111 | 1 | 2 | 60 | - | 40 | 2\n' +
  'BSC\n' +
  'COEMD112 | Set Theory and Logic | 3 | - | 20 | 20 | 60 | 3\n' +
  'Total | 18 | 8 | 400 | 100 | 500 | 22';

/**
 * A course the model read correctly.
 *
 * The model answers with a list of values in a fixed order rather than
 * with named keys, because named keys cost three times the tokens and the
 * provider limits how many tokens a model may produce.
 */
const GOOD_COURSE = ['COEMD112', 'BSC', 'Set Theory and Logic', 3, null, 20, 20, 60, 3, [], 1];

/**
 * Builds a course row for the tests.
 *
 * The order of the values is the model's order, and it is the same in
 * every test — a test that got the order wrong would be testing the test
 * rather than the code.
 *
 * The order is the printed table's own: code, type, name, lecture hours,
 * practical hours, CA, MSE, ESE, credits — then the two that are not
 * columns of the table, options and semester.
 */
function course(values: {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  semester?: unknown;
  lectureHours?: unknown;
  practicalHours?: unknown;
  ca?: unknown;
  mse?: unknown;
  ese?: unknown;
  credits?: unknown;
  options?: unknown;
}): unknown[] {
  return [
    values.code ?? null,
    values.type ?? null,
    values.name ?? null,
    values.lectureHours ?? null,
    values.practicalHours ?? null,
    values.ca ?? null,
    values.mse ?? null,
    values.ese ?? null,
    values.credits ?? null,
    values.options ?? [],
    values.semester ?? null,
  ];
}

describe('SchemeReaderService', () => {
  beforeEach(() => {
    providerAnswer = { courses: [], warnings: [] };
    guardScore = '0.0004';
    fakeProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('reading a model answer', () => {
    it('reads a course with every component', async () => {
      providerAnswer = { courses: [GOOD_COURSE], warnings: [] };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0]).toMatchObject({
        courseCode: 'COEMD112',
        courseName: 'Set Theory and Logic',
        courseType: 'BSC',
        semester: 1,
        ca: 20,
        mse: 20,
        ese: 60,
        credits: 3,
      });
    });

    it('reads an answer wrapped in a markdown fence', async () => {
      global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { model: string };
        const answer = body.model.includes('prompt-guard')
          ? '0.0004'
          : '```json\n{"courses":[["COEMD112","BSC","Set Theory and Logic",3,null,20,20,60,3,[],1]],"warnings":[]}\n```';

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ model: body.model, choices: [{ message: { content: answer } }] }),
        };
      }) as unknown as typeof fetch;

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].courseCode).toBe('COEMD112');
    });

    it('reads a dash in a component as absent, not as zero', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEMD111',
            name: 'Environmental Sciences and Engineering',
            type: 'BSC',
            semester: 1,
            lectureHours: 1,
            practicalHours: 2,
            ca: 60,
            mse: '-',
            ese: 40,
            credits: 2,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses[0].mse).toBeNull();
      expect(result.courses[0].ca).toBe(60);
    });

    it('keeps the alternatives of a co-curricular course', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COECC118',
            name: 'A. NSS / B. NCC / C. Yoga Education',
            type: 'CC',
            semester: 1,
            lectureHours: 1,
            practicalHours: 2,
            ca: 60,
            mse: null,
            ese: 40,
            credits: 2,
            options: ['NSS', 'NCC', 'Yoga Education'],
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses[0].options).toEqual(['NSS', 'NCC', 'Yoga Education']);
    });

    it('records the page a course came from', async () => {
      providerAnswer = { courses: [GOOD_COURSE], warnings: [] };

      const result = await buildReader([{ pageNumber: 7, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses[0].pageNumber).toBe(7);
    });

    it('collects the semesters it found, in order', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEMD112',
            name: 'Set Theory and Logic',
            type: 'BSC',
            semester: 2,
            lectureHours: 3,
            ca: 20,
            mse: 20,
            ese: 60,
            credits: 3,
          }),
          course({
            code: 'COEMD111',
            name: 'Environmental Sciences and Engineering',
            type: 'BSC',
            semester: 1,
            lectureHours: 1,
            practicalHours: 2,
            ca: 60,
            mse: null,
            ese: 40,
            credits: 2,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.semesters).toEqual([1, 2]);
    });
  });

  describe('rows that are not courses', () => {
    it('drops the totals row', async () => {
      providerAnswer = {
        courses: [
          course({
            code: '',
            name: 'Total',
            type: null,
            semester: 1,
            lectureHours: 18,
            practicalHours: 8,
            ca: 400,
            mse: 100,
            ese: 500,
            credits: 22,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toContain('totals row');
    });

    it('drops a legend row that has neither a code nor a name', async () => {
      providerAnswer = {
        courses: [course({ code: '', name: '', type: 'BSC' })],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toContain('neither a course code nor a course name');
    });

    it('drops a course with no assessment components at all', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEXX999',
            name: 'Set Theory and Logic',
            type: 'BSC',
            semester: 1,
            lectureHours: 3,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toContain('no assessment components');
    });
  });

  describe('the marks on a course', () => {
    it('keeps a course whose marks do not add up to 100, and warns about it', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEMD112',
            name: 'Set Theory and Logic',
            type: 'BSC',
            semester: 1,
            lectureHours: 3,
            ca: 20,
            mse: 20,
            ese: 40,
            credits: 3,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      /**
       * The course is kept. A reviewer sees the numbers and decides. What
       * is never done is quietly "fixing" the number.
       */
      expect(result.courses).toHaveLength(1);
      expect(result.courses[0].ese).toBe(40);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('add up to 80, not 100');
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('does not warn about a course whose marks add up to 100', async () => {
      providerAnswer = { courses: [GOOD_COURSE], warnings: [] };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('does not warn about a course whose only component is the external exam', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEMD112',
            name: 'Set Theory and Logic',
            type: 'BSC',
            semester: 1,
            lectureHours: 3,
            ca: 60,
            mse: null,
            ese: 40,
            credits: 3,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('values the system does not recognise', () => {
    it('records a course type the system does not know as absent, not as a guess', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEMD112',
            name: 'Set Theory and Logic',
            type: 'SOME_NEW_TYPE',
            semester: 1,
            lectureHours: 3,
            ca: 20,
            mse: 20,
            ese: 60,
            credits: 3,
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses[0].courseType).toBeNull();
    });

    it('reads a number the model wrote as text', async () => {
      providerAnswer = {
        courses: [
          course({
            code: 'COEMD112',
            name: 'Set Theory and Logic',
            type: 'BSC',
            semester: '1',
            lectureHours: '3',
            ca: '20',
            mse: '20',
            ese: '60',
            credits: '3',
          }),
        ],
        warnings: [],
      };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses[0].semester).toBe(1);
      expect(result.courses[0].ca).toBe(20);
      expect(result.courses[0].credits).toBe(3);
    });
  });

  describe('a page with no text', () => {
    it('warns the user instead of passing over the page in silence', async () => {
      const result = await buildReader([{ pageNumber: 4, text: '   ' }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.courses).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('error');
      expect(result.warnings[0].message).toContain('scan');
    });
  });

  describe('an answer the system cannot read', () => {
    it('refuses an answer that is not JSON', async () => {
      global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { model: string };
        const answer = body.model.includes('prompt-guard')
          ? '0.0004'
          : 'I could not read that document.';

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ model: body.model, choices: [{ message: { content: answer } }] }),
        };
      }) as unknown as typeof fetch;

      await expect(
        buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(Buffer.from('%PDF-1.7 test'))
      ).rejects.toBeInstanceOf(AiError);
    });
  });

  describe('the guard', () => {
    it('refuses to read a document the guard refused', async () => {
      /**
       * The guard scores the page as unsafe.
       */
      guardScore = '0.999';

      await expect(
        buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(Buffer.from('%PDF-1.7 test'))
      ).rejects.toMatchObject({ kind: AiErrorKind.MalformedResponse });
    });

    it('reads a document the guard passed', async () => {
      providerAnswer = { courses: [GOOD_COURSE], warnings: [] };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.guard.isSafe).toBe(true);
      expect(result.courses).toHaveLength(1);
    });

    it('tells the reviewer when a page could not be checked', async () => {
      /**
       * The guard cannot be reached for the page, so the page was never
       * defended. The reviewer is told, because "unchecked" and "safe" are
       * not the same thing.
       */
      global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { model: string };

        if (body.model.includes('prompt-guard')) {
          throw new TypeError('fetch failed');
        }

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              model: body.model,
              choices: [{ message: { content: JSON.stringify(providerAnswer) } }],
            }),
        };
      }) as unknown as typeof fetch;

      providerAnswer = { courses: [GOOD_COURSE], warnings: [] };

      const result = await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(result.guard.uncheckedPages).toEqual([2]);
      expect(
        result.warnings.some((warning) => warning.message.includes('could not be checked'))
      ).toBe(true);
    });
  });

  describe("the provider's output budget", () => {
    it('caps the answer so the provider is never asked for more than it will give', async () => {
      /**
       * The provider refuses a request whose expected output is over its
       * per-minute limit, so the answer is capped.
       */
      const calls: Array<{ body: Record<string, unknown> }> = [];

      global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { model: string; max_completion_tokens?: number };
        calls.push({ body: body as unknown as Record<string, unknown> });

        const answer = body.model.includes('prompt-guard')
          ? '0.0004'
          : JSON.stringify(providerAnswer);

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ model: body.model, choices: [{ message: { content: answer } }] }),
        };
      }) as unknown as typeof fetch;

      await buildReader([{ pageNumber: 2, text: PAGE_TEXT }]).read(Buffer.from('%PDF-1.7 test'));

      const readerCall = calls.find((call) => !String(call.body.model).includes('prompt-guard'));

      expect(readerCall).toBeDefined();
      expect(readerCall?.body.max_completion_tokens).toBe(450);
    });

    it('reads a page with more rows than one answer holds in pieces', async () => {
      /**
       * A page with more text than one answer can carry is read in pieces,
       * and every piece is asked for. The courses from all of them are
       * kept — a piece that was not read would be a course that quietly
       * went missing.
       *
       * The page stays inside what the guard will check, because a page
       * the guard refuses never reaches the reader at all.
       */
      const rowCount = 150;
      const rows = Array.from(
        { length: rowCount },
        (_, index) => `COEMD${index} | Course number ${index} | BSC | 3 | - | 20 | 20 | 60 | 3`
      ).join('\n');

      const seenTexts: string[] = [];

      global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as {
          model: string;
          messages: Array<{ content: string }>;
        };
        const content = body.messages[body.messages.length - 1]?.content ?? '';

        if (body.model.includes('prompt-guard')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ model: body.model, choices: [{ message: { content: '0.0004' } }] }),
          };
        }

        seenTexts.push(content);

        /**
         * The fake answers with one course per row it was given, so the
         * test can check that every row was sent.
         */
        const codes = [...content.matchAll(/COEMD(\d+)/g)].map((match) => `COEMD${match[1]}`);

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              model: body.model,
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      courses: codes.map((code) =>
                        course({
                          code,
                          name: 'A course',
                          type: 'BSC',
                          semester: 1,
                          lectureHours: 3,
                          ca: 20,
                          mse: 20,
                          ese: 60,
                          credits: 3,
                        })
                      ),
                      warnings: [],
                    }),
                  },
                },
              ],
            }),
        };
      }) as unknown as typeof fetch;

      const result = await buildReader([{ pageNumber: 1, text: rows }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      /**
       * More than one call was made, because the page was too big for one.
       */
      expect(seenTexts.length).toBeGreaterThan(1);

      /**
       * Every row reached the reader. None was dropped on the way.
       */
      const readCodes = new Set(result.courses.map((course) => course.courseCode));
      expect(readCodes.size).toBe(rowCount);
      expect(readCodes.has('COEMD0')).toBe(true);
      expect(readCodes.has(`COEMD${rowCount - 1}`)).toBe(true);
    });

    it('repeats the column header on every piece of a page', async () => {
      const header = 'Course Code | Type | Name | L | P | CA | MSE | ESE | Credit';
      const rows = Array.from(
        { length: 150 },
        (_, index) => `COEMD${index} | Course number ${index} | BSC | 3 | - | 20 | 20 | 60 | 3`
      ).join('\n');

      const seenTexts: string[] = [];

      global.fetch = jest.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as {
          model: string;
          messages: Array<{ content: string }>;
        };
        const content = body.messages[body.messages.length - 1]?.content ?? '';

        if (body.model.includes('prompt-guard')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ model: body.model, choices: [{ message: { content: '0.0004' } }] }),
          };
        }

        seenTexts.push(content);

        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              model: body.model,
              choices: [{ message: { content: JSON.stringify({ courses: [], warnings: [] }) } }],
            }),
        };
      }) as unknown as typeof fetch;

      await buildReader([{ pageNumber: 1, text: `${header}\n${rows}` }]).read(
        Buffer.from('%PDF-1.7 test')
      );

      expect(seenTexts.length).toBeGreaterThan(1);

      for (const text of seenTexts) {
        expect(text).toContain('Course Code | Type | Name');
      }
    });
  });
});
