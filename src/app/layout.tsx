import './src/app/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RAG Starter',
  description: 'Next.js 15 + Prisma + pgvector RAG template',
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