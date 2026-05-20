import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
  turbopack: {},
};

export default nextConfig;
