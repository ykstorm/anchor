import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Served at /sitemap.xml. It lists the public pages that have a fixed address:
// the home page and the playground. API routes and any ?q= variant of the
// playground are left out. The home entry has no trailing slash because that
// is the form the canonical link uses for it, so the two always agree.
// tests/seo-routes.test.ts fails if a page is added to src/app without being
// added here.
const PATHS = ['', '/playground']

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${SITE_URL}${path}` }))
}
