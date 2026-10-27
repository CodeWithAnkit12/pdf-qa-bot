'use client';

import { useEffect, useState } from 'react';

/** Shows the full chat URL with a copy button that confirms itself. */
export default function CopyLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);

  // The server doesn't know which domain the visitor used, so the
  // full URL is built in the browser.
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-midnight/60 p-1.5 pl-3.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-mist" title={url}>
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition duration-300 ${
          copied ? 'bg-emerald-400 text-midnight' : 'bg-white/10 text-paper hover:bg-white/20'
        }`}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}
