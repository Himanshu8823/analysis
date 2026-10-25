'use client';

interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    /** The primary role — what the header badge shows. */
    role: string;
    /** Every role the member holds. */
    roles?: string[];
    /**
     * The member's effective permissions — the union of every role they
     * hold. The navigation gates on these (§3.1).
     */
    permissions?: string[];
    branchId?: string | null;
    /**
     * When true, the account must change its password before it can use the
     * rest of the application. The backend is the authority on this flag.
     */
    mustChangePassword: boolean;
  };
}

const SESSION_KEY = 'auth_session';

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Replaces the tokens in the stored session.
 *
 * The backend rotates the refresh token on every refresh, so both tokens have
 * to be replaced together — keeping the old refresh token would make the next
 * refresh fail.
 */
export function setSessionTokens(accessToken: string, refreshToken?: string): void {
  const current = getSession();
  if (!current) return;
  current.accessToken = accessToken;
  if (refreshToken) current.refreshToken = refreshToken;
  setSession(current);
}

/** Replaces only the access token. */
export function setSessionToken(accessToken: string): void {
  setSessionTokens(accessToken);
}

/**
 * Updates the cached user in the stored session.
 *
 * Used after a forced password change, so the "must change password" gate
 * does not trap the user in a redirect loop.
 */
export function updateSessionUser(user: Partial<Session['user']>): void {
  const current = getSession();
  if (!current) return;
  current.user = { ...current.user, ...user };
  setSession(current);
}

export function signOut(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}
