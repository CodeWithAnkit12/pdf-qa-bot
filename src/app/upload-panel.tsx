'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

/**
 * Drop zone for PDFs. Accepts click-to-browse and drag-and-drop.
 * The animated border is a conic gradient that only spins while
 * something is happening (dragging over, or uploading), so motion
 * always means "the app is responding to you".
 */
export default function UploadPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('That file isn’t a PDF. Choose a .pdf file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That PDF is over 10 MB. Try a smaller file.');
      return;
    }

    setUploading(true);
    setError(null);
    setLastFile(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) setError(data.error ?? 'Upload failed. Try again.');
      else router.refresh();
    } catch {
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  const active = dragging || uploading;

  return (
    <div>
      <div className="relative rounded-3xl p-px">
        {/* Animated gradient border */}
        <span
          aria-hidden
          className={`absolute inset-0 overflow-hidden rounded-3xl transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-40'}`}
        >
          <span
            className={`absolute top-1/2 left-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,var(--color-glow),var(--color-violet),var(--color-signal),var(--color-glow))] ${active ? 'animate-[spin_2.5s_linear_infinite]' : ''}`}
          />
        </span>

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`relative flex w-full flex-col items-center justify-center gap-4 rounded-[23px] bg-midnight/85 px-6 py-12 text-center backdrop-blur-xl transition duration-300 ${
            dragging ? 'scale-[0.99] bg-ink/90' : 'hover:bg-ink/80'
          } disabled:cursor-wait`}
        >
          <span
            aria-hidden
            className={`relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-white to-[#dfe6ff] shadow-[0_12px_30px_-8px] shadow-glow/50 transition-transform duration-500 ${
              dragging ? '-translate-y-2 rotate-[-6deg] scale-110' : ''
            } ${uploading ? 'animate-float' : ''}`}
          >
            <span className="absolute -top-1 -right-1 size-4 rounded-sm bg-pdf/90 [clip-path:polygon(0_0,100%_100%,0_100%)]" />
            <span className="rounded bg-pdf px-1.5 py-0.5 text-[11px] font-bold text-white">PDF</span>
          </span>

          {uploading ? (
            <>
              <span className="font-display text-lg font-semibold">Reading {lastFile}</span>
              <span className="text-sm text-mist">
                Splitting it into passages and indexing each one. Usually under 30 seconds.
              </span>
              <span className="skeleton h-1.5 w-56 rounded-full" />
            </>
          ) : (
            <>
              <span className="font-display text-lg font-semibold">
                {dragging ? 'Drop it here' : 'Upload a PDF'}
              </span>
              <span className="text-sm text-mist">
                Drag a file here or click to choose. FAQ, policy, pricing or menu, up to 10 MB.
              </span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <p role="alert" className="mt-3 text-sm text-[#ff8a80] empty:hidden">
        {error}
      </p>
    </div>
  );
}
