/**
 * The course list, read out of a syllabus PDF.
 *
 * A DBATU syllabus opens with two pages that list every course in the
 * programme: its code, its name, its type, its weekly hours, how its marks
 * are split and how many credits it carries.
 *
 * ```
 * COEMD112 | Set Theory and Logic | 3 | - | 20 | 20 | 60 | 3
 * ```
 *
 * Reading that table from flattened text is unreliable — the columns run
 * together and a `-` (no practical) is indistinguishable from a value that
 * drifted into the next cell. So it is read from the *positions* of the
 * text, using the same positional layer the scheme extraction uses.
 *
 * The result is a course list that is exact rather than approximate, which
 * matters: this data ends up in the marks calculator, and a mark read from
 * the wrong column is a wrong mark.
 */

import { extractPdfLayout } from './pdf-table-extractor';
import type { PdfPageLayout, PdfTextLine } from './pdf-table-extractor';
import { readSchemeFromPage } from './scheme-extractor';
import type { CourseScheme } from './scheme-extractor';

/**
 * One course as the syllabus lists it.
 */
export interface SyllabusCourse {
  /** The course code — `COEMD112`. */
  courseCode: string;
  /** The course name — `Set Theory and Logic`. */
  courseName: string;
  /** The course type — `BSC`, `ESC`, `PCC`, `VSEC`, `AEC`, `CC`, `IKS`. */
  courseType?: string;
  /**
   * The semester the course is taught in.
   *
   * A syllabus prints one table per semester, and the semester is named in
   * the heading above the table — `Second Semester`, `Third Semester`. The
   * number is what the system needs; a course with no semester on its table
   * is a course the syllabus did not place, and that is `null` rather than
   * a guess.
   */
  semester: number | null;
  /** The weekly hours of the theory part. */
  theoryHours: number | null;
  /** The weekly hours of the practical part. */
  practicalHours: number | null;
  /** The marks the continuous assessment carries. */
  ca: number | null;
  /** The marks the mid-semester examination carries. */
  mse: number | null;
  /** The marks the end-semester examination carries. */
  ese: number | null;
  /** The credit count. */
  credits: number | null;
}

/**
 * The course types a DBATU syllabus uses.
 *
 * The list is closed because a course type that is not in it is not a type
 * — it is a stray cell that landed in the column.
 */
const COURSE_TYPES = ['BSC', 'ESC', 'PCC', 'VSEC', 'AEC', 'CC', 'IKS', 'MDC', 'MIC'] as const;

/**
 * The x at which the type column starts.
 *
 * The course table's first two columns are the code and the name; the type
 * follows the name. The name is the widest column, so the type is found by
 * looking for a known type token among the cells rather than by a fixed
 * position.
 */
const CODE_PATTERN = /^CO[A-Z]*\d[A-Z0-9]*$/;

/**
 * The x at which each column of the course table starts.
 *
 * These are the column rules of a printed DBATU course table, and they are
 * the same on every semester page of every syllabus:
 *
 * ```
 *   x= 54  Course Code
 *   x=140  Type of Course
 *   x=185  Course Name
 *   x=356  Weekly hours — L (lecture)
 *   x=382  Weekly hours — P (practical)
 *   x=404  Examination — CA
 *   x=430  Examination — MSE
 *   x=470  Examination — ESE
 *   x=515  Credit
 * ```
 *
 * The boundaries are read from the *header* row of the table rather than
 * hard-coded, because a syllabus may shift the table a few points. The
 * header row is the one that names `Course Code`.
 */
interface ColumnRules {
  /** The x at which each column's content starts, left to right. */
  starts: number[];
  /** The name of each column, left to right. */
  names: string[];
  /**
   * The y below which the table's body starts.
   *
   * Everything above this is the table's header, the page's headings and
   * the document's front matter — none of it is a course row.
   */
  headerBottomY: number;
}

/**
 * The header row of a course table.
 *
 * The table's header is split over two printed lines — `Weekly` over
 * `Hours` over `L`/`P`, and `Examination` over `Scheme` over
 * `CA`/`MSE`/`ESE` — so the header is recognised by the one label that is
 * never split: `Course Code`.
 */
function findHeaderLine(page: PdfPageLayout): PdfTextLine | null {
  return (
    page.lines.find((line) =>
      line.items.some((item) => item.text.trim().toLowerCase() === 'course code')
    ) ?? null
  );
}

/**
 * Reads the column rules off a table's header.
 *
 * The sub-labels `L`, `P`, `CA`, `MSE` and `ESE` sit on the line *below* the
 * header, so they are collected too — they are what distinguishes the two
 * weekly-hour columns and the three examination columns.
 */
function readColumnRules(page: PdfPageLayout): ColumnRules | null {
  const header = findHeaderLine(page);
  if (!header) return null;

  /**
   * The header line carries the column groups; the line below it carries the
   * sub-labels that name the individual numeric columns.
   */
  const headerIndex = page.lines.indexOf(header);
  const subLabels = new Map<string, number>();

  /**
   * The lowest y of the header block. Everything below it is the table's
   * body.
   */
  let headerBottomY = header.y;

  for (const line of page.lines.slice(headerIndex + 1, headerIndex + 3)) {
    headerBottomY = Math.min(headerBottomY, line.y);
    for (const item of line.items) {
      const text = item.text.trim();
      if (['L', 'P', 'CA', 'MSE', 'ESE'].includes(text)) {
        /**
         * The first occurrence wins — a label belongs to the column it is
         * printed in, and a second table on the page repeats them.
         */
        if (!subLabels.has(text)) subLabels.set(text, item.x);
      }
    }
  }

  /**
   * The columns are the union of the header's own labels and the
   * sub-labels, sorted left to right.
   */
  const columns: Array<{ name: string; x: number }> = [];

  for (const item of header.items) {
    const text = item.text.trim();
    if (text === 'Course Code') {
      columns.push({ name: 'courseCode', x: item.x });
    } else if (/^Type$/i.test(text) || /^of$/i.test(text) || /^Course$/i.test(text)) {
      /**
       * The type column's header is split over three lines — `Type` / `of` /
       * `Course`. It is the column between the code and the name.
       */
      if (!columns.some((column) => column.name === 'courseType')) {
        columns.push({ name: 'courseType', x: item.x });
      }
    } else if (/^Course Name$/i.test(text)) {
      columns.push({ name: 'courseName', x: item.x });
    } else if (/^Credit$/i.test(text)) {
      columns.push({ name: 'credits', x: item.x });
    }
  }

  /**
   * The type column's x is taken from the *leftmost* of its three header
   * runs, because the runs are centred on the column and the leftmost one
   * is the widest.
   */
  for (const label of ['L', 'P', 'CA', 'MSE', 'ESE']) {
    const x = subLabels.get(label);
    if (x === undefined) continue;
    const name =
      label === 'L' ? 'theoryHours' : label === 'P' ? 'practicalHours' : label.toLowerCase();
    if (!columns.some((column) => column.name === name)) {
      columns.push({ name, x });
    }
  }

  if (columns.length < 6) return null;

  columns.sort((a, b) => a.x - b.x);

  return {
    starts: columns.map((column) => column.x),
    names: columns.map((column) => column.name),
    headerBottomY,
  };
}

/**
 * Reads a cell as a number, treating a dash as "not present".
 */
function readNumber(text: string | undefined): number | null {
  if (text === undefined) return null;
  const cleaned = text.replace(/[,\s]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '–' || cleaned === '—') return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * A course row, read off a printed table.
 *
 * A row is identified by its course code. Everything else about it is
 * gathered *geometrically*, because the printed table merges cells:
 *
 *  - the **type** column is merged across the rows of a type group, so the
 *    type is printed once, on the line *between* two rows — it belongs to
 *    every row whose vertical span it falls inside;
 *  - the **name** column is merged for a theory course and its laboratory
 *    companion, and a long name wraps onto two printed lines, so the name
 *    can sit above and below the code's line.
 */
interface GeometryRow {
  /** The course code. */
  courseCode: string;
  /** The y of the line the code was printed on. */
  y: number;
  /** The name, as printed. */
  courseName?: string;
  /** The type of the course, if the table printed one. */
  courseType?: string;
  /** The lecture hours per week. */
  theoryHours: number | null;
  /** The practical hours per week. */
  practicalHours: number | null;
  /** The marks the continuous assessment carries. */
  ca: number | null;
  /** The marks the mid-semester examination carries. */
  mse: number | null;
  /** The marks the end-semester examination carries. */
  ese: number | null;
  /** The credit count. */
  credits: number | null;
}

/**
 * The number of points two lines may differ by and still be the same row.
 *
 * A printed row's runs share a baseline to within a point or two; a
 * wrapped name's second line is a full line height below.
 */
const SAME_ROW_TOLERANCE = 5;

/**
 * Reads the rows of one course table off a page.
 *
 * The table is read from the page's *lines* rather than from the
 * reconstructed tables, because a merged cell breaks the reconstruction:
 * a row that has no type and a wrapped name produce a different number of
 * cells from their neighbours, so the reconstruction treats them as
 * different tables.
 */
function readTableRows(page: PdfPageLayout, rules: ColumnRules): GeometryRow[] {
  /**
   * The column each x belongs to. A run belongs to the column whose start
   * is the nearest one to its left.
   */
  const columnOf = (x: number): number => {
    let index = 0;
    for (let i = 0; i < rules.starts.length; i += 1) {
      if (x >= rules.starts[i] - 6) index = i;
    }
    return index;
  };

  const rows: GeometryRow[] = [];

  /**
   * Every line that carries a course code starts a row. The other lines
   * are either the wrapped parts of a row above, or the merged type of a
   * group of rows.
   */
  const bodyLines = page.lines.filter((line) => line.y < rules.headerBottomY);

  for (const line of bodyLines) {
    for (const item of line.items) {
      const text = item.text.trim();
      if (!CODE_PATTERN.test(text)) continue;

      const row: GeometryRow = {
        courseCode: text,
        y: line.y,
        theoryHours: null,
        practicalHours: null,
        ca: null,
        mse: null,
        ese: null,
        credits: null,
      };

      /**
       * The numeric columns are read from this line only — they never wrap.
       */
      for (const cell of line.items) {
        const index = columnOf(cell.x);
        const name = rules.names[index];
        if (name === 'courseType') continue;
        const value = readNumber(cell.text.trim());
        if (value === null) continue;
        if (name === 'theoryHours') row.theoryHours = value;
        else if (name === 'practicalHours') row.practicalHours = value;
        else if (name === 'ca') row.ca = value;
        else if (name === 'mse') row.mse = value;
        else if (name === 'ese') row.ese = value;
        else if (name === 'credits') row.credits = value;
      }

      rows.push(row);
    }
  }

  /**
   * The name and the type are both merged cells, so they are read from the
   * whole body rather than from a single row's line.
   */
  assignMergedCells(bodyLines, rows, rules, columnOf);

  return rows;
}

/**
 * Gives every row its name and its type.
 *
 * Two merges are at work:
 *
 *  - the **name** column is merged for a theory course and its laboratory
 *    companion, so the name is printed once, above the first of the two
 *    rows — and a long name wraps, so it occupies two lines;
 *  - the **type** column is merged across a group of rows, so the type is
 *    printed once, vertically centred on the group — which puts it on a
 *    line *between* two rows rather than on either of them.
 */
function assignMergedCells(
  bodyLines: PdfTextLine[],
  rows: GeometryRow[],
  rules: ColumnRules,
  columnOf: (x: number) => number
): void {
  const nameColumn = rules.names.indexOf('courseName');
  const typeColumn = rules.names.indexOf('courseType');
  if (nameColumn === -1) return;

  /**
   * Every run that belongs to the name column, grouped by the line it is
   * printed on.
   */
  const nameRuns = new Map<number, string[]>();
  const typeRuns = new Map<number, string>();

  for (const line of bodyLines) {
    for (const item of line.items) {
      const index = columnOf(item.x);
      if (index === nameColumn) {
        const text = item.text.trim();
        if (!text) continue;
        const existing = nameRuns.get(line.y);
        if (existing) existing.push(text);
        else nameRuns.set(line.y, [text]);
      } else if (index === typeColumn) {
        const text = item.text.trim();
        /**
         * A type is one of the known acronyms; anything else in the column
         * is not a type.
         */
        if ((COURSE_TYPES as readonly string[]).includes(text)) {
          typeRuns.set(line.y, text);
        }
      }
    }
  }

  /**
   * The names, in reading order, each with the line it is printed on.
   */
  const names = [...nameRuns.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, parts]) => ({ y, text: parts.join(' ') }));

  /**
   * A name belongs to the row whose code is the *first* row at or below
   * the name. A name printed above two rows — the theory course and its
   * laboratory companion — belongs to the first of them, and the second
   * inherits it because its own cell is empty.
   */
  const sortedRows = [...rows].sort((a, b) => b.y - a.y);

  for (const name of names) {
    /**
     * The first row at or below the name.
     */
    const owner = sortedRows.find((row) => row.y <= name.y + SAME_ROW_TOLERANCE);
    if (!owner) continue;

    owner.courseName = name.text;
  }

  /**
   * A wrapped name occupies two lines: the second line is *below* the code
   * it belongs to. The code's own line is at the middle of the pair.
   *
   * `Web Site Development and MS` is printed above COESE126 and `Office`
   * below it, so the name must be assembled from both. The name's owner is
   * found by looking for a row between the two lines.
   */
  reassembleWrappedNames(sortedRows, names);

  /**
   * The type is printed at the vertical centre of the group it covers, so
   * it belongs to every row within the group's span. The span runs from the
   * row above the type to the row below it.
   */
  const typeEntries = [...typeRuns.entries()].sort((a, b) => b[0] - a[0]);

  for (const [typeY, type] of typeEntries) {
    /**
     * The rows the type covers: every row between the previous type and
     * the next one. The previous type's rows come before it, the next
     * type's rows after.
     */
    const covered = sortedRows.filter((row) => {
      /**
       * A row belongs to this type when it is above the *next* type and
       * below the *previous* one.
       */
      const nextType = typeEntries.find(([y]) => y < typeY);
      const previousType = typeEntries.find(([y]) => y > typeY);

      if (nextType && row.y > nextType[0]) return false;
      if (previousType && row.y < previousType[0]) return false;
      return true;
    });

    for (const row of covered) {
      if (!row.courseType) row.courseType = type;
    }
  }
}

/**
 * Joins a name that the table wrapped onto two lines.
 *
 * A name printed over two lines has its first line above the course code
 * and its second line below it. The code sits between the two, so the two
 * lines are joined when a row's code falls between them.
 */
function reassembleWrappedNames(
  sortedRows: GeometryRow[],
  names: Array<{ y: number; text: string }>
): void {
  /**
   * The names that are *above* the row they belong to, keyed by the row
   * they continue.
   */
  for (let i = 0; i < names.length - 1; i += 1) {
    const upper = names[i];
    const lower = names[i + 1];

    /**
     * A row between the two lines is the row whose name wraps: the upper
     * line is the first half of its name and the lower line is the second.
     */
    const between = sortedRows.filter((row) => row.y < upper.y && row.y > lower.y);

    if (between.length === 0) continue;

    for (const row of between) {
      /**
       * The upper half is already the row's name; the lower half is
       * appended to it.
       */
      const current = row.courseName ?? '';
      if (!current.startsWith(upper.text)) continue;
      if (current.endsWith(lower.text)) continue;
      row.courseName = `${current} ${lower.text}`.trim();
    }
  }
}

/**
 * The words a semester heading uses.
 *
 * `First`, `Second`, `Third`, … and `I`, `II`, `III`, …
 */
const SEMESTER_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
};

/**
 * Reads the semester a table's heading names.
 *
 * The heading sits above the table's header and is centred on the page. It
 * reads `Second Semester`, `Semester III`, or `III Semester` — all three
 * orders appear across DBATU syllabi.
 *
 * The heading must be the *closest* one above the table, because a syllabus
 * that prints several semesters on one page names each one above its own
 * table.
 */
function readSemester(page: PdfPageLayout, rules: ColumnRules): number | null {
  const candidates = page.lines.filter((line) => line.y > rules.headerBottomY);

  for (const line of candidates) {
    for (const item of line.items) {
      const text = item.text.trim();
      const match = text.match(
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|[IVX]{1,8})\b(?:\s+semester)?/i
      );
      if (!match) continue;

      /**
       * The heading must actually say `semester` — a course called
       * `Third Law of Motion` would otherwise be read as a semester.
       */
      const fullText = line.items.map((run) => run.text).join(' ');
      if (!/semester/i.test(fullText)) continue;

      const word = match[1].toLowerCase();
      const semester = SEMESTER_WORDS[word];
      if (semester !== undefined) return semester;
    }
  }

  return null;
}

/**
 * Reads the course list out of a syllabus PDF's opening pages.
 *
 * The course tables come before the course-detail pages, so the pages are
 * read in order and the rows that name a course are collected.
 */
export async function extractCourseList(buffer: Buffer): Promise<SyllabusCourse[]> {
  const layouts = await extractPdfLayout(buffer);
  const courses: SyllabusCourse[] = [];
  const seen = new Set<string>();

  for (const page of layouts) {
    const rules = readColumnRules(page);
    if (!rules) continue;

    const semester = readSemester(page, rules);
    const rows = readTableRows(page, rules);

    for (const row of rows) {
      if (!row.courseName) continue;
      if (seen.has(row.courseCode)) continue;
      seen.add(row.courseCode);

      courses.push({
        courseCode: row.courseCode,
        courseName: row.courseName,
        courseType: row.courseType,
        semester,
        theoryHours: row.theoryHours,
        practicalHours: row.practicalHours,
        ca: row.ca,
        mse: row.mse,
        ese: row.ese,
        credits: row.credits,
      });
    }
  }

  return courses;
}

/**
 * A syllabus, read in full: its courses and the scheme of each.
 */
export interface ExtractedSyllabus {
  /** Every course the syllabus lists. */
  courses: SyllabusCourse[];
  /** The scheme read off each course-detail page. */
  schemes: CourseScheme[];
}

/**
 * Reads a whole syllabus.
 *
 * The two halves are read independently and then paired by name, because
 * the course table carries the code and the detail pages carry the scheme.
 */
export async function extractSyllabus(buffer: Buffer): Promise<ExtractedSyllabus> {
  const layouts = await extractPdfLayout(buffer);

  const courses: SyllabusCourse[] = [];
  const seen = new Set<string>();
  for (const page of layouts) {
    const rules = readColumnRules(page);
    if (!rules) continue;

    const semester = readSemester(page, rules);
    for (const row of readTableRows(page, rules)) {
      if (!row.courseName || seen.has(row.courseCode)) continue;
      seen.add(row.courseCode);
      courses.push({
        courseCode: row.courseCode,
        courseName: row.courseName,
        courseType: row.courseType,
        semester,
        theoryHours: row.theoryHours,
        practicalHours: row.practicalHours,
        ca: row.ca,
        mse: row.mse,
        ese: row.ese,
        credits: row.credits,
      });
    }
  }

  const schemes: CourseScheme[] = [];
  for (const page of layouts) {
    const scheme = readSchemeFromPage(page);
    if (scheme) schemes.push(scheme);
  }

  return { courses, schemes };
}
