/**
 * Signs in as a member, the way a person does.
 *
 * Clicks the email field, types the address, clicks the password field,
 * types the password, clicks **Sign in** — and then waits for the page to
 * change. It does not call the API and it does not set a token: the point
 * is to go through the same door the member goes through, so that anything
 * broken on that door is noticed.
 */

/**
 * The accounts the testing uses.
 *
 * The Super Admin is the one the seed creates. The other five were made
 * through the invitation flow by `prisma/verify-matrix.ts`, which is how a
 * college makes them.
 */
const ACCOUNTS = {
  SUPER_ADMIN: { email: 'admin@dbatu.edu', password: 'Admin@123' },
  ADMIN: { email: 'admin.exam@dbatu.edu', password: 'Verify@123' },
  HOD: { email: 'hod@dbatu.edu', password: 'Verify@123' },
  PRINCIPAL: { email: 'principal@dbatu.edu', password: 'Verify@123' },
  TEACHER: { email: 'teacher@dbatu.edu', password: 'Verify@123' },
  STUDENT: { email: 'student@dbatu.edu', password: 'Verify@123' },
};

/**
 * Signs in.
 *
 * @param tab   The connected tab.
 * @param email The address to type.
 * @param password The password to type.
 * @returns Where the page ended up, and what it says.
 */
async function signIn(tab, email, password) {
  /**
   * The session is cleared first.
   *
   * A member who is already signed in is bounced straight past the login
   * form to their dashboard, so without this the form is never seen and
   * the test signs in as whoever was signed in before.
   */
  await tab.send('Storage.clearDataForOrigin', {
    origin: 'http://localhost:3000',
    storageTypes: 'all',
  });
  await tab.navigate('http://localhost:3000/login');

  /**
   * The form is waited for rather than assumed. The development server
   * compiles a route the first time it is asked for, and the first request
   * after a restart can take a while.
   */
  let fields = await tab.clickableElements();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const hasForm = fields.some((f) => f.type === 'email' && f.type === 'password');
    if (hasForm) break;
    await tab.settle(1500);
    fields = await tab.clickableElements();
  }

  const emailField = fields.find((f) => f.type === 'email');
  const passwordField = fields.find((f) => f.type === 'password');

  if (!emailField || !passwordField) {
    return {
      ok: false,
      reason: 'the sign-in form did not appear',
      text: await tab.visibleText(),
    };
  }

  await tab.clickAt(emailField.x, emailField.y);
  await tab.typeText(email);

  await tab.clickAt(passwordField.x, passwordField.y);
  await tab.typeText(password);

  /**
   * The **Sign in** button is pressed, the way a person presses it.
   *
   * The button is looked up again after the fields are filled: filling a
   * field can move the page, and a click on stale coordinates hits nothing.
   */
  const freshFields = await tab.clickableElements();
  const signInButton = freshFields.find(
    (f) => f.tag === 'button' && /^sign in$/i.test(f.text)
  );

  if (!signInButton) {
    return {
      ok: false,
      reason: 'the sign-in button did not appear',
      text: await tab.visibleText(),
    };
  }

  await tab.clickAt(signInButton.x, signInButton.y);

  /**
   * The wait is for the page to actually change, not for a fixed number
   * of milliseconds — a slow machine is not a broken one.
   */
  let location = await tab.location();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await tab.settle(600);
    location = await tab.location();
    if (!location.url.includes('/login')) break;
  }
  await tab.settle(1500);

  const text = await tab.visibleText();

  /**
   * The shell shows a spinner until the member's record has arrived. A
   * person waits for it; a test that navigates straight away would see the
   * spinner and conclude the screen is broken.
   */
  if (!location.url.includes('/login')) {
    await tab.waitForSession();
  }

  return {
    ok: !location.url.includes('/login'),
    location,
    text,
    errors: tab.errors(),
    failures: tab.failures(),
  };
}

module.exports = { signIn, ACCOUNTS };
