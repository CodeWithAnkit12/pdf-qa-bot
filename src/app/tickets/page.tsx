import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient, getUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function resolveTicket(formData: FormData) {
  'use server';

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const supabase = await createClient();
  // RLS restricts this update to the signed-in owner's own tickets,
  // so a forged id from another business simply matches zero rows.
  await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
  revalidatePath('/tickets');
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← Documents
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Tickets</h1>
      <p className="mt-1 text-sm text-slate-500">
        Questions your documents couldn&apos;t answer. Each one is a gap worth filling.
      </p>

      <section className="mt-8 space-y-3">
        {tickets?.length === 0 && (
          <p className="text-sm text-slate-500">No tickets yet.</p>
        )}

        {tickets?.map((t) => (
          <article
            key={t.id}
            className={`rounded-lg border p-4 ${
              t.status === 'open' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 opacity-60'
            }`}
          >
            <p className="text-sm text-slate-900">{t.question}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {t.customer_name ?? 'Anonymous'}
                {t.contact && ` · ${t.contact}`}
                {' · '}
                {new Date(t.created_at).toLocaleString()}
              </p>
              {t.status === 'open' ? (
                <form action={resolveTicket}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-xs font-medium text-slate-900 underline">
                    Mark resolved
                  </button>
                </form>
              ) : (
                <span className="text-xs text-slate-500">Resolved</span>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
