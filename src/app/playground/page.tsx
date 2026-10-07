import type { Metadata } from 'next'
import { Playground } from './playground'

export const metadata: Metadata = { title: 'Playground' }

// The home page links here with ?q= to fill the box. It does not search on load.
export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q } = await searchParams
  return <Playground initialQuery={typeof q === 'string' ? q.slice(0, 800) : ''} />
}
