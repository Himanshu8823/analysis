/**
 * The test that reads *every* page of the scheme document.
 *
 * The scheme has thirty-eight pages and they are not all the same shape:
 * some carry a course table, some carry the legend, some carry the exit
 * requirements, some carry the exam rules in prose. A renderer that works
 * on one page can still fail on another, so the whole document is checked.
 *
 * What is checked, page by page:
 *
 *  - a course code is never left on a line of its own, which is what a
 *    shattered row looks like;
 *  - a course code never appears on two lines, which is what a split row
 *    looks like;
 *  - the marks of a course row add up to 100, when the row carries all
 *    three of them — a row whose numbers are in the wrong places does not.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { readPdfText } from './document-renderer';

/**
 * The official scheme document.
 */
const SCHEME_PDF = resolve(__dirname, '../../../../../docs/First-Year-Computer-Engg.-1.pdf');

/**
 * The pages of the document, read once.
 */
describe('reading every page of the scheme document', () => {
  const hasDocument = existsSync(SCHEME_PDF);

  it('reads the document without a row being shattered', async () => {
    if (!hasDocument) {
      expect(true).toBe(true);
      return;
    }

    const buffer = readFileSync(SCHEME_PDF);
    const pages = await readPdfText(buffer);

    /**
     * The document has pages, and most of them carry text.
     */
    expect(pages.length).toBeGreaterThan(30);

    const pagesWithText = pages.filter((page) => page.text.trim().length > 0);
    expect(pagesWithText.length).toBeGreaterThan(30);

    for (const page of pagesWithText) {
      const lines = page.text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      /**
       * A course code sits at the start of its row, with the rest of the
       * row behind it. A line that is nothing but a course code means the
       * row was cut in two.
       */
      for (const line of lines) {
        if (/^COE[A-Z]*\d+$/i.test(line)) {
          throw new Error(
            `Page ${page.pageNumber} has a course code on a line of its own: "${line}". The row was split.`
          );
        }
      }

      /**
       * A course code is on one line and one line only.
       *
       * The code is the whole first cell of the row, so it is taken from
       * there rather than by a search through the line — a search would
       * find `COEES124` inside `COEES124L` and call the two the same.
       */
      const codes = lines
        .filter((line) => /^COE[A-Z]*\d/i.test(line))
        .map((line) => line.split('|')[0].trim().toUpperCase());

      if (new Set(codes).size !== codes.length) {
        throw new Error(
          `Page ${page.pageNumber} has a course code on more than one line. The row was split.`
        );
      }
    }
  }, 120_000);

  it('reads the marks of every course row so that they add up to 100', async () => {
    if (!hasDocument) return;

    const buffer = readFileSync(SCHEME_PDF);
    const pages = await readPdfText(buffer);

    /**
     * The numbers of a scheme row are the three assessment marks, and they
     * are printed in a row as three numbers. A row whose marks do not add
     * up to 100 has been read wrongly — the numbers are in the wrong
     * places, or one of them was missed.
     *
     * The row's shape is fixed by the table: a code, a type, a name, then
     * the two hour columns (L and P), then the three assessment columns
     * (CA, MSE, ESE), then the credits. A dash in a column means that
     * column is absent, but the column is still there — so the position of
     * the marks is the position of the columns, not the number of values
     * that happen to be numbers.
     *
     * The row is therefore read from the right: the credits are last, the
     * three marks are the three before it, and the two hour columns are
     * the two before those.
     */
    for (const page of pages) {
      const rows = page.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^COE[A-Z]*\d/i.test(line));

      for (const row of rows) {
        const cells = row.split('|').map((cell) => cell.trim());

        /**
         * The columns from the right, in the table's own order.
         */
        const ese = cells[cells.length - 2];
        const mse = cells[cells.length - 3];
        const ca = cells[cells.length - 4];
        const practical = cells[cells.length - 5];
        const lecture = cells[cells.length - 6];

        /**
         * A row that does not have the six columns after its name is not a
         * course row — it is the totals row, a legend, or a heading. Those
         * are read as text and are not checked.
         */
        if (cells.length < 9) continue;

        /**
         * The marks are numbers, a dash, or nothing at all.
         *
         * A dash means the course has no such component. An *empty* cell
         * means the same thing — the table has the column and this course
         * has nothing in it, which is what the renderer produces for a
         * column that is not printed for this row.
         */
        const markCells = [ca, mse, ese];
        const isMark = (cell: string): boolean => /^\d+$/.test(cell) || cell === '-' || cell === '';

        if (!markCells.every(isMark)) continue;

        /**
         * A dash is an absent component, not a zero, and an absent
         * component does not count towards the total.
         */
        const marks = markCells
          .filter((cell): cell is string => /^\d+$/.test(cell))
          .map((cell) => Number(cell));

        /**
         * The hour columns are numbers or a dash too, and they are read
         * only to confirm that the row has the shape of a course row.
         */
        if (![lecture, practical].every((cell) => /^\d+$/.test(cell) || cell === '-')) {
          continue;
        }

        /**
         * A course with no assessment at all is not a scheme row.
         */
        if (marks.length === 0) continue;

        const total = marks.reduce((sum, value) => sum + value, 0);

        /**
         * A scheme course's assessment adds up to 100. A row that does not
         * is a row that was read wrongly.
         */
        if (total !== 100) {
          throw new Error(
            `Page ${page.pageNumber}: the marks of "${cells[0]}" add up to ${total}, not 100. The row reads: ${row}`
          );
        }
      }
    }
  }, 120_000);
});
