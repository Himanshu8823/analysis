/**
 * Walks the application the way a person does.
 *
 * For each role: sign in, visit every screen that role is offered, and
 * read what is on the screen. Anything the screen says is wrong — an
 * access refusal where the screen was offered, a console error, a failed
 * request, an empty page — is a bug, and it is written to
 * `latest-bugs.md`.
 *
 * The point is to look at the app the way a member looks at it: to click
 * a link and see what happens, to read the words that are on the screen,
 * to notice the empty table and the red banner.
 */

const fs = require('fs');
const path = require('path');
const { open } = require('./cdp.js');
const { signIn, ACCOUNTS } = require('./signin.js');

const BASE = 'http://localhost:3000';
const SHOTS = path.resolve(__dirname, '../report/screenshots/testing');

/**
 * The screens each role is offered, and the screens that must **not**
 * appear for them.
 */
const SCREENS = {
  SUPER_ADMIN: [
    '/dashboard',
    '/admin/branches',
    '/admin/academic-years',
    '/admin/schemes',
    '/admin/schemes/new',
    '/admin/schemes/read',
    '/admin/subjects',
    '/admin/subjects/new',
    '/admin/subjects/offerings/new',
    '/admin/members',
    '/admin/members/new',
    '/admin/roles',
    '/admin/audit-log',
    '/my-account',
    '/change-password',
  ],
  ADMIN: [
    '/dashboard',
    '/students',
    '/students/new',
    '/students/import',
    '/students/bulk-provision',
    '/admin/subjects',
    '/admin/subjects/new',
    '/admin/subjects/offerings/new',
    '/marks',
    '/marks/correct',
    '/upload',
    '/upload-history',
    '/reports',
    '/analytics',
    '/admin/publications',
    '/toppers',
    '/my-account',
    '/change-password',
  ],
  HOD: [
    '/dashboard',
    '/students',
    '/marks',
    '/reports',
    '/analytics',
    '/admin/assignments',
    '/admin/subjects',
    '/toppers',
    '/class-overview',
    '/my-account',
    '/change-password',
  ],
  PRINCIPAL: [
    '/dashboard',
    '/students',
    '/marks',
    '/reports',
    '/analytics',
    '/toppers',
    '/admin/audit-log',
    '/my-account',
    '/change-password',
  ],
  TEACHER: [
    '/dashboard',
    '/students',
    '/marks',
    '/upload',
    '/upload-history',
    '/reports',
    '/analytics',
    '/admin/assignments',
    '/class-overview',
    '/toppers',
    '/my-account',
    '/change-password',
  ],
  STUDENT: [
    '/dashboard',
    '/my-result',
    '/toppers',
    '/my-account',
    '/change-password',
  ],
};

/**
 * The screens that must **not** be reachable by a role.
 *
 * A refusal here is correct behaviour, and is checked so that a later
 * change that opens a screen by accident is noticed.
 */
const FORBIDDEN = {
  /**
   * The Super Admin may **read** the marks — it supervises the academic
   * data — but it may not write them, and it may not add students or
   * invite members through the roster screens.
   */
  SUPER_ADMIN: ['/students/new'],
  /**
   * The exam cell may **read** the branches — it needs to know which branch
   * it is working in — but it may not manage them, and it may not touch the
   * member list or the roles.
   */
  ADMIN: ['/admin/members', '/admin/roles'],
  HOD: ['/admin/members', '/admin/roles', '/marks/correct', '/upload'],
  PRINCIPAL: ['/admin/members', '/marks', '/admin/assignments', '/upload'],
  TEACHER: ['/admin/members', '/admin/roles', '/students/new', '/marks/correct'],
  STUDENT: ['/students', '/marks', '/reports', '/analytics', '/admin/members'],
};

/**
 * The words that mean something went wrong.
 */
const REFUSAL_WORDS = [
  'you do not have access',
  'do not have access to this',
  'insufficient permissions',
  'not found',
  'this page could not be found',
  'something went wrong',
  'internal error',
];

/**
 * The words that mean a screen has nothing to show, which is a different
 * thing from being broken.
 */
const EMPTY_WORDS = [
  'no ',
  'not ',
  'none',
  'nothing',
  'yet',
];

/**
 * Reads the visible text, without the Next.js payload a person never sees.
 */
async function readScreen(tab) {
  const text = await tab.visibleText();
  return text.split('(self.__next_f')[0].trim();
}

/**
 * Is this screen refusing the member?
 */
function isRefusal(text) {
  const lower = text.toLowerCase();
  return REFUSAL_WORDS.some((word) => lower.includes(word));
}

/**
 * Walks one role.
 */
async function walkRole(tab, role) {
  const account = ACCOUNTS[role];
  const screens = SCREENS[role] ?? [];
  const forbidden = FORBIDDEN[role] ?? [];

  console.log(`\n${'='.repeat(70)}`);
  console.log(`${role} — ${account.email}`);
  console.log('='.repeat(70));

  const signInResult = await signIn(tab, account.email, account.password);
  if (!signInResult.ok) {
    console.log(`  ✗ COULD NOT SIGN IN — ${signInResult.location?.url}`);
    console.log(`     ${signInResult.text.slice(0, 300)}`);
    return [{ role, screen: '(sign in)', problem: 'could not sign in', text: signInResult.text }];
  }
  console.log(`  signed in → ${signInResult.location.url}`);

  const problems = [];

  for (const screen of screens) {
    tab.consoleMessages = [];
    tab.networkRequests = [];

    await tab.navigate(BASE + screen);

    /**
     * The page is given time to finish. The development server compiles a
     * route the first time it is asked for, so the first visit to a screen
     * is much slower than the ones after it — and a person would wait for
     * the page rather than look at a spinner.
     */
    await tab.settle(7000);

    const text = await readScreen(tab);
    const url = (await tab.location()).url;
    const errors = tab.errors();
    const failures = tab.failures();

    const notes = [];

    if (url.includes('/login')) {
      notes.push('signed out — the screen bounced to the login page');
    }
    if (isRefusal(text)) {
      notes.push('the screen refuses the member');
    }
    if (errors.length) {
      notes.push(`${errors.length} console error(s)`);
    }
    if (failures.length) {
      notes.push(`${failures.length} failed request(s)`);
    }
    if (text.length < 60) {
      notes.push('the page is nearly empty');
    }

    /**
     * The screenshot is taken for every screen — a picture is what a
     * person would look at.
     */
    const file = path.join(SHOTS, `${role}-${screen.replace(/\//g, '_') || 'root'}.png`);
    await tab.screenshot(file);

    if (notes.length) {
      console.log(`  ✗ ${screen} — ${notes.join('; ')}`);
      for (const failure of failures.slice(0, 4)) {
        console.log(`       ${failure.status} ${failure.url.replace('http://localhost:3001/api/v1', '')}`);
      }
      for (const error of errors.slice(0, 3)) {
        console.log(`       console: ${error.text.slice(0, 160)}`);
      }
      problems.push({ role, screen, problem: notes.join('; '), text: text.slice(0, 400), failures, errors });
    } else {
      console.log(`  ✓ ${screen}`);
    }
  }

  /**
   * The screens that must be refused.
   */
  for (const screen of forbidden) {
    tab.consoleMessages = [];
    tab.networkRequests = [];

    await tab.navigate(BASE + screen);
    await tab.settle(2000);

    const text = await readScreen(tab);
    const url = (await tab.location()).url;

    /**
     * A refusal is correct. What is not correct is the screen letting
     * the member in.
     *
     * The refusal is recognised by the page saying so — "You do not have
     * access to ..." — with a way back. A member who is refused lands on a
     * page that explains it and offers a way forward; that is the correct
     * behaviour, and it is what makes a refusal not a dead end.
     *
     * The text is flattened first: the page wraps its sentences across
     * lines, so "access to" and "the Members screen" can land on different
     * lines and a plain search would miss the phrase.
     */
    const flat = text.toLowerCase().replace(/\s+/g, ' ');
    const saidNo = flat.includes('do not have access') || flat.includes('not found');
    const offeredAWayBack =
      flat.includes('back to the dashboard') ||
      flat.includes('view my account') ||
      flat.includes('go back');

    const wasLetIn = !saidNo && !url.includes('/login');

    if (wasLetIn) {
      console.log(`  ✗ ${screen} — SHOULD HAVE BEEN REFUSED but was not`);
      problems.push({
        role,
        screen,
        problem: 'a screen that should be refused was opened',
        text: text.slice(0, 300),
      });
    } else if (!offeredAWayBack) {
      console.log(`  ✗ ${screen} — refused, but with no way back`);
      problems.push({
        role,
        screen,
        problem: 'a refusal with no way back — a dead end',
        text: text.slice(0, 300),
      });
    } else {
      console.log(`  ✓ ${screen} — refused, with a way back`);
    }
  }

  return problems;
}

/**
 * The run.
 */
async function main() {
  const only = process.argv[2];
  const roles = only ? [only] : Object.keys(SCREENS);

  fs.mkdirSync(SHOTS, { recursive: true });

  const tab = await open(BASE + '/login');
  const allProblems = [];

  for (const role of roles) {
    const problems = await walkRole(tab, role);
    allProblems.push(...problems);
  }

  tab.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`SUMMARY — ${allProblems.length} problems across ${roles.length} roles`);
  console.log('='.repeat(70));

  for (const problem of allProblems) {
    console.log(`  ${problem.role} → ${problem.screen}: ${problem.problem}`);
  }

  /**
   * The findings are written to a file, so that they are not lost between
   * runs and can be turned into the bug document.
   */
  const outFile = path.join(__dirname, 'walk-findings.json');
  fs.writeFileSync(outFile, JSON.stringify(allProblems, null, 2));
  console.log(`\nfindings written to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
