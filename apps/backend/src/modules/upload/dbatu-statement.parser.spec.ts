import { parseDbatuStatementLines } from './dbatu-statement.parser';

/**
 * The printed statement, exactly as the examination cell produces it.
 *
 * The subject header marks the boundary between one subject's block and the
 * next with a `|`. The row below it names the components of each block. The
 * same subject code appears twice — once for its theory part and once for
 * its practical.
 */
const STATEMENT_LINES = [
  "G P's Convent of College of Engineering, Jalgaon",
  'Department of Computer Engg. (A.Y. 2025-26) Sem – VII',
  'Result Analysis L.Y.B.Tech Div-A (A.V.2025-26)',
  'Roll  PRN No        Name        BTCOM701:INT | BTCOM701:PR | BTCOM702:INT | Total Marks | Percentage | SGPA | Result',
  'No                           CA1 CA2 MID WR     CA1 CA2 MID WR     CA1 CA2 MID WR              Marks',
  '1    225171126001   AISHWARYA CHAUDHARY   16  17  24  53   15  14  25  56   18  18  30  57   479   79.83  8.11  Pass',
  '2    225171126002   PATIL LOKESH GAUTAM    12  16  23  58   14  13  26  55   17  16  28  54   363   60.50  6.87  Pass',
];

describe('parseDbatuStatementLines', () => {
  it('expands one student row into one mark per component', () => {
    const { rows } = parseDbatuStatementLines(STATEMENT_LINES);

    // Three subject blocks of four components each = 12 marks per student,
    // across two students.
    expect(rows).toHaveLength(24);
  });

  it('reads the marks of the first student into the right components', () => {
    const { rows } = parseDbatuStatementLines(STATEMENT_LINES);
    const first = rows.filter((r) => r.rollNo === '225171126001');

    expect(first).toEqual(
      expect.arrayContaining([
        { rollNo: '225171126001', subjectCode: 'BTCOM701', examType: 'CA1', marksObtained: 16, maxMarks: 20 },
        { rollNo: '225171126001', subjectCode: 'BTCOM701', examType: 'CA2', marksObtained: 17, maxMarks: 20 },
        { rollNo: '225171126001', subjectCode: 'BTCOM701', examType: 'MID_SEM', marksObtained: 24, maxMarks: 30 },
        { rollNo: '225171126001', subjectCode: 'BTCOM701', examType: 'WRITTEN', marksObtained: 53, maxMarks: 100 },
        { rollNo: '225171126001', subjectCode: 'BTCOM702', examType: 'CA1', marksObtained: 18, maxMarks: 20 },
        { rollNo: '225171126001', subjectCode: 'BTCOM702', examType: 'WRITTEN', marksObtained: 57, maxMarks: 100 },
      ])
    );
  });

  it('records the practical block as the practical of its subject', () => {
    const { rows } = parseDbatuStatementLines(STATEMENT_LINES);
    const first = rows.filter((r) => r.rollNo === '225171126001');

    /**
     * The practical block is printed with the same component names as a
     * theory one. It must be recorded under the subject's practical, or it
     * would overwrite the theory marks — a mark is keyed on the student,
     * the subject and the exam type.
     */
    const practical = first.filter((r) => r.examType === 'PRACTICAL');
    expect(practical.length).toBeGreaterThan(0);
    expect(practical.every((r) => r.subjectCode === 'BTCOM701')).toBe(true);

    // The theory marks of the same subject are still there.
    expect(first.some((r) => r.examType === 'CA1' && r.marksObtained === 16)).toBe(true);
  });

  it('keys the marks on the PRN number, not the roll number', () => {
    const { rows } = parseDbatuStatementLines(STATEMENT_LINES);
    expect(rows.every((r) => r.rollNo.startsWith('225171126'))).toBe(true);
  });

  it('never records the summary columns as marks', () => {
    const { rows } = parseDbatuStatementLines(STATEMENT_LINES);

    // `Total Marks`, `Percentage`, `SGPA` and `Result` are the college's
    // own arithmetic — they must not become a mark for some subject.
    expect(rows.some((r) => r.marksObtained === 479 || r.marksObtained === 79.83)).toBe(false);
    expect(rows.every((r) => r.subjectCode.startsWith('BTCOM'))).toBe(true);
  });

  it('reads the second student as well as the first', () => {
    const { rows } = parseDbatuStatementLines(STATEMENT_LINES);
    const second = rows.filter((r) => r.rollNo === '225171126002');

    expect(second).toHaveLength(12);
    expect(second).toEqual(
      expect.arrayContaining([
        { rollNo: '225171126002', subjectCode: 'BTCOM701', examType: 'CA1', marksObtained: 12, maxMarks: 20 },
        { rollNo: '225171126002', subjectCode: 'BTCOM702', examType: 'WRITTEN', marksObtained: 54, maxMarks: 100 },
      ])
    );
  });

  it('records a literal Fail as a zero mark rather than dropping the row', () => {
    const { rows } = parseDbatuStatementLines([
      'Roll  PRN No        Name        BTCOM701:INT | Total Marks | Result',
      'No                           CA1 CA2 MID WR              Marks',
      '1    225171126004   PATIL SACHIN SURESH    9  10  20  45   209   Fail',
    ]);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].marksObtained).toBe(9);
    expect(rows[0].isAbsent).toBeUndefined();
  });

  it('records a literal Absent as an absent mark', () => {
    const { rows } = parseDbatuStatementLines([
      'Roll  PRN No        Name        BTCOM701:INT | Result',
      'No                           CA1 CA2 MID WR',
      '1    225171126005   SOME STUDENT    Absent  11  12  13   Fail',
    ]);

    const absent = rows.find((r) => r.examType === 'CA1');
    expect(absent?.isAbsent).toBe(true);
    expect(absent?.marksObtained).toBe(0);
  });

  it('reports a row with no identifier instead of guessing one', () => {
    const { rows, errors } = parseDbatuStatementLines([
      'Roll  PRN No        Name        BTCOM701:INT',
      'No                           CA1 CA2 MID WR',
      '                        SOME STUDENT   10  11  12  13',
    ]);

    expect(rows).toHaveLength(0);
    expect(errors[0].error).toMatch(/PRN No or Roll No/);
  });

  it('rejects a file that names no subject', () => {
    expect(() =>
      parseDbatuStatementLines([
        'Roll  PRN No        Name        Total Marks',
        'No                           Marks',
        '1    225171126006   SOME STUDENT   479',
      ])
    ).toThrow(/does not look like a printed result statement/);
  });

  it('rejects a mark that exceeds the component maximum', () => {
    const { rows, errors } = parseDbatuStatementLines([
      'Roll  PRN No        Name        BTCOM701:INT',
      'No                           CA1 CA2 MID WR',
      '1    225171126007   SOME STUDENT   45  11  12  13',
    ]);

    // The bad cell is reported and skipped; the good ones still land.
    expect(errors.some((e) => e.error.includes('exceeds the maximum'))).toBe(true);
    expect(rows.some((r) => r.marksObtained === 45)).toBe(false);
    expect(rows.some((r) => r.marksObtained === 11)).toBe(true);
  });
});
