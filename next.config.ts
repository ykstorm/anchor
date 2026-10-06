import type { NextConfig } from 'next'

// Pragmatic CSP: Next injects inline hydration scripts and inline styles, so
// 'unsafe-inline' is required without a nonce middleware. The playground only
// calls its own /api/* routes. In production, Vercel Analytics and Speed
// Insights load their scripts from this site (/_vercel/...); in development they
// load debug scripts from va.vercel-scripts.com, so script-src and connect-src
// also allow Vercel's analytics hosts. Everything else is locked down.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  // 'standalone' is for the Docker image. On Vercel it breaks output
  // tracing (next-server.js.nft.json is never written), so skip it there.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig