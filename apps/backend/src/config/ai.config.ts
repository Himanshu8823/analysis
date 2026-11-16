/**
 * AI provider configuration.
 *
 * The scheme reader uses GROQ's OpenAI-compatible chat API. The key comes
 * from `GROQ_API_KEY` and is never written into a source file, never
 * logged and never sent to the browser.
 *
 * If the key is missing the AI features are simply unavailable — the
 * system keeps working, because the scheme can always be entered by hand.
 * That is why the key is not validated at boot: a missing key must not stop
 * the college from using the rest of the product.
 */
export default () => ({
  ai: {
    /** The API key. Empty when the AI features are not configured. */
    groqApiKey: process.env.GROQ_API_KEY ?? '',
    /** The base URL of the OpenAI-compatible endpoint. */
    groqBaseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    /**
     * The model that reads the document.
     *
     * It must be a model the key has access to, and it must accept an
     * image — a syllabus PDF is often a scan or a vector drawing with no
     * text layer at all, and then the page has to be *seen*.
     *
     * The default reads both text and images. The name is configurable so
     * that a deployment with a different entitlement can change it
     * without a code change.
     */
    groqModel: process.env.GROQ_MODEL ?? 'qwen/qwen3.8-27b',
    /**
     * The model that checks a document before it is read.
     *
     * This one is a *guard*: it is asked whether the text it is given is
     * safe to send to the reader. A syllabus PDF is a file from outside
     * the college, and a file can carry text that tries to change the
     * reader's instructions. The guard looks for that before the reader
     * sees it.
     */
    groqGuardModel: process.env.GROQ_GUARD_MODEL ?? 'meta-llama/llama-prompt-guard-2-86m',
    /**
     * How long a single call may take, in milliseconds.
     *
     * A request that hangs is worse than one that fails: the exam cell is
     * waiting on a review screen. The timeout turns a hang into a clear
     * error the user can retry.
     */
    requestTimeoutMs: parseInt(process.env.GROQ_TIMEOUT_MS ?? '60000', 10),
    /**
     * How many times a failed call is retried.
     *
     * Only transport-level failures and rate limits are retried. A malformed
     * response is not retried — retrying a bad answer just gets a bad
     * answer again, more slowly.
     */
    maxRetries: parseInt(process.env.GROQ_MAX_RETRIES ?? '2', 10),
    /**
     * The most text that may be sent in one request, in characters.
     *
     * A scheme PDF is a few pages; this is far above what one produces. The
     * limit exists so that a mistake — handing the reader a 400-page
     * document — is refused with a clear message instead of silently
     * consuming a large token bill.
     */
    maxInputCharacters: parseInt(process.env.GROQ_MAX_INPUT_CHARS ?? '200000', 10),
    /**
     * The most output tokens one call to the reader may use.
     *
     * The provider limits how much output a model may produce in a minute,
     * and that limit is small on a free tier — a thousand tokens a minute
     * for the reader's model. A scheme page read as a single answer is
     * larger than that, and the provider refuses the request rather than
     * truncating it.
     *
     * So the answer is capped, and a page whose table is bigger than the
     * cap is read in pieces. The cap must stay under the provider's own
     * limit, or the request is refused before it is ever sent.
     *
     * The default is half the provider's limit, which is what allows two
     * calls a minute and so keeps the reading to a wait a person will
     * accept.
     */
    maxOutputTokens: parseInt(process.env.GROQ_MAX_OUTPUT_TOKENS ?? '450', 10),
    /**
     * The smallest gap between two calls to the reader, in milliseconds.
     *
     * The provider's limit is per minute and it counts every call in the
     * window, so the calls are spaced. The gap has to be long enough that
     * the answers of the calls inside one window stay under that limit —
     * otherwise the second call of a minute is refused.
     */
    minGapBetweenCallsMs: parseInt(process.env.GROQ_MIN_GAP_MS ?? '31000', 10),
    /**
     * The most text one call to the reader may send, in characters.
     *
     * A page with more table rows than this is read in pieces, so that no
     * single answer is asked for more than the provider will give.
     *
     * The default is a third of a printed scheme page, which carries
     * three or four courses — an answer that fits inside the output cap
     * with room to spare.
     */
    maxInputCharactersPerCall: parseInt(process.env.GROQ_MAX_INPUT_CHARS_PER_CALL ?? '1200', 10),
    /**
     * The smallest gap between two guard calls, in milliseconds.
     *
     * The provider limits the guard to thirty requests a minute. The calls
     * are spaced so that a document with more pages than the limit allows
     * is still checked in full, rather than running into the limit and
     * having its later pages go unchecked.
     */
    guardMinGapMs: parseInt(process.env.GROQ_GUARD_MIN_GAP_MS ?? '2100', 10),
  },
});
