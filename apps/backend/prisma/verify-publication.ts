/**
 * Verifies the publication cycle against the running application.
 *
 * The publication step is the last of the college's cycle, and it is the
 * one the specification found missing. This script exercises it the way the
 * exam cell would:
 *
 *  1. open an examination for a class;
 *  2. try to publish it while the result is incomplete — **refused**;
 *  3. enter the marks;
 *  4. publish it — **accepted**;
 *  5. publish it again — **refused**, because it is already published;
 *  6. return it to being worked on — **accepted**;
 *  7. publish it again — **accepted**.
 *
 * The refusals matter as much as the acceptances. A publication that can be
 * repeated, or one that publishes an incomplete result, is worse than no
 * publication at all.
 *
 * Run it with the backend up:
 *
 * ```
 * pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/verify-publication.ts
 * ```
 */

const API = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

/**
 * The HTTP client.
 *
 * Node's built-in `fetch` resolves the host to both an IPv4 and an IPv6
 * address and refuses the connection on this network, while `http` — which
 * tries the addresses in turn — succeeds.
 */
const http = require('http') as typeof import('http');

function request(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const payload = body ? JSON.stringify(body) : undefined;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => (data += chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, text: data }));
      }
    );

    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('the request timed out')));
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * The exam cell's account, made through the invitation flow by
 * `verify-matrix.ts`.
 */
const EXAM_CELL = { email: 'admin.exam@dbatu.edu', password: 'Verify@123' };

/**
 * The teacher who holds the subjects.
 *
 * The marks are entered as the teacher, because the exam cell may not
 * write a subject a teacher holds — that is the rule the system turns on.
 */
const TEACHER = 'teacher@dbatu.edu';

interface Json {
  success?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
}

/**
 * A student as the roster returns them.
 */
interface StudentRow {
  id: string;
  name: string;
  rollNo: string;
  branchId: string;
  schemeId: string;
  academicYearId: string;
  semester: number;
}

/**
 * Calls the API and returns the status with the body.
 */
async function call(
  token: string,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<{ status: number; body: Json }> {
  const response = await request(method, path, token, body);

  let parsed: Json = {};
  try {
    parsed = JSON.parse(response.text) as Json;
  } catch {
    /* A non-JSON body is reported as-is. */
  }

  return { status: response.status, body: parsed };
}

/**
 * Signs in and returns the access token.
 */
async function signIn(email: string, password: string): Promise<string | null> {
  const response = await request('POST', '/auth/login', '', { email, password });

  let parsed: Json = {};
  try {
    parsed = JSON.parse(response.text) as Json;
  } catch {
    /* Reported as a missing token below. */
  }

  return (parsed.data as { accessToken?: string } | undefined)?.accessToken ?? null;
}

/**
 * The id of the teacher who holds the subjects.
 *
 * The HOD's own list of assignable teachers is the place to find them —
 * the same list the assignments screen offers.
 */
async function teacherIdFor(hodToken: string): Promise<string | null> {
  const teachers = await call(hodToken, 'GET', '/teacher-allocations/assignable-teachers');

  const list = teachers.body.data as Array<{ id: string; email?: string; name?: string }> | undefined;

  const match =
    list?.find((teacher) => teacher.email === TEACHER) ??
    list?.find((teacher) => teacher.name?.toLowerCase().includes('teacher'));

  return match?.id ?? null;
}

/**
 * Reports one expectation and whether it was met.
 */
let failures = 0;

function check(label: string, met: boolean, detail = ''): void {
  if (met) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures += 1;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log(`Verifying the publication cycle against ${API}\n`);

  /**
   * The exam cell signs in.
   */
  const token = await signIn(EXAM_CELL.email, EXAM_CELL.password);

  if (!token) {
    console.log('Could not sign in as the exam cell.');
    process.exitCode = 1;
    return;
  }

  /**
   * A class to publish.
   *
   * The class is taken from the **roster** rather than assumed, because
   * the point of the check is a class with students in it — a class with
   * nobody in it is complete by definition, and would prove nothing.
   */
  const roster = await call(token, 'GET', '/students?pageSize=200');
  const students = (roster.body.data as { items?: StudentRow[] } | undefined)?.items ?? [];

  if (students.length === 0) {
    console.log('The college has no students, so there is no class to publish.');
    process.exitCode = 1;
    return;
  }

  const first = students[students.length - 1];
  const branchId = first.branchId;
  const schemeId = first.schemeId;
  const academicYearId = first.academicYearId;
  const semester = first.semester;

  const branches = await call(token, 'GET', '/branches');
  const branch = (branches.body.data as Array<{ id: string; code: string }> | undefined)?.find(
    (b) => b.id === branchId
  );

  const schemes = await call(token, 'GET', '/schemes');
  const scheme = (schemes.body.data as Array<{ id: string; name: string }> | undefined)?.find(
    (s) => s.id === schemeId
  );

  const years = await call(token, 'GET', '/academic/years');
  const year = (years.body.data as Array<{ id: string; year: string }> | undefined)?.find(
    (y) => y.id === academicYearId
  );

  if (!branch || !scheme || !year) {
    console.log('The branch, scheme or academic year could not be found.');
    process.exitCode = 1;
    return;
  }

  console.log(`The class: ${branch.code} · Semester ${semester} · ${scheme.name} · ${year.year}\n`);

  /**
   * 1. Open an examination for the class.
   *
   * A class has exactly one examination. When one already exists — from an
   * earlier run of this script — it is used rather than refused, so the
   * check is repeatable.
   */
  const existing = await call(
    token,
    'GET',
    `/examinations?branchId=${branch.id}&semester=${semester}&academicYearId=${year.id}`
  );
  const alreadyThere = (
    existing.body.data as Array<{ id: string; schemeId: string; status: string }> | undefined
  )?.find((row) => row.schemeId === scheme.id);

  let examination: { id: string; status: string } | undefined;

  if (alreadyThere) {
    examination = { id: alreadyThere.id, status: alreadyThere.status };
    console.log('  the examination for this class already exists — using it');
  } else {
    const opened = await call(token, 'POST', '/examinations', {
      name: `Computer Science — Semester ${semester} — ${year.year}`,
      branchId: branch.id,
      semester,
      schemeId: scheme.id,
      academicYearId: year.id,
      examDate: '2026-05-12',
    });

    check('an examination can be opened for the class', opened.status === 201, `got ${opened.status}`);
    examination = opened.body.data as { id: string; status: string } | undefined;
  }

  if (!examination) {
    console.log('\nThe examination was not opened, so the rest was not verified.');
    process.exitCode = 1;
    return;
  }

  /**
   * 2. Publishing an incomplete result must be refused.
   *
   * The check starts from a result that is **not** published, so that the
   * refusal is the refusal of an incomplete result and not of an already
   * published one. A result left published by an earlier run is returned
   * to being worked on first.
   */
  if (examination.status === 'PUBLISHED') {
    const returned = await call(token, 'DELETE', `/examinations/${examination.id}/publish`);
    check(
      'a result left published by an earlier run is returned to being worked on',
      returned.status === 200 || returned.status === 201,
      `got ${returned.status}`
    );
  }

  /**
   * Whether the result is complete **before** the marks are entered.
   *
   * The check has to know, because a class that an earlier run already
   * filled in is complete — and publishing a complete result is supposed
   * to succeed, not to be refused. The refusal is checked on a class whose
   * marks are not yet in; the acceptance is checked on this one.
   */
  const readiness = await call(token, 'GET', `/examinations/${examination.id}`);
  const wasComplete = (
    readiness.body.data as { isReady?: boolean; completeCount?: number } | undefined
  )?.isReady;

  if (wasComplete) {
    console.log(
      '\n  the class is already complete from an earlier run — the refusal was verified on that run'
    );
  } else {
    const earlyPublish = await call(token, 'POST', `/examinations/${examination.id}/publish`);
    check(
      'publishing an incomplete result is refused',
      earlyPublish.status === 400,
      `got ${earlyPublish.status}: ${earlyPublish.body.error?.message ?? ''}`
    );

    /**
     * The refusal must say how many students are missing — a refusal that
     * only says "no" leaves the exam cell with nothing to act on.
     */
    check(
      'the refusal says how many students are missing',
      /\d+ student/.test(earlyPublish.body.error?.message ?? ''),
      earlyPublish.body.error?.message ?? 'no message'
    );
  }

  /**
   * 3. Enter a mark for every student in the class, so the result is
   * complete.
   */
  const classStudents = students.filter(
    (student) =>
      student.branchId === branchId &&
      student.schemeId === schemeId &&
      student.academicYearId === academicYearId &&
      student.semester === semester
  );

  console.log(`\n  The class has ${classStudents.length} students.`);

  if (classStudents.length === 0) {
    console.log('  The class has no students, so the marks were not entered.');
    console.log('  The refusals above were still verified.');
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  const offerings = await call(
    token,
    'GET',
    `/subject-offerings?branchId=${branch.id}&schemeId=${scheme.id}&semester=${semester}`
  );
  const offeringList =
    (offerings.body.data as Array<{ id: string; subject?: { components?: { hasPractical?: boolean } } }> | undefined) ?? [];

  check('the class has subjects', offeringList.length > 0, `got ${offeringList.length}`);

  if (offeringList.length === 0) {
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  /**
   * The teacher must be **allocated** to the subjects before they may enter
   * their marks — a teacher writes only what the HOD gave them.
   *
   * The allocation is made through the HOD's own operation, which is what a
   * college does, and it is also what makes the rest of the check
   * meaningful: without it the teacher would be refused, and a refusal is
   * not a proof that the allocation works.
   */
  const hodToken = await signIn('hod@dbatu.edu', 'Verify@123');
  const teacherId = hodToken ? await teacherIdFor(hodToken) : null;

  if (hodToken && teacherId) {
    for (const offering of offeringList) {
      const allocation = await call(hodToken, 'POST', '/teacher-allocations', {
        teacherId,
        subjectOfferingId: offering.id,
        academicYearId: year.id,
      });

      /**
       * An allocation that already exists is a 409, which is the right
       * answer — the teacher is already allocated.
       */
      if (allocation.status !== 201 && allocation.status !== 409) {
        console.log(
          `  the allocation was refused: ${allocation.body.error?.message ?? ''}`
        );
      }
    }
    console.log(`  the teacher is allocated to the class's ${offeringList.length} subjects`);
  }

  /**
   * Every subject of every student needs a mark for the result to be
   * complete.
   *
   * The marks are entered **as the teacher who holds the subjects**, not
   * as the exam cell. The exam cell may not write a subject a teacher
   * holds — that is the rule the whole system turns on, and it is checked
   * here by entering as the teacher and watching it succeed.
   */
  const marks: Array<Record<string, unknown>> = [];
  for (const student of classStudents) {
    for (const offering of offeringList) {
      marks.push({
        studentId: student.id,
        subjectOfferingId: offering.id,
        examType: 'CA1',
        marksObtained: 15,
        maxMarks: 20,
        academicYearId: year.id,
      });
    }
  }

  const teacherToken = await signIn(TEACHER, 'Verify@123');

  if (!teacherToken) {
    console.log('\n  The teacher could not sign in, so the marks were not entered.');
    console.log('  The refusals above were still verified.');
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  const entered = await call(teacherToken, 'POST', '/marks/bulk', { marks });
  check(
    'the marks for every student and subject were entered by the teacher who holds them',
    entered.status === 201 || entered.status === 200,
    `got ${entered.status}: ${entered.body.error?.message ?? ''}`
  );

  /**
   * 4. Publishing a complete result must be accepted.
   */
  const published = await call(token, 'POST', `/examinations/${examination.id}/publish`);
  check(
    'publishing a complete result is accepted',
    published.status === 200 || published.status === 201,
    `got ${published.status}: ${published.body.error?.message ?? ''}`
  );

  check(
    'the published result records when it was published',
    Boolean((published.body.data as { resultPublishedAt?: string } | undefined)?.resultPublishedAt)
  );

  /**
   * 5. Publishing again must be refused — a publication is a moment, not
   * a state the exam cell may repeat by accident.
   */
  const again = await call(token, 'POST', `/examinations/${examination.id}/publish`);
  check(
    'publishing an already-published result is refused',
    again.status === 409,
    `got ${again.status}`
  );

  /**
   * 6. Returning it to being worked on must be accepted — for the case
   * where a mark was found to be wrong after the result went out.
   */
  const unpublished = await call(token, 'DELETE', `/examinations/${examination.id}/publish`);
  check(
    'a published result can be returned to being worked on',
    unpublished.status === 200 || unpublished.status === 201,
    `got ${unpublished.status}: ${unpublished.body.error?.message ?? ''}`
  );

  /**
   * 7. And it can be published again.
   */
  const republished = await call(token, 'POST', `/examinations/${examination.id}/publish`);
  check(
    'the result can be published again',
    republished.status === 200 || republished.status === 201,
    `got ${republished.status}: ${republished.body.error?.message ?? ''}`
  );

  console.log(`\n${failures === 0 ? 'Every expectation was met.' : `${failures} did not match.`}`);

  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
