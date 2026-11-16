/**
 * Positional PDF text extraction.
 *
 * `pdf-parse` returns a page as one flat string, which throws away the only
 * thing that makes a table a table: where each piece of text sits. A scheme
 * document is half prose and half tables, and the tables carry the facts that
 * matter — `CA 60 | PR 2 | MSE - | CR 2 | ESE 40` means something entirely
 * different when `40` drifts into the next column.
 *
 * This module reads the text runs out of a PDF *with their positions*, and
 * rebuilds the tables from those positions. Nothing is sent to an external
 * service: the PDF is read locally, and only the reconstructed text is
 * eligible to be sent anywhere afterwards.
 *
 * The reconstruction is deliberately conservative. When the geometry is
 * ambiguous, the text is kept as a line rather than being forced into a cell
 * — a wrong cell is a wrong mark, and a line is at least readable.
 */

/**
 * One piece of text on a page, with its position.
 */
export interface PositionedText {
  /** The text itself. */
  text: string;
  /** The distance of the text's left edge from the left of the page. */
  x: number;
  /** The distance of the text's baseline from the bottom of the page. */
  y: number;
  /** The width of the text. */
  width: number;
  /** The height of the text. */
  height: number;
}

/**
 * One row of a reconstructed table.
 */
export type PdfTableRow = string[];

/**
 * One reconstructed table.
 */
export interface PdfTable {
  /** The rows of the table, top to bottom. */
  rows: PdfTableRow[];
  /** The x position each column starts at. */
  columnBoundaries: number[];
}

/**
 * A page's text, laid out.
 */
export interface PdfPageText {
  /** The page number, 1-based. */
  pageNumber: number;
  /** The width of the page in points. */
  width: number;
  /** The height of the page in points. */
  height: number;
  /** Every text run on the page, in the order the PDF gives them. */
  items: PositionedText[];
}

/**
 * The lines a page's text falls into, top to bottom.
 */
export interface PdfTextLine {
  /** The vertical centre of the line. */
  y: number;
  /** The runs on the line, left to right. */
  items: PositionedText[];
}

/**
 * How close two runs must be, vertically, to count as the same line.
 *
 * A PDF line's runs do not share a baseline exactly — a superscript or a
 * bold run sits a fraction higher. The tolerance is generous enough to join
 * them and tight enough not to merge two printed lines.
 */
const LINE_TOLERANCE = 4;

/**
 * The smallest gap, in points, that separates two columns.
 *
 * A printed table's gutter is a few points wide. Anything smaller than this
 * is a word space inside a cell, not a column boundary.
 */
const MIN_COLUMN_GAP = 8;

/**
 * Groups a page's text runs into lines.
 *
 * The PDF gives runs in an arbitrary order — a column may be written
 * top-to-bottom before the column to its right is written at all. The lines
 * are therefore rebuilt from the y positions, not from the run order.
 */
export function groupIntoLines(items: PositionedText[]): PdfTextLine[] {
  const usable = items.filter((item) => item.text.trim().length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PdfTextLine[] = [];
  let current: PositionedText[] = [];
  let currentY = sorted[0].y;

  for (const item of sorted) {
    if (current.length === 0) {
      current = [item];
      currentY = item.y;
      continue;
    }

    /**
     * A run joins the current line when it sits within the tolerance of the
     * line's baseline. The comparison is against the *first* run of the
     * line, so a line does not drift as runs accumulate.
     */
    if (Math.abs(item.y - currentY) <= LINE_TOLERANCE) {
      current.push(item);
    } else {
      lines.push({ y: currentY, items: current });
      current = [item];
      currentY = item.y;
    }
  }

  if (current.length > 0) lines.push({ y: currentY, items: current });

  // Within a line, the runs read left to right.
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }

  return lines;
}

/**
 * The text of a line, with the runs joined into one string.
 *
 * A gap wider than {@link MIN_COLUMN_GAP} becomes a separator, because that
 * is a column boundary; a narrower gap is a space inside a cell.
 */
export function lineToText(line: PdfTextLine): string {
  let text = '';
  let previousEnd: number | null = null;

  for (const item of line.items) {
    if (previousEnd !== null) {
      const gap = item.x - previousEnd;
      if (gap > MIN_COLUMN_GAP) text += '  ';
      else if (gap > 0 && !text.endsWith(' ') && !item.text.startsWith(' ')) text += ' ';
    }
    text += item.text;
    previousEnd = item.x + item.width;
  }

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The cells of a line, split at the wide gaps between its runs.
 *
 * This is what turns a printed row into a table row: each cell is one
 * column, and the column order is preserved by the x position.
 */
export function lineToCells(line: PdfTextLine): string[] {
  const cells: string[] = [];
  let cell = '';
  let previousEnd: number | null = null;

  for (const item of line.items) {
    if (previousEnd !== null) {
      const gap = item.x - previousEnd;
      if (gap > MIN_COLUMN_GAP) {
        cells.push(cell.trim());
        cell = '';
      }
    }
    cell += item.text;
    previousEnd = item.x + item.width;
  }

  cells.push(cell.trim());
  return cells.filter((value) => value.length > 0);
}

/**
 * Groups the lines of a page into tables.
 *
 * A table is a run of consecutive lines that share the same column
 * boundaries. Two lines belong to the same table when they use the same
 * *number* of cells and their cells start at the same x positions — that is
 * what a printed table's grid does.
 *
 * Lines that do not fit are returned as prose, so nothing is lost.
 */
export function groupIntoTables(lines: PdfTextLine[]): {
  tables: PdfTable[];
  prose: string[];
} {
  const tables: PdfTable[] = [];
  const prose: string[] = [];

  let run: PdfTextLine[] = [];
  let runSignature: string | null = null;

  const flush = () => {
    if (run.length === 0) return;
    const rows = run.map((line) => lineToCells(line));
    const columnBoundaries = rows[0].map((_, index) => {
      const item = run[0].items[index];
      return item ? item.x : 0;
    });
    tables.push({ rows, columnBoundaries });
    run = [];
    runSignature = null;
  };

  for (const line of lines) {
    const cells = lineToCells(line);

    /**
     * A single-cell line is prose — a heading, a sentence, a caption. It
     * cannot belong to a table, so it ends any run of table lines.
     */
    if (cells.length < 2) {
      flush();
      prose.push(lineToText(line));
      continue;
    }

    /**
     * The signature of a line is where its cells start. Two lines with the
     * same signature are rows of the same table.
     */
    const signature = cells
      .map((_, index) => {
        const item = line.items[index];
        return item ? Math.round(item.x / 4) : -1;
      })
      .join(',');

    if (runSignature === null) {
      runSignature = signature;
      run = [line];
      continue;
    }

    if (signature === runSignature) {
      run.push(line);
      continue;
    }

    /**
     * The run has ended. A run of one line is not a table — it is a line
     * that happened to have two cells — so it goes back to being prose.
     */
    if (run.length === 1) {
      prose.push(lineToText(run[0]));
      run = [];
      runSignature = signature;
      run = [line];
      continue;
    }

    flush();
    runSignature = signature;
    run = [line];
  }

  flush();
  return { tables, prose };
}

/**
 * Reads a PDF into positioned text, page by page.
 *
 * The `pdfjs-dist` legacy build is used because it is the only one that
 * loads from a CommonJS module — the backend is CommonJS, and the ESM-only
 * builds cannot be required from it.
 *
 * The worker is disabled: the text layer does not need one, and running it
 * would spawn a process per page for nothing.
 */
export async function readPdfPages(buffer: Buffer): Promise<PdfPageText[]> {
  /**
   * Loaded lazily, and through `require`, because `pdfjs-dist` pulls in
   * optional native modules that are not needed for text extraction. A
   * missing `canvas` must not stop a PDF from being read.
   */
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js') as {
    getDocument: (options: Record<string, unknown>) => { promise: Promise<any> };
  };

  const data = new Uint8Array(buffer);
  const document = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const pages: PdfPageText[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items: PositionedText[] = content.items
      .filter((item: any) => typeof item.str === 'string')
      .map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width ?? 0,
        height: item.height ?? 0,
      }));

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      items,
    });

    page.cleanup();
  }

  await document.destroy();

  return pages;
}

/**
 * A page's text, both as lines and as reconstructed tables.
 */
export interface PdfPageLayout {
  pageNumber: number;
  lines: PdfTextLine[];
  tables: PdfTable[];
  prose: string[];
}

/**
 * Lays out a page's text.
 */
export function layoutPage(page: PdfPageText): PdfPageLayout {
  const lines = groupIntoLines(page.items);
  const { tables, prose } = groupIntoTables(lines);
  return { pageNumber: page.pageNumber, lines, tables, prose };
}

/**
 * Lays out every page of a PDF.
 */
export async function extractPdfLayout(buffer: Buffer): Promise<PdfPageLayout[]> {
  const pages = await readPdfPages(buffer);
  return pages.map(layoutPage);
}
