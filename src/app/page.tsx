import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
        <div className="text-xl font-bold tracking-tight">Anchor</div>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/playground" className="hover:text-white transition-colors">Playground</Link>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-24 pb-20 text-center">
        <div className="inline-block px-3 py-1 mb-6 text-xs font-medium border rounded-full bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
          Live · corpus-backed RAG demo
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          Ask anything about<br />
          <span className="text-emerald-400">projects, builders, localities</span>
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
          Anchor is a production-grade RAG stack built on Next.js 15, Prisma 7, and pgvector.
          Semantic search across real estate data — retrieval failed means answering refused.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/playground"
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors"
          >
            Open Playground →
          </Link>
          <a
            href="https://github.com/ykstorm/anchor"
            className="px-6 py-3 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300 font-medium transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Query demos */}
      <section className="max-w-3xl mx-auto px-8 pb-20">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">Try these queries</h2>
        <div className="grid gap-3">
          {[
            'Which Goyal & Co. projects in Shela are ready to move in?',
            'Projects in South Bopal under ₹1Cr with metro access',
            'Builders with A-grade trust score in Ahmedabad',
            'xkcd 18472 nonsense gibberish', // off-topic → refused
          ].map((q) => (
            <Link
              key={q}
              href={`/playground?q=${encodeURIComponent(q)}`}
              className="flex items-center gap-3 px-5 py-4 rounded-xl border border-gray-800 bg-gray-900 hover:border-emerald-500/40 hover:bg-gray-800/50 transition-all group"
            >
              <span className="text-gray-400 group-hover:text-emerald-400 transition-colors">›</span>
              <span className="text-gray-200 text-sm">{q}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-4xl mx-auto px-8 pb-24">
        <h2 className="text-2xl font-bold mb-8">What makes Anchor production-ready</h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            {
              title: '5-layer anti-hallucination',
              desc: 'Similarity floor, max chunks cap, refused-state flag, raw retrieval output, no LLM confabulation.',
            },
            {
              title: 'Sub-50ms retrieval',
              desc: 'pgvector HNSW index on Embedding table. Cosine similarity with configurable score floor.',
            },
            {
              title: 'Refused-state gateway',
              desc: 'Every /api/query response returns {chunks, refused}. Zero chunks = refusing to answer.',
            },
            {
              title: 'Corpus-backed live demo',
              desc: 'Seed route populates Embedding table from live DB. Playground queries the real vector store.',
            },
            {
              title: 'Next.js 15 + Prisma 7',
              desc: 'App Router, Server Components, edge-ready API routes. Prisma with raw SQL for pgvector.',
            },
            {
              title: 'Apache 2.0 licensed',
              desc: 'Full source available. Clone, deploy, customize.',
            },
          ].map((f) => (
            <div key={f.title} className="px-6 py-5 rounded-xl border border-gray-800 bg-gray-900/50">
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="max-w-4xl mx-auto px-8 pb-32 border-t border-gray-800 pt-16">
        <h2 className="text-2xl font-bold mb-8">Architecture</h2>
        <pre className="text-sm text-gray-400 bg-gray-900 rounded-xl p-6 overflow-x-auto leading-relaxed">{`User query
   │
   ▼
Next.js API Route (/api/query)
   │
   ▼
OpenAI text-embedding-3-small  (query → vector)
   │
   ▼
pgvector  ←→  Embedding table (1536-dim, HNSW index)
   │
   ▼
chunks[]  +  refused boolean
   │
   ▼
JSON response { chunks, refused }`}</pre>
      </section>
    </main>
  )
}