'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NoAccessProps {
  /**
   * The screen the member asked for.
   *
   * Named so the answer can be specific ("you cannot open the Marks Entry
   * screen") rather than a generic refusal. When it is unknown, the copy
   * falls back to a wording that does not pretend to know more than it does.
   */
  screenLabel?: string;
  /**
   * Why the member cannot open it, in the language of the person reading it.
   *
   * The most common reasons are: the member's role does not include this
   * screen, and the screen belongs to a branch the member is not part of.
   */
  reason?: 'role' | 'scope' | 'unknown';
  /**
   * Where the member can go instead.
   *
   * The dashboard is always reachable, so it is the default destination.
   */
  homeHref?: string;
  className?: string;
}

/**
 * NoAccess — the answer to "I cannot open this page".
 *
 * A refusal that only redirects is a dead end: the member typed a path, the
 * page bounced them somewhere else, and nothing told them why. That reads as
 * a broken system rather than as a decision, and it is the reason §1.7 says
 * a 403 is never a dead end.
 *
 * This screen answers the three questions the member actually has:
 *
 *  1. *What happened* — "you do not have access to this screen".
 *  2. *Why* — the role or the scope, said in a sentence, never a code.
 *  3. *What now* — a way back to somewhere they can work.
 *
 * It deliberately does not list the screens the member *does* have access to.
 * That list would tell a member which parts of the college they may not see,
 * which is exactly the leak §1.6 exists to prevent. The navigation already
 * shows what they can reach.
 */
export function NoAccess({
  screenLabel,
  reason = 'unknown',
  homeHref = '/dashboard',
  className,
}: NoAccessProps) {
  const subject = screenLabel ? `the ${screenLabel} screen` : 'this screen';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center md:py-20',
        className,
      )}
    >
      <span
        className="mb-4 inline-flex size-11 items-center justify-center rounded-full bg-surface-strong text-muted"
        aria-hidden
      >
        <ShieldAlert className="size-5" />
      </span>

      <h1 className="font-display text-title-md text-ink">
        You do not have access to {subject}
      </h1>

      <p className="mt-2 max-w-md text-body-sm text-body">{explain(reason)}</p>

      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <Button variant="secondary" asChild className="w-full sm:w-auto">
          <Link href={homeHref}>
            <ArrowLeft aria-hidden />
            Back to the dashboard
          </Link>
        </Button>
        <Button variant="ghost" asChild className="w-full sm:w-auto">
          <Link href="/my-account">
            <Compass aria-hidden />
            View my account
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * The reason, said in one sentence.
 *
 * Written for the person reading it: no permission names, no role names, no
 * jargon. A member who is told "you need `marks:write`" learns nothing they
 * can act on; a member who is told "your role does not include entering marks
 * for every subject" understands immediately.
 */
function explain(reason: 'role' | 'scope' | 'unknown'): string {
  switch (reason) {
    case 'role':
      return 'Your role does not include this part of the system. If you need it for your work, ask an administrator to give you the relevant access.';
    case 'scope':
      return 'This screen shows information for a branch or class that is not part of your assignment. If that is wrong, ask an administrator to check your branch.';
    default:
      return 'Your role does not include this part of the system. If you need it for your work, ask an administrator to give you the relevant access.';
  }
}
