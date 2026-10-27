/**
 * Gemini wrappers — embeddings and generation.
 *
 * Model names change often. Verify yours against your key with:
 *   curl -H "x-goog-api-key: $GEMINI_API_KEY" \
 *     https://generativelanguage.googleapis.com/v1beta/models
 * A 404 NOT_FOUND almost always means a retired model name.
 */
import { GoogleGenAI } from '@google/genai';

/**
 * Each model has its OWN free-tier quota. Set GEMINI_CHAT_MODEL in
 * .env.local to switch (e.g. to a Flash-Lite model, which usually has
 * a much larger daily allowance) without touching code.
 */
/**
 * A function, not a constant: a constant is evaluated the moment this
 * module is imported, which can be BEFORE a script has loaded its env
 * file (imports are hoisted above all other code). Reading the env at
 * call time always sees the final value.
 */
export function getChatModel(): string {
  return process.env.GEMINI_CHAT_MODEL || 'gemini-3.6-flash';
}
export const EMBED_MODEL = 'gemini-embedding-001';

/**
 * The model defaults to 3072 dimensions. We ask for 768 instead:
 * it is Google's recommended size for retrieval, it keeps the
 * pgvector rows ~4x smaller, and HNSW indexes cap at 2000 dims.
 *
 * This number must match vector(768) in supabase/schema.sql.
 */
export const EMBED_DIM = 768;

/**
 * Created lazily, on first use. Throwing at import time would break
 * `next build`, which imports every route module before env vars
 * from the hosting platform are guaranteed to be present.
 */
let client: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  // Without a timeout, a request to an overloaded model can hang
  // forever. 60s is far longer than any normal reply; past that we
  // abort, and withRetry decides whether to try again.
  client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 60_000 } });
  return client;
}

/**
 * When you request fewer than 3072 dimensions, the vector is a
 * truncated prefix (Matryoshka Representation Learning) and is no
 * longer unit length. Cosine similarity assumes unit vectors, so we
 * normalise before storing. Skipping this quietly degrades recall.
 */
function normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

/**
 * Task type matters. A document and a question about that document
 * are different kinds of text, and telling the model which is which
 * measurably improves retrieval. This is the single easiest RAG win
 * that most tutorials skip.
 */
type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export async function embedOne(
  text: string,
  taskType: EmbedTask,
): Promise<number[]> {
  const [vec] = await embedMany([text], taskType);
  return vec;
}

export async function embedMany(
  texts: string[],
  taskType: EmbedTask,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await getAI().models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    config: {
      taskType,
      outputDimensionality: EMBED_DIM,
    },
  });

  const embeddings = res.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: asked for ${texts.length}, got ${embeddings.length}`,
    );
  }

  return embeddings.map((e) => normalize(e.values ?? []));
}

/**
 * Free-tier embedding limits are roughly 100 requests/minute, so a
 * 200-chunk PDF sent one chunk at a time will hit 429. We batch and
 * pause instead. On a 429 we back off and retry rather than failing
 * the whole upload.
 */
export async function embedInBatches(
  texts: string[],
  taskType: EmbedTask,
  batchSize = 50,
): Promise<number[][]> {
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    out.push(...(await withRetry(() => embedMany(batch, taskType))));

    const hasMore = i + batchSize < texts.length;
    if (hasMore) await sleep(1000);
  }

  return out;
}

/**
 * Retry only TRANSIENT errors — ones where the same request can
 * succeed if sent again later:
 *   429 RESOURCE_EXHAUSTED  you are going too fast (rate limit)
 *   500 INTERNAL            the server hiccuped
 *   503 UNAVAILABLE         the model is overloaded right now
 * Anything else (400 bad request, 401 bad key, 404 wrong model) is
 * our mistake, and retrying would just repeat it — fail fast.
 *
 * Wait time, best first:
 *   1. The server says how long ("retryDelay":"41s"). Use that.
 *   2. Otherwise exponential backoff (2s, 4s, 8s, 16s) plus random
 *      jitter, so many clients don't all retry at the same instant.
 * Waits are capped at 60s; a longer wait usually means the DAILY
 * quota is gone, and no amount of retrying fixes that.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Network errors hide the real reason in err.cause.code
      // (e.g. "fetch failed" -> cause ECONNRESET). Include it.
      const cause = (err as { cause?: { code?: string } })?.cause?.code ?? '';
      const message = (err instanceof Error ? err.message : String(err)) + ' ' + cause;
      const isTransient =
        /ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT/.test(message) ||
        /\b(429|500|503)\b/.test(message) ||
        /RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL/.test(message) ||
        /timeout|timed out|aborted/i.test(message);

      if (!isTransient || attempt === attempts - 1) throw err;

      // Daily quota is gone: retrying in seconds is pointless.
      if (/per day/i.test(message)) throw err;

      // The error body carries a machine-readable hint like
      // "retryDelay":"41s". Prefer it over guessing.
      const serverHint = message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
      const waitMs = serverHint
        ? Math.ceil(parseFloat(serverHint[1]) * 1000) + 500
        : 2000 * 2 ** attempt + Math.random() * 1000;

      if (waitMs > 60_000) throw err;

      const reason = /429|RESOURCE_EXHAUSTED/.test(message)
        ? 'Rate limited'
        : /timeout|timed out|aborted/i.test(message)
          ? 'Timed out'
          : /ECONN|ETIMEDOUT|EAI_AGAIN|UND_ERR/.test(message)
            ? 'Network error'
            : 'Model busy';
      console.warn(`${reason}; retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
    }
  }

  throw lastErr;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
