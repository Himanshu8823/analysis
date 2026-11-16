import { parseMarksFile, isStatementText } from './marks-file.parser';

/**
 * The printed statement, exactly as the examination cell produces it.
 *
 * The columns are separated by spaces, not by commas — this is a *text*
 * layout. A file saved from it as `.csv` is still a text layout, and must be
 * read as one.
 */
const STATEMENT_TEXT = [
  "G P's Convent of College of Engineering, Jalgaon",
  'Department of Computer Engg. (A.Y. 2025-26) Sem – VII',
  'Result Analysis L.Y.B.Tech Div-A (A.V.2025-26)',
  'Roll  PRN No        Name        BTCOM701:INT | BTCOM701:PR | BTCOM702:INT | BTCOM703:INT | Total Marks | Percentage | SGPA | Result',
  'No                           CA1 CA2 MID WR     CA1 CA2 MID WR     CA1 CA2 MID WR              Marks',
  '1    225171126001   AISHWARYA CHAUDHARY   16  17  24  53   15  14  25  56   18  18  30  57   479   79.83  8.11  Pass',
  '2    225171126002   PATIL LOKESH GAUTAM    12  16  23  58   14  13  26  55   17  16  28  54   363   60.50  6.87  Pass',
].join('\n');

/**
 * The subject codes the statement actually carries marks for.
 *
 * `BTCOM703` is named in the header but the sub-header row gives it no
 * components, so it has no columns of its own. It is skipped rather than
 * given a guessed set of components, which would read the summary columns
 * (`Total Marks`, `Percentage`) as marks.
 */
const STATEMENT_SUBJECTS = ['BTCOM701', 'BTCOM702'];

/**
 * The tidy sheet: one row per mark, comma-separated.
 */
const TIDY_CSV = [
  'Roll No,Subject Code,Exam Type,Marks,Max Marks',
  'TCS001,CS101,WRITTEN,38,45',
  'TCS002,CS101,WRITTEN,42,45',
  'TCS003,CS101,CA1,15,20',
].join('\n');

describe('parseMarksFile', () => {
  it('reads a printed statement that was saved as a csv file', async () => {
    const { rows, errors } = await parseMarksFile(
      Buffer.from(STATEMENT_TEXT, 'utf8'),
      'statement.csv'
    );

    expect(errors).toEqual([]);
    // Three subject blocks of four components each, for two students.
    expect(rows).toHaveLength(24);

    const first = rows.find(
      (r) => r.rollNo === '225171126001' && r.subjectCode === 'BTCOM701' && r.examType === 'CA1'
    );
    expect(first).toEqual({
      rollNo: '225171126001',
      subjectCode: 'BTCOM701',
      examType: 'CA1',
      marksObtained: 16,
      maxMarks: 20,
    });
  });

  it('records a statement mark against the subject code without its part marker', async () => {
    const { rows } = await parseMarksFile(
      Buffer.from(STATEMENT_TEXT, 'utf8'),
      'statement.csv'
    );

    const subjects = new Set(rows.map((r) => r.subjectCode));
    expect(subjects).toEqual(new Set(STATEMENT_SUBJECTS));
  });

  it('reads a tidy sheet unchanged', async () => {
    const { rows, errors } = await parseMarksFile(
      Buffer.from(TIDY_CSV, 'utf8'),
      'marks.csv'
    );

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      rollNo: 'TCS001',
      subjectCode: 'CS101',
      examType: 'WRITTEN',
      marksObtained: 38,
      maxMarks: 45,
    });
  });

  it('reports a row whose mark exceeds its maximum without discarding the file', async () => {
    const csv = [
      'Roll No,Subject Code,Exam Type,Marks,Max Marks',
      'TCS002,CS101,WRITTEN,Fail,45',
      'TCS003,CS101,WRITTEN,,45',
      'TCS004,CS101,WRITTEN,28/40,40',
      'TCS005,CS101,WRITTEN,150,45',
    ].join('\n');

    const { rows, errors } = await parseMarksFile(Buffer.from(csv, 'utf8'), 'edge.csv');

    expect(rows).toHaveLength(3);
    expect(errors).toHaveLength(1);
    expect(errors[0].error).toContain('must be between 0 and 45');
  });

  it('rejects a file with no recognisable header', async () => {
    await expect(
      parseMarksFile(Buffer.from('nothing,useful\n1,2\n', 'utf8'), 'junk.csv')
    ).rejects.toThrow(/no recognisable header row/i);
  });
});

describe('isStatementText', () => {
  it('recognises a printed statement', () => {
    expect(isStatementText(STATEMENT_TEXT.split('\n'))).toBe(true);
  });

  it('does not mistake a tidy sheet for a statement', () => {
    expect(isStatementText(TIDY_CSV.split('\n'))).toBe(false);
  });
});
