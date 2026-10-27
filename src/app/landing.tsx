import Image from 'next/image';
import Link from 'next/link';
import Aurora from '@/components/aurora';
import DemoChat from '@/components/demo-chat';
import Tilt from '@/components/tilt';
import { Brand } from '@/components/logo';

/**
 * Public landing page, shown at "/" to signed-out visitors.
 *
 * The page has ONE orchestrated moment: on load the headline rises
 * line by line, the robot drops in, then the demo conversation starts
 * playing. Everything below the fold is deliberately still.
 */

const STEPS = [
  {
    title: 'Upload your PDF',
    body: 'Your FAQ, price list, policy or menu. We split it into passages and index what each one means.',
  },
  {
    title: 'Share your chat link',
    body: 'One link, no sign-in for customers. Put it on WhatsApp, Instagram or your website.',
  },
  {
    title: 'Read what it couldn’t answer',
    body: 'When the PDF has no answer the bot says so and offers a ticket. Your inbox becomes a list of gaps to fill.',
  },
];

export default function Landing() {
  return (
    <>
      <Aurora />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost !px-4">
            Sign in
          </Link>
          <Link href="/login?mode=signup" className="btn-primary !px-5 !py-2.5">
            Create your bot
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:pt-20">
          <div>
            <h1 className="font-display text-[clamp(2.5rem,4.9vw,4.4rem)] leading-[1.02] font-bold">
              {/* One vertical gradient shared by all three lines: each line
                  shows its own slice (background-position 0%, 50%, 100%),
                  so the colour flows down the headline without restarting. */}
              {['Your PDF,', 'answering customers', 'while you work.'].map((line, i) => (
                <span
                  key={line}
                  className="block animate-rise bg-[linear-gradient(180deg,var(--color-paper)_0%,var(--color-paper)_22%,var(--color-glow)_55%,var(--color-violet)_100%)] bg-[length:100%_300%] bg-clip-text text-transparent sm:whitespace-nowrap"
                  style={{ animationDelay: `${i * 120}ms`, backgroundPosition: `0 ${i * 50}%` }}
                >
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-7 max-w-[34rem] animate-rise text-lg leading-relaxed text-mist [animation-delay:380ms]">
              Upload your FAQ, policy or menu. Customers get a chat that answers only from your
              document, shows the page it used, and admits when it doesn’t know.
            </p>
            <div className="mt-9 flex animate-rise flex-wrap items-center gap-3 [animation-delay:500ms]">
              <Link href="/login?mode=signup" className="btn-primary !px-7 !py-3.5 !text-base">
                Create your bot
              </Link>
              <a href="#how" className="btn-ghost !py-3.5">
                How it works
              </a>
            </div>
            <p className="mt-5 animate-rise text-sm text-mist/80 [animation-delay:600ms]">
              Free to try. Setup takes about a minute.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {/* The robot floats above the demo and tilts toward the cursor. */}
            <Tilt className="relative z-10 mx-auto -mb-16 w-40 animate-pop [animation-delay:300ms] sm:w-48" max={18}>
              <div className="animate-float rounded-full">
                <span aria-hidden className="absolute inset-[-25%] rounded-full bg-[conic-gradient(from_0deg,var(--color-glow),var(--color-violet),var(--color-signal),var(--color-glow))] opacity-40 blur-2xl animate-spin-slow" />
                <Image
                  src="/brand/logo.png"
                  alt="PDF QA Bot robot holding a PDF"
                  width={192}
                  height={192}
                  priority
                  className="relative rounded-full drop-shadow-[0_20px_40px_rgb(79_209_255/0.35)] [transform:translateZ(40px)]"
                />
              </div>
            </Tilt>
            <Tilt className="animate-rise [animation-delay:650ms]" max={6}>
              <div className="pt-12">
                <DemoChat />
              </div>
            </Tilt>
          </div>
        </section>

        {/* How it works: a real sequence, so it is numbered. */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-10 px-5 pb-24 sm:px-8">
          <h2 className="max-w-xl font-display text-3xl font-semibold sm:text-4xl">
            Three steps from document to support desk
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="glass relative overflow-hidden rounded-3xl p-6">
                <span aria-hidden className="font-display text-6xl leading-none font-bold text-white/15">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-mist">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 py-8 text-sm text-mist sm:px-8">
        <Brand size={28} />
        <p>Answers come only from the documents you upload.</p>
      </footer>
    </>
  );
}
