/**
 * The authorisation matrix, verified against the **running** application.
 *
 * The specification asks for the matrix to be checked by logging in as each
 * of the six roles and asserting what each one may and may not do. Reading
 * the source is not the same thing: a route can be guarded by the right
 * permission and still leak, if the service layer does not enforce the
 * scope.
 *
 * So this script talks to the live API.
 *
 * ## The accounts are made the way a college makes them
 *
 * The seed creates only the Super Admin. The other five roles are created
 * through the **invitation flow** — the same one a college administrator
 * uses — and the acceptance link comes from the invitation email, read from
 * the mailbox the backend was pointed at.
 *
 * Creating the accounts by writing to the database instead would test a
 * system that does not exist: the invitation flow is what creates the
 * account, assigns the role, sets the branch scope and sends the email, and
 * it is part of what is being verified.
 *
 * ## The mailbox
 *
 * `mail-capture.ts` is a local SMTP server that keeps the mail. The
 * backend is pointed at it with `SMTP_HOST` and `SMTP_PORT`, which the
 * mailer already reads. Only the postbox differs — the invitation flow
 * itself is untouched.
 *
 * Run the capture, then the backend, then this:
 *
 * ```
 * pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/mail-capture.ts
 * pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/verify-matrix.ts
 * ```
 *
 * The base URL may be overridden with `API_BASE_URL`.
 */

import { waitForToken } from './mail-capture';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

/**
 * The password every verification account chooses.
 *
 * These are throwaway accounts for checking the matrix. The password obeys
 * the product's own policy, because the acceptance endpoint enforces it.
 */
const PASSWORD = 'Verify@123';

/**
 * The seed's Super Admin — the only account the seed creates, and the one
 * that may invite.
 */
const SUPER_ADMIN = { email: 'admin@dbatu.edu', password: 'Admin@123' };

/**
 * The accounts to create, one per role.
 *
 * `SUPER_ADMIN` is absent: the seed already made it, and the invite flow
 * deliberately cannot grant it — a Super Admin must not be able to mint a
 * second one.
 */
const ACCOUNTS: Array<{
  email: string;
  name: string;
  role: string;
  branchCode?: string;
}> = [
  { email: 'admin.exam@dbatu.edu', name: 'Exam Cell Admin', role: 'ADMIN' },
  { email: 'hod@dbatu.edu', name: 'Head of Department', role: 'HOD', branchCode: 'CS' },
  {
    email: 'principal@dbatu.edu',
    name: 'Principal',
    role: 'PRINCIPAL',
    branchCode: 'CS',
  },
  {
    email: 'teacher@dbatu.edu',
    name: 'Subject Teacher',
    role: 'TEACHER',
    branchCode: 'CS',
  },
  {
    /**
     * The STUDENT role is **not** branch-scoped. A student's branch comes
     * from their student record, not from their role — a student is
     * appointed, not appointed to a branch. The invitation therefore
     * carries no branch.
     */
    email: 'student@dbatu.edu',
    name: 'Student',
    role: 'STUDENT',
  },
];

/**
 * A check: a route, and the status it should give for a role.
 */
interface Check {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** The status each role should get, by role name. */
  expect: Partial<Record<string, number>>;
}

const checks: Check[] = [
  {
    label: 'the dashboard',
    method: 'GET',
    path: '/dashboard',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 200,
    },
  },
  {
    label: 'the member roster',
    method: 'GET',
    path: '/students?page=1&pageSize=5',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      /** A student reads their own record through their own path, never the
       *  whole college's roster. */
      STUDENT: 403,
    },
  },
  {
    label: 'the marks of a class',
    method: 'GET',
    path: '/marks',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the member list (administration)',
    method: 'GET',
    path: '/users/members?page=1&pageSize=5',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 403,
      HOD: 403,
      PRINCIPAL: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    label: 'the audit trail',
    method: 'GET',
    path: '/audit-logs',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 403,
      HOD: 403,
      PRINCIPAL: 200,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    label: 'the role catalogue',
    method: 'GET',
    path: '/roles',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 403,
      HOD: 403,
      PRINCIPAL: 403,
      TEACHER: 403,
      STUDENT: 403,
    },
  },
  {
    label: 'the branches',
    method: 'GET',
    path: '/branches',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the subjects',
    method: 'GET',
    path: '/subjects',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the reports',
    method: 'GET',
    path: '/reports',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      /**
       * A teacher holds `reports:read` — the seed grants it, because a
       * teacher who enters marks needs to see the class's report. The
       * listing is scoped to what they may see.
       */
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the analytics',
    method: 'GET',
    path: '/analytics/overview',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the upload history',
    method: 'GET',
    path: '/upload/jobs',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 403,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: "a student's own record",
    method: 'GET',
    path: '/students/own',
    expect: {
      /**
       * Only a student reads their own record through this path. The staff
       * read the roster instead — the route is the *own* route, and giving
       * the staff access to it would be a second way in.
       */
      SUPER_ADMIN: 403,
      ADMIN: 403,
      HOD: 403,
      PRINCIPAL: 403,
      TEACHER: 403,
      STUDENT: 200,
    },
  },
  {
    label: 'the academic years',
    method: 'GET',
    path: '/academic/years',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the class-teacher assignments',
    method: 'GET',
    path: '/class-teacher-assignments',
    expect: {
      /**
       * The Super Admin configures the college but does not allocate its
       * teaching staff — that is the HOD's duty. The seed grants the
       * Super Admin no allocation permission, so the route refuses them.
       */
      SUPER_ADMIN: 403,
      ADMIN: 403,
      HOD: 200,
      PRINCIPAL: 403,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the teacher allocations',
    method: 'GET',
    path: '/teacher-allocations',
    expect: {
      SUPER_ADMIN: 403,
      ADMIN: 403,
      HOD: 200,
      PRINCIPAL: 403,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
  {
    label: 'the scheme reader availability',
    method: 'GET',
    path: '/scheme-reader/availability',
    expect: {
      SUPER_ADMIN: 200,
      ADMIN: 200,
      /**
       * The route asks one question: "is the AI reading available?". It
       * carries no academic data, and it is guarded by `schemes:read` — a
       * permission the HOD, the Principal and the Teacher all hold.
       */
      HOD: 200,
      PRINCIPAL: 200,
      TEACHER: 200,
      STUDENT: 403,
    },
  },
];

/**
 * Signs in and returns the access token.
 */
async function login(email: string, password: string): Promise<string | null> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await response.json()) as {
    data?: { accessToken?: string };
    error?: { message?: string };
  };

  return body.data?.accessToken ?? null;
}

/**
 * Calls a route and returns its status.
 */
async function call(
  token: string,
  check: Check
): Promise<{ status: number; body: string }> {
  const response = await fetch(`${API}${check.path}`, {
    method: check.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(check.body ? { body: JSON.stringify(check.body) } : {}),
  });

  const text = await response.text();
  return { status: response.status, body: text };
}

/**
 * Creates one account through the invitation flow.
 *
 * An account that already exists is not re-created — a college does not
 * invite the same person twice, and the invitation would be refused. The
 * account is simply used.
 */
async function createThroughInvitation(
  superAdminToken: string,
  account: (typeof ACCOUNTS)[number],
  branchId: string | undefined
): Promise<boolean> {
  /**
   * The account may already exist from an earlier run. Signing in is the
   * way to find out — an invitation would be refused for an address that
   * is already on the roll.
   */
  if (await login(account.email, PASSWORD)) {
    console.log(`  ${account.email} — ${account.role} (already on the roll)`);
    return true;
  }

  const requestedAt = Date.now();

  const invite = await fetch(`${API}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      email: account.email,
      name: account.name,
      roleName: account.role,
      ...(branchId ? { branchId } : {}),
    }),
  });

  const inviteBody = (await invite.json()) as {
    success: boolean;
    error?: { message?: string };
  };

  if (!inviteBody.success) {
    console.log(
      `  ${account.email} — the invitation was refused: ${inviteBody.error?.message ?? 'unknown reason'}`
    );
    return false;
  }

  /**
   * Only a message that arrived *after* the invitation carries a token
   * that is still good — asking twice withdraws the first one.
   */
  const token = await waitForToken(account.email, requestedAt);
  if (!token) {
    console.log(`  ${account.email} — no invitation email arrived`);
    return false;
  }

  const accept = await fetch(`${API}/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: PASSWORD }),
  });

  const acceptBody = (await accept.json()) as {
    success: boolean;
    error?: { message?: string };
  };

  if (!acceptBody.success) {
    console.log(
      `  ${account.email} — the invitation could not be accepted: ${acceptBody.error?.message ?? 'unknown reason'}`
    );
    return false;
  }

  console.log(`  ${account.email} — ${account.role} (through the invitation flow)`);
  return true;
}

async function main() {
  console.log(`Verifying the authorisation matrix against ${API}\n`);

  const superAdminToken = await login(SUPER_ADMIN.email, SUPER_ADMIN.password);
  if (!superAdminToken) {
    console.log('Could not sign in as the Super Admin, so nothing was verified.');
    console.log('The seed prints the Super Admin password when it runs.');
    process.exitCode = 1;
    return;
  }

  /**
   * The branch the branch-scoped roles work in. The branch id comes from
   * the application, not from the database.
   */
  const branches = (await (
    await fetch(`${API}/branches`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    })
  ).json()) as { data?: Array<{ id: string; code: string }> };

  const cs = branches.data?.find((branch) => branch.code === 'CS');
  if (!cs) {
    console.log('The CS branch could not be found.');
    process.exitCode = 1;
    return;
  }

  console.log('Creating the accounts through the invitation flow…');
  for (const account of ACCOUNTS) {
    const branchId = account.branchCode ? cs.id : undefined;
    await createThroughInvitation(superAdminToken, account, branchId);
  }

  console.log('\nSigning in as each role…');

  const tokens = new Map<string, string>();
  const signIn: Array<{ email: string; role: string; password: string }> = [
    { email: SUPER_ADMIN.email, role: 'SUPER_ADMIN', password: SUPER_ADMIN.password },
    ...ACCOUNTS.map((account) => ({
      email: account.email,
      role: account.role,
      password: PASSWORD,
    })),
  ];

  for (const account of signIn) {
    const token = await login(account.email, account.password);
    if (!token) {
      console.log(`  could not sign in as ${account.email}`);
      continue;
    }
    tokens.set(account.role, token);
  }

  if (tokens.size === 0) {
    console.log('No account could be signed in, so nothing was verified.');
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  let total = 0;

  console.log('\nThe matrix:');
  for (const check of checks) {
    const row: string[] = [];

    for (const account of signIn) {
      const expected = check.expect[account.role];
      if (expected === undefined) continue;

      const token = tokens.get(account.role);
      if (!token) {
        row.push(`${account.role}: —`);
        continue;
      }

      const { status, body } = await call(token, check);
      total += 1;

      if (status === expected) {
        row.push(`${account.role}: ${status}`);
      } else {
        failures += 1;
        row.push(`${account.role}: ${status} (expected ${expected}) ${body.slice(0, 100)}`);
      }
    }

    const mark = row.some((entry) => entry.includes('expected')) ? '✗' : '✓';
    console.log(`${mark} ${check.label}`);
    console.log(`    ${row.join('  |  ')}`);
  }

  console.log(`\n${total - failures} of ${total} expectations met.`);

  if (failures > 0) {
    console.log(`${failures} did not match.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
