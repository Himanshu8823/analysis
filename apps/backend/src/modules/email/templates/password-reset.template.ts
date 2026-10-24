import { EMAIL_COLORS, escapeHtml, escapeUrl, renderEmailLayout } from './layout';

export interface PasswordResetEmailOptions {
  /** The account holder's display name. */
  name: string;
  /** The account holder's email address. */
  email: string;
  /** The full reset-password URL, including the one-time token. */
  resetUrl: string;
  /** When the link expires. */
  expiresAt: Date;
  /** The institution name shown in the copy. */
  institutionName?: string;
}

/** Formats a date for display, e.g. "25 October 2026, 14:30". */
function formatExpiry(expiresAt: Date): string {
  return expiresAt.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Renders the password-reset email.
 *
 * The link is one-time: the server stores only the SHA-256 hash of the raw
 * token, and consuming the link invalidates it.
 */
export function renderPasswordResetEmail(options: PasswordResetEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const institution = options.institutionName ?? 'your institution';
  const safeName = escapeHtml(options.name);
  const safeEmail = escapeHtml(options.email);
  const safeUrl = escapeUrl(options.resetUrl);
  const expiry = formatExpiry(options.expiresAt);

  const subject = 'Reset your DBATU Result Analysis password';

  const bodyHtml = `
<p style="margin:0 0 16px; font-size:15px; line-height:24px; color:${EMAIL_COLORS.body};">
Hello ${safeName},
</p>

<p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${EMAIL_COLORS.body};">
We received a request to reset the password for your DBATU Result Analysis System account (${safeEmail}). Use the button below to choose a new one.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
<tr>
<td bgcolor="${EMAIL_COLORS.primary}" style="border-radius:8px;">
<a href="${safeUrl}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; text-decoration:none; color:${EMAIL_COLORS.onPrimary}; border-radius:8px;">Reset password</a>
</td>
</tr>
</table>

<p style="margin:0 0 16px; font-size:13px; line-height:20px; color:${EMAIL_COLORS.muted};">
This link can only be used once, and it expires on ${escapeHtml(expiry)}. If you did not request a password reset you can safely ignore this email — your password will not change.
</p>

<p style="margin:0; font-size:13px; line-height:20px; color:${EMAIL_COLORS.muted};">
If the button above does not work, copy this link into your browser:<br>
<a href="${safeUrl}" style="color:${EMAIL_COLORS.primary}; word-break:break-all;">${escapeHtml(options.resetUrl)}</a>
</p>
`;

  const text = `Hello ${options.name},

We received a request to reset the password for your DBATU Result Analysis System account (${options.email}).

Reset your password by opening this link:

${options.resetUrl}

The link can only be used once and expires on ${expiry}. If you did not request this, you can ignore this email.

— DBATU Result Analysis System`;

  return {
    subject,
    html: renderEmailLayout({
      title: subject,
      preheader: 'Reset your DBATU Result Analysis System password.',
      bodyHtml,
    }),
    text,
  };
}
