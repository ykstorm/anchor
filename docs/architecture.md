# Anchor — System Architecture

## Why this document exists

Most "RAG system" diagrams are happy-path arrows: query → embed → search → answer. They hide where things go wrong. This doc traces both paths — happy and unhappy — and shows where each defensive layer earns its keep.

---

## 1. Component map

```mermaid
graph TB
    subgraph Client
        UI[Next.js UI<br/>app/playground]
    end

    subgraph "Anchor Service"
        API[/api/query<br/>POST handler/]
        Intent[Intent classifier]
        Retriever[Retriever<br/>retriever.ts]
        Embedder[Embedder<br/>OpenAI / future: Anthropic, Ollama]
        Provenance[Provenance API<br/>chunk → sourceId]
        Health[/api/health/]
    end

    subgraph Storage
        PG[(Postgres + pgvector)]
        Docs[(Documents)]
        Chunks[(Embedding chunks)]
    end

    subgraph "Write path"
        Seed[seed script<br/>scripts/embed-backfill.ts]
        Chunker[Domain chunker<br/>chunkForProject etc.]
    end

    UI --> API
    API --> Intent
    Intent --> Retriever
    Retriever --> Embedder
    Embedder --> PG
    PG --> Retriever
    Retriever --> Provenance
    Provenance --> API
    API --> UI

    Seed --> Chunker
    Chunker --> Embedder
    Embedder --> PG

    Health --> PG

    classDef storage fill:#fef3c7,stroke:#ca8a04
    classDef defense fill:#fee2e2,stroke:#dc2626
    classDef happy fill:#dcfce7,stroke:#16a34a

    class PG,Docs,Chunks storage
    class Retriever,Provenance defense
    class Embedder,Chunker happy
```

---

## 2. Read path — query sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant API as POST /api/query
    participant I as Intent classifier
    participant R as Retriever
    participant E as Embedder
    participant V as pgvector
    participant P as Provenance API
    participant L as LLM (caller)

    U->>API: {"q": "schools near Bopal"}
    API->>I: classify(q)
    I-->>API: intent=amenity → K=10, floor=0.20
    API->>R: retrieve(q, K, floor)
    R->>E: embed(q)  [600ms timeout]
    E-->>R: vector(1536)
    R->>V: SELECT ... ORDER BY embedding <=> q_vec LIMIT 10
    V-->>R: 10 candidates with scores
    R->>R: filter where score ≥ 0.20
    Note over R: ALL below 0.20?<br/>return [] (no source)

    alt chunks found
        R-->>API: {chunks[], scores[], sourceIds[]}
        API->>P: lookupSources(sourceIds)
        P-->>API: sources[]  (title, url, type)
        API-->>L: prompt + provenance-tagged context
        L-->>U: answer + sources
    else nothing crossed floor
        R-->>API: {chunks: [], refused: true}
        API-->>L: prompt + "no source found" sentinel
        L-->>U: "I don't have a source for that. Try X."
    end
```

**Why the sentinel matters.** The LLM is not free-running. It is told explicitly: when `chunks: []` and `refused: true`, do not synthesize from priors. Defer to a fallback action (ask clarifying question, suggest documentation link, suggest contacting human). This is the difference between Anchor and a naive top-K retriever — the unhappy path is engineered, not implicit.

---

## 3. Write path — document ingestion

```mermaid
sequenceDiagram
    autonumber
    participant Op as Operator
    participant Seed as seed script
    participant Chunk as Domain chunker
    participant E as Embedder
    participant V as pgvector
    participant L as Embedding table

    Op->>Seed: npm run seed
    Seed->>Seed: list documents in /corpus
    loop per document
        Seed->>Chunk: chunkForDocType(doc)
        Chunk-->>Seed: chunks[] with positions
        loop per chunk
            Seed->>E: embed(chunkText)
            E-->>Seed: vector(1536)
            Seed->>L: UPSERT (docId, position, contentHash, vector)
            Note over L: idempotent: same hash = same row<br/>OpenAI bill paid once
        end
    end
    Seed-->>Op: report (embedded N chunks, cost $X)
```

---

## 4. The five defensive layers

Inherited from the buyerchat anti-fabrication architecture, three of them land in Anchor:

| # | Layer | Where it lives | What it catches |
|---|---|---|---|
| 1 | Cosine floor | `retriever.ts:filterByFloor` | Top-K results that are technically returned but semantically irrelevant |
| 2 | 600 ms timeout | `retriever.ts:withTimeout` | Slow embedder or DB → silent degradation, not 30s hang |
| 3 | Provenance API | `lib/provenance.ts` | LLM citation drift — chunk goes in, sourceId must come out |
| 4 | Adaptive K | `retriever.ts:classifyIntent` | Amenity queries starved of recall; precision queries flooded with noise |
| 5 | Idempotent upsert | `scripts/embed-backfill.ts` | Re-seed bloats the table, doubles cost, confuses retrieval |

Layers 2 (markdown abort) and 4 (regex audit) from buyerchat live in a sibling project: **Streamward**.

---

## 5. Failure modes (intentional)

| Failure | Anchor behavior | What you DON'T get |
|---|---|---|
| Embedder timeout (>600ms) | Returns empty chunks + `refused: true` | A 30s hang while OpenAI is having an outage |
| All chunks below floor | Returns empty chunks + `refused: true` | The LLM stitching together unrelated documents |
| DB connection drop | Returns empty chunks + Sentry alert | A crashing API route |
| Malformed query (empty string) | 400 Bad Request | A wasted embedding call |
| Duplicate seed run | Idempotent — same hash → same row | Doubled embedding cost + duplicate retrieval hits |

---

## 6. What's intentionally out of scope (v0.1)

- **Re-ranking.** Cross-encoder re-rank pass would improve quality at the cost of latency. We expose a hook (`afterRetrieve(chunks)`) but ship without one. Add yours if you need it.
- **Hybrid retrieval (BM25 + vector).** Proper nouns hurt pure vector search. Hybrid retrieval is on the v0.3 roadmap.
- **Multi-tenant isolation.** Single-tenant Postgres schema. v0.3 adds namespace per tenant.
- **Streaming.** Anchor returns chunks synchronously. Streaming the LLM response is the caller's job (Anchor's sibling **Streamward** handles mid-stream safety).

---

## 7. Deployment topology (production)

```mermaid
graph LR
    User[User] -->|HTTPS| Edge[Vercel Edge]
    Edge --> App[Anchor Next.js<br/>Vercel serverless]
    App -->|pooled| Neon[(Neon Postgres<br/>pgvector pre-installed)]
    App --> OpenAI[OpenAI embeddings API]

    classDef edge fill:#e0e7ff,stroke:#4f46e5
    classDef compute fill:#dcfce7,stroke:#16a34a
    classDef data fill:#fef3c7,stroke:#ca8a04

    class Edge edge
    class App compute
    class Neon,OpenAI data
```

- **Compute:** Vercel Next.js serverless functions (no cold-start tax on Edge runtime for /api/query)
- **Database:** Neon Postgres (Free tier supports pgvector natively, autoscaling, branching for preview deploys)
- **Embedder:** OpenAI text-embedding-3-small (~$0.02 per million tokens, sub-200ms p99)
- **Observability:** Sentry for errors, Vercel Analytics for latency, OpenTelemetry hooks exposed but unopinionated

Self-hosted alternative: any Postgres with pgvector + any Node runtime. Anchor is portable by design.
