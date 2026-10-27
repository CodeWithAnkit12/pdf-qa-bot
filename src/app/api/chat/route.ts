/**
 * POST /api/chat
 *
 * Public endpoint: customers are not signed in. businessId arrives
 * from the URL, so it is untrusted input and gets validated before it
 * reaches the agent.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgent, dedupeSources, type Turn } from '@/lib/agent';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  businessId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().max(4000),
      }),
    )
    .max(20) // cap context growth; long chats would blow the token budget
    .default([]),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { businessId, message, history } = body;

  // Confirm this business exists and has at least one ready document.
  // Without this check, any UUID would open a chat session against an
  // empty index and the bot would answer "I don't know" forever.
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', businessId)
    .eq('status', 'ready');

  if (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json(
      { error: 'This business has no documents yet.' },
      { status: 404 },
    );
  }

  try {
    const result = await runAgent(message, history as Turn[], {
      ownerId: businessId,
    });

    return NextResponse.json({
      answer: result.answer,
      sources: dedupeSources(result.sources),
      // Returned so the demo UI can show the agent's reasoning trace.
      // In a real product this would be logged, not shipped to the client.
      toolCalls: result.toolCalls,
      steps: result.steps,
    });
  } catch (err) {
    console.error('[chat]', err);

    const message = err instanceof Error ? err.message : '';
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Rate limit reached. Wait a minute and try again.' },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
