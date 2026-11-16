/**
 * A local SMTP server that captures the invitation and reset emails.
 *
 * ## Why this exists
 *
 * The verification needs to read the acceptance link out of the
 * invitation email, because that is how the account is really created. The
 * mail host configured for development is a disposable one whose inbox API
 * is not reachable from this network, and the mailbox protocol it offers
 * does not carry data either.
 *
 * So the mailbox is brought closer: a local SMTP server takes the mail and
 * writes it to a file. The **invitation flow itself is untouched** — the
 * application still creates the invitation, still queues the email, still
 * builds the acceptance link, and still accepts the invitation. Only the
 * postbox differs.
 *
 * The backend is pointed at it with the `SMTP_HOST` and `SMTP_PORT`
 * environment variables, which the mailer already reads.
 *
 * Run it with:
 *
 * ```
 * pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/mail-capture.ts
 * ```
 */

import { createServer, type Socket } from 'net';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PORT = Number(process.env.CAPTURE_PORT ?? 2525);
const HOST = '127.0.0.1';

/**
 * Where the captured messages are written.
 *
 * Inside the repository, so that the folder is the same one whichever
 * directory the script is run from, and so that it can be ignored by git
 * along with everything else a run leaves behind.
 */
const CAPTURE_DIR = join(__dirname, '../../../.mail-capture');

/**
 * One captured message.
 */
interface CapturedMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
}

/**
 * Reads the captured messages.
 */
export function readCaptured(): CapturedMessage[] {
  try {
    return readdirSync(CAPTURE_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(CAPTURE_DIR, name), 'utf8')) as CapturedMessage)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  } catch {
    return [];
  }
}

/**
 * Undoes the quoted-printable encoding the mailer used.
 *
 * A long acceptance link is very likely to be soft-wrapped by the mailer,
 * and a wrapped link is not a link. The encoding is undone before the
 * token is read, so the token comes out whole.
 *
 * The two forms that matter:
 *
 *  - `=\r\n` — a soft line break. The two characters are removed and the
 *    two halves are joined.
 *  - `=XX` — a single byte written as two hexadecimal digits.
 */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * The token from a captured message.
 *
 * The link carries the token as a query parameter, so it is read from
 * there rather than from the visible text — the visible text is wrapped and
 * punctuated for reading, and the parameter is the machine's copy.
 *
 * The body is decoded first: the mailer soft-wraps the link and marks the
 * break with an `=`, so a token read from the raw body arrives in two
 * halves with the marker in between.
 */
export function tokenFrom(message: CapturedMessage): string | null {
  const body = decodeQuotedPrintable(message.body);

  const matches = [
    ...body.matchAll(/[?&]token=([A-Za-z0-9._%-]{32,})/g),
  ].map((match) => match[1]);

  if (matches.length === 0) return null;

  /**
   * The longest match is taken: the body may carry truncated forms of the
   * link as well — a preview cut short — and the shortest is not a token
   * the server will accept.
   */
  return matches.sort((a, b) => b.length - a.length)[0];
}

/**
 * Waits for a message about an address, and returns its token.
 *
 * The **newest** message is used, and only messages that arrived *after*
 * the caller's request are considered. A token is good once, and asking
 * for a reset twice leaves two emails in the mailbox of which only the
 * newer is good — so a token from before the request is spent.
 *
 * `since` is the moment the request was made. A message that arrived
 * earlier belongs to an earlier request.
 */
export async function waitForToken(
  email: string,
  since: number = 0,
  attempts = 12,
  delayMs = 2500
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const messages = readCaptured();

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];

      /**
       * A message that arrived before the request belongs to an earlier
       * request, and its token has been withdrawn.
       */
      if (new Date(message.receivedAt).getTime() < since) continue;

      if (!message.to.includes(email) && !message.body.includes(email)) continue;

      const token = tokenFrom(message);
      if (token) return token;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

/**
 * Handles one SMTP conversation.
 */
function handleSession(socket: Socket): void {
  let buffer = '';
  let from = '';
  let to = '';
  let inData = false;
  let data = '';

  socket.write('220 capture.local ESMTP\r\n');

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    while (true) {
      if (inData) {
        /**
         * The message ends at a line holding a single dot.
         */
        const end = buffer.indexOf('\r\n.\r\n');
        if (end === -1) return;

        data += buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        inData = false;

        /**
         * The subject is a header of the message; the body is everything
         * after the blank line that separates the headers from it.
         */
        const separator = data.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
        const bodyStart = data.indexOf(separator);
        const headers = bodyStart === -1 ? data : data.slice(0, bodyStart);
        const body = bodyStart === -1 ? data : data.slice(bodyStart + separator.length);

        const subject = headers.match(/^Subject:\s*(.*)$/m)?.[1]?.trim() ?? '';

        const message: CapturedMessage = {
          from,
          to,
          subject,
          body,
          receivedAt: new Date().toISOString(),
        };

        mkdirSync(CAPTURE_DIR, { recursive: true });
        const name = `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, '_')}.json`;
        writeFileSync(join(CAPTURE_DIR, name), JSON.stringify(message, null, 2));

        console.log(`captured "${subject}" for ${to}`);

        socket.write('250 2.0.0 Ok: queued\r\n');
        continue;
      }

      const end = buffer.indexOf('\r\n');
      if (end === -1) return;

      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);

      const upper = line.toUpperCase();

      if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
        socket.write('250-capture.local\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
      } else if (upper.startsWith('AUTH')) {
        socket.write('235 2.7.0 Authentication successful\r\n');
      } else if (upper.startsWith('MAIL FROM')) {
        from = line.match(/<([^>]*)>/)?.[1] ?? '';
        socket.write('250 2.1.0 Ok\r\n');
      } else if (upper.startsWith('RCPT TO')) {
        to = line.match(/<([^>]*)>/)?.[1] ?? '';
        socket.write('250 2.1.5 Ok\r\n');
      } else if (upper.startsWith('DATA')) {
        inData = true;
        data = '';
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (upper.startsWith('QUIT')) {
        socket.end('221 Bye\r\n');
        return;
      } else {
        socket.write('250 2.0.0 Ok\r\n');
      }
    }
  });

  socket.on('error', () => {
    /* The client hung up; nothing to do. */
  });
}

if (require.main === module) {
  const server = createServer(handleSession);

  server.listen(PORT, HOST, () => {
    console.log(`The mail capture is listening on ${HOST}:${PORT}.`);
    console.log(`Captured messages are written to ${CAPTURE_DIR}.`);
  });

  process.on('SIGINT', () => {
    server.close();
    process.exit(0);
  });
}
