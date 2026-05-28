#!/bin/bash
URL="$1"
TIMEOUT="${2:-60}"
START=$(date +%s)
while true; do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    echo "healthy: $URL"
    exit 0
  fi
  NOW=$(date +%s)
  if (( NOW - START > TIMEOUT )); then
    echo "timeout waiting for $URL"
    exit 1
  fi
  sleep 2
done
