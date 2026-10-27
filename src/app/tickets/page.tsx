import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';
import Aurora from '@/components/aurora';
import AppHeader from '@/components/app-header';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tickets' };

async function resolveTicket(formData: FormData) {
  'use server';

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const supabase = await createClient();
  // RLS restricts this update to the signed-in owner's own tickets,
  // so a forged id from another business simply matches zero rows.
  await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
  revalidatePath('/tickets');
  revalidatePath('/');
}

export default async function TicketsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, customer_name, contact, question, status, created_at')
    .order('status', { ascending: true }) // 'open' sorts before 'resolved'
    .order('created_at', { ascending: false });

  const open = tickets?.filter((t) => t.status === 'open').length ?? 0;

  return (
    <>
      <Aurora intensity={0.6} />
      <AppHeader active="tickets" openTickets={open} />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="animate-rise">
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Tickets</h1>
          <p className="mt-3 max-w-xl text-mist">
            Questions your documents couldn&apos;t answer. Add the answer to your PDF, re-upload it,
            and the bot will know next time.
          </p>
        </div>

        <ul className="mt-10 space-y-3">
          {tickets?.length === 0 && (
            <li className="glass rounded-3xl px-6 py-12 text-center text-mist">
              No tickets yet. When a customer asks something your PDF doesn&apos;t cover, it lands here.
            </li>
          )}

          {tickets?.map((t, i) => {
            const isOpen = t.status === 'open';
            return (
              <li
                key={t.id}
                className={`glass relative animate-pop overflow-hidden rounded-3xl p-5 pl-6 sm:p-6 sm:pl-7 ${isOpen ? '' : 'opacity-55'}`}
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                {isOpen && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-pdf to-violet" />}
                <p className="text-lg leading-snug text-paper">&ldquo;{t.question}&rdquo;</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-mist">
                    <span className="text-paper">{t.customer_name ?? 'Anonymous'}</span>
                    {t.contact && <span>, {t.contact}</span>}
                    <time className="ml-3 text-mist/80" dateTime={t.created_at}>
                      {new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                  </p>
                  {isOpen ? (
                    <form action={resolveTicket}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="btn-ghost !px-4 !py-2 !text-xs">Mark resolved</button>
                    </form>
                  ) : (
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Resolved
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
