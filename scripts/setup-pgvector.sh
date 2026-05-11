#!/bin/bash
# scripts/setup-pgvector.sh
# Start pgvector via docker-compose, run Prisma migrate, seed sample data.
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== Starting pgvector ==="
docker compose up -d postgres

echo "=== Waiting for postgres to be ready ==="
sleep 3
until docker compose exec -T postgres pg_isready -U rag > /dev/null 2>&; do
  echo "  Waiting for postgres..."
  sleep 2
done
echo -e "${GREEN}✓ postgres is up${NC}"

echo "=== Checking DATABASE_URL ==="
if [ -z "$DATABASE_URL" ]; then
  echo -e "${GREEN}Setting DATABASE_URL for local dev${NC}"
  export DATABASE_URL="postgresql://rag:rag_password@localhost:5432/rag_starter?sslmode=prefer"
  echo "DATABASE_URL=postgresql://rag:rag_password@localhost:5432/rag_starter?sslmode=prefer" >> .env.local
fi

echo ""
echo "=== Ready ==="
echo "  DATABASE_URL: $DATABASE_URL"
echo "  Run: npx prisma studio  (to browse data)"
echo "  Run: npm run embed:backfill  (to embed sample data)"