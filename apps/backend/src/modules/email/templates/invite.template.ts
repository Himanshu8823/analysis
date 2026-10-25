import { EMAIL_COLORS, escapeHtml, escapeUrl, renderEmailLayout } from './layout';

export interface InviteEmailOptions {
  /** The invitee's display name. */
  name: string;
  /** The invitee's email address. */
  email: string;
  /** The role the invite assigns. */
  roleName: string;
  /** The full accept-invite URL, including the one-time token. */
  inviteUrl: string;
  /** When the invitation expires. */
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
 * Renders the invitation email.
 *
 * The invitee sets their own password when they accept — no temporary
 * password is ever generated or sent.
 */
export function renderInviteEmail(options: InviteEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const institution = options.institutionName ?? 'your institution';
  const safeName = escapeHtml(options.name);
  const safeEmail = escapeHtml(options.email);
  const safeRole = escapeHtml(options.roleName);
  const safeUrl = escapeUrl(options.inviteUrl);
  const expiry = formatExpiry(options.expiresAt);

  const subject = `You've been invited to the DBATU Result Analysis System`;

  const bodyHtml = `
<p style="margin:0 0 16px; font-size:15px; line-height:24px; color:${EMAIL_COLORS.body};">
Hello ${safeName},
</p>

<p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${EMAIL_COLORS.body};">
You have been invited to join the DBATU Result Analysis System for ${institution}. You will be able to analyse results, generate reports, and manage academic data for your department.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px; background-color:${EMAIL_COLORS.surfaceSoft}; border:1px solid ${EMAIL_COLORS.hairline}; border-radius:8px;">
<tr>
<td style="padding:20px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding:0 0 12px; font-size:12px; letter-spacing:0.4px; text-transform:uppercase; color:${EMAIL_COLORS.muted};">Your invitation</td>
</tr>
<tr>
<td style="padding:0 0 8px; font-size:14px; color:${EMAIL_COLORS.muted};">Email</td>
<td style="padding:0 0 8px; font-size:14px; font-weight:600; color:${EMAIL_COLORS.ink};">${safeEmail}</td>
</tr>
<tr>
<td style="padding:0 0 8px; font-size:14px; color:${EMAIL_COLORS.muted};">Role</td>
<td style="padding:0 0 8px; font-size:14px; font-weight:600; color:${EMAIL_COLORS.ink};">${safeRole}</td>
</tr>
<tr>
<td style="padding:0; font-size:14px; color:${EMAIL_COLORS.muted};">Expires</td>
<td style="padding:0; font-size:14px; font-weight:600; color:${EMAIL_COLORS.ink};">${escapeHtml(expiry)}</td>
</tr>
</table>
</td>
</tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
<tr>
<td bgcolor="${EMAIL_COLORS.primary}" style="border-radius:8px;">
<a href="${safeUrl}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; text-decoration:none; color:${EMAIL_COLORS.onPrimary}; border-radius:8px;">Accept invitation</a>
</td>
</tr>
</table>

<p style="margin:0 0 16px; font-size:13px; line-height:20px; color:${EMAIL_COLORS.muted};">
You will choose your own password on the next screen. This link can only be used once, and it expires on ${escapeHtml(expiry)}.
</p>

<p style="margin:0; font-size:13px; line-height:20px; color:${EMAIL_COLORS.muted};">
If the button above does not work, copy this link into your browser:<br>
<a href="${safeUrl}" style="color:${EMAIL_COLORS.primary}; word-break:break-all;">${escapeHtml(options.inviteUrl)}</a>
</p>
`;

  const text = `Hello ${options.name},

You have been invited to join the DBATU Result Analysis System.

  Email:  ${options.email}
  Role:   ${options.roleName}
  Expires: ${expiry}

Accept your invitation by opening this link:

${options.inviteUrl}

You will choose your own password on the next screen. The link can only be used once.

— DBATU Result Analysis System`;

  return {
    subject,
    html: renderEmailLayout({
      title: subject,
      preheader: `Accept your invitation to the DBATU Result Analysis System as ${options.roleName}.`,
      bodyHtml,
    }),
    text,
  };
}
