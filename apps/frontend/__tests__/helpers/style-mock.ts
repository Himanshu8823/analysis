/**
 * The stand-in for a stylesheet import.
 *
 * A test does not care what a CSS file contains — only that importing it
 * does not break the test. Jest's moduleNameMapper points every `.css`
 * import here.
 */
export default {};
