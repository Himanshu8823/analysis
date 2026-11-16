/**
 * The tests for how a failed request is classified.
 *
 * The classification decides two things the member sees: the sentence, and
 * whether a retry button is offered at all. Getting the second one wrong is
 * the dead end the specification forbids — a 403 with a "Retry" button
 * invites the member to try again forever against a refusal that will never
 * change.
 *
 * The case that matters most is the network failure: it has no status code,
 * and it must never be reported as a server fault. Nothing went wrong on the
 * server's side, because the server was never asked.
 */

import { describeFailure, isRetryable } from '@/lib/api/interceptors';

/** Builds the shape axios produces for a failed request. */
function failedRequest(status: number) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: {} },
  };
}

/** Builds the shape axios produces when the request never reached the server. */
function networkFailure(code = 'ERR_NETWORK', message = 'Network Error') {
  return { isAxiosError: true, code, message, request: {} };
}

describe('how a failed request is classified', () => {
  describe('a refusal', () => {
    it('is a refusal, and cannot be retried into success', () => {
      const failure = describeFailure(failedRequest(403));

      expect(failure.kind).toBe('no-access');
      expect(failure.canRetry).toBe(false);
    });
  });

  describe('a missing record', () => {
    it('is not found, and retrying will not bring it back', () => {
      const failure = describeFailure(failedRequest(404));

      expect(failure.kind).toBe('not-found');
      expect(failure.canRetry).toBe(false);
    });
  });

  describe('a validation failure', () => {
    it('is a form problem', () => {
      expect(describeFailure(failedRequest(422)).kind).toBe('invalid');
      expect(describeFailure(failedRequest(400)).kind).toBe('invalid');
    });

    it('cannot be retried without changing what was sent', () => {
      expect(describeFailure(failedRequest(422)).canRetry).toBe(false);
    });
  });

  describe('a conflict', () => {
    it('is a conflict, and retrying the same change will not help', () => {
      const failure = describeFailure(failedRequest(409));

      expect(failure.kind).toBe('conflict');
      expect(failure.canRetry).toBe(false);
    });
  });

  describe('an expired session', () => {
    it('is an expired session, not a permission problem', () => {
      expect(describeFailure(failedRequest(401)).kind).toBe('session-expired');
    });
  });

  describe('a rate limit', () => {
    it('can be retried, once the member has waited', () => {
      const failure = describeFailure(failedRequest(429));

      expect(failure.kind).toBe('too-many');
      expect(failure.canRetry).toBe(true);
    });
  });

  describe('a server fault', () => {
    it('can be retried', () => {
      const failure = describeFailure(failedRequest(500));

      expect(failure.kind).toBe('server-error');
      expect(failure.canRetry).toBe(true);
    });
  });

  describe('a request that never reached the server', () => {
    it('is a network failure, not a server fault', () => {
      const failure = describeFailure(networkFailure());

      expect(failure.kind).toBe('network');
      expect(failure.kind).not.toBe('server-error');
    });

    it('can be retried once the connection is back', () => {
      expect(describeFailure(networkFailure()).canRetry).toBe(true);
    });
  });

  describe('a request that timed out', () => {
    it('is treated like the network failure it resembles', () => {
      const failure = describeFailure(
        networkFailure('ECONNABORTED', 'timeout of 30000ms exceeded'),
      );

      expect(failure.kind).toBe('network');
      expect(failure.canRetry).toBe(true);
    });
  });

  describe('an unrecognised failure', () => {
    it('is reported as a server fault rather than as a developer phrase', () => {
      const failure = describeFailure({ isAxiosError: true, message: 'Request failed with status code 418' });

      expect(failure.kind).toBe('server-error');
      expect(failure.label).not.toContain('418');
    });
  });

  describe('the retry helper', () => {
    it('agrees with the classification', () => {
      expect(isRetryable(failedRequest(500))).toBe(true);
      expect(isRetryable(failedRequest(403))).toBe(false);
      expect(isRetryable(networkFailure())).toBe(true);
    });
  });
});
