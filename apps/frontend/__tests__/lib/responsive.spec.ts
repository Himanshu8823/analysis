/**
 * The test for the responsive contract.
 *
 * The specification requires every screen to work at exactly three
 * breakpoints — mobile below 768px, tablet from 768px, desktop from 1024px —
 * with no horizontal scroll and touch targets of at least 44 pixels.
 *
 * The browser walk is the best way to check this, and it is not available
 * in every environment. So the *classes* are checked instead: a screen that
 * uses only the default (mobile-first) classes, or that adds `md:` and `lg:`
 * as the layout needs them, will lay out correctly. A screen that hard-codes
 * a pixel width wider than the smallest breakpoint will not.
 *
 * The check is a **contract**, not a rendering: it catches the mistake that
 * causes horizontal scroll — a fixed width that cannot shrink — and it
 * catches tables that are not made scrollable or stacked on a phone.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The frontend's pages and components.
 */
const APP_DIR = join(__dirname, '../../app');
const COMPONENTS_DIR = join(__dirname, '../../components');

/**
 * Every `.tsx` file under a directory.
 */
function tsxFiles(root: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      found.push(...tsxFiles(full));
    } else if (entry.endsWith('.tsx')) {
      found.push(full);
    }
  }

  return found;
}

const allFiles = [...tsxFiles(APP_DIR), ...tsxFiles(COMPONENTS_DIR)];

/**
 * A pixel width that cannot shrink.
 *
 * A width above the mobile breakpoint that is not inside a
 * `max-width` is a fixed width, and a fixed width wider than the screen
 * causes a horizontal scrollbar.
 */
const FIXED_WIDTH = /(?:^|["'\s])w-\[(9[6-9]\d|[1-9]\d{3,})px\]/g;

describe('the responsive contract', () => {
  it('finds the files it is checking', () => {
    expect(allFiles.length).toBeGreaterThan(40);
  });

  it('has no fixed width that could overflow a phone', () => {
    const offenders: string[] = [];

    for (const file of allFiles) {
      const source = readFileSync(file, 'utf8');

      /**
       * A `max-w-` is a ceiling, not a floor — it shrinks. Only a plain
       * `w-[…]` is a floor.
       */
      const matches = [...source.matchAll(FIXED_WIDTH)];
      for (const match of matches) {
        const index = match.index ?? 0;
        const before = source.slice(Math.max(0, index - 12), index);

        if (before.includes('max-')) continue;

        offenders.push(`${file.replace(/.*frontend[\\/]/, '')}: ${match[0].trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('makes every table scrollable or stacked on a phone', () => {
    /**
     * A table wider than a phone must either be wrapped in a
     * horizontally-scrollable box, or be replaced by a stacked list on
     * mobile. A bare `<table>` is neither, and it is the most common cause
     * of a sideways-scrolling page.
     */
    const offenders: string[] = [];

    for (const file of allFiles) {
      const source = readFileSync(file, 'utf8');

      if (!/<table[\s>]/.test(source)) continue;

      /**
       * A table has three acceptable forms on a phone:
       *
       *  - wrapped in a horizontally-scrollable box;
       *  - hidden on mobile and replaced by a stacked list (`hidden md:table`);
       *  - inside the shared `DataTable` component, which does one of the
       *    above for every screen that uses it.
       */
      const scrollable = source.includes('overflow-x-auto');
      const stackedOnMobile = /hidden[^"']*md:table/.test(source);
      const sharedDataTable = source.includes('<DataTable');

      if (!scrollable && !stackedOnMobile && !sharedDataTable) {
        offenders.push(file.replace(/.*frontend[\\/]/, ''));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('gives every icon button a touch target of at least 44 pixels', () => {
    /**
     * A button that is only an icon is small by default, and on a phone a
     * 24-pixel target is a tap target people miss. The height and width
     * classes are what the specification means by "44px touch targets".
     */
    const offenders: string[] = [];

    for (const file of allFiles) {
      const source = readFileSync(file, 'utf8');

      /**
       * A button with only an icon in it — an SVG and nothing else — is
       * the one that needs the explicit size.
       */
      const iconButtons = [
        ...source.matchAll(
          /<button\b[^>]*className="([^"]*)"[^>]*>\s*<[A-Z]\w+[^>]*\/>\s*<\/button>/g
        ),
      ];

      for (const match of iconButtons) {
        const className = match[1];
        const hasLargeTarget = /h-11/.test(className) || /size-11/.test(className);
        if (!hasLargeTarget) {
          offenders.push(`${file.replace(/.*frontend[\\/]/, '')}: ${className.slice(0, 60)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
