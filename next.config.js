/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // El service worker debe poder controlar todo el origen y no cachearse.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
