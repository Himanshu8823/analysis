/**
 * The tests for the error envelope the server sends when a request fails.
 *
 * The envelope has three parts — the status, the code and the message — and
 * each answers a different question. The status says how the request went.
 * The code says *what kind* of failure it was. The message says what
 * happened, in words meant for the person reading it.
 *
 * The code used to be `INTERNAL_ERROR` for everything that did not carry
 * one of its own, which is almost all of them. A missing permission and a
 * broken database were therefore indistinguishable to the client, and the
 * only way to tell them apart was the status — a detail the client has to
 * know to look at. The code is the field made for this, so it is filled in
 * from the status.
 */

import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/** The parts of an Express response the filter writes to. */
interface FakeResponse {
  statusCode?: number;
  body?: Record<string, unknown>;
  headers: Record<string, string>;
  status(code: number): FakeResponse;
  json(body: Record<string, unknown>): void;
  setHeader(name: string, value: string): void;
}

/** The parts of an Express request the filter reads. */
interface FakeRequest {
  method: string;
  url: string;
}

/**
 * Runs the filter over an exception and returns what it would have sent.
 */
function filterOver(exception: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  const response: FakeResponse = {
    headers: {},
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: Record<string, unknown>) {
      response.body = body;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
    },
  };

  const request: FakeRequest = { method: 'GET', url: '/api/v1/students' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };

  // The filter logs the error; the logger's output is not what is tested.
  const filter = new HttpExceptionFilter();
  const originalError = console.error;
  console.error = () => undefined;
  try {
    filter.catch(exception, host as never);
  } finally {
    console.error = originalError;
  }

  return {
    status: response.statusCode ?? 0,
    body: response.body ?? {},
  };
}

/** The code inside the error envelope. */
function codeOf(body: Record<string, unknown>): string {
  const error = body.error as { code?: string };
  return error.code ?? '';
}

/** The message inside the error envelope. */
function messageOf(body: Record<string, unknown>): string {
  const error = body.error as { message?: unknown };
  return typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
}

describe('the error envelope', () => {
  describe('a failure that carries its own code', () => {
    it('keeps that code', () => {
      const exception = new BadRequestException({
        code: 'RATE_LIMITED',
        message: 'Too many attempts',
      });

      const { body } = filterOver(exception);

      expect(codeOf(body)).toBe('RATE_LIMITED');
    });
  });

  describe('a failure that carries no code of its own', () => {
    it('names a refusal as a refusal, not as an internal error', () => {
      const { status, body } = filterOver(new ForbiddenException('Insufficient permissions'));

      expect(status).toBe(HttpStatus.FORBIDDEN);
      expect(codeOf(body)).toBe('FORBIDDEN');
    });

    it('names a missing sign-in as an unauthorised request', () => {
      const { status, body } = filterOver(new UnauthorizedException());

      expect(status).toBe(HttpStatus.UNAUTHORIZED);
      expect(codeOf(body)).toBe('UNAUTHORIZED');
    });

    it('names a missing record as not found', () => {
      const { status, body } = filterOver(new NotFoundException('Invitation not found'));

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(codeOf(body)).toBe('NOT_FOUND');
    });

    it('names a bad request as a bad request', () => {
      const { status, body } = filterOver(new BadRequestException('That is not valid'));

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(codeOf(body)).toBe('BAD_REQUEST');
    });
  });

  describe('the message', () => {
    it('is the sentence the server wrote', () => {
      const { body } = filterOver(
        new ForbiddenException('You do not have access to the requested branch')
      );

      expect(messageOf(body)).toBe('You do not have access to the requested branch');
    });

    it('is kept when the failure also carries a code', () => {
      const exception = new BadRequestException({
        code: 'RATE_LIMITED',
        message: 'Too many attempts',
      });

      expect(messageOf(filterOver(exception).body)).toBe('Too many attempts');
    });
  });

  describe('a failure the server did not anticipate', () => {
    it('is an internal error', () => {
      const { status, body } = filterOver(new Error('connection pool exhausted'));

      expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(codeOf(body)).toBe('INTERNAL_ERROR');
    });

    it('does not leak the internal wording to the client', () => {
      const { body } = filterOver(new Error('connection pool exhausted'));

      expect(messageOf(body)).not.toContain('connection pool');
      expect(messageOf(body)).toBe('Something went wrong on our side. Please try again.');
    });
  });

  describe('a request the server could not read', () => {
    it('is a bad request, not an internal error', () => {
      const { status, body } = filterOver(
        new SyntaxError('Unexpected token } in JSON at position 14')
      );

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(codeOf(body)).toBe('MALFORMED_REQUEST');
    });

    it('does not show the parser its own wording', () => {
      const { body } = filterOver(new SyntaxError('Unexpected token } in JSON at position 14'));

      expect(messageOf(body)).not.toContain('JSON');
      expect(messageOf(body)).toBe('That request could not be read. Please try again.');
    });
  });

  describe('the envelope as a whole', () => {
    it('says it failed', () => {
      const { body } = filterOver(new ForbiddenException());

      expect(body.success).toBe(false);
    });

    it('carries the path that was asked for', () => {
      const { body } = filterOver(new ForbiddenException());

      expect(body.path).toBe('/api/v1/students');
    });

    it('carries the time', () => {
      const { body } = filterOver(new ForbiddenException());

      expect(typeof body.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
    });
  });
});
