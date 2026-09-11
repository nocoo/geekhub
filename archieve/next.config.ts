import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize for production builds
  reactStrictMode: true,

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
