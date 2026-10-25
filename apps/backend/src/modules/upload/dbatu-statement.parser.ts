import { BadRequestException } from '@nestjs/common';
import type { ExtractedMark } from './marks-file.parser';

/**
 * The parser for the printed DBATU result statement.
 *
 * This is the format the examination cell actually receives — a wide,
 * one-row-per-student table with a merged two-row header:
 *
 * ```
 * G P's Convent of College of Engineering, Jalgaon
 * Department of Computer Engg. (A.Y. 2025-26) Sem – VII
 * Result Analysis L.Y.B.Tech Div-A (A.V.2025-26)
 * Roll  PRN No        Name        BTCOM701:INT | BTCOM701:PR | BTCOM702:INT | Total Marks | Percentage | SGPA | Result
 * No                           CA1 CA2 MID WR     CA1 CA2 MID WR     CA1 CA2 MID WR              Marks
 * 1    225171126001   AISHWARYA CHAUDHARY   16  17  24  53   15  14  25  56   18  18  30  57   479   79.83  8.11  Pass
 * ```
 *
 * Two things make this different from the tidy layout the marks parser
 * expects, and both are handled here:
 *
 *  1. **The header is two rows.** The first names the subjects; the second
 *     names the components *under* each subject. A subject with a theory
 *     part spans four columns (`CA1 CA2 MID WR`); a subject with only a
 *     practical part spans one.
 *  2. **One row carries many marks.** A single student's row holds a value
 *     for every component of every subject, so it has to be *expanded* into
 *     one mark record per component.
 *
 * The summary columns (`Total Marks`, `Percentage`, `SGPA`, `Result`) are
 * deliberately ignored: they are the college's own arithmetic, and
 * re-deriving them from the components is the point of this system.
 */

/**
 * The components a theory subject is broken into, in the order they appear.
 */
const THEORY_COMPONENTS = ['CA1', 'CA2', 'MID_SEM', 'WRITTEN'] as const;

/**
 * The component a practical-only subject is recorded as.
 */
const PRACTICAL_COMPONENT = 'PRACTICAL';

/**
 * The maximum marks for each component, per the schemes the college runs.
 *
 * The statement prints the *marks* only — never the maximum — so the
 * maximum has to come from the scheme's own rules.
 *
 * These are the maxima the college's own component sheet records:
 * CA1 20, CA2 20, Mid-Sem 30, Written 45, Practical 25.
 *
 * The values are the *default*. When the upload is confirmed, the maximum
 * is taken from the subject's own component configuration, which is what
 * the college sets up for each scheme — so a subject configured with a
 * different split is still recorded correctly.
 */
const COMPONENT_MAX: Record<string, number> = {
  CA1: 20,
  CA2: 20,
  MID_SEM: 30,
  WRITTEN: 45,
  PRACTICAL: 25,
  // SCHEME_2022 / SCHEME_2024 — internal 40 (CT1 15 + Mid 15 + Quiz 10)
  // and external 60. The printed sheet still labels the theory components
  // CA1 / CA2 / MID / WR, so the same maxima are used.
  ORAL: 10,
};

/**
 * A component read from the second header row, bound to the subject above.
 */
interface ComponentHeader {
  subjectCode: string;
  /** The exam type this column records — `CA1`, `MID_SEM`, `WRITTEN`, … */
  examType: string;
  /** The maximum for this component, when the scheme defines one. */
  maxMarks: number;
  /** The column of the data row this component is read from. */
  columnIndex: number;
  /**
   * The columns that make up this component.
   *
   * A theory block's component is one column. A *practical* block is
   * printed with several columns, but the scheme treats the practical as a
   * single component, so its columns are summed into one mark.
   */
  sourceColumns: number[];
}

/**
 * The result of parsing a printed statement.
 */
export interface ParsedStatement {
  rows: ExtractedMark[];
  errors: Array<{ row: number; error: string }>;
}

/**
 * Normalises a header cell for comparison.
 */
function normalise(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[|_]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Reads a subject header cell such as `BTCOM701:INT`.
 *
 * Returns `null` for a cell that is not a subject header — the identity
 * columns (`Roll`, `PRN No`, `Name`) and the summary columns all land here.
 *
 * A subject code is a run of letters followed by a run of digits, optionally
 * followed by a part marker. The shape matters: without it, `Roll`,
 * `Percentage` and `SGPA` would be read as subject headings, and every
 * column after the first real subject would be shifted out of alignment.
 */
function readSubjectHeader(cell: unknown): { subjectCode: string; kind: 'theory' | 'practical' } | null {
  const text = String(cell ?? '').trim();
  if (!text) return null;

  // `BTCOM701:INT`, `BTCOM701:PR`, and the bare `BTCOM701` all appear.
  const match = text.match(/^([A-Za-z]+[0-9]+)\s*(?::\s*(INT|PR|THEORY|PRACTICAL))?$/i);
  if (!match) return null;

  const subjectCode = match[1].toUpperCase();

  // A bare subject code with no suffix is a subject heading, but the cell
  // alone does not say whether it is theory or practical. It is treated as
  // theory, which is the default part of every subject.
  const suffix = (match[2] ?? 'INT').toUpperCase();
  const kind = suffix === 'PR' || suffix === 'PRACTICAL' ? 'practical' : 'theory';

  return { subjectCode, kind };
}

/**
 * Maps a sub-header cell (`CA1`, `CA2`, `MID`, `WR`) to an exam type.
 */
function readComponentHeader(cell: unknown): string | null {
  const text = normalise(cell);
  if (!text) return null;

  switch (text) {
    case 'ca1':
    case 'ca i':
    case 'ct1':
    case 'quiz':
      return 'CA1';
    case 'ca2':
    case 'ca ii':
    case 'ct2':
      return 'CA2';
    case 'mid':
    case 'mid sem':
    case 'mid sems':
    case 'midsem':
    case 'midsemester':
    case 'internal':
      return 'MID_SEM';
    case 'wr':
    case 'written':
    case 'theory':
    case 'external':
      return 'WRITTEN';
    case 'pr':
    case 'practical':
    case 'lab':
      return 'PRACTICAL';
    case 'oral':
    case 'viva':
      return 'ORAL';
    default:
      return null;
  }
}

/**
 * The subject code the student rows are keyed by.
 *
 * The printed statement carries a `PRN No` — a long enrollment number — and a
 * separate `Roll No`. The college identifies a student by the PRN, so the
 * PRN is the value a mark row is recorded against.
 */

/**
 * Splits one line of a printed statement into its cells.
 *
 * The statement is laid out in columns, not separated by delimiters, so the
 * columns are recovered from the runs of spaces between them. A single space
 * is common inside a name ("AISHWARYA CHAUDHARY") and inside a component
 * list (`CA1 CA2 MID WR`), so a cell boundary is a run of two or more spaces.
 */
export function splitStatementLine(line: string): string[] {
  return line
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter((cell, index, all) => !(cell === '' && index === all.length - 1));
}

/**
 * Parses a printed DBATU result statement given as raw text lines.
 *
 * This is the format the college actually produces: the statement is laid
 * out in columns, not delimited, so the columns are recovered from the
 * spacing. The subject header marks the boundary between one subject's
 * block and the next with a `|`, and the sub-header row below it names the
 * components of each block.
 *
 * The line-based reading is the accurate one, because it keeps the two
 * header rows *as they are written* — one subject per `|`-separated block —
 * instead of guessing at column positions from a flattened grid.
 */
export function parseDbatuStatementLines(lines: string[]): ParsedStatement {
  const rows: ExtractedMark[] = [];
  const errors: ParsedStatement['errors'] = [];

  const headerIndex = lines.findIndex((line) => hasSubjectHeader(line));
  if (headerIndex === -1) {
    throw new BadRequestException(
      'This file does not look like a printed result statement. Expected a header naming "PRN No" and at least one subject such as "BTCOM701:INT".'
    );
  }

  const headerLine = lines[headerIndex];
  const subHeaderLine = lines[headerIndex + 1] ?? '';

  /**
   * The header is one line, but it holds two kinds of content: the identity
   * columns on the left, and the subject and summary columns on the right.
   * The right-hand side is delimited by `|`, so it is split out first.
   *
   * The first subject shares the identity block — it sits after the name
   * column and before the first `|` — so the identity block is cut at the
   * subject rather than at the delimiter.
   */
  const pipeIndex = headerLine.indexOf('|');

  /**
   * The subject blocks, read from the whole line. The first one shares the
   * identity block, so the search starts at the beginning of the line.
   */
  const subjectBlocks = headerLine
    .split('|')
    .map((block) => block.trim())
    .map((block) => {
      /**
       * The first block carries the identity columns as well as the first
       * subject, so the subject is the last cell of it.
       */
      const cells = splitStatementLine(block);
      return cells.length > 0 ? cells[cells.length - 1] : '';
    })
    .filter((block) => readSubjectHeader(block) !== null);

  /**
   * The identity columns are the cells of the first block before the first
   * subject.
   */
  const firstBlockCells = splitStatementLine(
    headerLine.split('|')[0].trim()
  );
  const firstSubjectCell = subjectBlocks.length > 0 ? subjectBlocks[0] : '';
  const firstSubjectIndex = firstBlockCells.indexOf(firstSubjectCell);
  const identityBlock = firstBlockCells
    .slice(0, firstSubjectIndex >= 0 ? firstSubjectIndex : firstBlockCells.length)
    .join('  ');

  if (subjectBlocks.length === 0) {
    throw new BadRequestException(
      'The header row names no subject. Expected at least one column like "BTCOM701:INT" or "BTCOM701:PR".'
    );
  }

  /**
   * The component names, read from the sub-header row. Each group names the
   * components of one subject block, and the groups are separated by the
   * same wide gaps that separate the columns.
   */
  const componentGroups = readSubHeaderGroups(subHeaderLine);

  /**
   * Where the identity columns end and the marks begin. The header names
   * them — `Roll`, `PRN No`, `Name` — and each one takes a column of its
   * own in the data row.
   */
  const identity = readIdentityLayout(identityBlock);

  /**
   * The subject blocks, each with the components the sub-header gives it.
   *
   * The sub-header groups and the subject blocks are read in the same order,
   * so the first group belongs to the first subject.
   *
   * A subject the sub-header does not cover has no columns of its own — the
   * statement names it but prints no marks under it. Such a subject is
   * skipped rather than given a guessed set of components, which would read
   * the summary columns as marks.
   */
  const components: ComponentHeader[] = [];
  const subjectCells = subjectBlocks.map((block) => readSubjectHeader(block)!);

  let columnIndex = identity.markColumn;
  subjectCells.forEach((subject, index) => {
    const named = componentGroups[index] ?? [];
    if (named.length === 0) return;

    /**
     * A practical is assessed as *one* mark, and the scheme's pass rule for
     * it is a single threshold. The statement prints it in a column of its
     * own, so it is read as one mark.
     *
     * It is not recorded under the printed component names: a mark is keyed
     * on the student, the subject and the exam type, so a practical written
     * as `CA1` would overwrite the theory part's `CA1` of the same student.
     */
    if (subject.kind === 'practical') {
      components.push({
        subjectCode: subject.subjectCode,
        examType: PRACTICAL_COMPONENT,
        maxMarks: COMPONENT_MAX[PRACTICAL_COMPONENT],
        columnIndex,
        sourceColumns: [columnIndex],
      });
      columnIndex += 1;
      return;
    }

    named.forEach((examType) => {
      components.push({
        subjectCode: subject.subjectCode,
        examType,
        maxMarks: COMPONENT_MAX[examType] ?? 0,
        columnIndex,
        sourceColumns: [columnIndex],
      });
      columnIndex += 1;
    });
  });

  const dataStartLine = headerIndex + (componentGroups.length > 0 ? 2 : 1);

  for (let i = dataStartLine; i < lines.length; i += 1) {
    const line = lines[i];
    const rowNumber = i + 1; // 1-based.

    if (!line.trim()) continue;

    const cells = splitStatementLine(line);
    if (cells.length === 0) continue;

    /**
     * The identifier is read by position: the PRN sits in the column the
     * header gives it, and the roll number is the fallback.
     */
    const identifier = readLineIdentifier(cells, identity);
    if (!identifier) {
      errors.push({ row: rowNumber, error: 'No PRN No or Roll No in this row' });
      continue;
    }

    if (!hasAnyMark(cells, components)) continue;

    for (const component of components) {
      /**
       * A component may be printed in several columns — a practical is.
       * Each column is read on its own, and the marks are summed.
       */
      const parts: Array<{ text: string; columnIndex: number }> = component.sourceColumns.map(
        (columnIndex) => ({ text: String(cells[columnIndex] ?? '').trim(), columnIndex })
      );

      /**
       * A blank cell means the component was not conducted — it is not a
       * zero. Recording it as zero would silently fail the student, so the
       * omission is reported and the component is left out.
       */
      const blank = parts.find((part) => part.text === '');
      if (blank) {
        errors.push({
          row: rowNumber,
          error: `No ${component.examType} mark for ${component.subjectCode}`,
        });
        continue;
      }

      const lowered = parts.map((part) => part.text.toLowerCase());

      /**
       * `Absent` means the student did not take the component; `Fail` means
       * they took it and did not clear it. Both are recorded as a zero, but
       * only an absence carries the absent flag.
       */
      if (lowered.some((text) => text === 'absent' || text === 'ab')) {
        rows.push({
          rollNo: identifier,
          subjectCode: component.subjectCode,
          examType: component.examType,
          marksObtained: 0,
          maxMarks: component.maxMarks,
          isAbsent: true,
        });
        continue;
      }
      if (lowered.some((text) => text === 'fail' || text === 'f')) {
        rows.push({
          rollNo: identifier,
          subjectCode: component.subjectCode,
          examType: component.examType,
          marksObtained: 0,
          maxMarks: component.maxMarks,
        });
        continue;
      }

      let obtained = 0;
      let unreadable = false;

      for (const part of parts) {
        const value = parseNumber(part.text);
        if (value === null) {
          errors.push({
            row: rowNumber,
            error: `Could not read "${part.text}" as a mark for ${component.subjectCode} ${component.examType}`,
          });
          unreadable = true;
          break;
        }
        if (value < 0) {
          errors.push({ row: rowNumber, error: `Negative mark for ${component.subjectCode}` });
          unreadable = true;
          break;
        }
        obtained += value;
      }

      if (unreadable) continue;

      if (obtained > component.maxMarks) {
        errors.push({
          row: rowNumber,
          error: `Mark ${obtained} for ${component.subjectCode} ${component.examType} exceeds the maximum of ${component.maxMarks}`,
        });
        continue;
      }

      rows.push({
        rollNo: identifier,
        subjectCode: component.subjectCode,
        examType: component.examType,
        marksObtained: obtained,
        maxMarks: component.maxMarks,
      });
    }
  }

  return { rows, errors };
}

/**
 * Whether a line carries a subject header such as `BTCOM701:INT`.
 *
 * The subject may sit on its own between the `|` markers, or share a block
 * with the identity columns — the first subject does.
 */
function hasSubjectHeader(line: string): boolean {
  return line.split('|').some((block) => {
    const cells = splitStatementLine(block);
    if (cells.length === 0) return false;
    return readSubjectHeader(cells[cells.length - 1]) !== null;
  });
}

/**
 * Reads the component groups from the sub-header row.
 *
 * The row names the components of each subject block. The components of one
 * block are separated by single spaces (`CA1 CA2 MID WR`) and the blocks
 * themselves by wide gaps, so each wide-gap-separated cell is one group's
 * component list.
 *
 * The identity cell (`No`) and the summary cell (`Marks`) are not components
 * and are dropped.
 */
function readSubHeaderGroups(line: string): string[][] {
  if (!line.trim()) return [];

  const cells = line
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  const groups: string[][] = [];

  for (const cell of cells) {
    /**
     * A group is a run of component names separated by single spaces.
     */
    const names = cell
      .split(/\s+/)
      .map((name) => readComponentHeader(name))
      .filter((name): name is string => name !== null);

    if (names.length > 0) groups.push(names);
  }

  return groups;
}

/**
 * The identity columns of the statement — the roll number, the PRN and the
 * name — and where the marks begin after them.
 */
interface IdentityLayout {
  /** The column the PRN sits in, or -1 when the statement has no PRN. */
  prnColumn: number;
  /** The column the roll number sits in. */
  rollColumn: number;
  /** The column the first mark sits in. */
  markColumn: number;
}

/**
 * Reads where the identity columns are.
 *
 * The header names them in order — `Roll`, `PRN No`, `Name` — and each one
 * takes a column of its own in the data row, so the marks begin after the
 * last of them.
 *
 * The printed statement splits `Roll No` across two header cells (`Roll`
 * over `No`), but that is a *header* artefact: the data row carries the
 * roll number in a single cell, so the identity columns are counted from
 * the labels that name a data column.
 */
function readIdentityLayout(identityBlock: string): IdentityLayout {
  const cells = splitStatementLine(identityBlock);

  const prnColumn = cells.findIndex((cell) => isPrnLabel(cell));
  const nameColumn = cells.findIndex((cell) => isNameLabel(cell));

  /**
   * The roll number is the first identity column. The PRN is the second,
   * but only when the statement names one — a statement without a PRN must
   * not fall back to the name, which is not an identifier at all.
   */
  const rollColumn = 0;

  /**
   * The marks begin after the last identity column. The name is the last of
   * them, and it may hold more than one word — but it is still one column
   * of the grid, because a name is written in one cell.
   */
  const markColumn = Math.max(prnColumn, nameColumn, rollColumn) + 1;

  return { prnColumn, rollColumn, markColumn };
}

/**
 * Whether a header cell names the PRN column.
 */
function isPrnLabel(cell: string): boolean {
  const n = normalise(cell);
  return (
    n === 'prn no' ||
    n === 'prn' ||
    n === 'prn number' ||
    n === 'enrollment no' ||
    n === 'enrollment number' ||
    n === 'enrollmentno'
  );
}

/**
 * Whether a header cell names the roll-number column.
 */
function isRollLabel(cell: string): boolean {
  const n = normalise(cell);
  return (
    n === 'roll' || n === 'roll no' || n === 'roll no.' || n === 'roll number' ||
    n === 'sr no' || n === 'sno'
  );
}

/**
 * Whether a header cell names the student's name column.
 */
function isNameLabel(cell: string): boolean {
  const n = normalise(cell);
  return n === 'name' || n === 'student name' || n === 'full name';
}

/**
 * Reads the identifier of a student row.
 *
 * The PRN is preferred — it is the number the college identifies a student
 * by. The roll number is the fallback. Both are read by the column the
 * header gives them.
 */
function readLineIdentifier(cells: string[], identity: IdentityLayout): string {
  if (identity.prnColumn >= 0) {
    const prn = String(cells[identity.prnColumn] ?? '').trim();
    if (prn) return prn;
  }

  const roll = String(cells[identity.rollColumn] ?? '').trim();
  if (roll) return roll;

  return '';
}

/**
 * Parses a printed DBATU result statement that was read into a grid.
 *
 * A statement is a *text* layout, so it is read from its lines. This
 * function exists for the callers that already hold a grid — a spreadsheet
 * whose columns were read one by one — and re-joins that grid into lines
 * before parsing it.
 */
export function parseDbatuStatement(matrix: unknown[][]): ParsedStatement {
  const lines = matrix.map((row) =>
    (row ?? [])
      .map((cell) => String(cell ?? '').trim())
      .filter((cell) => cell.length > 0)
      .join('  ')
  );

  return parseDbatuStatementLines(lines);
}

/**
 * Whether a row carries any mark at all.
 *
 * The caption and footer lines of a statement carry no numbers, so this
 * tells a student row from page furniture.
 */
function hasAnyMark(cells: unknown[], components: ComponentHeader[]): boolean {
  return components.some((component) =>
    component.sourceColumns.some((columnIndex) => {
      const text = String(cells[columnIndex] ?? '').trim();
      if (!text) return false;
      return parseNumber(text) !== null || /^(fail|f|absent|ab)$/i.test(text);
    })
  );
}

/**
 * Reads a numeric cell, tolerating the decorations a statement uses.
 */
function parseNumber(value: unknown): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const cleaned = text.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
