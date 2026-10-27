/**
 * Text chunking.
 *
 * Chunk size is the main quality dial in RAG:
 *   too small -> a chunk loses the context that made it meaningful
 *   too large -> one chunk mixes several topics, so similarity blurs
 *
 * ~1200 characters with 200 characters of overlap is a sane default
 * for FAQ, policy and menu documents. The overlap exists so an answer
 * that straddles a boundary still appears whole in at least one chunk.
 */

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 200;

export interface Chunk {
  content: string;
  page: number | null;
  index: number;
}

/**
 * Split on structure first, characters second. Paragraph breaks are
 * real semantic boundaries; a blind every-N-characters split cuts
 * sentences in half and produces chunks that embed badly.
 */
export function chunkText(
  text: string,
  page: number | null = null,
  startIndex = 0,
): Chunk[] {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: Chunk[] = [];

  let buffer = '';

  const flush = () => {
    const content = buffer.trim();
    if (content) {
      chunks.push({ content, page, index: startIndex + chunks.length });
    }
    buffer = '';
  };

  for (const para of paragraphs) {
    // A single paragraph larger than one chunk gets split by sentence.
    if (para.length > CHUNK_SIZE) {
      flush();
      for (const piece of splitLongText(para)) {
        chunks.push({ content: piece, page, index: startIndex + chunks.length });
      }
      continue;
    }

    if (buffer.length + para.length + 2 > CHUNK_SIZE) {
      const tail = buffer.slice(-CHUNK_OVERLAP);
      flush();
      buffer = tail ? `${tail}\n\n${para}` : para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }

  flush();
  return chunks;
}

function splitLongText(text: string): string[] {
  // Split after . ! ? followed by whitespace. Keeps sentences intact.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    if (buffer.length + sentence.length + 1 > CHUNK_SIZE) {
      if (buffer.trim()) out.push(buffer.trim());
      buffer = buffer.slice(-CHUNK_OVERLAP) + ' ' + sentence;
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    }
  }

  if (buffer.trim()) out.push(buffer.trim());

  // Last resort for text with no sentence breaks at all (e.g. a long table).
  return out.flatMap((piece) =>
    piece.length <= CHUNK_SIZE * 1.5 ? [piece] : hardSplit(piece),
  );
}

function hardSplit(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    out.push(text.slice(i, i + CHUNK_SIZE));
  }
  return out;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Chunk a PDF page by page so each chunk keeps its page number,
 * which is what lets the UI show "source: page 4".
 */
export function chunkPages(pages: string[]): Chunk[] {
  const all: Chunk[] = [];

  pages.forEach((pageText, i) => {
    const pageChunks = chunkText(pageText, i + 1, all.length);
    all.push(...pageChunks);
  });

  return all;
}
