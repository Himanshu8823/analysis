/**
 * Email layout shell.
 *
 * Table-based HTML with inline styles only — email clients do not reliably
 * support flexbox, grid, or external stylesheets. Colours come from the
 * Coinbase design tokens (DESIGN.md) so the email matches the product.
 */

export const EMAIL_COLORS = {
  primary: '#0052ff',
  primaryActive: '#003ecc',
  ink: '#0a0b0d',
  body: '#5b616e',
  muted: '#7c828a',
  hairline: '#dee1e6',
  hairlineSoft: '#eef0f3',
  canvas: '#ffffff',
  surfaceSoft: '#f7f7f7',
  surfaceDark: '#0a0b0d',
  onPrimary: '#ffffff',
} as const;

/**
 * Escapes a value for safe interpolation into HTML.
 *
 * The invitee's name and email are user-supplied, so they are the XSS vector
 * in an email body. Every interpolated value must pass through this.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes a value for use inside an `href` attribute.
 *
 * A `javascript:` URL or a stray quote in the query string would otherwise
 * break out of the attribute.
 */
export function escapeUrl(value: string): string {
  return value.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}

export interface EmailLayoutOptions {
  title: string;
  preheader: string;
  bodyHtml: string;
}

/**
 * Wraps content in the shared email shell.
 *
 * `preheader` is the grey preview text shown in the inbox list next to the
 * subject line.
 */
export function renderEmailLayout({ title, preheader, bodyHtml }: EmailLayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:${EMAIL_COLORS.surfaceSoft}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.surfaceSoft}; padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:${EMAIL_COLORS.canvas}; border:1px solid ${EMAIL_COLORS.hairline}; border-radius:12px; overflow:hidden;">

<tr>
<td style="padding:24px 32px; background-color:${EMAIL_COLORS.surfaceDark};">
<p style="margin:0; font-size:15px; font-weight:600; letter-spacing:-0.2px; color:${EMAIL_COLORS.onPrimary};">DBATU Result Analysis</p>
</td>
</tr>

<tr>
<td style="padding:32px;">
${bodyHtml}
</td>
</tr>

<tr>
<td style="padding:20px 32px; background-color:${EMAIL_COLORS.surfaceSoft}; border-top:1px solid ${EMAIL_COLORS.hairlineSoft};">
<p style="margin:0; font-size:12px; line-height:18px; color:${EMAIL_COLORS.muted};">
This is an automated message from the DBATU Result Analysis System. If you were not expecting this invitation, you can safely ignore this email.
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}
