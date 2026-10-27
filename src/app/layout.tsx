import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PDF QA Bot',
  description: 'Turn a business document into a customer support agent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
