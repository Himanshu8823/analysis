/**
 * The Jest setup — what every frontend test gets before it runs.
 *
 * `@testing-library/jest-dom` adds the matchers that let a test assert on
 * what a person sees (`toBeInTheDocument`, `toHaveTextContent`) rather than
 * on the shape of the DOM tree.
 */

import '@testing-library/jest-dom';

/**
 * `matchMedia` is not implemented in jsdom.
 *
 * The sidebar and the dropdown menus ask the browser whether the viewport is
 * wide enough before they render, and the answer decides which layout they
 * draw. A test that renders one of those components needs an answer, so the
 * browser's own rules are implemented here rather than a stub that always
 * says "yes" — a stub that always says yes would make the mobile-only
 * branches of the layout untestable.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

/**
 * `ResizeObserver` is not implemented in jsdom either.
 *
 * The charts and the sidebar watch their own size. Without the observer the
 * component throws on mount, and the test fails for a reason that has
 * nothing to do with the behaviour under test.
 */
if (typeof globalThis !== 'undefined' && !('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

/**
 * `scrollIntoView` is missing from jsdom.
 *
 * Radix's dropdown menus call it on the highlighted item. It is a no-op in a
 * browser test, and its absence would break every menu test with a
 * confusing "not a function" error.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
