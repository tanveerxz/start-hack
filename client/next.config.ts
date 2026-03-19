import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['three'],

  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.51.1.171:3000'
  ],
}

export default nextConfig