/**
 * Email (SMTP) configuration.
 *
 * Generic SMTP — works with any provider (Gmail, Office365, Amazon SES, or a
 * college's own mail server). The common case is port 587 with STARTTLS
 * (`SMTP_SECURE=false`); port 465 uses implicit TLS (`SMTP_SECURE=true`).
 */
export default () => ({
  email: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? '',
    fromName: process.env.SMTP_FROM_NAME ?? 'DBATU Result Analysis',
    /** Used to build the accept-invite link that goes in the email. */
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    /** Invitation lifetime in hours. 168 = 7 days. */
    inviteTtlHours: parseInt(process.env.INVITE_TOKEN_TTL_HOURS ?? '168', 10),
    /** Password-reset link lifetime in minutes. */
    passwordResetTtlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '30', 10),
  },
});
