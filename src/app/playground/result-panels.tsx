import { ChunkList } from '@/components/ui/ChunkList'
import { Panel } from '@/components/ui/Panel'
import { chunkRows, citations, formatBelow, formatScore, type QueryResponse } from './query'

// Anchor writes no text of its own, so the answer is the best match, quoted.
export function AnswerPanel({ data }: { data: QueryResponse }) {
  const rows = chunkRows(data.chunks)
  const best = rows.find((row) => row.best)
  if (!best) return null
  const cites = citations(data)
  const cited = cites.findIndex((c) => c.label === best.source) + 1
  return (
    <Panel title="Answer">
      <p className="answer">{best.text}</p>
      <p className="meta">
        Quoted from the best match,{' '}
        <a href={`#${best.id}`}>
          [{cited}] <span className="mono">{best.source}</span>
        </a>
        , score <span className="mono">{best.score}</span>.
      </p>
      <h3>Citations</h3>
      <ol className="citations">
        {cites.map((c) => (
          <li key={c.label}>
            <a href={c.href} className="mono">
              {c.label}
            </a>
            , score <span className="mono">{c.score}</span>
          </li>
        ))}
      </ol>
      <h3>
        Chunks above the {formatScore(data.floor)} floor ({rows.length})
      </h3>
      <ChunkList rows={rows} />
    </Panel>
  )
}

export function AbstainPanel({ data }: { data: QueryResponse }) {
  const best = data.maxSimilarity
  return (
    <Panel title="No answer">
      <p className="answer">
        {best === null
          ? 'The store returned no chunks at all, so nothing could be compared with the floor. The corpus may not be seeded.'
          : 'No chunk scored at or above the floor, so Anchor returns no answer instead of a weak match.'}
      </p>
      <dl className="facts">
        <dt>Floor</dt>
        <dd className="mono">{formatScore(data.floor)}</dd>
        <dt>Best score</dt>
        <dd className="mono">{best === null ? 'none' : formatBelow(best, data.floor)}</dd>
      </dl>
    </Panel>
  )
}
