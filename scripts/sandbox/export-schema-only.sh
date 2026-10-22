#!/usr/bin/env bash
set -euo pipefail

# Usage: SOURCE_DB_URL=... bash scripts/sandbox/export-schema-only.sh
# Use a read-only production role with catalog read permissions. Keep URLs secret.
# No rows or customer data are exported.
: "${SOURCE_DB_URL:?Set SOURCE_DB_URL in a secure shell; never commit it}"
mkdir -p sandbox/schema
pg_dump --dbname="$SOURCE_DB_URL" \
  --schema=public --schema-only --no-owner --no-privileges \
  --file=sandbox/schema/production-public-schema.sql
echo "Schema-only export written. Review security policies, extensions and cross-schema dependencies before applying."
echo "Never treat this export as complete Supabase parity: audit auth, storage, edge functions and privileges separately."
