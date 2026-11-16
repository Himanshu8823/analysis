import type { AxiosError } from 'axios';

/**
 * The classification of a failed request.
 *
 * Every failure the app can show a member falls into exactly one of these
 * buckets. The bucket is what decides the *shape* of the answer — whether
 * there is a retry button, whether the screen offers a way back, whether the
 * message names a field — so it is decided in one place rather than
 * separately on each screen.
 */
export type FailureKind =
  /** The member's session has ended. They need to sign in again. */
  | 'session-expired'
  /** The member may not do this. They need access, not a retry. */
  | 'no-access'
  /** The record is gone. They need to go back, not retry. */
  | 'not-found'
  /** Something in the form is wrong. The message names the field. */
  | 'invalid'
  /** The change collides with something that already exists. */
  | 'conflict'
  /** Too many attempts. They need to wait. */
  | 'too-many'
  /** The server failed. They can retry. */
  | 'server-error'
  /** The server could not be reached at all. */
  | 'network';

/**
 * How a failure should be answered.
 */
export interface FailureDescription {
  kind: FailureKind;
  /**
   * Whether trying the same thing again could plausibly work.
   *
   * This is what decides whether a retry button is shown. A 403 cannot be
   * retried into success; a 500 can.
   */
  canRetry: boolean;
  /**
   * The short label for the failure, used where a heading is needed.
   */
  label: string;
}

/**
 * The short labels. They are short enough to sit in a banner and plain
 * enough for a college clerk.
 */
const LABELS: Record<FailureKind, string> = {
  'session-expired': 'Your session has ended',
  'no-access': 'You do not have access to this',
  'not-found': 'This record no longer exists',
  invalid: 'Please check the form',
  conflict: 'That already exists',
  'too-many': 'Too many attempts',
  'server-error': 'Something went wrong on our side',
  network: 'We could not reach the server',
};

/**
 * Classifies a failed request.
 *
 * The status code decides the bucket, except for one case: a request that
 * never reached the server has no status code at all, and it must not be
 * reported as a server fault. Nothing went wrong on the server's side,
 * because the server was never asked — and telling a member otherwise sends
 * them looking for a fault in the application.
 *
 * @param error The failed request.
 */
export function describeFailure(error: AxiosError | unknown): FailureDescription {
  const axiosError = error as AxiosError & { code?: string };
  const status = axiosError?.response?.status;

  /**
   * The request never reached the server. Axios reports this as a code
   * rather than a status, and it is checked first because it has no status
   * to read.
   */
  if (!status && (axiosError?.code === 'ERR_NETWORK' || axiosError?.message === 'Network Error')) {
    return { kind: 'network', canRetry: true, label: LABELS.network };
  }

  if (status === 401) {
    return { kind: 'session-expired', canRetry: false, label: LABELS['session-expired'] };
  }
  if (status === 403) {
    return { kind: 'no-access', canRetry: false, label: LABELS['no-access'] };
  }
  if (status === 404) {
    return { kind: 'not-found', canRetry: false, label: LABELS['not-found'] };
  }
  if (status === 409) {
    return { kind: 'conflict', canRetry: false, label: LABELS.conflict };
  }
  if (status === 422 || status === 400) {
    return { kind: 'invalid', canRetry: false, label: LABELS.invalid };
  }
  if (status === 429) {
    return { kind: 'too-many', canRetry: true, label: LABELS['too-many'] };
  }
  if (status && status >= 500) {
    return { kind: 'server-error', canRetry: true, label: LABELS['server-error'] };
  }

  /**
   * A request that timed out. It is treated like the network failure it
   * resembles: the server may still be working, but the member cannot wait,
   * and retrying is the right advice.
   */
  if (
    axiosError?.code === 'ECONNABORTED' ||
    axiosError?.message?.toLowerCase().includes('timeout')
  ) {
    return { kind: 'network', canRetry: true, label: LABELS.network };
  }

  /**
   * Anything else is a server fault by elimination. It is reported as such
   * so that the member is never shown a developer-facing phrase like
   * "Request failed with status code 418".
   */
  return { kind: 'server-error', canRetry: true, label: LABELS['server-error'] };
}

/**
 * Whether the failure is one the member can do anything about by trying
 * again.
 *
 * A convenience for the screens, which use it to decide whether to offer a
 * retry button at all.
 */
export function isRetryable(error: AxiosError | unknown): boolean {
  return describeFailure(error).canRetry;
}
