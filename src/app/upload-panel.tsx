'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function UploadPanel() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) setError(data.error ?? 'Upload failed');
      else router.refresh();
    } catch {
      setError('Upload failed. Check your connection.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-8">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 py-10 text-center transition hover:border-slate-400 ${
          uploading ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <span className="text-sm font-medium text-slate-900">
          {uploading ? 'Processing — this takes a few seconds…' : 'Upload a PDF'}
        </span>
        <span className="mt-1 text-xs text-slate-500">
          FAQ, policy, pricing or menu. Max 10 MB.
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
