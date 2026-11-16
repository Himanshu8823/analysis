/**
 * The responsive pass.
 *
 * Every screen is looked at at the three widths the specification names —
 * mobile below 768px, tablet from 768px, desktop from 1024px — and two
 * things are checked at each:
 *
 *  - **is there a sideways scroll?** A page that has to be swiped
 *    sideways to be read is a page a member on a phone cannot use. The
 *    check is the one a person makes: does the content extend past the
 *    right edge of the screen?
 *  - **are the touch targets big enough?** A button smaller than 44
 *    pixels is a button a finger misses. The specification says 44 pixels
 *    on a phone.
 *
 * A screenshot is taken at each width, so that what was measured can also
 * be looked at.
 */

const fs = require('fs');
const path = require('path');
const { open } = require('./cdp.js');
const { signIn, ACCOUNTS } = require('./signin.js');

const BASE = 'http://localhost:3000';
const SHOTS = path.resolve(__dirname, '../report/screenshots/responsive');

/**
 * The three widths.
 */
const WIDTHS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

/**
 * The screens, and the role that sees them.
 */
const SCREENS = [
  { role: 'STUDENT', path: '/dashboard' },
  { role: 'STUDENT', path: '/my-result' },
  { role: 'STUDENT', path: '/toppers' },
  { role: 'TEACHER', path: '/marks' },
  { role: 'TEACHER', path: '/students' },
  { role: 'TEACHER', path: '/analytics' },
  { role: 'TEACHER', path: '/class-overview' },
  { role: 'HOD', path: '/admin/assignments' },
  { role: 'HOD', path: '/reports' },
  { role: 'ADMIN', path: '/students' },
  { role: 'ADMIN', path: '/admin/publications' },
  { role: 'ADMIN', path: '/upload' },
  { role: 'ADMIN', path: '/reports' },
  { role: 'SUPER_ADMIN', path: '/admin/members' },
  { role: 'SUPER_ADMIN', path: '/admin/roles' },
  { role: 'SUPER_ADMIN', path: '/admin/academic-years' },
  { role: 'SUPER_ADMIN', path: '/admin/schemes' },
  { role: 'SUPER_ADMIN', path: '/admin/audit-log' },
];

/**
 * What the page looks like at a width.
 *
 * The measurement is the one a person would make by eye: how wide is the
 * content, and how wide is the window.
 */
async function measure(tab) {
  const result = await tab.send('Runtime.evaluate', {
    expression: `(() => {
      const doc = document.documentElement;
      const body = document.body;

      /**
       * The widest thing on the page, and what it is. A table that is
       * wider than the window is usually the culprit — unless it is
       * inside a box that scrolls, which is the correct arrangement.
       */
      let widest = null;
      let widestWidth = 0;
      document.querySelectorAll('body *').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > widestWidth && rect.height > 0) {
          widestWidth = rect.width;
          widest = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0,3).join('.') : '');
        }
      });

      /**
       * The touch targets — the things a finger has to hit.
       */
      const small = [];
      document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.height < 44 || rect.width < 44) {
          small.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      });

      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        widest: widest,
        widestWidth: Math.round(widestWidth),
        smallTargets: small.slice(0, 12),
        smallTargetCount: small.length,
        title: document.title,
      };
    })()`,
    returnByValue: true,
  });
  return result.result.value;
}

/**
 * The run.
 */
async function main() {
  const only = process.argv[2];
  fs.mkdirSync(SHOTS, { recursive: true });

  const tab = await open(BASE + '/login');
  const problems = [];

  /**
   * The screens are grouped by role, so that each role is signed in once
   * rather than once per screen.
   */
  const byRole = new Map();
  for (const screen of SCREENS) {
    if (only && !screen.path.includes(only)) continue;
    const list = byRole.get(screen.role) ?? [];
    list.push(screen.path);
    byRole.set(screen.role, list);
  }

  for (const [role, paths] of byRole) {
    const account = ACCOUNTS[role];
    await signIn(tab, account.email, account.password);
    await tab.settle(2000);

    for (const screenPath of paths) {
      for (const size of WIDTHS) {
        await tab.resize(size.width, size.height);
        await tab.navigate(BASE + screenPath);
        await tab.settle(5000);

        const measurement = await measure(tab);

        /**
         * The sideways scroll. A pixel or two of rounding is not a
         * sideways scroll; a table that overflows by a hundred is.
         */
        const overflow = Math.max(
          measurement.scrollWidth - measurement.clientWidth,
          measurement.bodyScrollWidth - measurement.clientWidth
        );

        const file = path.join(
          SHOTS,
          `${role}-${screenPath.replace(/\//g, '_')}-${size.name}.png`
        );
        await tab.screenshot(file);

        const notes = [];

        if (overflow > 2) {
          notes.push(
            `scrolls sideways by ${overflow}px (widest: ${measurement.widest} at ${measurement.widestWidth}px)`
          );
        }

        /**
         * The touch targets. The check is for the phone — on a tablet and
         * a desktop a mouse does not need a 44-pixel target.
         */
        if (size.name === 'mobile' && measurement.smallTargetCount > 0) {
          notes.push(`${measurement.smallTargetCount} touch target(s) under 44px`);
        }

        if (notes.length) {
          console.log(`  ✗ ${screenPath} @ ${size.name} — ${notes.join('; ')}`);
          if (size.name === 'mobile' && measurement.smallTargets.length) {
            for (const small of measurement.smallTargets.slice(0, 5)) {
              console.log(`       ${small.tag} "${small.text}" ${small.w}×${small.h}`);
            }
          }
          problems.push({ role, screen: screenPath, size: size.name, notes, measurement });
        } else {
          console.log(`  ✓ ${screenPath} @ ${size.name}`);
        }
      }
    }
  }

  tab.close();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESPONSIVE SUMMARY — ${problems.length} problems`);
  console.log('='.repeat(70));
  for (const problem of problems) {
    console.log(`  ${problem.role} ${problem.screen} @ ${problem.size}: ${problem.notes.join('; ')}`);
  }

  fs.writeFileSync(
    path.join(__dirname, 'responsive-findings.json'),
    JSON.stringify(problems, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
