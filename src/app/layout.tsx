import './globals.css'
import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AnalyticsStripped } from './analytics'

export const metadata: Metadata = {
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
