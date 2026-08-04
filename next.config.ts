import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export is a hard constraint (CLAUDE.md): no backend, no API routes,
  // no server actions. `next build` emits a fully static site into `out/`.
  output: 'export',

  // The image optimiser is a server feature and is unavailable under `export`.
  // Card visuals are deterministic CSS gradients, so nothing needs it.
  images: { unoptimized: true },

  reactStrictMode: true,
};

export default nextConfig;
