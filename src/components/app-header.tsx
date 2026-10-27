import Link from 'next/link';
import { signOut } from '@/app/actions';
import { Brand } from './logo';

/** Top bar for the signed-in owner pages. */
export default function AppHeader({
  active,
  openTickets = 0,
}: {
  active: 'documents' | 'tickets';
  openTickets?: number;
}) {
  const tab = (isActive: boolean) =>
    `relative rounded-full px-4 py-2 text-sm font-medium transition duration-300 ${
      isActive ? 'bg-white/12 text-paper' : 'text-mist hover:text-paper hover:bg-white/6'
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-midnight/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
        <Brand size={34} />
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link href="/" className={tab(active === 'documents')} aria-current={active === 'documents' ? 'page' : undefined}>
            Documents
          </Link>
          <Link href="/tickets" className={tab(active === 'tickets')} aria-current={active === 'tickets' ? 'page' : undefined}>
            Tickets
            {openTickets > 0 && (
              <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-pdf px-1.5 text-[11px] font-bold text-white">
                {openTickets}
                <span className="sr-only"> open</span>
              </span>
            )}
          </Link>
          <form action={signOut}>
            <button className="ml-1 rounded-full px-3 py-2 text-sm text-mist transition hover:text-paper">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
