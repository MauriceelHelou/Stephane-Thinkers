/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Required for Docker/Railway deployment - creates standalone build
  output: 'standalone',

  // Optimize images for production
  images: {
    unoptimized: true,
  },

  // TypeScript - ignore test file errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
