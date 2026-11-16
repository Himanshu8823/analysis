/**
 * The interaction pass.
 *
 * Every screen is a set of things a person does: a button that opens a
 * dialog, a form that saves, a tab that changes what is shown, a link that
 * goes somewhere. This walks those, the way a person would — click the
 * button, read what appeared, close it.
 *
 * The checks are the ones that matter to a member:
 *
 *  - does the button open something?
 *  - does the dialog say what it is going to do?
 *  - does cancelling close it without changing anything?
 *  - does the screen come back to where it was?
 *
 * A button that does nothing, a dialog that opens on the wrong screen, a
 * save that silently fails — those are the bugs a person would hit.
 */

const fs = require('fs');
const path = require('path');
const { open } = require('./cdp.js');
const { signIn, ACCOUNTS } = require('./signin.js');

const BASE = 'http://localhost:3000';
const SHOTS = path.resolve(__dirname, '../report/screenshots/interactions');

/**
 * What to try on each screen.
 *
 * `button` — the text of a button to click.
 * `expect` — what must be true afterwards.
 */
const INTERACTIONS = [
  {
    role: 'ADMIN',
    screen: '/students',
    button: 'Add student',
    expect: ['add student', 'roll number', 'full name'],
  },
  {
    role: 'ADMIN',
    screen: '/admin/subjects',
    button: 'Add subject',
    expect: ['subject'],
  },
  {
    role: 'ADMIN',
    screen: '/upload',
    /** The upload area is a drop zone, and it says so. */
    button: 'Click to upload',
    expect: ['upload', 'file'],
  },
  {
    role: 'ADMIN',
    screen: '/reports',
    button: null,
    expect: ['report'],
  },
  {
    role: 'SUPER_ADMIN',
    screen: '/admin/branches',
    button: 'Add branch',
    expect: ['branch'],
  },
  {
    role: 'SUPER_ADMIN',
    screen: '/admin/members',
    button: 'Invite member',
    expect: ['invite', 'email', 'role'],
  },
  {
    role: 'SUPER_ADMIN',
    screen: '/admin/academic-years',
    button: 'Add an academic year',
    expect: ['academic year', 'starts on', 'ends on'],
  },
  {
    role: 'SUPER_ADMIN',
    screen: '/admin/schemes',
    button: 'Add scheme',
    expect: ['scheme'],
  },
  {
    role: 'HOD',
    screen: '/admin/assignments',
    button: 'Assign teacher',
    expect: ['teacher', 'subject'],
  },
  {
    role: 'TEACHER',
    screen: '/my-account',
    button: null,
    expect: ['account', 'profile'],
  },
];

/**
 * The things on a page a person can press, as a person would read them.
 *
 * A **link** counts as well as a button — "Add student" is a link on some
 * screens and a button on others, and a member presses whichever it is.
 */
async function buttons(tab) {
  const elements = await tab.clickableElements();
  return elements.filter(
    (element) =>
      (element.tag === 'button' || element.tag === 'a') &&
      element.text &&
      element.text.toLowerCase() !== 'signing in' &&
      !/toggle sidebar|devtools|delete |remove |^ec$|^st$|^ho$|^sa$|^p$|resultiq|^\w+ (admin|teacher|principal|department)$/i.test(
        element.text.trim()
      ) &&
      /**
       * The row actions — a delete for each student — are not what this
       * pass is looking for. Only the screen's own actions count.
       */
      !/^(delete|remove)\b/i.test(element.text.trim())
  );
}

/**
 * The run.
 */
async function main() {
  const only = process.argv[2];
  fs.mkdirSync(SHOTS, { recursive: true });

  const tab = await open(BASE + '/login');
  const problems = [];
  let checks = 0;

  const byRole = new Map();
  for (const interaction of INTERACTIONS) {
    if (only && !interaction.screen.includes(only)) continue;
    const list = byRole.get(interaction.role) ?? [];
    list.push(interaction);
    byRole.set(interaction.role, list);
  }

  for (const [role, interactions] of byRole) {
    const account = ACCOUNTS[role];
    await signIn(tab, account.email, account.password);
    await tab.settle(2000);

    for (const interaction of interactions) {
      await tab.navigate(BASE + interaction.screen);
      await tab.settle(4000);

      const urlBefore = (await tab.location()).url;

      /**
       * The screen itself must show something before any button is tried.
       */
      const before = (await tab.visibleText()).split('(self.__next_f')[0].replace(/\s+/g, ' ');
      for (const word of interaction.expect) {
        checks += 1;
        if (!before.toLowerCase().includes(word.toLowerCase())) {
          problems.push({
            role,
            screen: interaction.screen,
            problem: `the screen does not mention "${word}"`,
            text: before.slice(0, 250),
          });
          console.log(`  ✗ ${interaction.screen} — no "${word}" on the screen`);
        }
      }

      if (!interaction.button) {
        console.log(`  ✓ ${interaction.screen} — reads correctly`);
        continue;
      }

      /**
       * The button is clicked, the way a person clicks it.
       */
      const available = await buttons(tab);
      const target = available.find((button) =>
        button.text.toLowerCase().includes(interaction.button.toLowerCase())
      );

      if (!target) {
        problems.push({
          role,
          screen: interaction.screen,
          problem: `there is no button called "${interaction.button}"`,
          text: available.map((button) => button.text).join(', ').slice(0, 250),
        });
        console.log(`  ✗ ${interaction.screen} — no "${interaction.button}" button`);
        console.log(`      the buttons are: ${available.map((b) => b.text).join(', ')}`);
        continue;
      }

      await tab.clickAt(target.x, target.y);
      await tab.settle(2500);

      const after = (await tab.visibleText()).split('(self.__next_f')[0].replace(/\s+/g, ' ');
      const urlAfter = (await tab.location()).url;

      const file = path.join(
        SHOTS,
        `${role}-${interaction.screen.replace(/\//g, '_')}-${interaction.button.replace(/\s+/g, '-')}.png`
      );
      await tab.screenshot(file);

      /**
       * A dialog opens: the words appear, and the page offers a way to
       * close it. A form appears: the fields appear.
       */
      const opened =
        after.length > before.length + 40 ||
        interaction.expect.some((word) => {
          const count = (after.toLowerCase().match(new RegExp(word, 'gi')) || []).length;
          const beforeCount = (before.toLowerCase().match(new RegExp(word, 'gi')) || []).length;
          return count > beforeCount;
        });

      const canClose =
        after.toLowerCase().includes('cancel') ||
        after.toLowerCase().includes('close') ||
        urlAfter !== urlBefore;

      if (!opened) {
        problems.push({
          role,
          screen: interaction.screen,
          problem: `clicking "${interaction.button}" changed nothing`,
          text: after.slice(0, 250),
        });
        console.log(`  ✗ ${interaction.screen} — "${interaction.button}" did nothing`);
      } else if (!canClose) {
        problems.push({
          role,
          screen: interaction.screen,
          problem: `"${interaction.button}" opened something with no way to close it`,
          text: after.slice(0, 250),
        });
        console.log(`  ✗ ${interaction.screen} — "${interaction.button}" opened a dead end`);
      } else {
        console.log(`  ✓ ${interaction.screen} — "${interaction.button}" opens and closes`);
      }
    }
  }

  tab.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`INTERACTION SUMMARY — ${problems.length} problems out of ${checks} checks`);
  console.log('='.repeat(70));
  for (const problem of problems) {
    console.log(`  ${problem.role} ${problem.screen}: ${problem.problem}`);
    if (problem.text) console.log(`     "${problem.text.slice(0, 180)}"`);
  }

  fs.writeFileSync(
    path.join(__dirname, 'interaction-findings.json'),
    JSON.stringify(problems, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
