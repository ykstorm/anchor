'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { StatusLine } from '@/components/ui/StatusLine'
import { Textarea } from '@/components/ui/Textarea'
import { runQuery, statusOf, type QueryState } from './query'
import { AbstainPanel, AnswerPanel } from './result-panels'

function Outcome({ state }: { state: QueryState }) {
  if (state.kind === 'idle') {
    return (
      <EmptyState title="No question yet">
        The best match appears here first, then its citations and every chunk that cleared the floor.
      </EmptyState>
    )
  }
  if (state.kind !== 'done') return null
  return state.data.refused ? <AbstainPanel data={state.data} /> : <AnswerPanel data={state.data} />
}

export function Playground({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [state, setState] = useState<QueryState>({ kind: 'idle' })
  const busy = state.kind === 'loading'
  const status = statusOf(state)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    if (!q || busy) return
    setState({ kind: 'loading' })
    setState(await runQuery(q))
  }

  return (
    <main className="page">
      <nav aria-label="Site">
        <Link href="/">Anchor</Link>
      </nav>
      <h1>Playground</h1>
      <p className="lede">
        Ask a question about the demo corpus. Anchor returns the stored chunks closest in meaning, each with its
        source, or no answer when even the best match scores under the floor.
      </p>
      <Panel>
        <form onSubmit={handleSubmit}>
          <Field label="Question" help="Enter searches, Shift+Enter starts a new line. Up to 800 characters.">
            {(control) => (
              <Textarea
                {...control}
                name="q"
                rows={2}
                maxLength={800}
                required
                autoFocus
                placeholder="Which Builder A projects in North Ridge are ready to move in?"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
          </Field>
          <div className="row">
            <Button type="submit" disabled={busy}>
              Search
            </Button>
            <StatusLine tone={status.tone}>{status.text}</StatusLine>
          </div>
        </form>
      </Panel>
      <Outcome state={state} />
    </main>
  )
}
