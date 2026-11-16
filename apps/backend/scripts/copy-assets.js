/**
 * Copies the backend's static assets into the build output.
 *
 * The build produces `dist/`, and the assets the application reads at
 * runtime — the report templates, the fonts — live in `assets/`. Without
 * this copy the built application starts but cannot find them.
 *
 * This is a file rather than an inline `node -e "..."` in `package.json`
 * because a command with nested quotes inside it is quoted differently by
 * every shell, and the ones that differ are the ones that break. A script
 * file has no quoting rules to get wrong.
 */

const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', 'assets');
const destination = path.resolve(__dirname, '..', 'dist', 'assets');

if (!fs.existsSync(source)) {
  // Nothing to copy is not a failure: a deployment without assets is a
  // valid configuration, and a build that stops here would be wrong.
  console.log('No assets directory — nothing to copy.');
  process.exit(0);
}

fs.cpSync(source, destination, { recursive: true });
console.log(`Copied assets to ${path.relative(process.cwd(), destination)}.`);
