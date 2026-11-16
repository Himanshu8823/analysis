/**
 * Turning a PDF into text a model can read.
 *
 * A scheme PDF is a document with a text layer — the university publishes
 * it that way, and the exam cell downloads it from the official site. So
 * the text is read out of the file locally and sent as text.
 *
 * The text is put back into reading order — top to bottom, and left to
 * right within a line — because the order a PDF stores its runs in is not
 * the order a person reads them in. The runs are also kept apart by the
 * gaps between them, so a table row arrives as a row of cells rather than
 * as a run-together sentence.
 *
 * What this module never does is send the original PDF to a model. The
 * model receives text, which is what it reads best and what costs least.
 */

import { Logger } from '@nestjs/common';

/**
 * The logger for this module.
 */
const logger = new Logger('DocumentRenderer');

/**
 * One page, ready to be read.
 */
export interface RenderedPage {
  /** The page number, 1-based. */
  pageNumber: number;
  /** The page's text, in reading order. */
  text: string;
  /** The width of the page in points. */
  width: number;
  /** The height of the page in points. */
  height: number;
}

/**
 * How close two runs must be, vertically, to count as the same line.
 *
 * A printed line's runs share a baseline to within a point or two. A
 * superscript or a bold run sits a fraction higher.
 */
const LINE_TOLERANCE = 4;

/**
 * The smallest gap, in points, that separates two columns.
 *
 * A printed table's gutter is a few points wide. Anything smaller than
 * this is a word space inside a cell, not a column boundary.
 */
const MIN_COLUMN_GAP = 8;

/**
 * How close two runs must be, horizontally, to count as the same column.
 *
 * A table's cells are aligned to a column, and a cell's own text may sit a
 * little left or right of that alignment — a centred number sits differently
 * from a left-aligned code. This is the width of the band around a column
 * in which a run is still considered to belong to it.
 */
const COLUMN_TOLERANCE = 12;

/**
 * How far apart two runs may be vertically and still be one table row.
 *
 * A cell's contents are vertically *centred* in its row, so a row whose
 * course name wraps onto two lines has its name's two lines above and
 * below the line of numbers beside it, and the row's type label — printed
 * once, centred across the group of rows it covers — sits further still.
 *
 * The measurement comes from the document itself. In the university's
 * First-Year scheme, one row's four lines sit at 628.3, 621.4, 614.5 and
 * 609.6 — a span of 18.7 points — while the next course starts 18.6 points
 * below the last of them. A tolerance of 19 points therefore keeps a row
 * whole and still starts the next row where the page starts it.
 */
const ROW_TOLERANCE = 19;

/**
 * How far apart two course rows may be and still belong to the same table.
 *
 * A table's courses are printed one after another, a row's height apart. A
 * second table on the same page — the exit-requirements table on page
 * three of the scheme — is separated from the first by a heading and a
 * gap of white space, and that gap is much larger than a row.
 *
 * A course row that is this far below the last one starts a new table.
 */
const TABLE_GAP = 120;

/**
 * Loads the PDF reader.
 *
 * The `legacy` build is used because it is the only one that loads from a
 * CommonJS module, and the backend is CommonJS.
 */
function loadPdfjs(): {
  getDocument: (options: Record<string, unknown>) => { promise: Promise<any> };
} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('pdfjs-dist/legacy/build/pdf.js') as never;
}

/**
 * One piece of text on a page, with its position.
 */
interface PositionedRun {
  text: string;
  x: number;
  width: number;
  y: number;
}

/**
 * The x-positions of a page's columns.
 *
 * A printed table aligns its cells to columns, and the columns are found
 * from where the text actually sits — not from a list of names. The
 * document says what its columns *mean*; the geometry says where they
 * *are*, and the geometry is the same for every scheme the college reads.
 *
 * The columns are found from the *gaps* between the runs. A table's cells
 * are separated by the gutter of the table, so where one run ends and the
 * next begins there is a space that nothing occupies. A paragraph of text
 * has no such space: its words follow each other.
 *
 * The gap must be a *column* gutter rather than a word space, and the two
 * are told apart by how far the runs are apart. A word space is a few
 * points; a table's gutter is tens of points.
 *
 * A page with no table at all — a cover page, a note — has no columns,
 * and is read as ordinary running text.
 */
function findColumns(runs: PositionedRun[]): number[] {
  /**
   * The runs in the order they are printed, left to right.
   */
  const sorted = [...runs].sort((a, b) => a.x - b.x);

  const columns: number[] = [];

  /**
   * The first run is the start of the first column, always.
   */
  if (sorted.length > 0) columns.push(sorted[0].x);

  for (let index = 1; index < sorted.length; index += 1) {
    const run = sorted[index];
    const previous = sorted[index - 1];

    /**
     * Two runs at the same place are the same cell continuing — the
     * second line of a wrapped course name, say — and not a new column.
     */
    if (run.x - previous.x <= COLUMN_TOLERANCE) continue;

    /**
     * A run that starts well after the one before it ends begins a new
     * column.
     */
    if (run.x - (previous.x + previous.width) > MIN_COLUMN_GAP) {
      columns.push(run.x);
    }
  }

  return columns;
}

/**
 * The cells of one table row.
 *
 * The cells are placed by the *page's* columns, so that every row of the
 * table lines up with every other one. That is what makes an empty column
 * visible: the cell is there, and it is empty, and that is how a reader
 * knows that the value beside it belongs to a later column.
 *
 * @param rowRuns The row's runs, in reading order.
 * @param columns The page's columns.
 */
function cellsOfRow(rowRuns: PositionedRun[], columns: number[]): string[][] {
  /**
   * A row with no runs has no cells.
   */
  if (rowRuns.length === 0) return [];

  if (columns.length === 0) {
    /**
     * The page has no columns — this is running text, and it is read in
     * reading order as one cell.
     */
    return [rowRuns.map((run) => run.text)];
  }

  const cells: string[][] = columns.map(() => []);
  const loose: string[] = [];

  for (const run of rowRuns) {
    const column = columns.findIndex((c) => Math.abs(run.x - c) <= COLUMN_TOLERANCE);

    if (column === -1) {
      /**
       * A run that belongs to no column. On a row that is a table row,
       * this is a caption or a note printed over the table, and it goes in
       * the last cell so that it is read but does not stand between two
       * real cells.
       */
      loose.push(run.text);
      continue;
    }

    cells[column].push(run.text);
  }

  if (loose.length > 0) {
    cells[cells.length - 1].push(...loose);
  }

  return cells;
}

/**
 * The text of a page, in reading order, with its table rows rebuilt.
 *
 * A table row comes out as `cell | cell | cell` — the gaps between the
 * cells become pipes, so the row keeps its shape and the model can see
 * where one column ended and the next began. That is the whole reason the
 * positions are read at all.
 *
 * The rows are rebuilt by *column*, not by line of text. This matters more
 * than it sounds. A printed scheme table does not put every cell of a row
 * on the same baseline: a cell's contents are vertically centred in the
 * row, so the two lines of a wrapped course name sit above and below the
 * line of numbers beside it, and the row's type label — printed once and
 * centred across the group of rows it covers — sits further still.
 *
 * Grouping by line of text therefore shatters one course across four or
 * five lines, and the model is asked to read a row that is not there. What
 * the model is given instead is the row as the page *prints* it:
 *
 * ```
 * COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 | - | 40 | 2
 * ```
 *
 * So the page is read as a grid. The columns are found from where the
 * text actually sits, and every run is placed in a column and a row, and
 * a cell that spans two lines is joined back into one.
 *
 * It is exported for the tests, which build the runs by hand rather than
 * parsing a PDF.
 */
export function pageText(
  items: Array<{ str?: string; transform: number[]; width?: number }>
): string {
  const runs: PositionedRun[] = items
    .filter((item) => typeof item.str === 'string' && item.str.trim().length > 0)
    .map((item) => ({
      text: item.str as string,
      x: item.transform[4],
      width: item.width ?? 0,
      y: item.transform[5],
    }));

  if (runs.length === 0) return '';

  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);

  /**
   * The lines, each with the runs on it.
   */
  const lines: Array<{ y: number; runs: PositionedRun[] }> = [];

  for (const run of sorted) {
    const last = lines[lines.length - 1];
    /**
     * The comparison is against the *first* run of the line, so a line
     * does not drift as runs accumulate.
     */
    if (last && Math.abs(run.y - last.y) <= LINE_TOLERANCE) {
      last.runs.push(run);
      continue;
    }
    lines.push({ y: run.y, runs: [run] });
  }

  /**
   * The rows, built from the lines.
   *
   * A line joins the row above it when the two are close enough vertically
   * to be the same printed row. This is what pulls the second line of a
   * wrapped name into the row it belongs to.
   */
  const rows: Array<{ y: number; lines: Array<{ y: number; runs: PositionedRun[] }> }> = [];

  for (const line of lines) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(line.y - last.y) <= ROW_TOLERANCE) {
      last.lines.push(line);
      continue;
    }
    rows.push({ y: line.y, lines: [line] });
  }

  /**
   * The rows, with their runs.
   */
  const rowRuns = rows.map((row) =>
    row.lines.flatMap((line) => line.runs).sort((a, b) => a.x - b.x)
  );

  /**
   * The page's columns, found from the table's *data* rows.
   *
   * This is the heart of the whole module, so it is worth being exact
   * about what it is for and what it is not.
   *
   * The columns are found from the rows that carry a course code, and
   * from those rows *only*. The header of the table is not used, because
   * the header has a geometry of its own — "Weekly Hours" spans the two
   * columns the hours go in, and "Examination" spans three of them — and
   * mixing the header's positions with the data rows' positions produces
   * columns that belong to neither.
   *
   * The columns are found from the data rows because those rows agree
   * with each other: they all put their code in the first column, their
   * name in the third, and their marks in the sixth, seventh and eighth.
   * A column that is empty in one row is still a column, and the other
   * rows say where it is.
   *
   * This is what lets a row keep the *shape* of the table. A course with
   * no Mid-Semester Examination has nothing printed in that column, and
   * without the shared columns the row would come out as
   *
   *   COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 | 40 | 2
   *
   * — seven values for a nine-column table, with no way for anyone reading
   * it to know that the 40 is the end-semester mark and not the
   * mid-semester one. With the shared columns the row comes out as
   *
   *   COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 | | 40 | 2
   *
   * — nine values, the empty one showing where the missing mark belongs.
   */
  const tableRows = rowRuns.filter((runs) => isCourseRow(runs));
  const columns = findColumns(tableRows.length > 0 ? tableRows.flat() : sorted);

  /**
   * The rows that belong to the table.
   *
   * A row is a table row when it begins with a course code, and the rows
   * that follow it until the table ends are table rows too — the totals
   * row, the last line of a wrapped course name, the heading of the next
   * table. Those rows are read in the table's columns, so that they line
   * up with the courses above them.
   *
   * A row that is not in the table — the university's name at the top of
   * the page, a note under the table — is read as ordinary text. Putting
   * a heading into the table's columns would fill it with empty cells and
   * make it harder to read, not easier.
   */
  const tableRowIndexes = findTableRows(rowRuns);

  return rows
    .map((row, index) => {
      /**
       * A row that is not part of the table is read as ordinary text, in
       * reading order, with no pipes in it.
       */
      if (!tableRowIndexes.has(index)) {
        return rowRuns[index]
          .map((run) => run.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      /**
       * The cells of the row.
       *
       * The cells are placed by the page's columns, so that a row and its
       * neighbours line up and an empty column shows as an empty cell.
       */
      const cells = cellsOfRow(rowRuns[index], columns);

      /**
       * The row is written as its cells, separated by pipes.
       *
       * An empty cell is written as an empty space between two pipes, and
       * that is deliberate: the empty space *is* the information. It says
       * that the table has a column here and that this course has nothing
       * in it, which is what lets a reader know that the number beside it
       * belongs to the column after, not the one before.
       */
      return cells
        .map((cell) => cell.join(' ').replace(/\s+/g, ' ').trim())
        .join(' | ')
        .replace(/^\s*\|\s*/, '')
        .replace(/\s*\|\s*$/, '')
        .trim();
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * The rows that belong to the table.
 *
 * A table begins at a course row and runs until the page stops being about
 * that table. The rows between the courses — a wrapped name, the totals
 * row, the heading of the next table — belong to it.
 *
 * @param rowRuns Every row of the page, with its runs.
 * @returns The indexes of the rows that are in the table.
 */
function findTableRows(rowRuns: PositionedRun[][]): Set<number> {
  const inTable = new Set<number>();

  /**
   * The row the table starts on, and the row its last course is on.
   */
  let start = -1;
  let end = -1;

  /**
   * The rows of a table that has been closed.
   */
  const closeTable = (): void => {
    const last = findLastRow(rowRuns, start, end);

    for (let index = start; index <= last; index += 1) inTable.add(index);
  };

  for (let index = 0; index < rowRuns.length; index += 1) {
    if (!isCourseRow(rowRuns[index])) continue;

    /**
     * The first course row is where the table starts. A later one is a
     * new table — the exit-requirements table on page three — and it
     * starts its own block.
     */
    if (start === -1) {
      start = index;
      end = index;
      continue;
    }

    /**
     * A course row that is far below the last one is a new table. The
     * gap between the courses of one table is a few lines; the gap
     * between two tables is a heading and a gap of white space.
     */
    const gap = rowRuns[end][0].y - rowRuns[index][0].y;

    /**
     * The table is also finished when it has had its totals row. A
     * table's totals row comes after its last course, and the next
     * course on the page belongs to a new table — the exit-requirements
     * table on page three of the scheme, which sits below the totals of
     * the first table and only a little lower than it.
     */
    const totals = findLastRow(rowRuns, start, end);
    const hasTotals = totals > end;

    if (gap > TABLE_GAP || hasTotals) {
      closeTable();

      start = index;
      end = index;
      continue;
    }

    end = index;
  }

  if (start === -1) return inTable;

  closeTable();

  return inTable;
}

/**
 * The last row of the table whose last course is at `end`.
 *
 * It is the totals row if the table has one, and the last course row
 * otherwise.
 */
function findLastRow(rowRuns: PositionedRun[][], start: number, end: number): number {
  /**
   * The rows below the last course are the table's own rows — the totals
   * row — and then the heading of whatever comes next.
   */
  const limit = Math.min(rowRuns.length, end + 4);

  for (let index = end; index < limit; index += 1) {
    const text = rowRuns[index]
      .map((run) => run.text)
      .join(' ')
      .trim();

    /**
     * The totals row ends the table.
     */
    if (/^total\b/i.test(text)) return index;

    /**
     * A heading that names another table ends this one. The heading
     * itself is not part of the table — it is a heading — so the table
     * ends at the row before it.
     */
    if (/exit requirement/i.test(text)) return index - 1;
  }

  return end;
}

/**
 * Whether a row of runs is a course row.
 *
 * A course row carries a course code. The code is in the table's first
 * column, and so it is the leftmost thing on the row — but the *first run*
 * of the row is not necessarily the code, because a course name that wraps
 * onto two lines has its first line printed above the code's line, and
 * reading order puts that line first.
 *
 * So the code is found by looking for it and then checking that nothing
 * is to the left of it. A word that happens to look like a code in the
 * middle of a course's name is not the row's code.
 */
function isCourseRow(runs: PositionedRun[]): boolean {
  if (runs.length === 0) return false;

  /**
   * The leftmost run that looks like a course code.
   */
  const code = runs.find((run) => /^\s*COE[A-Z]*\d/i.test(run.text));

  if (!code) return false;

  /**
   * Nothing is to the left of it, so it is in the first column.
   */
  return !runs.some((run) => run.x < code.x - COLUMN_TOLERANCE);
}

/**
 * Reads the pages of a PDF.
 *
 * A page with no text is reported as empty rather than passed over in
 * silence — the caller can then say so to the user, who can be told to
 * upload the PDF version of the document rather than a scan of it.
 */
export async function readPdfText(
  buffer: Buffer,
  options: { fromPage?: number; toPage?: number } = {}
): Promise<RenderedPage[]> {
  const pdfjs = loadPdfjs();

  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const fromPage = Math.max(1, options.fromPage ?? 1);
  const toPage = Math.min(document.numPages, options.toPage ?? document.numPages);

  const pages: RenderedPage[] = [];

  for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const text = pageText(
      content.items as Array<{ str?: string; transform: number[]; width?: number }>
    );

    if (text.length === 0) {
      logger.warn(`Page ${pageNumber} has no readable text.`);
    }

    pages.push({
      pageNumber,
      text,
      width: viewport.width,
      height: viewport.height,
    });

    page.cleanup();
  }

  await document.destroy();

  return pages;
}
