import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== '1') {
      headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    }
    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
