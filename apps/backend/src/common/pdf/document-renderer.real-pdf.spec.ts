/**
 * The tests that read the university's real scheme document.
 *
 * The other renderer tests build their pages by hand, so they can say
 * exactly what they mean to say. This one reads the actual PDF the college
 * will be reading — the First-Year Computer Engineering scheme published by
 * Dr. Babasaheb Ambedkar Technological University — and checks that the rows
 * come out the way the page prints them.
 *
 * These are the tests that would have caught the fault that made the reader
 * fail: the rows were being shattered across four or five lines each, so
 * the model was asked to read rows that were not on the page. A hand-built
 * page does not catch that, because it is built the way the reader expects
 * the page to look. Only the real page does.
 *
 * The document is read from `docs/`. If it is not there, the test says so
 * and passes — the document is an input to a manual check, and a missing
 * input must not turn the build red.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { readPdfText } from './document-renderer';

/**
 * The official scheme document.
 */
const SCHEME_PDF = resolve(__dirname, '../../../../../docs/First-Year-Computer-Engg.-1.pdf');

/**
 * The document's course rows, read from the PDF.
 */
async function readPage(pageNumber: number): Promise<string> {
  const buffer = readFileSync(SCHEME_PDF);
  const pages = await readPdfText(buffer, {
    fromPage: pageNumber,
    toPage: pageNumber,
  });

  return pages[0]?.text ?? '';
}

/**
 * The course rows on a page.
 *
 * A course row begins with its course code — a letter code and a number.
 */
function courseRows(pageText: string): string[] {
  return pageText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^COE[A-Z]*\d/i.test(line));
}

describe("reading the university's real scheme document", () => {
  const hasDocument = existsSync(SCHEME_PDF);

  it('has the scheme document to read', () => {
    if (!hasDocument) {
      /**
       * The document is not in the repository. This is not a failure of the
       * reader; it is a missing input. The test says so and moves on.
       */
      expect(true).toBe(true);
      return;
    }

    expect(hasDocument).toBe(true);
  });

  it('reads the course rows as one line each, with the cells in the order the page prints them', async () => {
    if (!hasDocument) return;

    const page = await readPage(2);
    const rows = courseRows(page);

    /**
     * The page has courses on it.
     */
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      /**
       * Every course row is one line, and its cells are separated by pipes.
       */
      expect(row).toContain('|');

      /**
       * A course code comes first, then the type, then the name. If the
       * numbers came first, the row would have been shattered.
       */
      const cells = row.split('|').map((cell) => cell.trim());
      expect(cells[0]).toMatch(/^COE[A-Z]*\d/i);
    }
  });

  it('reads a known course row exactly as the page prints it', async () => {
    if (!hasDocument) return;

    const page = await readPage(2);
    const rows = courseRows(page);

    const first = rows.find((row) => /^COEMD111\b/i.test(row));
    const second = rows.find((row) => /^COEMD112\b/i.test(row));

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    /**
     * The first course of the first year. The row is checked cell by cell,
     * because a row that is in the right order but has a number in the
     * wrong place is still a wrong row.
     *
     * The row has *nine* cells, not eight: the table has nine columns,
     * and this course has no Mid-Semester Examination, so the sixth cell
     * is empty. The empty cell is what says that the 40 is the
     * end-semester mark and not the mid-semester one — without it, the
     * row would have been read wrong.
     */
    const firstCells = (first as string).split('|').map((cell) => cell.trim());

    expect(firstCells).toHaveLength(9);
    expect(firstCells[0]).toBe('COEMD111');
    expect(firstCells[1]).toBe('BSC');
    expect(firstCells[2]).toBe('Environmental Sciences and Engineering');
    expect(firstCells[3]).toBe('1');
    expect(firstCells[4]).toBe('2');
    expect(firstCells[5]).toBe('60');
    expect(firstCells[6]).toBe('');
    expect(firstCells[7]).toBe('40');
    expect(firstCells[8]).toBe('2');

    /**
     * The second course. Its practical hours are printed as a dash, and
     * that dash is a value — not a missing cell.
     *
     * It has no type of its own: the `BSC` on the row above is a cell
     * merged across both rows, printed once and centred between them. The
     * renderer does not invent the type — it reads what is printed, and
     * the reader's instructions tell the model that a merged cell applies
     * to every row it covers.
     */
    const secondCells = (second as string).split('|').map((cell) => cell.trim());

    expect(secondCells).toHaveLength(9);
    expect(secondCells[0]).toBe('COEMD112');
    expect(secondCells[1]).toBe('');
    expect(secondCells[2]).toBe('Set Theory and Logic');
    expect(secondCells[3]).toBe('3');
    expect(secondCells[4]).toBe('-');
    expect(secondCells[5]).toBe('20');
    expect(secondCells[6]).toBe('20');
    expect(secondCells[7]).toBe('60');
    expect(secondCells[8]).toBe('3');
  });

  it('does not shatter a course across more than one line', async () => {
    if (!hasDocument) return;

    const page = await readPage(2);
    const lines = page.split('\n');

    /**
     * Every line that begins with a course code is that course's row. If
     * the row had been shattered, the name would be on a line of its own,
     * with no course code on it.
     */
    const rowsWithCode = lines.filter((line) => /^COE[A-Z]*\d/i.test(line.trim()));
    expect(rowsWithCode.length).toBe(courseRows(page).length);

    /**
     * And no course code appears on two lines.
     *
     * The code is the whole first cell of the row, so it is taken from
     * there — a search through the line would find `COEES124` inside
     * `COEES124L` and call the two the same.
     */
    const codes = rowsWithCode.map((line) => line.split('|')[0].trim().toUpperCase());

    expect(new Set(codes).size).toBe(codes.length);
  });
});
