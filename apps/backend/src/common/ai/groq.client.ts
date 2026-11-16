/**
 * The GROQ client.
 *
 * GROQ speaks the OpenAI chat API, so the request is an ordinary HTTP call
 * to `/chat/completions`. What this module adds is everything the raw API
 * does not give you:
 *
 *  - a **timeout**, so a hanging request becomes a clear error rather than
 *    a screen that never loads;
 *  - **error mapping**, so a caller deals with `AiErrorKind.RateLimited`
 *    rather than with a provider's HTTP status;
 *  - **retries** for the failures that are worth retrying — a network
 *    blip, a rate limit — and *no* retry for the ones that are not, such
 *    as an answer that could not be parsed;
 *  - a **secret that is never logged**. The key goes in the `Authorization`
 *    header and nowhere else, and no log line ever contains it.
 *
 * The client is a plain class rather than an injectable service because it
 * holds no state beyond the configuration, and the module that owns it
 * (see `ai.module.ts`) is the only thing that constructs it.
 */

import { Logger } from '@nestjs/common';
import { AiError, AiErrorKind } from './ai.errors';

/**
 * The logger for this module.
 *
 * The key is never passed to it. Only the *kind* of failure and a redacted
 * message are.
 */
const logger = new Logger('GroqClient');

/**
 * The configuration the client needs.
 */
export interface GroqClientOptions {
  /** The API key. An empty string means the AI features are unavailable. */
  apiKey: string;
  /** The base URL of the OpenAI-compatible endpoint. */
  baseUrl: string;
  /** The model to call. */
  model: string;
  /** How long a single attempt may take, in milliseconds. */
  timeoutMs: number;
  /** How many times a failed attempt is retried. */
  maxRetries: number;
}

/**
 * One message in a chat request.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

/**
 * The options for one call.
 */
export interface ChatCompletionOptions {
  /** The messages to send. */
  messages: ChatMessage[];
  /**
   * The response format the model must produce.
   *
   * `json_object` asks for JSON; `json_schema` asks for JSON that matches
   * a given schema. A schema is strongly preferred where the provider
   * supports it, because it removes the parsing guesswork.
   */
  responseFormat?:
    | { type: 'json_object' }
    | {
        type: 'json_schema';
        json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
      };
  /** The sampling temperature. Zero is what a data-reading task wants. */
  temperature?: number;
  /** The most tokens the answer may use. */
  maxTokens?: number;
  /**
   * The effort the model should spend reasoning.
   *
   * `none` is what a task that reads data wants: the model is copying a
   * table, not solving a problem, and reasoning tokens are taken from the
   * same budget as the answer. `low`, `medium` and `high` are for tasks
   * that need to think. The value is only sent when the model understands
   * it.
   */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

/**
 * The answer to one call.
 */
export interface ChatCompletionResult {
  /** The text the model produced. */
  content: string;
  /** The model that produced it. */
  model: string;
  /** How long the call took, in milliseconds. */
  durationMs: number;
}

/**
 * Reads the wait the provider asked for out of its rate-limit message.
 *
 * GROQ says how long to wait: "Please try again in 5.1675s". Waiting the
 * time the provider named is the difference between retrying successfully
 * and retrying into the same wall — the limit is a *tokens per minute*
 * limit, so a request that is too large has to wait for the window to
 * roll over, and a fixed short backoff would just fail again.
 */
function readRetryAfterSeconds(body: string): number | null {
  const match = body.match(/try again in ([\d.]+)s/i);
  if (!match) return null;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  /**
   * The wait is capped so that a bad message cannot park the request for
   * an hour. Past a minute the caller is better off being told to try
   * again than being left waiting.
   */
  return Math.min(seconds, 60);
}

/**
 * Strips a key out of a string that is about to be logged.
 *
 * A provider's error body echoes the request headers back in some
 * deployments. The key must not reach a log file even by accident, so it
 * is replaced wherever it appears.
 */
function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('[redacted]');
}

/**
 * Maps a provider failure onto the small set of cases the caller handles.
 */
function mapProviderError(status: number, body: string): AiError {
  const safeBody = body.slice(0, 500);

  if (status === 401 || status === 403) {
    return new AiError(
      AiErrorKind.Unauthorised,
      `The AI provider refused the request (${status}).`,
      status
    );
  }

  if (status === 429) {
    return new AiError(
      AiErrorKind.RateLimited,
      `The AI provider is rate limiting (${status}).`,
      status,
      true,
      readRetryAfterSeconds(body) ?? undefined
    );
  }

  if (status === 413) {
    return new AiError(
      AiErrorKind.TooLarge,
      'The AI provider refused the request as too large.',
      status
    );
  }

  if (status >= 500) {
    return new AiError(
      AiErrorKind.Unreachable,
      `The AI provider returned a server error (${status}).`,
      status,
      true
    );
  }

  return new AiError(
    AiErrorKind.MalformedResponse,
    `The AI provider rejected the request (${status}): ${safeBody}`,
    status
  );
}

/**
 * Reads the error kind out of an exception thrown by `fetch`.
 *
 * `fetch` rejects with an `AbortError` when the timeout fires, and with a
 * `TypeError` when the host cannot be reached.
 */
function mapTransportError(error: unknown, timeoutMs: number): AiError {
  const name = error instanceof Error ? error.name : '';

  if (name === 'AbortError' || name === 'TimeoutError') {
    return new AiError(
      AiErrorKind.TimedOut,
      `The AI provider did not answer within ${timeoutMs}ms.`,
      undefined,
      true
    );
  }

  return new AiError(
    AiErrorKind.Unreachable,
    `The AI provider could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    undefined,
    true
  );
}

/**
 * The GROQ client.
 */
export class GroqClient {
  constructor(private readonly options: GroqClientOptions) {}

  /**
   * Whether the client can make a call at all.
   *
   * The key is not validated here — only its presence. A key that is wrong
   * fails at the call, with a message that says so.
   */
  get isConfigured(): boolean {
    return this.options.apiKey.trim().length > 0;
  }

  /**
   * Sends a chat request and returns the answer.
   *
   * @throws {AiError} when the provider is not configured, is unreachable,
   *   is rate limiting, times out, or answers with something unusable.
   */
  async complete(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.isConfigured) {
      throw new AiError(AiErrorKind.NotConfigured, 'GROQ_API_KEY is not configured.');
    }

    const attempts = Math.max(1, this.options.maxRetries + 1);
    let lastError: AiError | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const startedAt = Date.now();

      try {
        const result = await this.attempt(options);
        return { ...result, durationMs: Date.now() - startedAt };
      } catch (error) {
        const aiError =
          error instanceof AiError
            ? error
            : new AiError(
                AiErrorKind.MalformedResponse,
                error instanceof Error ? error.message : String(error)
              );

        lastError = aiError;

        /**
         * A failure that cannot improve with another attempt — a bad
         * answer, a rejected key, a request that is too large — is not
         * retried. Retrying it would only cost time and money.
         */
        if (!aiError.retryable) throw aiError;

        /**
         * The last attempt has been made.
         */
        if (attempt === attempts) break;

        /**
         * The wait grows with each attempt, so a provider that is busy for
         * a moment is not hammered.
         *
         * When the provider named a wait of its own, that wait is used
         * instead — it knows when its window rolls over and the caller
         * does not.
         */
        const waitMs =
          aiError.retryAfterSeconds !== undefined
            ? aiError.retryAfterSeconds * 1000
            : 500 * 2 ** (attempt - 1);
        logger.warn(
          `The AI provider failed (${aiError.kind}). Retrying in ${waitMs}ms — attempt ${attempt} of ${attempts}.`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    throw (
      lastError ?? new AiError(AiErrorKind.Unreachable, 'The AI provider could not be reached.')
    );
  }

  /**
   * One attempt at a chat request.
   */
  private async attempt(
    options: ChatCompletionOptions
  ): Promise<Omit<ChatCompletionResult, 'durationMs'>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          /**
           * The key goes here and nowhere else.
           */
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0,
          /**
           * GROQ's newer models count the completion budget with
           * `max_completion_tokens`; the older ones use `max_tokens`. The
           * model decides which one it reads, and an unknown field is
           * refused — so the field that is most widely accepted is sent.
           */
          ...(options.maxTokens !== undefined ? { max_completion_tokens: options.maxTokens } : {}),
          ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
          ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        }),
        signal: controller.signal,
      });

      const raw = await response.text();

      if (!response.ok) {
        /**
         * The body is logged, but only after the key has been removed from
         * it. A provider that echoes the request headers back must not be
         * able to write the key into a log file.
         */
        logger.error(
          `The AI provider returned ${response.status}: ${redact(raw, this.options.apiKey).slice(0, 500)}`
        );
        throw mapProviderError(response.status, raw);
      }

      let parsed: {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };

      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AiError(
          AiErrorKind.MalformedResponse,
          'The AI provider answered with something that is not JSON.'
        );
      }

      const content = parsed.choices?.[0]?.message?.content;

      if (typeof content !== 'string' || content.length === 0) {
        throw new AiError(
          AiErrorKind.MalformedResponse,
          'The AI provider answered with no content.'
        );
      }

      return { content, model: parsed.model ?? this.options.model };
    } catch (error) {
      if (error instanceof AiError) throw error;
      throw mapTransportError(error, this.options.timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }
}
