import type { NextConfig } from "next";


const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',

  //basePath: isProd ? '/Study-Abroad-Tool' : '',
  //assetPrefix: isProd ? '/Study-Abroad-Tool/' : '',

  images: { 
    unoptimized: true, 
  }, 

  eslint: {
    ignoreDuringBuilds: true,
  },


};

export default nextConfig;