import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // --- Configuration for GitHub Pages Project Site ---
  // Replace <repository-name> with your actual repository name.
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Study-Abroad-Tool/' : '', // Important for asset paths
  basePath: process.env.NODE_ENV === 'production' ? '/Study-Abroad-Tool' : '',    // Important for routing
  images: {
    unoptimized: true, // Disable Next.js image optimization (not compatible with static export)
  },
  // If you have a trailing slash issue, you can try this:
  // trailingSlash: false,
};

export default nextConfig;