'use client';

import Image from 'next/image';
import { use, useEffect, useRef, useState } from 'react';
import Aurora from '@/components/aurora';

interface Source {
  page: number | null;
  similarity: number;
  excerpt: string;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
  toolCalls?: ToolCall[];
}

const SUGGESTIONS = ['What are your opening hours?', 'How much does it cost?', 'How do I cancel?'];

export default function CustomerChat({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to the newest message whenever the conversation changes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  async function ask(question: string) {
    question = question.trim();
    if (!question || pending) return;

    const nextMessages: Message[] = [...messages, { role: 'user', text: question }];
    setMessages(nextMessages);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          message: question,
          // Send only text back, never sources or tool traces — the
          // model does not need them and they cost tokens.
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try asking again.');
      } else {
        setMessages([
          ...nextMessages,
          { role: 'model', text: data.answer, sources: data.sources, toolCalls: data.toolCalls },
        ]);
      }
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <Aurora intensity={0.6} />

      <div className="mx-auto flex h-dvh max-w-3xl flex-col px-3 sm:px-6">
        <header className="glass mt-3 flex items-center gap-3 rounded-3xl px-4 py-3 sm:mt-5">
          <span className="relative">
            <Image src="/brand/logo-256.webp" alt="" width={40} height={40} priority className="rounded-full" />
            <span aria-hidden className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-midnight bg-emerald-400" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-base font-semibold">Ask us anything</h1>
            <p className="truncate text-xs text-mist">Answers come from this business&apos;s own documents.</p>
          </div>
        </header>

        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="flex-1 space-y-5 overflow-y-auto px-1 py-6 [scrollbar-width:thin]"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="animate-pop">
                <div className="animate-float">
                  <Image
                    src="/brand/logo.png"
                    alt=""
                    width={120}
                    height={120}
                    priority
                    className="rounded-full drop-shadow-[0_20px_40px_rgb(79_209_255/0.35)]"
                  />
                </div>
              </div>
              <h2 className="mt-6 animate-rise font-display text-2xl font-semibold [animation-delay:120ms]">
                Hi! What would you like to know?
              </h2>
              <p className="mt-2 max-w-sm animate-rise text-mist [animation-delay:200ms]">
                I&apos;ll look it up in the business&apos;s documents and show you where I found it.
              </p>
              <div className="mt-7 flex animate-rise flex-wrap justify-center gap-2 [animation-delay:300ms]">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="btn-ghost !py-2 text-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] animate-pop rounded-3xl rounded-br-lg bg-gradient-to-br from-glow to-[#7b97ff] px-4 py-3 text-[15px] leading-relaxed font-medium text-midnight shadow-[0_10px_30px_-12px] shadow-glow/60">
                  {msg.text}
                </p>
              </div>
            ) : (
              <div key={i} className="flex animate-pop gap-3">
                <Image src="/brand/logo-256.webp" alt="" width={32} height={32} className="mt-1 size-8 shrink-0 rounded-full" />
                <div className="min-w-0 max-w-[88%]">
                  <p className="glass rounded-3xl rounded-tl-lg px-4 py-3 text-[15px] leading-relaxed text-paper">
                    {msg.text}
                  </p>

                  {/* The agent's trace: shows the model chose to search. */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.toolCalls.map((call, j) => (
                        <span
                          key={j}
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                            call.ok
                              ? call.name === 'createTicket'
                                ? 'border-violet/40 bg-violet/10 text-violet'
                                : 'border-glow/30 bg-glow/10 text-glow'
                              : 'border-pdf/40 bg-pdf/10 text-[#ff8a80]'
                          }`}
                        >
                          {call.name}()
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <details className="group mt-2">
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-full px-1 text-xs text-mist transition hover:text-paper [&::-webkit-details-marker]:hidden">
                        <span className="rounded-sm bg-pdf px-1 text-[9px] font-bold text-white">PDF</span>
                        {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} from the document
                        <span aria-hidden className="transition-transform duration-300 group-open:rotate-180">⌄</span>
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {msg.sources.map((source, j) => (
                          <li key={j} className="animate-pop rounded-2xl border border-white/10 bg-midnight/50 p-3 text-xs text-mist" style={{ animationDelay: `${j * 60}ms` }}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-paper">
                                {source.page ? `Page ${source.page}` : 'Document'}
                              </span>
                              <span className="flex items-center gap-2">
                                <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                                  <span className="block h-full rounded-full bg-gradient-to-r from-glow to-violet" style={{ width: `${Math.round(source.similarity * 100)}%` }} />
                                </span>
                                {(source.similarity * 100).toFixed(0)}% match
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-3 leading-relaxed">{source.excerpt}…</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex animate-pop gap-3">
              <Image src="/brand/logo-256.webp" alt="" width={32} height={32} className="mt-1 size-8 shrink-0 rounded-full" />
              <div className="glass flex items-center gap-3 rounded-3xl rounded-tl-lg px-4 py-3.5">
                <span className="flex gap-1.5" aria-hidden>
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 animate-blink rounded-full bg-glow" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
                <span className="text-sm text-mist">Searching the documents</span>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mx-auto w-fit rounded-2xl border border-pdf/30 bg-pdf/10 px-4 py-2.5 text-sm text-[#ff8a80]">
              {error}
            </p>
          )}

          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="glass mb-3 flex items-center gap-2 rounded-full p-1.5 pl-5 transition focus-within:border-glow/60 sm:mb-5"
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <input
            ref={inputRef}
            id="question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            maxLength={1000}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-paper outline-none placeholder:text-mist/60 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            aria-label="Send"
            className="btn-primary !size-11 shrink-0 !p-0"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
