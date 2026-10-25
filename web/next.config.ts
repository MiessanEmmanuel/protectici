import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), payment=(), usb=(), geolocation=(self)',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  // Permet une compilation de vérification sans toucher au dossier du serveur de développement.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Image Docker : serveur autonome minimal (.next/standalone).
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/a-propos', destination: '/qui-sommes-nous', permanent: true }];
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== '1') {
      headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    }
    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
