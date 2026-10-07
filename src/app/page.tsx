import Link from 'next/link'
import { Panel } from '@/components/ui/Panel'
import { SIM_FLOOR } from '@/lib/rag/retriever'

const REPO = 'https://github.com/ykstorm/anchor'

export default function Home() {
  return (
    <main className="page">
      <h1>Anchor</h1>
      <p className="lede">
        Anchor takes a text query and searches a Postgres table for the closest stored chunks. When the best match
        clears a similarity floor, it returns the matching chunks with their provenance, the record of which source
        each chunk came from. When nothing clears the floor, it returns an empty result flagged{' '}
        <span className="mono">refused</span>, with the floor and the best similarity it saw, so the caller can tell
        a real miss from a weak guess.
      </p>
      <Panel title="Facts">
        <dl className="facts">
          <dt>Corpus</dt>
          <dd>
            A synthetic real-estate dataset of invented placeholders: 16 projects, 5 builders, 4 localities, 4 infra
            items and 31 points of interest, 60 rows in all.
          </dd>
          <dt>Threshold</dt>
          <dd>
            A cosine similarity floor of <span className="mono">{SIM_FLOOR.toFixed(2)}</span>, set by hand and not
            yet calibrated against this corpus.
          </dd>
          <dt>Code</dt>
          <dd>
            <a href={REPO}>github.com/ykstorm/anchor</a>, Apache 2.0.
          </dd>
        </dl>
        <p className="row">
          <Link href="/playground" className="button">
            Open the playground
          </Link>
          <a href={REPO}>Read the code on GitHub</a>
        </p>
      </Panel>
    </main>
  )
}
