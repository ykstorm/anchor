import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <main className="page">
      <nav aria-label="Site">
        <Link href="/">Anchor</Link>
      </nav>
      <h1>Page not found</h1>
      <EmptyState title="Nothing is published at this address.">
        The site has two pages: the <Link href="/">home page</Link> and the <Link href="/playground">playground</Link>.
      </EmptyState>
    </main>
  )
}
