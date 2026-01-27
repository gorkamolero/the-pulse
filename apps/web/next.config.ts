import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'dk8a54oensfymssl.public.blob.vercel-storage.com',
        protocol: 'https',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=self'
          }
        ]
      }
    ];
  },
  allowedDevOrigins: [
    "raspgorkpi.drake-halosaur.ts.net",
    "100.73.125.61",
    "gorkbook-pro.drake-halosaur.ts.net",
    "100.92.166.126",
  ],
};

export default nextConfig;
