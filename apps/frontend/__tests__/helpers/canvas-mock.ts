/**
 * The stand-in for the optional `canvas` package.
 *
 * jsdom loads `canvas` when it can resolve it, and uses it to render
 * `<canvas>` elements and to measure text. On this machine the package is
 * present but its **native binding** was never built, so requiring it throws
 * `Cannot find module '../build/Release/canvas.node'` and takes the whole
 * test environment down with it.
 *
 * The application does not draw to a canvas — the charts are SVG — so the
 * stub is enough: it satisfies jsdom's optional dependency check and lets
 * the environment start. A test that genuinely needed canvas rendering
 * would need the native package built, which is a different problem from
 * the one this stub solves.
 */
export default {};
