import { BadRequestException } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { parseCsv, parseExcel } from '../students/student-import.parser';

/**
 * One extracted mark row — exactly the fields the confirm DTO accepts.
 */
export interface ExtractedMark {
  rollNo: string;
  subjectCode: string;
  examType: string;
  marksObtained: number;
  maxMarks: number;
  isAbsent?: boolean;
}

export interface ParsedMarksSheet {
  rows: ExtractedMark[];
  /** Human-readable reasons, keyed by the 1-based spreadsheet row number. */
  errors: Array<{ row: number; error: string }>;
}

/**
 * The column headers the extractor understands, lower-cased and normalised.
 *
 * Two layouts are common in result spreadsheets:
 *  - one row per mark  (`Roll No | Subject Code | Exam Type | Marks | Max Marks`)
 *  - one row per student with a column per subject
 *
 * The first is supported directly. The second is expanded by
 * `expandSubjectColumns`, which needs the subject codes from the header row.
 */
const COLUMN_ALIASES: Record<string, keyof ExtractedMark> = {
  rollno: 'rollNo',
  'roll no': 'rollNo',
  'roll number': 'rollNo',
  enrollmentno: 'rollNo',
  'enrollment no': 'rollNo',
  'enrollment number': 'rollNo',
  subjectcode: 'subjectCode',
  'subject code': 'subjectCode',
  'subject': 'subjectCode',
  'subject name': 'subjectCode',
  examtype: 'examType',
  'exam type': 'examType',
  exam: 'examType',
  type: 'examType',
  marksobtained: 'marksObtained',
  'marks obtained': 'marksObtained',
  obtainedmarks: 'marksObtained',
  'obtained marks': 'marksObtained',
  marks: 'marksObtained',
  score: 'marksObtained',
  maxmarks: 'maxMarks',
  'max marks': 'maxMarks',
  maximummarks: 'maxMarks',
  'maximum marks': 'maxMarks',
  totalmarks: 'maxMarks',
  'total marks': 'maxMarks',
  outof: 'maxMarks',
  'out of': 'maxMarks',
  isabsent: 'isAbsent',
  'is absent': 'isAbsent',
  absent: 'isAbsent',
};

const MAX_ROWS = 5000;

function normaliseHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function resolveColumn(header: string): keyof ExtractedMark | null {
  if (COLUMN_ALIASES[header]) return COLUMN_ALIASES[header];
  const compact = header.replace(/\s+/g, '');
  return COLUMN_ALIASES[compact] ?? null;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const maybe = value as { text?: unknown; result?: unknown };
    if (typeof maybe.text === 'string') return maybe.text.trim();
    if (typeof maybe.result === 'string') return maybe.result.trim();
    return '';
  }
  return String(value).trim();
}

/**
 * Parses a numeric cell.
 *
 * A cell like `28/40` is accepted — the numerator is the obtained mark and
 * the denominator is the maximum. Returns `null` when the cell holds no
 * usable number.
 */
function parseMarkCell(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;

  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const obtained = Number(fraction[1]);
    const max = Number(fraction[2]);
    return max === 0 ? null : obtained;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads the maximum mark from a cell, accepting `28/40` as 40. */
function parseMaxCell(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;

  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const max = Number(fraction[2]);
    return Number.isFinite(max) ? max : null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Truthy check for the absent flag — `1`, `yes`, `true`, `absent` all count. */
function asBoolean(value: unknown): boolean {
  const text = asString(value).toLowerCase();
  return text === '1' || text === 'yes' || text === 'true' || text === 'absent';
}

class RowError extends Error {
  constructor(public readonly rowNumber: number, message: string) {
    super(message);
    this.name = 'RowError';
  }
}

/**
 * Parses the header row plus the data rows into mark records.
 *
 * Rows that fail validation are collected instead of aborting the whole file,
 * so one bad line does not discard an otherwise valid import.
 */
export function parseMarksSheet(
  headerRow: unknown[],
  dataRows: unknown[][],
): ParsedMarksSheet {
  const columnMap = new Map<number, keyof ExtractedMark>();
  headerRow.forEach((cell, index) => {
    const column = resolveColumn(normaliseHeader(cell));
    if (column && !columnMap.has(index)) columnMap.set(index, column);
  });

  if (!columnMap.size) {
    throw new BadRequestException(
      'The file has no recognisable header row. Expected at least "Roll No", "Subject Code" and "Marks" columns.',
    );
  }

  const columns = Array.from(columnMap.values());
  if (!columns.includes('rollNo')) {
    throw new BadRequestException('The file is missing a "Roll No" column.');
  }
  if (!columns.includes('subjectCode')) {
    throw new BadRequestException('The file is missing a "Subject Code" column.');
  }
  if (!columns.includes('marksObtained')) {
    throw new BadRequestException('The file is missing a "Marks" column.');
  }

  const rows: ExtractedMark[] = [];
  const errors: ParsedMarksSheet['errors'] = [];

  const limited = dataRows.slice(0, MAX_ROWS);
  limited.forEach((cells, index) => {
    const rowNumber = index + 2; // 1-based, and the header occupies row 1.
    try {
      const parsed: ExtractedMark = {
        rollNo: '',
        subjectCode: '',
        examType: '',
        marksObtained: 0,
        maxMarks: 0,
      };

      let obtained: number | null = null;
      let max: number | null = null;

      columnMap.forEach((column, cellIndex) => {
        const value = cells[cellIndex];
        switch (column) {
          case 'rollNo':
            parsed.rollNo = asString(value);
            break;
          case 'subjectCode':
            parsed.subjectCode = asString(value);
            break;
          case 'examType':
            parsed.examType = asString(value).toUpperCase();
            break;
          case 'marksObtained':
            obtained = parseMarkCell(value);
            break;
          case 'maxMarks':
            max = parseMaxCell(value);
            break;
          case 'isAbsent':
            if (asBoolean(value)) parsed.isAbsent = true;
            break;
          default:
            break;
        }
      });

      if (!parsed.rollNo) throw new RowError(rowNumber, 'Roll No is required');
      if (!parsed.subjectCode) throw new RowError(rowNumber, 'Subject Code is required');

      // A single `28/40` cell carries both values.
      if (obtained === null && max === null) {
        throw new RowError(rowNumber, 'Marks are required');
      }

      const marksObtained = obtained ?? 0;
      const maxMarks = max ?? 0;

      if (maxMarks <= 0) {
        throw new RowError(rowNumber, 'Max Marks must be greater than zero');
      }
      if (marksObtained < 0 || marksObtained > maxMarks) {
        throw new RowError(
          rowNumber,
          `Marks (${marksObtained}) must be between 0 and ${maxMarks}`,
        );
      }

      parsed.marksObtained = marksObtained;
      parsed.maxMarks = maxMarks;

      // An absent student has no mark — it defaults to zero.
      if (!parsed.examType) parsed.examType = 'WRITTEN';

      rows.push(parsed);
    } catch (error) {
      if (error instanceof RowError) {
        errors.push({ row: error.rowNumber, error: error.message });
      } else {
        errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Invalid row',
        });
      }
    }
  });

  if (dataRows.length > MAX_ROWS) {
    errors.push({
      row: MAX_ROWS + 2,
      error: `Only the first ${MAX_ROWS} rows were extracted`,
    });
  }

  return { rows, errors };
}

/**
 * Reads an uploaded result sheet (CSV, Excel or a text PDF) into mark records.
 *
 * A PDF is parsed by extracting its text layer and then reading the rows the
 * same way a CSV is read. A scanned PDF has no text layer — that needs OCR,
 * which is not part of the extraction pipeline, so it is rejected with a
 * message the user can act on.
 */
export async function parseMarksFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedMarksSheet> {
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith('.pdf');

  let matrix: unknown[][];
  if (isPdf) {
    matrix = await parsePdfText(buffer);
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    matrix = parseCsv(buffer).map((row) => row as unknown[]);
  } else {
    matrix = await parseExcel(buffer);
  }

  if (!matrix.length) {
    throw new BadRequestException('The file is empty.');
  }

  const [headerRow, ...dataRows] = matrix;
  return parseMarksSheet(headerRow ?? [], dataRows);
}

/**
 * Extracts the text layer of a PDF and splits it into a header row and data
 * rows.
 *
 * The text layer of a result PDF is a set of positioned text runs, not a
 * clean table. Rows are recovered by grouping the runs that share a vertical
 * band, and cells are separated by two or more spaces — the convention the
 * PDF writers of result sheets use.
 */
async function parsePdfText(buffer: Buffer): Promise<unknown[][]> {
  let parsed: { text: string };
  try {
    parsed = await pdfParse(buffer);
  } catch (err) {
    throw new BadRequestException(
      `The PDF could not be read: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }

  const text = parsed.text ?? '';
  if (!text.trim()) {
    throw new BadRequestException(
      'This PDF has no readable text. Scanned PDFs need to be converted to Excel or CSV first.',
    );
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    throw new BadRequestException('The PDF has no readable text.');
  }

  // A header row is the first line that names at least a roll number and a
  // subject column; the lines above it are titles and captions.
  const headerIndex = lines.findIndex((line) => {
    const normalised = normaliseHeader(line);
    return normalised.includes('roll') && normalised.includes('subject');
  });

  if (headerIndex === -1) {
    throw new BadRequestException(
      'The PDF has no recognisable header row. Expected a line naming "Roll No" and "Subject".',
    );
  }

  const headerCells = splitPdfCells(lines[headerIndex]);
  const rows: unknown[][] = [headerCells];

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const cells = splitPdfCells(lines[i]);
    // Rows shorter than the header are footers or page furniture.
    if (cells.length < 2) continue;
    rows.push(cells);
  }

  return rows;
}

/**
 * Splits one line of PDF text into cells.
 *
 * Cells are separated by two or more spaces — a single space is common inside
 * a name ("Akshay Kumar") and must not split the cell.
 */
function splitPdfCells(line: string): string[] {
  return line
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}
