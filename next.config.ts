import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // unpdf ships its own pdf.js build; keep it out of the server bundle
  // so Next doesn't try to transform it.
  serverExternalPackages: ['unpdf'],
};

export default nextConfig;
