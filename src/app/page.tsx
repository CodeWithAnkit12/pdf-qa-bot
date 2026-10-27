import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, getUser } from '@/lib/supabase/server';
import UploadPanel from './upload-panel';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // RLS means this returns only this owner's rows even though the
  // query has no explicit owner filter.
  const { data: documents } = await supabase
    .from('documents')
    .select('id, filename, status, chunk_count, error, created_at')
    .order('created_at', { ascending: false });

  const { count: openTickets } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  const readyCount = documents?.filter((d) => d.status === 'ready').length ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your documents</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <Link
          href="/tickets"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tickets
          {openTickets ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {openTickets}
            </span>
          ) : null}
        </Link>
      </header>

      <UploadPanel />

      {readyCount > 0 && (
        <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-medium text-slate-900">Your customer chat link</h2>
          <p className="mt-1 text-xs text-slate-500">
            Share this with customers. No sign-in needed on their side.
          </p>
          <code className="mt-3 block overflow-x-auto rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            /chat/{user.id}
          </code>
          <Link
            href={`/chat/${user.id}`}
            className="mt-3 inline-block text-sm font-medium text-slate-900 underline"
          >
            Open it
          </Link>
        </section>
      )}

      <section className="mt-8 space-y-3">
        {documents?.length === 0 && (
          <p className="text-sm text-slate-500">
            No documents yet. Upload a PDF to get started.
          </p>
        )}

        {documents?.map((doc) => (
          <article
            key={doc.id}
            className="flex items-start justify-between rounded-lg border border-slate-200 p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {doc.filename}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {doc.status === 'ready' && `${doc.chunk_count} chunks indexed`}
                {doc.status === 'processing' && 'Processing…'}
                {doc.status === 'failed' && (doc.error ?? 'Failed')}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                doc.status === 'ready'
                  ? 'bg-emerald-100 text-emerald-800'
                  : doc.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {doc.status}
            </span>
          </article>
        ))}
      </section>
    </main>
  );
}
