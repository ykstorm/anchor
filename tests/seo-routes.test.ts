import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { metadata } from '@/app/layout'
import { SITE_URL } from '@/lib/site'

const APP_DIR = join(process.cwd(), 'src', 'app')

// Every route that has a page.tsx, as a URL path. API routes are not pages.
function pageRoutes(dir = APP_DIR, segments: string[] = []): string[] {
  const routes: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (segments.length === 0 && entry.name === 'api') continue
      routes.push(...pageRoutes(join(dir, entry.name), [...segments, entry.name]))
    } else if (entry.name === 'page.tsx') {
      routes.push('/' + segments.join('/'))
    }
  }
  return routes
}

function sitemapUrls(): string[] {
  return sitemap().map((entry) => entry.url)
}

describe('SITE_URL', () => {
  it('is the https origin of the production site, with no path or trailing slash', () => {
    const url = new URL(SITE_URL)
    expect(url.protocol).toBe('https:')
    expect(url.origin).toBe(SITE_URL)
  })

  it('matches the homepage recorded in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { homepage: string }
    expect(SITE_URL).toBe(pkg.homepage)
  })
})

describe('robots', () => {
  const result = robots()
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules]

  it('lets every crawler read the site but keeps them off the API', () => {
    expect(rules).toHaveLength(1)
    expect(rules[0].userAgent).toBe('*')
    expect(rules[0].allow).toBe('/')
    expect(rules[0].disallow).toEqual(['/api/'])
  })

  it('points at the absolute sitemap URL', () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})

describe('sitemap', () => {
  it('has absolute https URLs on the production origin, once each, with no query or fragment', () => {
    const urls = sitemapUrls()
    expect(urls.length).toBeGreaterThan(0)
    expect(new Set(urls).size).toBe(urls.length)
    for (const url of urls) {
      const parsed = new URL(url)
      expect(parsed.origin).toBe(SITE_URL)
      expect(parsed.search).toBe('')
      expect(parsed.hash).toBe('')
    }
  })

  it('lists the home page and the playground', () => {
    const urls = sitemapUrls()
    expect(urls).toContain(SITE_URL)
    expect(urls).toContain(`${SITE_URL}/playground`)
  })

  it('lists no API route and no dynamic segment', () => {
    for (const url of sitemapUrls()) {
      const path = new URL(url).pathname
      expect(path).not.toMatch(/^\/api(\/|$)/)
      expect(path).not.toMatch(/[[\]]/)
    }
  })

  it('has exactly one entry for each static page in src/app', () => {
    const fromFiles = pageRoutes()
      .filter((route) => !route.includes('['))
      .map((route) => (route === '/' ? SITE_URL : `${SITE_URL}${route}`))
    expect(sitemapUrls().sort()).toEqual(fromFiles.sort())
  })
})

describe('root layout metadata', () => {
  it('sets metadataBase to the production origin', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
    expect((metadata.metadataBase as URL).origin).toBe(SITE_URL)
  })

  it('sets a canonical that follows the page, so /playground is not marked as a copy of the home page', () => {
    expect(metadata.alternates?.canonical).toBe('./')
  })
})
