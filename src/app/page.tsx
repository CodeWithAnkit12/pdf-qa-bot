import Link from 'next/link';
import { createClient, getUser } from '@/lib/supabase/server';
import Aurora from '@/components/aurora';
import AppHeader from '@/components/app-header';
import CopyLink from '@/components/copy-link';
import { LogoMark } from '@/components/logo';
import Tilt from '@/components/tilt';
import UploadPanel from './upload-panel';
import Landing from './landing';

export const dynamic = 'force-dynamic';

/**
 * "/" serves two audiences from one URL:
 *   signed out -> the public landing page
 *   signed in  -> the owner's dashboard
 */
export default async function HomePage() {
  const user = await getUser();
  if (!user) return <Landing />;

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
  const chatPath = `/chat/${user.id}`;

  return (
    <>
      <Aurora intensity={0.75} />
      <AppHeader active="documents" openTickets={openTickets ?? 0} />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="animate-rise">
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Your documents</h1>
          <p className="mt-2 text-mist">
            Signed in as <span className="text-paper">{user.email}</span>
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <UploadPanel />

            <section aria-labelledby="docs-heading" className="glass rounded-3xl p-2">
              <h2 id="docs-heading" className="sr-only">Uploaded documents</h2>

              {(!documents || documents.length === 0) && (
                <p className="px-5 py-10 text-center text-mist">
                  Nothing uploaded yet. Add a PDF above and your chat link appears here.
                </p>
              )}

              <ul className="divide-y divide-white/6">
                {documents?.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-4 rounded-2xl px-4 py-4 transition hover:bg-white/4">
                    <span
                      aria-hidden
                      className="grid size-11 shrink-0 place-items-center rounded-xl bg-pdf/15 text-[10px] font-bold text-[#ff8a80] ring-1 ring-pdf/30"
                    >
                      PDF
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-paper">{doc.filename}</p>
                      <p className="mt-0.5 text-sm text-mist">
                        {doc.status === 'ready' && `${doc.chunk_count} passages indexed`}
                        {doc.status === 'processing' && 'Reading and indexing…'}
                        {doc.status === 'failed' && (doc.error ?? 'Could not process this file')}
                      </p>
                    </div>
                    <StatusPill status={doc.status} />
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Tilt max={5}>
              <section
                aria-labelledby="link-heading"
                className="glass relative overflow-hidden rounded-3xl p-6"
              >
                <span aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full bg-glow/20 blur-3xl" />
                <div className="relative flex items-center gap-3">
                  <LogoMark size={44} />
                  <div>
                    <h2 id="link-heading" className="font-display text-lg font-semibold">
                      Customer chat link
                    </h2>
                    <p className="text-sm text-mist">No sign-in needed for customers.</p>
                  </div>
                </div>

                {readyCount > 0 ? (
                  <div className="relative mt-5 space-y-3">
                    <CopyLink path={chatPath} />
                    <Link href={chatPath} target="_blank" className="btn-primary w-full">
                      Open your chat
                    </Link>
                  </div>
                ) : (
                  <p className="relative mt-5 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-mist">
                    Your link goes live once a document finishes indexing.
                  </p>
                )}
              </section>
            </Tilt>

            <Link
              href="/tickets"
              className="glass group flex items-center justify-between rounded-3xl p-6 transition duration-300 hover:border-white/25"
            >
              <div>
                <p className="font-display text-lg font-semibold">Unanswered questions</p>
                <p className="mt-0.5 text-sm text-mist">
                  {openTickets
                    ? `${openTickets} waiting for a reply`
                    : 'None yet. Your PDF is covering it.'}
                </p>
              </div>
              <span
                aria-hidden
                className={`grid size-12 place-items-center rounded-2xl font-display text-xl font-bold transition-transform duration-300 group-hover:scale-110 ${
                  openTickets ? 'bg-pdf text-white shadow-[0_8px_30px_-6px] shadow-pdf' : 'bg-white/8 text-mist'
                }`}
              >
                {openTickets ?? 0}
              </span>
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
    processing: 'bg-glow/15 text-glow ring-glow/30',
    failed: 'bg-pdf/15 text-[#ff8a80] ring-pdf/30',
  };
  const labels: Record<string, string> = { ready: 'Ready', processing: 'Indexing', failed: 'Failed' };

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${styles[status] ?? styles.processing}`}>
      <span
        aria-hidden
        className={`size-1.5 rounded-full bg-current ${status === 'processing' ? 'animate-blink' : ''}`}
      />
      {labels[status] ?? status}
    </span>
  );
}
