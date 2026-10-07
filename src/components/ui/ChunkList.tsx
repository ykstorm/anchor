export type ChunkRow = {
  /** Element id, so a citation can link to the row. */
  id: string
  source: string
  score: string
  text: string
  best: boolean
}

// Retrieved chunks in ranked order: source, score and text, best match marked.
export function ChunkList({ rows }: { rows: ChunkRow[] }) {
  return (
    <ol className="chunks">
      {rows.map((row) => (
        <li key={row.id} id={row.id} className="chunk">
          <p className="chunk-head">
            <span className="mono">{row.source}</span>
            <span>
              score <span className="mono">{row.score}</span>
            </span>
            {row.best && <span className="tag">best match</span>}
          </p>
          <p className="chunk-text">{row.text}</p>
        </li>
      ))}
    </ol>
  )
}
