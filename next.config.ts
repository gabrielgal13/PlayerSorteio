// @ts-check
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  turbopack: {},
  async rewrites() {
    return [
      { source: '/api/marketing/random', destination: '/api/admin/marketing/random' },
    ];
  },
};

export default nextConfig;
