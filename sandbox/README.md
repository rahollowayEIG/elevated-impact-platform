# ElevationPilot Sandbox Baseline: Schema-Only Replay

**Status (October 2026):** All 71 production public tables have been recreated in the isolated project `publruuuyvpggogrrgwp`. Metadata comparisons currently match 222 indexes, 403 constraints, 131 RLS policies, 25 public triggers (31 trigger events), 38 public functions, 24 `eig_private` functions, 4 `app_private` functions, the `private.enforce_golf_event_capacity` function, one security-invoker view, and three identity sequences. No production data was imported.

**Production reference:** `aszixzrdayrivungodwq` is READ-ONLY for inventory. NEVER target that project with these files. No live data snapshots, auth users, passwords, access tokens, payment methods, messages, Drive links, or customer assets are used.

## Rebuild a brand-new isolated sandbox

Before every operation, verify you are in the designated SANDBOX project. These are ordered SQL files in `sandbox/baseline/`; apply only to a clean separate Supabase project with Supabase-managed `auth` and `storage` already provisioned:

1. `00_bootstrap_first_13.sql` (recovered from the sandbox's own prior migration log)
2. `slice_01.sql` through `slice_06.sql`
3. `align_numeric_precision.sql`
4. `unique_constraints.sql`
5. `foreign_keys.sql`
6. `check_constraints_safe.sql`
7. `private_validation_functions.sql`
8. `indexes_01.sql`, then `indexes_02.sql`
9. `reviewed_local_triggers.sql`
10. `reviewed_business_triggers.sql`
11. `private_functions_quarantined.sql`
12. `public_functions_quarantined.sql`
13. `identity_columns.sql`
14. `organization_credit_view.sql`
15. `app_private_policy_helpers.sql`
16. `rls_policies_part_01.sql`, then `rls_policies_part_02.sql`

**Do not replay these files against the already-populated sandbox**; they are a clean-rebuild reference, not repeat-safe migrations. Do not include this directory in automated production migrations. Stored function and policy definitions remain subject to human security review before granting access.

To add fictional, unpublished demonstration settings, run `sandbox/fixtures/fictional_practice_event.sql` against the designated sandbox **once**. All email addresses use the reserved `.example` domain. Do not enable external delivery, payment processors, or Google integrations for that fixture.

## Verified protection

- All 71 application tables have RLS enabled.
- `anon` and `authenticated` have **zero direct public-table privileges and zero application-function EXECUTE privileges**.
- No auth users, stored objects, Google OAuth token rows, real messages, or participant registrations are present in the sandbox.
- Isolation and parity are different gates. Matching SQL definitions does **not** prove UI readiness or integration isolation.
- Production migration history was **not** copied into the sandbox. This baseline is schema, indexes, constraints, functions, policy, triggers, view and sequence definitions, not production row snapshots.

## Still BLOCKED before any client testing

- Review and selectively grant safe sandbox RLS + RPC privileges; test role boundaries with synthetic accounts.
- Configure sandbox-specific Auth redirects and fictional verified user accounts; block signup links to live.
- Deploy isolated Supabase Edge Functions and confirm no live email, Stripe, Google Workspace, webhook, SMS, or external Squawk destinations can be reached. Use test payments and a sandbox-only mailbox.
- Audit all cross-app URLs, hardcoded live site links, embedding, email templates, images and asset/storage references. Platform routing guard PR #60 is **draft**, not certified.
- Add safe storage buckets/objects, synthetic team registrations and financial simulations only after outbound integrations are quarantined.
- Run complete Airport → Registration → Main Cabin → Event Builder journeys and negative isolation tests in the protected sandbox.
- Integrate the safe-load policy and full automated refresh gate before enabling any “Load Latest Live Version” button. Current loader is **not** automated.

## Migration hygiene

Future refreshes must reject new columns/tables by default until classified. Maintain an auditable per-field allowlist for approved event settings, never import authentication tables or customer rows. Keep secrets only in dedicated sandbox environment variables and route all communications to an internal practice mailbox. A schema change from production requires catalog validation and an isolated test before being approved for sandbox replay.
