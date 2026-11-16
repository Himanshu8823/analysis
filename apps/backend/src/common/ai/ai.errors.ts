/**
 * The errors the AI provider can raise.
 *
 * They are mapped to one small set of cases, because the caller — the exam
 * cell, waiting on a screen — needs to know what to *do*, not what the
 * provider's HTTP status was.
 */
export enum AiErrorKind {
  /** No API key is configured. */
  NotConfigured = 'not_configured',
  /** The provider rejected the key. */
  Unauthorised = 'unauthorised',
  /** The provider is busy or the key has hit its rate limit. */
  RateLimited = 'rate_limited',
  /** The provider did not answer in time. */
  TimedOut = 'timed_out',
  /** The provider could not be reached. */
  Unreachable = 'unreachable',
  /** The provider answered, but the answer was not usable. */
  MalformedResponse = 'malformed_response',
  /** The request was larger than the provider will accept. */
  TooLarge = 'too_large',
}

/**
 * An error raised by the AI provider.
 */
export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    /**
     * The provider's own status code, when there was one.
     *
     * It is kept for the logs. It is never shown to the user.
     */
    readonly statusCode?: number,
    /**
     * Whether retrying the same request could plausibly succeed.
     */
    readonly retryable = false,
    /**
     * How long the provider asked the caller to wait, in seconds.
     *
     * A provider that is rate limiting says how long the window takes to
     * roll over, and waiting exactly that long is the difference between a
     * retry that works and a retry that hits the same wall.
     */
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'AiError';
  }

  /**
   * The message the user is shown.
   *
   * It says what happened and what to do about it, and it never contains a
   * key, a token or the provider's raw response body.
   */
  get userMessage(): string {
    switch (this.kind) {
      case AiErrorKind.NotConfigured:
        return 'AI reading is not set up on this system. Enter the scheme manually instead.';
      case AiErrorKind.Unauthorised:
        return 'AI reading was refused because its access key is not valid. Enter the scheme manually instead.';
      case AiErrorKind.RateLimited:
        return 'The AI service is busy right now. Wait a moment and try again, or enter the scheme manually.';
      case AiErrorKind.TimedOut:
        return 'The AI service took too long to answer. Try again, or enter the scheme manually.';
      case AiErrorKind.Unreachable:
        return 'The AI service could not be reached. Check the connection and try again, or enter the scheme manually.';
      case AiErrorKind.MalformedResponse:
        return 'The AI service answered with something this system could not read. Try again, or enter the scheme manually.';
      case AiErrorKind.TooLarge:
        return 'This document is too long for the AI service to read. Split it into smaller parts and upload them one at a time.';
      default:
        return 'The AI service could not read this document. Enter the scheme manually instead.';
    }
  }
}
