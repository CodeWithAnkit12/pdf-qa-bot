-- ============================================================
-- PDF QA Bot — database schema
-- Run this in Supabase Studio → SQL Editor
-- ============================================================

-- pgvector gives Postgres a `vector` column type + similarity operators.
-- Supabase convention is to install extensions into the `extensions`
-- schema, not `public`. The SQL Editor's search_path already includes
-- it, so `vector(768)` below resolves without a schema prefix.
create extension if not exists vector with schema extensions;

-- ------------------------------------------------------------
-- documents: one row per uploaded PDF, owned by a business
-- ------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  filename      text not null,
  storage_path  text,
  status        text not null default 'processing'
                check (status in ('processing', 'ready', 'failed')),
  error         text,
  chunk_count   int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists documents_owner_idx on public.documents (owner_id);

-- ------------------------------------------------------------
-- chunks: the searchable pieces of each document
--
-- owner_id is denormalised onto this table on purpose. Every
-- search filters by owner, and doing that without a join keeps
-- the vector scan on a single table.
-- ------------------------------------------------------------
create table if not exists public.chunks (
  id           bigserial primary key,
  document_id  uuid not null references public.documents (id) on delete cascade,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  content      text not null,
  page         int,
  chunk_index  int  not null,
  -- 768 must match EMBED_DIM in src/lib/gemini.ts.
  -- Changing it means re-embedding every chunk.
  embedding    vector(768),
  created_at   timestamptz not null default now()
);

create index if not exists chunks_owner_idx on public.chunks (owner_id);
create index if not exists chunks_document_idx on public.chunks (document_id);

-- Approximate-nearest-neighbour index. Cosine distance (<=>) must match
-- the operator used in match_chunks below, or the index is ignored.
-- HNSW is built for recall + speed; it caps out at 2000 dimensions,
-- which is another reason 768 beats the default 3072.
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------
-- tickets: raised by the agent when the document has no answer
-- ------------------------------------------------------------
create table if not exists public.tickets (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  customer_name  text,
  contact        text,
  question       text not null,
  status         text not null default 'open'
                 check (status in ('open', 'resolved')),
  created_at     timestamptz not null default now()
);

create index if not exists tickets_owner_idx on public.tickets (owner_id, status);

-- ============================================================
-- Similarity search
--
-- SECURITY INVOKER (the default) is deliberate: the function runs
-- with the caller's permissions, so RLS below still applies. A
-- SECURITY DEFINER function here would quietly bypass RLS and
-- let one business read another's chunks.
--
-- The search_path is pinned (not left to the caller) so it can't be
-- hijacked, and it must include `extensions`: the <=> operator lives
-- there with pgvector. Pinning it to '' instead fails at query time
-- with "operator does not exist: extensions.vector <=> extensions.vector".
-- ============================================================
create or replace function public.match_chunks (
  query_embedding      vector(768),
  p_owner_id           uuid,
  match_count          int   default 5,
  similarity_threshold float default 0.35
)
returns table (
  id          bigint,
  content     text,
  page        int,
  document_id uuid,
  similarity  float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.content,
    c.page,
    c.document_id,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.owner_id = p_owner_id
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Row Level Security
--
-- RLS protects the browser-facing (publishable key) paths. Customer chat
-- is a public endpoint and runs server-side with the secret
-- key, which bypasses RLS — there the owner scoping is enforced in
-- application code by always passing p_owner_id. Both layers exist
-- because they defend different paths.
-- ============================================================
alter table public.documents enable row level security;
alter table public.chunks    enable row level security;
alter table public.tickets   enable row level security;

-- documents: an owner sees and manages only their own
drop policy if exists "owner reads own documents" on public.documents;
create policy "owner reads own documents"
  on public.documents for select
  using (auth.uid() = owner_id);

drop policy if exists "owner writes own documents" on public.documents;
create policy "owner writes own documents"
  on public.documents for insert
  with check (auth.uid() = owner_id);

drop policy if exists "owner deletes own documents" on public.documents;
create policy "owner deletes own documents"
  on public.documents for delete
  using (auth.uid() = owner_id);

-- chunks: read-only to the owner; writes happen server-side only
drop policy if exists "owner reads own chunks" on public.chunks;
create policy "owner reads own chunks"
  on public.chunks for select
  using (auth.uid() = owner_id);

-- tickets: the owner reads and resolves their inbox
drop policy if exists "owner reads own tickets" on public.tickets;
create policy "owner reads own tickets"
  on public.tickets for select
  using (auth.uid() = owner_id);

drop policy if exists "owner updates own tickets" on public.tickets;
create policy "owner updates own tickets"
  on public.tickets for update
  using (auth.uid() = owner_id);

-- ============================================================
-- Storage bucket for the original PDFs (private)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "owner reads own files" on storage.objects;
create policy "owner reads own files"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner uploads own files" on storage.objects;
create policy "owner uploads own files"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
