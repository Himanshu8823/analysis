/**
 * A layout probe for the browser walk.
 *
 * It answers two questions about the page as it is actually rendered:
 *
 *  - does the page scroll sideways? A screen that scrolls sideways on a
 *    phone is unusable, whatever else is true about it.
 *  - is every control big enough to tap? A target under 44 pixels is
 *    hard to hit with a thumb, and a mis-tap on a "Delete" button is not a
 *    mistake the user can undo.
 *
 * It is a script rather than a test because it is used against a running
 * server, from the browser tools, on every screen and every breakpoint.
 * The results are read by eye and by the summary it prints.
 */

window.__layoutProbe = function layoutProbe() {
  const de = document.documentElement;
  const vw = de.clientWidth;

  /**
   * The elements that stick out past the right edge.
   *
   * An element inside an SVG is skipped: a chart's circles are clipped by
   * the chart's own box, so their geometry says nothing about the page.
   */
  const offenders = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (el.ownerSVGElement) continue;
    const style = getComputedStyle(el);
    if (style.position === 'fixed' || style.display === 'none' || style.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 50),
        right: Math.round(r.right),
      });
    }
  }

  /**
   * The controls that are too small to tap.
   *
   * A link whose whole content is a word is not a touch target — the text
   * is the target and the text is 16 pixels tall. The rule applies to
   * buttons, and to links that carry an icon of their own.
   */
  const small = [];
  const seen = new Set();
  for (const el of Array.from(document.querySelectorAll('button, a[href], [role="button"], input, select, textarea'))) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (style.position === 'absolute' && style.clip === 'rect(0px, 0px, 0px, 0px)') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // A link with no text of its own is usually inside a sentence; the
    // sentence is what the user aims at.
    const text = (el.textContent || '').trim();
    const isTextLink = el.tagName === 'A' && text.length > 0 && el.querySelectorAll('svg, img, button').length === 0;
    if (isTextLink) continue;

    if (r.height < 44 || r.width < 44) {
      const key = el.tagName + '|' + Math.round(r.top) + '|' + Math.round(r.left);
      if (seen.has(key)) continue;
      seen.add(key);
      small.push({
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 30),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }

  return {
    url: location.pathname,
    viewport: { w: vw, h: de.clientHeight },
    scrollWidth: de.scrollWidth,
    hasHorizontalScroll: de.scrollWidth > de.clientWidth + 1,
    overflowCount: offenders.length,
    offenders: offenders.slice(0, 5),
    smallTargetCount: small.length,
    smallTargets: small.slice(0, 10),
  };
};

'ready';
