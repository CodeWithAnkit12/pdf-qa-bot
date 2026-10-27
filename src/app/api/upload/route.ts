/**
 * POST /api/upload
 *
 * PDF -> extract text -> chunk -> embed -> store.
 *
 * Runs synchronously, which is fine for the small documents this app
 * targets. A production version would hand this to a queue; the README
 * says why, and that trade-off is worth being able to explain.
 */
import { NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { getUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { chunkPages } from '@/lib/chunk';
import { embedInBatches } from '@/lib/gemini';

// The Gemini SDK and PDF parsing both need Node APIs, not the Edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHUNKS = 400; // keeps one upload inside the free-tier quota

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File is larger than 10 MB' }, { status: 400 });
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Record the document first so the UI can show "processing" while we work.
  const { data: doc, error: insertError } = await supabase
    .from('documents')
    .insert({ owner_id: user.id, filename: file.name, status: 'processing' })
    .select('id')
    .single();

  if (insertError || !doc) {
    return NextResponse.json({ error: 'Could not create document' }, { status: 500 });
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());

    // Keep the original PDF. Not needed for answering, but it means the
    // owner can re-download it and you can re-index later if chunking changes.
    const storagePath = `${user.id}/${doc.id}.pdf`;
    await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: 'application/pdf' });

    // ---- extract -------------------------------------------------
    // mergePages: false keeps page boundaries, which is what lets the
    // UI cite "page 4" instead of just quoting text from nowhere.
    const pdf = await getDocumentProxy(buffer);
    const { text: pages } = await extractText(pdf, { mergePages: false });

    const nonEmpty = (pages as string[]).filter((p) => p.trim().length > 0);

    if (nonEmpty.length === 0) {
      // Almost always a scanned PDF: images of text, no text layer.
      // OCR would be the fix; we fail clearly instead of silently
      // indexing an empty document.
      throw new Error(
        'No text found in this PDF. It may be a scanned document, which needs OCR.',
      );
    }

    // ---- chunk ---------------------------------------------------
    const chunks = chunkPages(pages as string[]);

    if (chunks.length === 0) throw new Error('Document produced no chunks');
    if (chunks.length > MAX_CHUNKS) {
      throw new Error(
        `Document is too large (${chunks.length} chunks, limit ${MAX_CHUNKS}). Try a shorter PDF.`,
      );
    }

    // ---- embed ---------------------------------------------------
    // RETRIEVAL_DOCUMENT here; the question side uses RETRIEVAL_QUERY.
    const embeddings = await embedInBatches(
      chunks.map((c) => c.content),
      'RETRIEVAL_DOCUMENT',
    );

    // ---- store ---------------------------------------------------
    const rows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      owner_id: user.id,
      content: chunk.content,
      page: chunk.page,
      chunk_index: chunk.index,
      embedding: embeddings[i],
    }));

    // Insert in batches: a single statement with hundreds of 768-float
    // vectors makes for an enormous request body.
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('chunks').insert(rows.slice(i, i + 100));
      if (error) throw new Error(`Chunk insert failed: ${error.message}`);
    }

    await supabase
      .from('documents')
      .update({
        status: 'ready',
        storage_path: storagePath,
        chunk_count: chunks.length,
      })
      .eq('id', doc.id);

    return NextResponse.json({
      documentId: doc.id,
      filename: file.name,
      pages: nonEmpty.length,
      chunks: chunks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error('[upload]', err);

    // Mark the row failed and remove any half-written chunks, so a
    // partial index can never serve wrong answers.
    await supabase
      .from('documents')
      .update({ status: 'failed', error: message })
      .eq('id', doc.id);
    await supabase.from('chunks').delete().eq('document_id', doc.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
