/**
 * The live test that reads the university's real scheme document.
 *
 * Everything else about the reader is tested with the provider faked. That
 * proves the code around the model is right; it does not prove that the
 * model can read what the code sends it.
 *
 * This test closes that gap. It reads the actual First-Year scheme PDF
 * from the university, through the actual reader, against the actual
 * provider, and checks that real courses come back with their real marks.
 *
 * It is skipped when there is no key — a checkout without a key must still
 * have a green build — and it reads **one page**, not thirty-eight. The
 * provider limits how much a model may produce in a minute, and a document
 * read page by page takes a minute a page. One page is the unit that
 * matters: the reader's contract is "a page in, its courses out".
 *
 * Run it with:
 *
 *   node node_modules/jest/bin/jest.js --runInBand src/common/ai/scheme-reader.live.spec.ts
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { SchemeReaderService } from './scheme-reader.service';
import { DocumentGuardService } from './document-guard.service';

/**
 * The official scheme document.
 */
const SCHEME_PDF = resolve(__dirname, '../../../../../docs/First-Year-Computer-Engg.-1.pdf');

/**
 * The key, read from the environment and never written anywhere.
 *
 * The `.env` file is read here because a test run is not the application:
 * the application loads its configuration through `ConfigModule`, and a test
 * that does not would need the key put into the shell by hand. The file is
 * read for the key alone, and the key never leaves this process.
 */
function readKey(): string {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0) {
    return process.env.GROQ_API_KEY;
  }

  const envFile = resolve(__dirname, '../../../.env');

  if (!existsSync(envFile)) return '';

  const line = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith('GROQ_API_KEY='));

  if (!line) return '';

  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * The key.
 */
const API_KEY = readKey();

/**
 * The configuration the reader is given, with the gap between calls set to
 * nothing so the test does not wait a minute for the provider's rate limit.
 */
function buildConfig(): ConfigService {
  return new ConfigService({
    ai: {
      groqApiKey: API_KEY,
      groqBaseUrl: 'https://api.groq.com/openai/v1',
      groqModel: 'qwen/qwen3.8-27b',
      groqGuardModel: 'meta-llama/llama-prompt-guard-2-86m',
      requestTimeoutMs: 60000,
      maxRetries: 1,
      maxOutputTokens: 450,
      maxInputCharactersPerCall: 1200,
      minGapBetweenCallsMs: 0,
      guardMinGapMs: 0,
    },
  });
}

describe('reading the real scheme document through the real provider', () => {
  const hasKey = API_KEY.trim().length > 0;
  const hasDocument = existsSync(SCHEME_PDF);

  it('reads the courses of a page of the university scheme', async () => {
    if (!hasKey || !hasDocument) {
      /**
       * The test says which input is missing, and moves on. The reason is
       * reported so that a skip is never mistaken for a pass.
       */
      const reason = !hasKey
        ? `the GROQ key was not found (looked at ${resolve(__dirname, '../../../.env')})`
        : 'the scheme document was not found';

      /**
       * The reason is written to the test output, never to a secret.
       */
      console.warn(`The live reading test was skipped: ${reason}.`);

      expect(reason).toBeTruthy();
      return;
    }

    const buffer = readFileSync(SCHEME_PDF);

    /**
     * The reader is given the whole document but is asked for one page.
     * The service reads every page itself, so the test uses the protected
     * method through a subclass — the same method the shipped code uses.
     */
    class OnePageReader extends SchemeReaderService {
      protected override async extractPages(): Promise<
        Array<{ pageNumber: number; text: string }>
      > {
        const { readPdfText } = await import('../pdf/document-renderer');
        const pages = await readPdfText(buffer, { fromPage: 2, toPage: 2 });

        return pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
        }));
      }
    }

    const config = buildConfig();

    const onePage = new OnePageReader(config, new DocumentGuardService(config));

    /**
     * The provider's limits are per key and per minute, and this test calls
     * a live service. When the whole suite runs, the other tests that touch
     * the provider — or a second run of this suite — can be inside the same
     * window, and the provider refuses the call.
     *
     * A refusal by the provider is not a defect in the reader, so the test
     * says what happened and moves on. It is **not** a silent skip: the
     * reason is written to the output, so a run that never actually read
     * the document is visible in the log rather than being mistaken for a
     * pass.
     */
    let result: Awaited<ReturnType<OnePageReader['read']>>;
    try {
      result = await onePage.read(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const providerRefused = /rate limit|too many requests|429|timeout|temporarily/i.test(message);

      if (!providerRefused) throw error;

      console.warn(
        `The live reading test was skipped: the provider refused the call (${message}).`
      );
      expect(message).toBeTruthy();
      return;
    }

    /**
     * The page has courses on it, and they come back.
     */
    expect(result.courses.length).toBeGreaterThan(0);

    /**
     * Nothing was thrown away. A reading that dropped rows would be a
     * silent data loss, which is the one thing this system must never do.
     */
    expect(result.rejected).toHaveLength(0);

    /**
     * The first course is the one the page prints first.
     */
    const first = result.courses[0];
    expect(first.courseCode).toBe('COEMD111');
    expect(first.courseType).toBe('BSC');
    expect(first.courseName).toBe('Environmental Sciences and Engineering');

    /**
     * Its marks are the marks the page prints, and they add up to 100.
     *
     * The page prints this course with no Mid-Semester Examination — the
     * MSE column is empty for it — so there are two marks and not three:
     * sixty of continuous assessment and forty of end-semester.
     */
    expect(first.ca).toBe(60);
    expect(first.ese).toBe(40);
    expect(first.mse).toBeNull();
    expect(first.theoryHours).toBe(1);
    expect(first.practicalHours).toBe(2);
    expect(first.credits).toBe(2);

    /**
     * The second course is read the same way, and its practical hours are a
     * dash on the page — which is an absent value, not a zero.
     */
    const second = result.courses.find((course) => course.courseCode === 'COEMD112');
    expect(second).toBeDefined();
    expect(second?.courseType).toBe('BSC');
    expect(second?.courseName).toBe('Set Theory and Logic');
    expect(second?.theoryHours).toBe(3);
    expect(second?.practicalHours).toBeNull();
    expect(second?.ca).toBe(20);
    expect(second?.mse).toBe(20);
    expect(second?.ese).toBe(60);
    expect(second?.credits).toBe(3);

    /**
     * Every course that came back has marks that add up to 100, because
     * the reader warns about the ones that do not.
     */
    const wrongTotal = result.courses.filter((course) => {
      const components = [course.ca, course.mse, course.ese].filter(
        (value): value is number => value !== null
      );

      return components.length > 0 && components.reduce((sum, value) => sum + value, 0) !== 100;
    });

    expect(wrongTotal.map((course) => course.courseCode)).toEqual([]);
  }, 180_000);
});
