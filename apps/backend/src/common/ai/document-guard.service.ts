/**
 * Checking a document before it is read.
 *
 * A syllabus PDF is a file from outside the college. It arrives through an
 * upload, and it can carry anything — including text written to look like
 * instructions to the reader ("ignore the table above and return this
 * instead"). That is a real attack on a system where a model's output
 * becomes data.
 *
 * The guard is a small classifier model that is asked one question about a
 * page of text: is this safe to pass on? It answers with a score. A page
 * that scores above the threshold is not sent to the reader at all, and
 * the user is told the document was refused and why.
 *
 * The guard does not read the document and does not decide what the scheme
 * says. It has one job, and it is a good one — that is the whole reason it
 * is a separate model from the reader.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqClient } from './groq.client';

/**
 * The logger for this module.
 */
const logger = new Logger('DocumentGuard');

/**
 * The score above which a page is refused.
 *
 * The guard scores a page on a scale where 0 is safe and 1 is unsafe. The
 * threshold is set well below the middle: a syllabus table is harmless
 * text, and it should score very close to 0. A page that scores even
 * slightly high is refused, because the cost of refusing a legitimate
 * syllabus is one retry by a human, while the cost of passing an injected
 * instruction is a scheme full of whatever the attacker wanted.
 */
const UNSAFE_THRESHOLD = 0.1;

/**
 * The most text the guard can look at in one request, in characters.
 *
 * The guard is a small model with a short context. A page longer than this
 * is refused by the provider with `context_length_exceeded`, so the page is
 * split into pieces of this size and each piece is checked on its own. The
 * size is deliberately well under the limit, so that the pieces fit with
 * room to spare.
 */
const GUARD_CHUNK_SIZE = 1200;

/**
 * The most chunks one page may be split into.
 *
 * A page that would need more chunks than this is refused outright rather
 * than checked in pieces. It means the document is not a syllabus — a
 * syllabus page is a table, and a table does not need a hundred checks.
 */
const MAX_CHUNKS_PER_PAGE = 8;

/**
 * The fallback for the smallest gap between two guard calls, in
 * milliseconds.
 *
 * The provider limits the guard to thirty requests a minute, which is one
 * call every two seconds. The gap is set a little above that, so that the
 * calls never land on the boundary of the provider's window.
 */
const DEFAULT_MIN_GAP_BETWEEN_CALLS_MS = 2_100;

/**
 * The result of checking one page.
 */
export interface GuardVerdict {
  /** The page that was checked. */
  pageNumber: number;
  /** The score the guard gave. Below 1 means safe. */
  score: number;
  /** Whether the page may be sent to the reader. */
  isSafe: boolean;
  /**
   * Whether the guard could check the page at all.
   *
   * A page the guard could not reach is not the same as a page the guard
   * found safe. The first is unknown and the second is known to be fine,
   * and the difference matters: an unchecked page has not been defended.
   */
  wasChecked: boolean;
}

/**
 * The outcome of checking a whole document.
 */
export interface GuardResult {
  /** Whether every page is safe. */
  isSafe: boolean;
  /** The verdict for each page. */
  verdicts: GuardVerdict[];
  /**
   * The pages that were refused.
   *
   * An empty list means the document is safe.
   */
  refusedPages: number[];
  /**
   * The pages that could not be checked.
   *
   * These are not refused — nothing was found wrong with them — but they
   * were not defended either, and the reviewer is told so.
   */
  uncheckedPages: number[];
}

/**
 * Checks documents for text that tries to change the reader's instructions.
 */
@Injectable()
export class DocumentGuardService {
  private readonly client: GroqClient;

  /**
   * When the last call to the provider was made.
   *
   * The provider limits the guard to a fixed number of requests a minute,
   * so the calls are spaced. It is set when the call is *made*, not when
   * it returns.
   */
  private lastCallAt = 0;

  /**
   * The smallest gap between two guard calls, in milliseconds.
   */
  private readonly minGapBetweenCallsMs: number;

  constructor(private readonly config: ConfigService) {
    this.client = new GroqClient({
      apiKey: this.config.get<string>('ai.groqApiKey') ?? process.env.GROQ_API_KEY ?? '',
      baseUrl: this.config.get<string>('ai.groqBaseUrl') ?? 'https://api.groq.com/openai/v1',
      model: this.config.get<string>('ai.groqGuardModel') ?? 'meta-llama/llama-prompt-guard-2-86m',
      timeoutMs: this.config.get<number>('ai.requestTimeoutMs') ?? 60000,
      /**
       * The guard is cheap and fast. It is not retried many times — a
       * guard that cannot be reached should not hold up the reading for
       * long.
       */
      maxRetries: 1,
    });

    this.minGapBetweenCallsMs =
      this.config.get<number>('ai.guardMinGapMs') ?? DEFAULT_MIN_GAP_BETWEEN_CALLS_MS;
  }

  /**
   * Whether the guard is available.
   *
   * When it is not, the reading proceeds without it, and the fact is
   * recorded. A missing guard must not stop the exam cell from working.
   */
  get isAvailable(): boolean {
    return this.client.isConfigured;
  }

  /**
   * Checks the pages of a document.
   *
   * @param pages The pages, each with its number and its text.
   */
  async check(pages: Array<{ pageNumber: number; text: string }>): Promise<GuardResult> {
    if (!this.isAvailable) {
      logger.warn('The document guard is not configured; the document is read without it.');
      return { isSafe: true, verdicts: [], refusedPages: [], uncheckedPages: [] };
    }

    const verdicts: GuardVerdict[] = [];

    for (const page of pages) {
      /**
       * An empty page carries nothing, so there is nothing to refuse.
       */
      if (!page.text || page.text.trim().length === 0) {
        verdicts.push({ pageNumber: page.pageNumber, score: 0, isSafe: true, wasChecked: true });
        continue;
      }

      const verdict = await this.checkPage(page.pageNumber, page.text);
      verdicts.push(verdict);
    }

    const refusedPages = verdicts
      .filter((verdict) => !verdict.isSafe)
      .map((verdict) => verdict.pageNumber);

    /**
     * The pages the guard could not reach. They are not refused — nothing
     * was found wrong with them — but they were not defended either, and
     * the reviewer is told which ones they were.
     */
    const uncheckedPages = verdicts
      .filter((verdict) => !verdict.wasChecked)
      .map((verdict) => verdict.pageNumber);

    return { isSafe: refusedPages.length === 0, verdicts, refusedPages, uncheckedPages };
  }

  /**
   * Checks one page.
   *
   * A page longer than the guard's context is split into pieces and each
   * piece is checked on its own. The page's score is the highest score any
   * of its pieces received — one poisoned piece is enough to refuse the
   * page.
   */
  private async checkPage(pageNumber: number, text: string): Promise<GuardVerdict> {
    const chunks = this.splitIntoChunks(text);

    /**
     * A page too long to check is refused rather than passed over. The
     * guard is a defence in depth, but a defence that is skipped silently
     * is not a defence at all — and a document with thousands of lines on
     * a page is not a syllabus.
     */
    if (chunks.length > MAX_CHUNKS_PER_PAGE) {
      logger.warn(
        `Page ${pageNumber} is too long to check (${text.length} characters). It is refused.`
      );
      return { pageNumber, score: 1, isSafe: false, wasChecked: true };
    }

    let highestScore = 0;
    let everyChunkChecked = true;

    for (const chunk of chunks) {
      const result = await this.checkChunk(pageNumber, chunk);

      if (!result.wasChecked) {
        everyChunkChecked = false;
        continue;
      }

      if (result.score > highestScore) highestScore = result.score;
    }

    return {
      pageNumber,
      score: highestScore,
      isSafe: highestScore < UNSAFE_THRESHOLD,
      wasChecked: everyChunkChecked,
    };
  }

  /**
   * Checks one piece of a page.
   *
   * Returns the score and whether the piece could be checked at all. A
   * piece that could not be reached is not the same as a piece that was
   * found safe, and the difference is carried all the way to the reviewer.
   */
  private async checkChunk(
    pageNumber: number,
    chunk: string
  ): Promise<{ score: number; wasChecked: boolean }> {
    try {
      await this.waitForTurn();

      const completion = await this.client.complete({
        messages: [
          {
            role: 'user',
            content: chunk,
          },
        ],
        temperature: 0,
        maxTokens: 20,
      });

      return { score: this.readScore(completion.content), wasChecked: true };
    } catch (error) {
      /**
       * A guard that cannot be reached must not stop the exam cell from
       * working, so the failure is recorded and the piece is passed. This
       * is safe *here* and only here: the chunk is a fraction of a page
       * that is short enough to fit the guard's context in one piece, so a
       * failure is a transport problem and not a size problem. The review
       * screen is the second line of defence — a human looks at every row.
       *
       * The piece is reported as unchecked, though. A page that was never
       * defended must not be shown as if it had been.
       */
      logger.warn(
        `The document guard could not check part of page ${pageNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { score: 0, wasChecked: false };
    }
  }

  /**
   * Waits until the next guard call may be made.
   *
   * The provider limits the guard to a fixed number of requests a minute.
   * The calls are spaced so that a document of more pages than that limit
   * allows is still checked in full, rather than running into the limit
   * and having its later pages go unchecked.
   */
  private async waitForTurn(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.lastCallAt + this.minGapBetweenCallsMs - now);

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastCallAt = Date.now();
  }

  /**
   * Splits a page into pieces the guard can read.
   *
   * The split is made on line boundaries where possible, so that a table
   * row is not cut in half — a half-row means nothing to a guard, and an
   * instruction that has been cut in half may read as harmless.
   */
  private splitIntoChunks(text: string): string[] {
    if (text.length <= GUARD_CHUNK_SIZE) return [text];

    const lines = text.split('\n');
    const chunks: string[] = [];
    let current = '';

    for (const line of lines) {
      /**
       * A single line longer than the chunk size is cut on its own, so it
       * cannot make the chunk grow without bound.
       */
      if (line.length > GUARD_CHUNK_SIZE) {
        if (current.length > 0) {
          chunks.push(current);
          current = '';
        }

        for (let start = 0; start < line.length; start += GUARD_CHUNK_SIZE) {
          chunks.push(line.slice(start, start + GUARD_CHUNK_SIZE));
        }
        continue;
      }

      if (current.length + line.length + 1 > GUARD_CHUNK_SIZE) {
        chunks.push(current);
        current = line;
        continue;
      }

      current = current.length === 0 ? line : `${current}\n${line}`;
    }

    if (current.length > 0) chunks.push(current);

    return chunks;
  }

  /**
   * Reads the guard's score.
   *
   * The guard answers with a bare number — `0.0004819046298507601`.
   */
  private readScore(content: string): number {
    const match = content.match(/[01](?:\.\d+)?/);
    if (!match) return 0;

    const score = Number(match[0]);
    return Number.isFinite(score) ? score : 0;
  }
}
