'use client'

import { Analytics } from '@vercel/analytics/next'

// Strip the query string from analytics URLs. The playground puts the user's
// search text in ?q=..., which must never leave the browser as analytics data.
export function AnalyticsStripped() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url)
          url.search = ''
          return { ...event, url: url.toString() }
        } catch {
          return event
        }
      }}
    />
  )
}
