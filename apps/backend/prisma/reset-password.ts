/**
 * Restores a member's password through the **product's own** reset flow.
 *
 * The seed deliberately does not reset a password on re-run — a college
 * that changes its admin password must not have it silently changed by the
 * next deploy. That is the right behaviour, and it means a verification
 * account whose password was changed needs the same route a person uses:
 * ask for a reset, read the email, follow the link.
 *
 * This script does exactly that, against the running application.
 *
 * Run it with the backend up:
 *
 * ```
 * pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/reset-password.ts <email> <new-password>
 * ```
 */

import { waitForToken } from './mail-capture';

const API = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: reset-password <email> <new-password>');
    process.exitCode = 1;
    return;
  }

  const requestedAt = Date.now();

  const requested = await fetch(`${API}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  console.log(`reset requested: ${requested.status}`);

  /**
   * Only a message that arrived *after* the request carries a token that
   * is still good — asking for a reset twice withdraws the first link.
   */
  const token = await waitForToken(email, requestedAt);
  if (!token) {
    console.log('no reset email arrived');
    process.exitCode = 1;
    return;
  }

  const reset = await fetch(`${API}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  const body = (await reset.json()) as { error?: { message?: string } };

  if (!reset.ok) {
    console.log(`the reset was refused: ${body.error?.message ?? reset.status}`);
    process.exitCode = 1;
    return;
  }

  console.log(`the password for ${email} was reset.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
