'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * A scripted replay of two real conversations with the sample gym
 * handbook: one the document can answer (with its page), one it
 * can't (so the bot offers a ticket instead of guessing).
 *
 * It is a little state machine: each "beat" reveals the next piece,
 * and a timer advances the beat. Reduced-motion users get the
 * finished first conversation, still.
 */

type Script = {
  question: string;
  tool: string;
  answer: string;
  cite?: string;
  followTool?: string;
};

const SCRIPTS: Script[] = [
  {
    question: 'Can I pause my membership while I travel?',
    tool: 'searchDocs("membership freeze travel")',
    answer:
      'Yes. Annual and quarterly members can freeze for up to 60 days a year, in blocks of at least 7 days. Your end date moves forward by the days you freeze.',
    cite: 'Page 2 of the handbook',
  },
  {
    question: 'Do you have a swimming pool?',
    tool: 'searchDocs("swimming pool")',
    answer:
      "The handbook doesn't mention a pool, so I won't guess. Want me to pass your question to the team?",
    followTool: 'createTicket()',
  },
];

// beats: 0 empty, 1 question, 2 searching, 3 typing the answer, 4 done
const BEAT_MS = [500, 900, 1300, 0, 3800];

export default function DemoChat() {
  const [scriptIndex, setScriptIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [typed, setTyped] = useState(0);
  const [reduced, setReduced] = useState(false);

  const script = SCRIPTS[scriptIndex];

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduced) return;

    if (beat === 3) {
      // Type the answer out a few characters per tick.
      if (typed >= script.answer.length) {
        setBeat(4);
        return;
      }
      const t = setTimeout(() => setTyped((n) => Math.min(n + 3, script.answer.length)), 22);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      if (beat === 4) {
        setScriptIndex((i) => (i + 1) % SCRIPTS.length);
        setTyped(0);
        setBeat(0);
      } else {
        setBeat((b) => b + 1);
      }
    }, BEAT_MS[beat]);
    return () => clearTimeout(t);
  }, [beat, typed, reduced, script.answer.length]);

  const b = reduced ? 4 : beat;
  const shown = reduced ? script.answer : script.answer.slice(0, typed);

  return (
    <div className="glass w-full rounded-[28px] p-5 sm:p-6">
      <p className="sr-only">
        Example: a customer asks whether they can pause their membership while travelling. The
        bot searches the gym handbook and answers with the policy and the page it came from.
      </p>

      <div aria-hidden className="flex min-h-[300px] flex-col gap-3">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <Image src="/brand/logo-256.webp" alt="" width={28} height={28} className="rounded-full" />
          <span className="text-sm font-semibold text-paper">FitZone Gym</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-mist">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />
            Online
          </span>
        </div>

        {b >= 1 && (
          <div key={`q${scriptIndex}`} className="ml-auto max-w-[85%] animate-pop rounded-2xl rounded-br-md bg-gradient-to-br from-glow to-[#7b97ff] px-4 py-2.5 text-sm font-medium text-midnight">
            {script.question}
          </div>
        )}

        {b >= 2 && (
          <span key={`t${scriptIndex}`} className="w-fit animate-pop rounded-full border border-glow/30 bg-glow/10 px-3 py-1 font-mono text-[11px] text-glow">
            {script.tool}
          </span>
        )}

        {b === 2 && (
          <div className="flex w-fit gap-1.5 rounded-2xl rounded-bl-md bg-white/8 px-4 py-3.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-blink rounded-full bg-paper" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {b >= 3 && (
          <div className="max-w-[92%] animate-pop rounded-2xl rounded-bl-md border border-white/10 bg-white/8 px-4 py-3 text-sm leading-relaxed text-paper">
            {shown}
            {b === 3 && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-blink bg-glow" />}
          </div>
        )}

        {b >= 4 && script.cite && (
          <span className="flex w-fit animate-pop items-center gap-2 rounded-full bg-pdf/15 px-3 py-1 text-xs font-medium text-[#ff8a80]">
            <span className="rounded-sm bg-pdf px-1 text-[9px] font-bold text-white">PDF</span>
            {script.cite}
          </span>
        )}

        {b >= 4 && script.followTool && (
          <span className="w-fit animate-pop rounded-full border border-violet/40 bg-violet/10 px-3 py-1 font-mono text-[11px] text-violet">
            offers {script.followTool}
          </span>
        )}
      </div>
    </div>
  );
}
