/**
 * The tests for turning a page's text into a table a model can read.
 *
 * These matter more than they look. The reader used to group a page's text
 * into lines by its vertical position alone, which shattered one printed
 * table row across four or five lines — the course name above the row, the
 * numbers in the middle of it, the type label below it. The model was then
 * asked to read a row that was not there, and it answered with garbage
 * that looked plausible.
 *
 * The tests below are about the *shape* of the output: that a row comes
 * out as one line of pipe-separated cells, and that a cell which wraps
 * onto two printed lines comes out as one cell.
 */

import { pageText } from './document-renderer';

/**
 * Builds the text of a page from a list of positioned runs.
 *
 * The real renderer takes the runs a PDF gives — each with a position and a
 * width — and works out the table from them. A test needs the same thing,
 * so the runs are written out by hand.
 */
function render(runs: Array<{ text: string; x: number; y: number; width?: number }>): string {
  const items = runs.map((run) => ({
    str: run.text,
    transform: [1, 0, 0, 1, run.x, run.y],
    width: run.width ?? run.text.length * 6,
  }));

  return pageText(items);
}

/**
 * The column positions of the university's scheme table.
 */
const COL = {
  code: 55,
  type: 154,
  name: 194,
  L: 352,
  P: 379,
  CA: 404,
  MSE: 439,
  ESE: 474,
  credit: 518,
};

describe('reading a page as a table', () => {
  it('puts one printed row on one line, with its cells separated by pipes', () => {
    const text = render([
      { text: 'COEMD112', x: COL.code, y: 591 },
      { text: 'Set Theory and Logic', x: COL.name, y: 591 },
      { text: '3', x: COL.L, y: 591 },
      { text: '-', x: COL.P, y: 591 },
      { text: '20', x: COL.CA, y: 591 },
      { text: '20', x: COL.MSE, y: 591 },
      { text: '60', x: COL.ESE, y: 591 },
      { text: '3', x: COL.credit, y: 591 },
    ]);

    expect(text).toContain('COEMD112 | Set Theory and Logic | 3 | - | 20 | 20 | 60 | 3');
  });

  it('keeps a course name that wraps onto two printed lines as one cell', () => {
    /**
     * The name is centred in its row, so its two lines sit above and below
     * the line of numbers beside it. This is the case that used to split
     * the course across three lines.
     */
    const text = render([
      { text: 'COEMD111', x: COL.code, y: 621.4 },
      { text: 'Environmental Sciences and', x: COL.name, y: 628.3 },
      { text: 'Engineering', x: COL.name, y: 614.5 },
      { text: 'BSC', x: COL.type, y: 609.6 },
      { text: '1', x: COL.L, y: 621.4 },
      { text: '2', x: COL.P, y: 621.4 },
      { text: '60', x: COL.CA, y: 621.4 },
      { text: '40', x: COL.ESE, y: 621.4 },
      { text: '2', x: COL.credit, y: 621.4 },
    ]);

    expect(text).toContain(
      'COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 | 40 | 2'
    );
  });

  it('keeps two courses on two lines when they are separate rows', () => {
    const text = render([
      { text: 'COEMD111', x: COL.code, y: 621.4 },
      { text: 'Environmental Sciences and', x: COL.name, y: 628.3 },
      { text: 'Engineering', x: COL.name, y: 614.5 },
      { text: '1', x: COL.L, y: 621.4 },

      { text: 'COEMD112', x: COL.code, y: 591.0 },
      { text: 'Set Theory and Logic', x: COL.name, y: 591.0 },
      { text: '3', x: COL.L, y: 591.0 },
    ]);

    const lines = text.split('\n');
    const first = lines.find((l) => l.includes('COEMD111'));
    const second = lines.find((l) => l.includes('COEMD112'));

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toContain('COEMD112');
    expect(second).not.toContain('COEMD111');
  });

  it('reads a page with no table as ordinary text', () => {
    const text = render([
      { text: 'Dr. Babasaheb Ambedkar Technological University', x: 176, y: 797.6 },
      { text: 'First Year in B. Tech. in Computer Engineering', x: 141, y: 760.9 },
    ]);

    expect(text).toContain('Dr. Babasaheb Ambedkar Technological University');
    expect(text).toContain('First Year in B. Tech. in Computer Engineering');
    expect(text).not.toContain('|');
  });

  it('reports a page with no text as empty rather than failing', () => {
    expect(render([])).toBe('');
  });
});
