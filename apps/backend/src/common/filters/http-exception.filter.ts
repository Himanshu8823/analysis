import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ExceptionResponseShape {
  message?: unknown;
  code?: string;
  /** Seconds the client should wait before retrying (rate-limit responses). */
  retryAfter?: number;
}

/**
 * The message shown to the client when something goes wrong that the
 * application did not anticipate.
 *
 * An unexpected error is usually a database error, and a database error
 * names its tables, its columns and sometimes the values it was looking
 * for. That is a picture of the inside of the system, handed to whoever
 * happened to trigger the error. The detail belongs in the server's log —
 * where it is useful to whoever has to fix it — and not in the response.
 */
const UNEXPECTED_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';

/**
 * The message shown when the request itself was malformed in a way the
 * application could not describe.
 *
 * A body that fails to parse, or a query string that is not valid JSON, is
 * the client's mistake and not a leak — but the parser's own wording
 * ("Unexpected token } in JSON at position 14") is developer-facing, so it
 * is replaced with a sentence a person can act on.
 */
const MALFORMED_REQUEST_MESSAGE = 'That request could not be read. Please try again.';

/**
 * The code sent with a failure, when the failure did not carry one of its
 * own.
 *
 * The code is what tells the client what *kind* of failure this is. A
 * permission refusal and a server crash are different things, and a client
 * that cannot tell them apart can only show one message for both — which
 * would tell an administrator that a missing permission is the server's
 * fault. Every status therefore gets its own code, derived from the status
 * itself rather than left as the catch-all.
 */
const CODE_FOR_STATUS: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.REQUEST_TIMEOUT]: 'REQUEST_TIMEOUT',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/**
 * The code for a status that has no code of its own.
 *
 * A 500 is the server's own failure and is named as such. A status this
 * function has never heard of is given a name built from its number, so
 * the code still says something true rather than claiming to be an
 * internal error when it is not.
 */
function codeForStatus(status: number): string {
  const known = CODE_FOR_STATUS[status];
  if (known) return known;
  if (status >= 500) return 'INTERNAL_ERROR';
  return `HTTP_${status}`;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = UNEXPECTED_ERROR_MESSAGE;
    let code = 'INTERNAL_ERROR';
    let retryAfter: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      /**
       * The code starts as the one that belongs to the status, and an
       * exception that carries its own code replaces it. A plain
       * `ForbiddenException` carries none, so it keeps `FORBIDDEN` — which
       * is what the client needs to know.
       */
      code = codeForStatus(status);
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const shaped = exceptionResponse as ExceptionResponseShape;
        message = shaped.message ?? exceptionResponse;
        code = shaped.code ?? code;
        retryAfter = shaped.retryAfter;
      }
    } else if (isMalformedRequest(exception)) {
      /**
       * A body the server could not parse.
       *
       * This is a 400, not a 500: the client sent something the server
       * could not read, and the server did nothing wrong. The parser's own
       * message is not shown — it describes JSON syntax, which is not what
       * a college administrator needs to read.
       */
      status = HttpStatus.BAD_REQUEST;
      message = MALFORMED_REQUEST_MESSAGE;
      code = 'MALFORMED_REQUEST';
    } else if (exception instanceof Error) {
      /**
       * An unexpected error.
       *
       * The message is *not* sent to the client. It is logged in full
       * below, where whoever has to fix it will find it.
       */
      message = UNEXPECTED_ERROR_MESSAGE;
      code = 'INTERNAL_ERROR';
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : undefined
    );

    // Tell the client exactly how long to wait before retrying.
    if (retryAfter !== undefined) {
      response.setHeader('Retry-After', String(retryAfter));
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(retryAfter !== undefined ? { retryAfter } : {}),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

/**
 * Whether the failure was the server being unable to read the request.
 *
 * The body parser reports these as a `SyntaxError` with a status of 400, and
 * the query parser as its own error type. Both are the client's mistake and
 * both need a plain sentence rather than the parser's own wording.
 */
function isMalformedRequest(exception: unknown): boolean {
  if (!(exception instanceof Error)) return false;

  const status = (exception as Error & { status?: number }).status;
  if (status === HttpStatus.BAD_REQUEST) return true;

  // `express.json()` reports a body it cannot parse as a SyntaxError.
  return exception instanceof SyntaxError && exception.message.includes('JSON');
}
