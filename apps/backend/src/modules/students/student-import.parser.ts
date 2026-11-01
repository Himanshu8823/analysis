import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ParsedStudentRow {
  rollNo: string;
  name: string;
}

export interface ParsedSheet {
  rows: ParsedStudentRow[];
  /** Human-readable reasons, keyed by the 1-based spreadsheet row number. */
  errors: Array<{ row: number; error: string }>;
}

/**
 * The column headers the importer understands, lower-cased and normalised.
 *
 * Only the two columns that are unique to a student are read. The class
 * details — branch, scheme, academic year, batch, year and semester — are
 * chosen once on the import page and applied to every row, so a sheet that
 * still carries one of those columns is simply ignored rather than allowed
 * to override the operator's choice.
 */
const COLUMN_ALIASES: Record<string, keyof ParsedStudentRow> = {
  rollno: 'rollNo',
  'roll no': 'rollNo',
  'roll number': 'rollNo',
  enrollmentno: 'rollNo',
  'enrollment no': 'rollNo',
  name: 'name',
  'student name': 'name',
  fullname: 'name',
  'full name': 'name',
};

const MAX_ROWS = 5000;

/**
 * Normalises a header cell: lower-cased, whitespace collapsed, so that
 * `Roll No`, `roll_no` and `ROLLNO` all resolve to the same column.
 */
function normaliseHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

function resolveColumn(header: string): keyof ParsedStudentRow | null {
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

class RowError extends Error {
  constructor(
    public readonly rowNumber: number,
    message: string
  ) {
    super(message);
    this.name = 'RowError';
  }
}

/**
 * Parses the header row plus the data rows into student records.
 * Rows that fail validation are collected instead of aborting the whole file,
 * so one bad line does not discard an otherwise valid import.
 */
export function parseStudentSheet(headerRow: unknown[], dataRows: unknown[][]): ParsedSheet {
  const columnMap = new Map<number, keyof ParsedStudentRow>();
  headerRow.forEach((cell, index) => {
    const column = resolveColumn(normaliseHeader(cell));
    if (column && !columnMap.has(index)) columnMap.set(index, column);
  });

  if (!columnMap.size) {
    throw new BadRequestException(
      'The file has no recognisable header row. Expected at least "Roll No" and "Name" columns.'
    );
  }
  if (!Array.from(columnMap.values()).includes('rollNo')) {
    throw new BadRequestException('The file is missing a "Roll No" column.');
  }
  if (!Array.from(columnMap.values()).includes('name')) {
    throw new BadRequestException('The file is missing a "Name" column.');
  }

  const rows: ParsedStudentRow[] = [];
  const errors: ParsedSheet['errors'] = [];

  const limited = dataRows.slice(0, MAX_ROWS);
  limited.forEach((cells, index) => {
    const rowNumber = index + 2; // 1-based, and the header occupies row 1.
    try {
      const parsed: ParsedStudentRow = { rollNo: '', name: '' };
      columnMap.forEach((column, cellIndex) => {
        const value = cells[cellIndex];
        switch (column) {
          case 'rollNo':
            parsed.rollNo = asString(value);
            break;
          case 'name':
            parsed.name = asString(value);
            break;
          default:
            break;
        }
      });

      if (!parsed.rollNo) throw new RowError(rowNumber, 'Roll No is required');
      if (!parsed.name) throw new RowError(rowNumber, 'Name is required');

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
      error: `Only the first ${MAX_ROWS} rows were imported`,
    });
  }

  return { rows, errors };
}

/** Splits a raw CSV buffer into rows of cells, honouring quoted fields. */
export function parseCsv(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(field);
      field = '';
    } else if (char === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
    } else if (char === '\r') {
      // handled by the \n branch
    } else {
      field += char;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

/** Reads the first worksheet of an XLSX/XLS buffer into rows of cells. */
export async function parseExcel(buffer: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new BadRequestException('The spreadsheet has no worksheets.');
  }

  const rows: unknown[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    // ExcelJS pads `values` with a leading `undefined` for the 1-based index.
    rows.push(values.slice(1));
    if (rows.length > MAX_ROWS + 1) return;
  });

  return rows;
}

/**
 * Reads an uploaded student sheet (CSV or Excel) into student records.
 */
export async function parseStudentFile(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  const lower = filename.toLowerCase();
  const isCsv = lower.endsWith('.csv') || lower.endsWith('.txt');

  let matrix: unknown[][];
  if (isCsv) {
    matrix = parseCsv(buffer).map((row) => row as unknown[]);
  } else {
    matrix = await parseExcel(buffer);
  }

  if (!matrix.length) {
    throw new BadRequestException('The file is empty.');
  }

  const [headerRow, ...dataRows] = matrix;
  return parseStudentSheet(headerRow ?? [], dataRows);
}
