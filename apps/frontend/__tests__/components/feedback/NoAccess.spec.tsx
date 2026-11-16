/**
 * The test for the refusal screen.
 *
 * §1.7 says a 403 is never a dead end. That is a promise about what the
 * member sees when they are refused, so it is tested against what they see.
 *
 * The two things that must be true:
 *
 *  1. The screen says **why**, in language a college member uses — not a
 *     permission name, not a role name, not an error code.
 *  2. The screen offers a way back, so the member is never stranded.
 *
 * And one thing that must *not* be true: the screen must not list what the
 * member may not see. A refusal that enumerates the screens the member is
 * denied tells them which parts of the college exist that they cannot
 * reach — the very leak §1.6 exists to prevent.
 */

import { render, screen } from '@testing-library/react';

import { NoAccess } from '@/components/feedback/NoAccess';

describe('NoAccess', () => {
  it('names the screen the member asked for', () => {
    render(<NoAccess screenLabel="Marks Entry" />);

    expect(
      screen.getByRole('heading', { name: /marks entry screen/i }),
    ).toBeInTheDocument();
  });

  it('says why without naming a permission or a role', () => {
    render(<NoAccess screenLabel="Students" reason="role" />);

    const text = document.body.textContent ?? '';

    expect(text).toMatch(/your role does not include/i);
    expect(text).not.toMatch(/students:read/);
    expect(text).not.toMatch(/students:write/);
    expect(text).not.toMatch(/HOD|TEACHER|ADMIN|PRINCIPAL/);
  });

  it('offers a way back to the dashboard', () => {
    render(<NoAccess screenLabel="Students" />);

    const link = screen.getByRole('link', { name: /back to the dashboard/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('offers the account page as a second way back', () => {
    render(<NoAccess screenLabel="Students" />);

    const link = screen.getByRole('link', { name: /view my account/i });
    expect(link).toHaveAttribute('href', '/my-account');
  });

  /**
   * The refusal must not tell the member what they *cannot* see.
   *
   * A screen that says "you cannot open the audit log, the member list or
   * the role settings" has told them the college has those screens and
   * where they are — which is the leak the model forbids.
   */
  it('does not list the screens the member is denied', () => {
    render(<NoAccess screenLabel="Students" />);

    const text = document.body.textContent ?? '';

    expect(text).not.toMatch(/audit log/i);
    expect(text).not.toMatch(/role settings/i);
    expect(text).not.toMatch(/member list/i);
  });

  it('reads sensibly when the screen is not known', () => {
    render(<NoAccess />);

    expect(
      screen.getByRole('heading', { name: /you do not have access to this screen/i }),
    ).toBeInTheDocument();
  });

  /**
   * The scope reason is different from the role reason: a branch-scoped
   * member refused a screen sees a different explanation, because the thing
   * to fix is different. An administrator will correct a role; they will
   * correct a branch assignment.
   */
  it('explains a scope refusal in terms of the branch', () => {
    render(<NoAccess screenLabel="Class Overview" reason="scope" />);

    const text = document.body.textContent ?? '';

    expect(text).toMatch(/branch/i);
    expect(text).toMatch(/assignment/i);
  });
});
