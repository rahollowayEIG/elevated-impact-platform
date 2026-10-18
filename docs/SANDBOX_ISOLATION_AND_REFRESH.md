# ElevationPilot Sandbox: Isolation and Refresh Contract

Status: architecture / preflight. Do not enable client access until every gate passes.

## Sources of truth
- Production platform: Supabase `aszixzrdayrivungodwq`.
- Isolated sandbox: Supabase `publruuuyvpggogrrgwp`.
- Separate Vercel project: `elevationpilot-sandbox`.
- Production DB has 67 recorded migrations at the time of the initial audit; sandbox started with 0.
- Repository migration files are **not** yet a complete historical schema snapshot. Do not blindly replay them and claim parity.

## Load Latest Live Version
1. Record the approved production Git commit and release versions of each extension.
2. Export a schema-only snapshot through a controlled operator process (tables, constraints, triggers, functions, enums, indexes, RLS policies, storage configuration). Never import auth secrets, service keys or live OAuth tokens.
3. Compare with sandbox schema and apply versioned, reviewed migrations with rollback/snapshot readiness.
4. Import allowlisted organization/event **configuration**, using fictionalized users, participants and contacts. Keep unique internal identities and foreign keys consistent.
5. Retain sandbox-only integration settings: Stripe TEST only; email routed to sandbox mailbox / verified initiating user; Squawk in sandbox only; no live Google Sheets/Drive writes; no production webhook endpoints.
6. Run scanner preflight, route tests, auth/permissions tests, payments and communication simulations.
7. Only then unlock Demo/Practice. Any outbound integration without sandbox policy must fail closed.

## Hard blockers
- A sandbox page resolves to a production host or production Supabase project.
- Any sandbox worker can use production Stripe keys, OAuth tokens, payment methods or production SMTP destinations.
- Any real participant/recipient is reachable through email, Squawk, push, SMS or third-party integration from the sandbox.
- Demo users can access another client's practice workspace.
- Schema parity is unknown or incomplete while UI claims the sandbox has been refreshed.

## Scanner reporting
Every finding: tested build ID, source environment, intended route, observed route, expected outcome, evidence, severity, proposed fix, owner and retest status.
A successful check must distinguish passed from not-tested/blocked.
No automatic production writes or code merges.

## Refresh modes
- Full release refresh: production-approved code + schema + sanitized allowlisted configuration.
- One organization/event: approved settings and templates plus fictional participants.
- Reset practice: wipe only the initiating tenant's demo records, never the shared platform schema.
- Client practice snapshots should be preserved or explicitly confirmed for replacement.

## Delivery stages
1. Provision isolated infrastructure (completed).
2. Schema extraction/parity and strict integration barriers (not completed).
3. Protected sandbox build, test users and seeded examples (not completed).
4. Real user journeys and scanner automation (not completed).
5. Customer demo/practice access (not completed).
