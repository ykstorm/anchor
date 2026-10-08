import './globals.css'
import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AnalyticsStripped } from './analytics'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // './' is the address of the page being rendered, so each page names itself
  // as canonical, query string left off. A fixed '/' here would tell search
  // engines that /playground is a copy of the home page.
  alternates: { canonical: './' },
  title: { default: 'Anchor', template: '%s · Anchor' },
  description:
    'Retrieval for pgvector that returns no answer when the best match is too weak, and names the source of every chunk it returns.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsStripped />
        <SpeedInsights />
      </body>
    </html>
  )
}
