import type { ReactNode } from 'react'

// What an area shows before it has anything to show.
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="empty-body">{children}</p>
    </div>
  )
}
