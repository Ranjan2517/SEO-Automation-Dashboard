/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a check build run beside a live `next start` without overwriting its files.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Keep these as plain Node requires instead of bundling them into route handlers.
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis', '@prisma/client', 'puppeteer'],
  },
};

export default nextConfig;
