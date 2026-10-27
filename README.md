# PDF QA Bot — agentic RAG customer support

A business uploads its FAQ, policy, pricing or menu PDF and gets a public chat link. Customers ask questions in plain language; an agent searches the document, answers only from what it finds, cites the page, and raises a ticket for the owner when the document has no answer.

**Stack:** Next.js 15 (App Router) · Supabase (Postgres, pgvector, Auth, Storage) · Gemini API · Tailwind · Vercel

---

## What makes it "agentic" and not just a PDF chatbot

A plain RAG app runs the same fixed pipeline on every message: embed the question, fetch the top chunks, stuff them into the prompt. This app gives the model **tools** and lets it decide:

| Tool | When the agent uses it |
|---|---|
| `searchDocs(query)` | Any question about the business. The agent rewrites the question into a standalone search phrase first ("how much is it?" → "monthly membership price"). |
| `createTicket(question, name?, contact?)` | Only after a search found nothing **and** the customer agreed to leave the question for a human. |

The owner's ticket inbox becomes a list of gaps in their documentation.

---

## Architecture

```
                       UPLOAD (owner, signed in)
  PDF ──► unpdf: text per page ──► chunk (~1200 chars, 200 overlap, page kept)
       ──► Gemini embed (RETRIEVAL_DOCUMENT, 768 dims, normalised)
       ──► Postgres: chunks table + HNSW index

                       CHAT (customer, public)
  question ──► agent loop (max 5 steps)
                  │
                  ├─► model asks for searchDocs
                  │       embed query (RETRIEVAL_QUERY) ──► match_chunks(owner_id) ──► passages
                  │
                  ├─► model asks for createTicket ──► tickets table ──► owner inbox
                  │
                  └─► model returns text ──► answer + page citations + tool trace
```

---

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL Editor** → paste and run `supabase/schema.sql`. This creates the tables, the vector index, the search function, RLS policies and the storage bucket.
3. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs. Add your Vercel URL here too when you deploy.

### 2. Gemini
Create a free API key at Google AI Studio. No card needed.

Check that the model names in `src/lib/gemini.ts` are still available to your key, since they change often. Open this in a browser with your key pasted in, then press Ctrl+F and search for each model name:

```
https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
```

### 3. Run
```bash
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm install
npm run dev
```

Fill in the four values in `.env.local` before `npm run dev`. Sign in at `/login`, upload `sample-docs/fitzone-gym-policy.pdf`, then open your chat link.

### 4. Evals
Add `EVAL_BUSINESS_ID` to `.env.local` (the UUID at the end of your chat link), then:
```bash
npm run eval
```
The suite runs 20 questions against the sample PDF. Run it after every change to the prompt, chunk size or similarity threshold. Each question costs 2–3 model calls, so one full run can use a large share of a free-tier daily quota.

### 5. Deploy
Push to GitHub, import into Vercel, add the four env vars, and add the Vercel URL to Supabase's redirect list.

---

## Design decisions (and how to explain them in an interview)

**The model never sees `owner_id`.** It is not a tool parameter; the server injects it. If the model could pass an owner id, a customer could ask it to search another business's documents — prompt injection with a database attached. The eval suite includes this attack.

**Two layers of tenant isolation.** RLS protects browser-facing queries made with the publishable key. Customer chat has no signed-in user, so it runs server-side with the secret key, which bypasses RLS; there, isolation is enforced by always passing `p_owner_id` to `match_chunks`. Each layer defends a different path. `match_chunks` is `SECURITY INVOKER` so it never silently bypasses RLS.

**Different embedding task types for documents and queries.** A passage and a question about it are different kinds of text. Gemini embeds them with `RETRIEVAL_DOCUMENT` and `RETRIEVAL_QUERY` respectively, which improves retrieval at zero cost.

**768 dimensions, normalised.** `gemini-embedding-001` defaults to 3072. 768 is the recommended size for retrieval, makes rows about 4× smaller, and fits under HNSW's 2000-dimension limit. Truncated vectors are no longer unit length, so they are re-normalised before storage; cosine similarity assumes unit vectors.

**Chunking by structure, with overlap.** Paragraphs first, sentences second, characters only as a last resort, so chunks don't cut sentences in half. 200 characters of overlap means an answer that straddles a boundary still appears whole in one chunk. Chunks keep their page number, which is what makes citations possible.

**Honest "I don't know".** A similarity threshold (0.35) filters weak matches. When nothing passes, the tool returns `found: 0` plus an explicit note telling the model to say it doesn't know. That is more reliable than an empty array the model has to interpret.

**Model output is untrusted input.** Every tool argument is validated with Zod. Validation errors go back to the model as data so it can correct itself rather than crashing the request.

**A hard step limit.** The loop stops after 5 model calls. Without a ceiling, a model that keeps calling `searchDocs` loops until it hits the rate limit or a timeout.

**The model's own turn is echoed back verbatim.** Newer Gemini models attach signatures to function calls that must be returned with the next request. Re-sending the model's `parts` unchanged handles this.

**Retrieved text is treated as data, not instructions.** The system prompt says so explicitly. A malicious PDF could contain "ignore previous instructions"; the model is told passages are content.

**Failed uploads leave no partial index.** If embedding fails halfway, the document is marked `failed` and its chunks are deleted, so a half-indexed document can never serve answers.

---

## Known limits and next steps

These are deliberate scope cuts. Each one is a good interview answer to "what would you do next?"

- **Upload runs synchronously.** Fine for small documents. At scale, move extraction and embedding to a background job (a queue, or Supabase Edge Functions) and poll the document status.
- **No rate limiting on the public chat.** Anyone with the link can spend your Gemini quota. Add per-IP limits (Upstash Redis or Vercel's rate-limit middleware).
- **The chat URL exposes the owner's user id.** A random business slug would be better.
- **Scanned PDFs are rejected.** They have no text layer. OCR would fix this.
- **Pure vector search.** Exact terms like plan names or prices can rank low. Hybrid search (vector + Postgres full-text) with rank fusion would improve this.
- **No streaming.** Answers arrive whole. Streaming the final turn would improve perceived latency.
- **No conversation persistence.** History lives in the browser tab.

---

## Project structure

```
supabase/schema.sql          tables, HNSW index, match_chunks, RLS, storage bucket
src/lib/gemini.ts            embeddings (task types, 768 dims, normalise, batching, retry)
src/lib/chunk.ts             paragraph → sentence → hard-split chunker, keeps page numbers
src/lib/tools.ts             tool schemas, Zod validation, searchDocs, createTicket
src/lib/agent.ts             the agent loop and system prompt
src/app/api/upload/route.ts  extract → chunk → embed → store
src/app/api/chat/route.ts    public chat endpoint
src/app/page.tsx             owner dashboard: upload, documents, share link
src/app/chat/[businessId]/   customer chat with tool trace and citations
src/app/tickets/page.tsx     owner ticket inbox
evals/run.ts                 20-case behavioural eval suite
sample-docs/                 demo PDF the evals are written against
```
# pdf-qa-bot
