/**
 * Tools the agent is allowed to call.
 *
 * The model NEVER runs any of this. It only replies "call searchDocs
 * with these arguments", and this file decides whether to honour that.
 *
 * Two rules hold everything together:
 *
 *  1. ownerId is NOT a tool parameter. It comes from the server-side
 *     context, never from the model. If the model could pass an owner
 *     id, a customer could ask it to read another business's documents
 *     and it might comply — that is prompt injection with a database
 *     attached.
 *
 *  2. Every argument the model sends is validated with Zod before use.
 *     Model output is untrusted input, exactly like a request body.
 */
import { Type, type FunctionDeclaration } from '@google/genai';
import { z } from 'zod';
import { createAdminClient } from './supabase/admin';
import { embedOne } from './gemini';

/** Server-supplied context. Never visible to the model. */
export interface ToolContext {
  ownerId: string;
}

/** A citation the UI can render under the answer. */
export interface Source {
  page: number | null;
  similarity: number;
  excerpt: string;
}

/** Collected during a run so the UI can show what the agent did. */
export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
}

// ----------------------------------------------------------------
// Schemas the model sees (JSON Schema) and schemas we enforce (Zod)
// ----------------------------------------------------------------

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'searchDocs',
    description:
      "Search the business's uploaded documents for passages relevant to a " +
      'customer question. Call this before answering any question about the ' +
      'business — its hours, pricing, menu, policies or services. Returns ' +
      'an empty list when the documents do not cover the question.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            'The search phrase. Rewrite the customer question into a ' +
            'standalone phrase that would appear in the document, ' +
            'resolving words like "it" or "that" from the conversation.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'createTicket',
    description:
      'Raise a support ticket for the business owner. Call this ONLY when ' +
      'searchDocs found nothing relevant AND the customer has agreed to ' +
      'leave their question for a human. Never call it without asking first.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: {
          type: Type.STRING,
          description: "The customer's question, in full.",
        },
        customerName: {
          type: Type.STRING,
          description: 'Name, if the customer gave one.',
        },
        contact: {
          type: Type.STRING,
          description: 'Email or phone, if the customer gave one.',
        },
      },
      required: ['question'],
    },
  },
];

const searchDocsArgs = z.object({
  query: z.string().min(2).max(500),
});

const createTicketArgs = z.object({
  question: z.string().min(5).max(2000),
  customerName: z.string().max(100).optional(),
  contact: z.string().max(200).optional(),
});

// ----------------------------------------------------------------
// Implementations
// ----------------------------------------------------------------

const MATCH_COUNT = 5;
const SIMILARITY_THRESHOLD = 0.35;

async function searchDocs(rawArgs: unknown, ctx: ToolContext) {
  const { query } = searchDocsArgs.parse(rawArgs);

  // RETRIEVAL_QUERY, not RETRIEVAL_DOCUMENT — the question is a
  // different kind of text from the passages it is matched against.
  const queryEmbedding = await embedOne(query, 'RETRIEVAL_QUERY');

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    p_owner_id: ctx.ownerId, // from the server, never from the model
    match_count: MATCH_COUNT,
    similarity_threshold: SIMILARITY_THRESHOLD,
  });

  if (error) throw new Error(`match_chunks failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
    content: string;
    page: number | null;
    similarity: number;
  }>;

  // The shape returned to the model matters. An explicit "found: 0"
  // plus an instruction is far more reliable at producing an honest
  // "I don't know" than an empty array the model has to interpret.
  if (rows.length === 0) {
    return {
      found: 0,
      passages: [],
      note:
        'No relevant passage found. Tell the customer you do not have that ' +
        'information, and offer to pass the question to the business.',
    };
  }

  return {
    found: rows.length,
    passages: rows.map((r) => ({
      page: r.page,
      similarity: Number(r.similarity.toFixed(3)),
      text: r.content,
    })),
  };
}

async function createTicket(rawArgs: unknown, ctx: ToolContext) {
  const args = createTicketArgs.parse(rawArgs);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      owner_id: ctx.ownerId, // again: server-supplied
      question: args.question,
      customer_name: args.customerName ?? null,
      contact: args.contact ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`ticket insert failed: ${error.message}`);

  return {
    ok: true,
    ticketId: data.id,
    note: 'Ticket created. Tell the customer the business will follow up.',
  };
}

// ----------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------

type ToolResult = Record<string, unknown>;

const registry: Record<
  string,
  (args: unknown, ctx: ToolContext) => Promise<ToolResult>
> = {
  searchDocs,
  createTicket,
};

/**
 * Run one tool call.
 *
 * Errors are returned to the model as data rather than thrown. A
 * validation failure is often something the model can fix on its next
 * turn ("query was too short — try a longer phrase"), and letting it
 * retry beats crashing the request.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ result: ToolResult; ok: boolean }> {
  const fn = registry[name];

  if (!fn) {
    return { result: { error: `Unknown tool: ${name}` }, ok: false };
  }

  try {
    return { result: await fn(args, ctx), ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        result: {
          error: 'Invalid arguments',
          details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        ok: false,
      };
    }

    console.error(`[tool:${name}]`, err);
    return {
      result: { error: 'Tool failed. Do not retry this call.' },
      ok: false,
    };
  }
}

/** Pull citations out of a searchDocs result for the UI. */
export function sourcesFrom(result: ToolResult): Source[] {
  const passages = result.passages;
  if (!Array.isArray(passages)) return [];

  return passages.map((p: { page: number | null; similarity: number; text: string }) => ({
    page: p.page,
    similarity: p.similarity,
    excerpt: p.text.slice(0, 220),
  }));
}
