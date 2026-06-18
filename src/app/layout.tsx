import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Anchor', template: '%s · Anchor' },
  description: 'Provenance-first RAG that refuses to hallucinate.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}