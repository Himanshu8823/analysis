/**
 * The tests for the message shown when a request fails.
 *
 * The rule these tests protect is simple: the user reads the sentence the
 * server wrote for them, not a sentence guessed from a status code.
 *
 * The server sends its failures as
 * `{ success: false, error: { code, message } }`. When the message lived
 * somewhere else — at the top level, as a validation failure puts it — the
 * server's own wording was silently dropped and every failure showed the
 * same generic text. "That invitation has already been accepted" became
 * "Something went wrong. Please try again.", which is not merely less
 * helpful: it sends the user looking for a fault that is not there.
 */

import { extractErrorMessage } from '@/hooks/useAuth';

/** Builds the shape axios produces for a failed request. */
function failedRequest(status: number, data: unknown) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data },
  };
}

describe('the message shown when a request fails', () => {
  describe("the server's own wording", () => {
    it('is used when the failure carries an error envelope', () => {
      const error = failedRequest(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to the requested branch' },
      });

      expect(extractErrorMessage(error)).toBe(
        'You do not have access to the requested branch'
      );
    });

    it('is used for a message about an already-accepted invitation', () => {
      const error = failedRequest(400, {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'This invitation has already been accepted',
        },
      });

      expect(extractErrorMessage(error)).toBe(
        'This invitation has already been accepted'
      );
    });

    it('is used when it arrives as an array of field messages', () => {
      const error = failedRequest(400, {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: ['email must be an email', 'name must not be empty'],
        },
      });

      expect(extractErrorMessage(error)).toBe(
        'email must be an email. name must not be empty'
      );
    });
  });

  describe('a message at the top level', () => {
    it('is used, because a validation failure puts it there', () => {
      const error = failedRequest(400, {
        message: ['email must be an email'],
      });

      expect(extractErrorMessage(error)).toBe('email must be an email');
    });

    it('is used when it is a single string', () => {
      const error = failedRequest(400, { message: 'That file is too large' });

      expect(extractErrorMessage(error)).toBe('That file is too large');
    });
  });

  describe('the error envelope is preferred over the top level', () => {
    it('when both are present', () => {
      const error = failedRequest(400, {
        message: 'A generic top-level message',
        error: { code: 'BAD_REQUEST', message: 'The specific reason' },
      });

      expect(extractErrorMessage(error)).toBe('The specific reason');
    });
  });

  describe('a failure with no message of its own', () => {
    it('falls back to a sentence the user can act on for a wrong password', () => {
      const error = failedRequest(401, { success: false, error: {} });

      expect(extractErrorMessage(error)).toBe(
        'Your email or password is incorrect.'
      );
    });

    it('falls back to a sentence about permission for a refusal', () => {
      const error = failedRequest(403, {});

      expect(extractErrorMessage(error)).toBe(
        "You don't have permission to do that."
      );
    });

    it('falls back to a sentence about not finding something', () => {
      const error = failedRequest(404, {});

      expect(extractErrorMessage(error)).toBe(
        'We could not find what you were looking for.'
      );
    });

    it('falls back to a sentence about the server for a server fault', () => {
      const error = failedRequest(500, {});

      expect(extractErrorMessage(error)).toBe(
        'Something went wrong on our side. Please try again.'
      );
    });

    it('never shows the raw axios wording', () => {
      const error = failedRequest(500, {});

      expect(extractErrorMessage(error)).not.toContain('Request failed with');
    });
  });

  describe('a rate limit', () => {
    it('says how long to wait when the server says', () => {
      const error = failedRequest(429, {
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts', retryAfter: 120 },
      });

      expect(extractErrorMessage(error)).toBe(
        'Too many attempts. Please try again in 2 minutes.'
      );
    });

    it('says to wait a moment when the server does not say', () => {
      const error = failedRequest(429, { success: false, error: {} });

      expect(extractErrorMessage(error)).toBe(
        'Too many attempts. Please wait a moment and try again.'
      );
    });
  });

  describe('a failure that is not a request at all', () => {
    it('still produces a sentence rather than nothing', () => {
      expect(extractErrorMessage(undefined)).toBe(
        'Something went wrong. Please try again.'
      );
      expect(extractErrorMessage(null)).toBe(
        'Something went wrong. Please try again.'
      );
      expect(extractErrorMessage('a string')).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });
});
