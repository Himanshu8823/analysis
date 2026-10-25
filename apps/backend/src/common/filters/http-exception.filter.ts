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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let retryAfter: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const shaped = exceptionResponse as ExceptionResponseShape;
        message = shaped.message ?? exceptionResponse;
        code = shaped.code ?? code;
        retryAfter = shaped.retryAfter;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
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
