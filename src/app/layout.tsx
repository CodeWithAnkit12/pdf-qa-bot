import type { Metadata, Viewport } from 'next';
// Fonts are self-hosted from npm packages: no request to Google at
// runtime (faster, works offline, no third-party tracking).
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PDF QA Bot', template: '%s | PDF QA Bot' },
  description:
    'Upload your FAQ, policy or menu PDF and get a support chat that answers customers from it, with page citations.',
};

export const viewport: Viewport = {
  themeColor: '#070b1f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
