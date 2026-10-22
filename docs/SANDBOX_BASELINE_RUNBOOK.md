# ElevationPilot isolated sandbox baseline

## Status
The Supabase sandbox project and its dedicated Vercel project exist, but the database is **not cloned** and the web app is **not ready for user testing**.

## Safe baseline procedure
1. Use a restricted, read-only database credential via an operator-controlled environment; never place it in chat, repository files, GitHub logs, or public environment variables.
2. Execute `scripts/sandbox/export-schema-only.sh` from a controlled workstation or CI secret-enabled runner. It uses `pg_dump --schema-only`; **no table rows** are extracted.
3. Inspect the schema for privileged functions, secrets in function bodies, foreign dependencies, grant statements, and references to production domains or integrations before storing or applying it.
4. Apply reviewed schema to the empty, isolated Supabase project through migrations. Handle Supabase-managed schemas and storage setup separately.
5. Deploy only sandbox-safe functions and fake integrations. Redirect all mail to the initiating verified demo user, Squawk to simulated users, and payments to Stripe test mode. Fail closed when unconfigured.
6. Seed fictional users/events, run RLS and workflow tests, and verify no sandbox request can call production.
7. Enable the Vercel sandbox deployment and client demo only after isolation tests pass.

## Initial production inventory (2026-10-18)
- 71 public base tables
- 38 public functions
- 131 public RLS policies
- 31 public trigger records
- 67 recorded Supabase migrations (sandbox initially had 0)

These counts are inventory, **not** proof of schema parity. Baseline excludes production data by design.

## Important
The sandbox refresh action must not execute unrestricted SQL dumps from production or import auth users, stored tokens, signed documents, real communications or payments. Do not treat GitHub preview environments as isolated until their Supabase connection and integration safety have been verified.
