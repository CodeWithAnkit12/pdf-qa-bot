'use client';

import { use, useRef, useState } from 'react';

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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
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
        setError(data.error ?? 'Something went wrong.');
      } else {
        setMessages([
          ...nextMessages,
          {
            role: 'model',
            text: data.answer,
            sources: data.sources,
            toolCalls: data.toolCalls,
          },
        ]);
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setPending(false);
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ behavior: 'smooth' }),
      );
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4">
      <header className="border-b border-slate-200 py-4">
        <h1 className="text-sm font-semibold text-slate-900">Ask us anything</h1>
        <p className="text-xs text-slate-500">
          Answers come from this business&apos;s own documents.
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">
            Try: &ldquo;What are your opening hours?&rdquo;
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={
                msg.role === 'user'
                  ? 'ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white'
                  : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-900'
              }
            >
              {msg.text}
            </div>

            {/* The agent's trace. Great for a demo video: it shows the
                model choosing to search rather than just answering. */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.toolCalls.map((call, j) => (
                  <span
                    key={j}
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
                      call.ok
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {call.name}()
                  </span>
                ))}
              </div>
            )}

            {msg.sources && msg.sources.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">
                  {msg.sources.length} source
                  {msg.sources.length > 1 ? 's' : ''} from the document
                </summary>
                <ul className="mt-2 space-y-2">
                  {msg.sources.map((source, j) => (
                    <li
                      key={j}
                      className="rounded border border-slate-200 bg-white p-2.5 text-xs text-slate-600"
                    >
                      <span className="font-medium text-slate-900">
                        {source.page ? `Page ${source.page}` : 'Document'}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {(source.similarity * 100).toFixed(0)}% match
                      </span>
                      <p className="mt-1 line-clamp-3">{source.excerpt}…</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}

        {pending && <p className="text-sm text-slate-400">Searching the documents…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          maxLength={1000}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-slate-900 px-5 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
