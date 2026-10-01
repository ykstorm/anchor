-- Fixed-window rate-limiting counters for the public API routes.
-- One row per (caller-hash, window); the bucket string is the primary key so the
-- counter upsert is a single atomic statement.
CREATE TABLE "RateLimit" (
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("bucket")
);

-- Supports opportunistic cleanup of expired windows.
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
