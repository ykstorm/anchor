import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Served at /robots.txt. The API routes return JSON and are not pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
