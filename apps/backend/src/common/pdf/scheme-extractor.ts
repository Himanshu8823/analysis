/**
 * The examination scheme, read out of a syllabus PDF.
 *
 * A DBATU syllabus is half prose and half tables, and the part that matters
 * to this system is the **examination scheme** — the grid that says how a
 * subject's 100 marks are split:
 *
 * ```
 * TH  3   CA  20
 * PR  -   MSE 20
 * CR  3   ESE 60
 * ```
 *
 * Reading that grid from flattened text is guesswork: `CA 20` and `MSE 20`
 * and `ESE 60` run together, and a missing value (`MSE -`) is
 * indistinguishable from a value that spilled into the next column. So the
 * grid is read from the *positions* of the text, which is what
 * {@link extractPdfLayout} provides.
 *
 * The structure the extraction relies on, which is the same on every course
 * page of a DBATU syllabus:
 *
 *  - the left block at x≈59 carries the row marker (`TH`, `PR`, `CR`) and
 *    the weekly hours or the credit count;
 *  - the right block at x≈470 carries the assessment component (`CA`,
 *    `MSE`, `ESE`) and the marks it carries;
 *  - the three blocks are stacked, so a row's marker and its component sit
 *    on the same printed line.
 *
 * Nothing here sends the PDF anywhere. The file is read locally and the
 * scheme is derived from the text that is already in it.
 */

import { extractPdfLayout, lineToCells } from './pdf-table-extractor';
import type { PdfPageLayout, PdfTextLine } from './pdf-table-extractor';

/**
 * The assessment components a syllabus names.
 *
 * `CA` — Continuous Assessment (the internal marks).
 * `MSE` — Mid-Semester Examination.
 * `ESE` — End-Semester Examination.
 */
export const SCHEME_COMPONENTS = ['CA', 'MSE', 'ESE'] as const;

export type SchemeComponent = (typeof SCHEME_COMPONENTS)[number];

/**
 * The row markers of the left-hand block.
 *
 * `TH` — the theory row.
 * `PR` — the practical row.
 * `CR` — the credit row.
 */
export const SCHEME_ROW_MARKERS = ['TH', 'PR', 'CR'] as const;

export type SchemeRowMarker = (typeof SCHEME_ROW_MARKERS)[number];

/**
 * One course's examination scheme.
 */
export interface CourseScheme {
  /** The course code, when the page names one. */
  courseCode?: string;
  /** The course name, when the page names one. */
  courseName?: string;
  /** The marks each assessment component carries. */
  components: Record<string, number>;
  /**
   * The weekly hours of the theory row.
   *
   * `null` means the syllabus printed a dash — the course has no theory
   * component, which is the case for every practical-only course.
   */
  theoryHours: number | null;
  /** The weekly hours of the practical row. */
  practicalHours: number | null;
  /** The credit count of the credit row. */
  credits: number | null;
  /** The page the scheme was read from. */
  pageNumber: number;
}

/**
 * The leftmost x that still counts as the left block of the grid.
 *
 * The left block always starts at the page's left margin, so anything
 * further left than this is not part of it.
 */
const LEFT_BLOCK_MAX_X = 140;

/**
 * The x at or beyond which the right-hand block begins.
 *
 * The assessment components sit in the right-hand column of the page, well
 * clear of the course-content prose in the middle.
 */
const RIGHT_BLOCK_MIN_X = 440;

/**
 * Reads a cell as a number.
 *
 * A dash means "this course does not have that component" — it is `null`,
 * not zero. A zero would say the component exists and nobody scored any
 * marks, which is a different and wrong statement.
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
 * The text of a line's runs that fall inside a horizontal band.
 */
function textInBand(line: PdfTextLine, minX: number, maxX: number): string {
  return line.items
    .filter((item) => item.x >= minX && item.x < maxX)
    .map((item) => item.text)
    .join(' ')
    .trim();
}

/**
 * Reads one line of the examination-scheme grid.
 *
 * A grid line carries a row marker on the left and, possibly, a component
 * and its marks on the right. A line that carries neither is prose.
 */
interface GridRow {
  marker: SchemeRowMarker | null;
  leftValue: number | null;
  component: SchemeComponent | null;
  marks: number | null;
}

/**
 * Reads a line as a row of the examination-scheme grid.
 */
function readGridRow(line: PdfTextLine): GridRow | null {
  const leftText = textInBand(line, 0, LEFT_BLOCK_MAX_X);
  const rightText = textInBand(line, RIGHT_BLOCK_MIN_X, Infinity);

  const markerMatch = leftText.match(/\b(TH|PR|CR)\b/);
  const marker = (markerMatch?.[1] as SchemeRowMarker | undefined) ?? null;

  /**
   * The number on the left of the marker is the weekly hours; the number
   * between the marker and the middle of the page is the credit count.
   */
  let leftValue: number | null = null;
  if (marker) {
    const afterMarker = leftText.slice(leftText.indexOf(marker) + marker.length);
    leftValue = readNumber(afterMarker.split(/\s+/).find((part) => readNumber(part) !== null));
  }

  /**
   * The right block reads `CA 60`, `MSE -` or `ESE 40`. The component is
   * whichever of the three names appears; the marks are the number beside
   * it.
   */
  let component: SchemeComponent | null = null;
  for (const candidate of SCHEME_COMPONENTS) {
    if (new RegExp(`\\b${candidate}\\b`).test(rightText)) {
      component = candidate;
      break;
    }
  }

  let marks: number | null = null;
  if (component) {
    const afterComponent = rightText.slice(
      rightText.search(new RegExp(`\\b${component}\\b`)) + component.length
    );
    marks = readNumber(afterComponent.split(/\s+/).find((part) => readNumber(part) !== null));
  }

  /**
   * A line with no marker and no component is prose, not a grid row.
   */
  if (!marker && !component) return null;

  return { marker, leftValue, component, marks };
}

/**
 * The course code and name a page's header names.
 *
 * The header of a course page is a two-row grid:
 *
 * ```
 * Teaching            Semester I          Examination
 * Scheme              <Course Name>       Scheme
 * ```
 *
 * The university name sits above it and is the same on every page, so it is
 * skipped — it names no course.
 */
function readCourseHeading(page: PdfPageLayout): { courseCode?: string; courseName?: string } {
  const headerLines = page.lines.filter((line) => line.y > 700);

  /**
   * The university name is printed on every page and would otherwise be
   * picked up as the course name.
   */
  const UNIVERSITY_LINE = /Technological University/i;

  let courseName: string | undefined;
  let courseCode: string | undefined;

  for (const line of headerLines) {
    const cells = lineToCells(line);
    if (cells.length === 0) continue;
    if (cells.every((cell) => UNIVERSITY_LINE.test(cell))) continue;

    for (const cell of cells) {
      if (UNIVERSITY_LINE.test(cell)) continue;

      /**
       * A course code is a run of letters followed by digits — `COEMD111`,
       * `COESE126`, `COE1X1`. It is never a plain word, so the shape is what
       * distinguishes it.
       */
      const codeMatch = cell.match(/^(CO[A-Z0-9]*\d[A-Z0-9]*)$/);
      if (codeMatch && !courseCode) {
        courseCode = codeMatch[1];
        continue;
      }

      /**
       * The course name is the header cell that is neither a label
       * (`Teaching`, `Scheme`, `Semester I`, `Examination`) nor the course
       * code. It is the one that names something rather than describing the
       * grid.
       */
      if (
        !courseName &&
        cell.length > 4 &&
        !/^(Teaching|Examination|Semester|Scheme|Semester\s*I)$/i.test(cell)
      ) {
        courseName = cell;
      }
    }
  }

  return { courseCode, courseName };
}

/**
 * Reads the examination scheme off one page.
 *
 * Returns `null` when the page carries no grid — a contents page, a
 * bibliography, a page of course content.
 */
export function readSchemeFromPage(page: PdfPageLayout): CourseScheme | null {
  const gridLines = page.lines
    .filter((line) => line.y < 740)
    .map((line) => ({ line, row: readGridRow(line) }))
    .filter((entry): entry is { line: PdfTextLine; row: GridRow } => entry.row !== null);

  const rows = gridLines.map((entry) => entry.row);

  /**
   * A scheme page names at least two of the three assessment components.
   * One component on its own is a stray number that happened to sit in the
   * right-hand column.
   */
  const components: SchemeComponent[] = [];
  for (const row of rows) {
    if (row.component && !components.includes(row.component)) components.push(row.component);
  }
  if (components.length < 2) return null;

  const marks: Record<string, number> = {};
  for (const row of rows) {
    if (row.component && row.marks !== null) marks[row.component] = row.marks;
  }

  const markerValue = (marker: SchemeRowMarker): number | null => {
    const row = rows.find((candidate) => candidate.marker === marker);
    return row ? row.leftValue : null;
  };

  const heading = readCourseHeading(page);

  return {
    courseCode: heading.courseCode,
    courseName: heading.courseName,
    components: marks,
    theoryHours: markerValue('TH'),
    practicalHours: markerValue('PR'),
    credits: markerValue('CR'),
    pageNumber: page.pageNumber,
  };
}

/**
 * Reads the examination schemes out of a whole syllabus PDF.
 *
 * The pages are read in order, and the schemes come back in that order, so
 * a caller can pair them with the course list it already has.
 */
export async function extractSchemes(buffer: Buffer): Promise<CourseScheme[]> {
  const layouts = await extractPdfLayout(buffer);
  const schemes: CourseScheme[] = [];

  for (const page of layouts) {
    const scheme = readSchemeFromPage(page);
    if (scheme) schemes.push(scheme);
  }

  return schemes;
}
