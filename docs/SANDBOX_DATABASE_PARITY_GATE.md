# Sandbox database parity gate

Production inventory recorded 2026-10-18: 71 tables, 160 foreign keys, 71 RLS-enabled tables, 131 policies, 38 public functions, 31 trigger records, 1 view, 3 sequences.

Use `scripts/sandbox/verify-schema-parity.sql` as a **read-only** count comparison before and after a controlled schema-only baseline deployment.

## Required gates
- Production schema is exported from a restricted role with `pg_dump --schema-only`; never use a data dump.
- Review SQL for hardcoded production references, elevated privileges, definer functions and external integrations.
- Apply to the sandbox project `publruuuyvpggogrrgwp` only. Verify its project ID before each migration.
- Validate object-level names, relationships, RLS policy predicates, functions, triggers, views, storage objects and extensions beyond these counts.
- Do not enable outgoing mail, Stripe live payments, OAuth callbacks or webhook delivery.
- Seed entirely fictional accounts and event content and test allowed/denied role access.
- Counts alone cannot prove parity or confidentiality; no sandbox deployment is client-ready until all gates pass.

## Blocker
The sandbox currently has zero public tables. A reviewed schema-only dump has **not** been generated or applied yet. The existing repository migrations are not a full copy of the live schema, so running them alone would not establish parity.
