# Build Lab permanent records: staged release gate

Status: **isolated browser storage and recovery PASS (2026-10-31); production storage remains OFF and unapplied**.
Branch: `release/build-lab-v1-owner-only-20261028`.
Owner-only preview scanning and local Scan → History → Work Buckets → Review & Fix Plan are verified. The separate **5. Cloud Storage** preview tab successfully saved one Master Scan, 13 Work Bucket findings and one synthetic Manager Plan to a disposable Supabase branch; all three were restored and compared successfully (cloud revisions **2, 2, 1**). Production cloud persistence is **not activated**.

## Files staged for review

- `api/eig-build-lab-live-records.js`: typed read/save endpoint, independent server-side owner check.
- `server/eig-build-lab-durable-records.cjs`: strict document validation, size limits, optimistic revision checks and fail-closed storage errors.
- `server/eig-build-lab-document-store.cjs`: fixed Supabase project/table/RPC adapter; no client-supplied table, SQL or owner.
- `docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql`: applied and tested **only on isolated Supabase test branches**, not production; RLS and service-only grants, versioned append-only history, atomic compare-and-swap.
- `src/lib/buildLabCloudRecords.mjs`, `src/lib/buildLabCloudBackup.mjs`, `src/components/BuildLabCloudBackup.jsx`: already-staged explicit inspect, backup, compare, and restore controls.
- `tests/eig-build-lab-durable-records.test.cjs`: server authorization, wrong owner, revoked session, malformed inputs, stale revisions, outages, and schema contract.
- `tests/build-lab-cloud-records.test.mjs`, `tests/build-lab-cloud-backup.test.mjs`: client and backup recovery contracts.

## Explicit rollout boundaries

1. **No production or pink Sandbox schema changes now.** Do not execute the SQL design proposal directly. Create and review an actual migration with Supabase CLI, then test against an isolated database before considering deployment.
2. **No automatic cloud writes or sync.** Cloud save and restore must be deliberate owner actions with visible revision comparison; local JSON export remains the safe recovery path until verified.
3. **Production remains OFF.** `EIG_BUILD_LAB_LIVE_RECORDS_ENABLED` and `VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED` stay disabled. A **separate, owner-gated test-only Preview endpoint** and Preview UI were enabled to verify temporary storage on an isolated Supabase project. Do not use those test endpoints for production or weaken the owner/session gate.
4. **No cross-app data.** Only `scan_history`, `work_buckets`, and `manager_blueprint`; no registrations, payment records, customer tables, emails, or unrestricted source blobs.
5. **No execution authority.** Stored plans have no capability to trigger repair agents, jobs, merges, or deployment.

## Must-pass acceptance matrix before enabling records

| Gate | Evidence required |
| --- | --- |
| Immutable owner and session | Correct owner succeeds; nonowner, wrong organization, revoked/expired session, forbidden origin fail without any storage call |
| Schema privileges | RLS enabled; zero anon/authenticated table or RPC privileges; service-only access verified by database queries |
| Atomic save | Revision 0→1, 1→2, stale revision rejected with 409; concurrent writers cannot overwrite the winner |
| Revision history | Each successful save creates one retrievable revision; no history row on conflict or failed transaction |
| Validation | Oversized, malformed, wrong kind, owner-supplied ID/SQL/table requests rejected before storage |
| Backup / recovery | Download local evidence before restore; read and compare all three cloud documents; no silent browser overwrite; absent cloud data does not erase local data |
| Runtime isolation | Preview uses an isolated test data store with no production writes. Current Preview endpoint must deny records while flag is off |
| Deploy & rollback | Tests pinned to exact commit; protected preview, manual owner walkthrough, server logs and backup verified; rollback disables flags without deleting retained records |

## Next authorized work (updated 2026-11-02)

- **Migration parity is the immediate production blocker.** The live database has 67 migrations, but the release branch has 13 SQL migration files: 10 versions match, 57 exist only in live history, and 3 source versions are unmatched. See [production migration baseline audit](Build-Lab-Production-Migration-Baseline-Audit-2026-11-02.md). The failing full replay of the isolated branch means storage-only tests cannot authorize production DDL.
- **8/8 isolated CI jobs passed** at GitHub Actions run #80 (commit `1d6fb001`); SQL privileges, versioning, browser restore and synthetic Manager Plan have been verified. Retain this evidence rather than rerunning browser tests unnecessarily.
- **Live API-denial verification still requires authenticated Vercel access.** An external no-token request was intercepted by Vercel Authentication. The perimeter is protected, but the application owner gate was not reached. Use authorized `vc curl` or short-lived project-scope credentials, without disabling Deployment Protection; test negative tokens, wrong host/origin, stale revision and nonowner/revoked sessions with no production mutation.
- Reconcile migration baselines, generate a reviewed **new migration using Supabase CLI** and rehearse it on a representative isolated database. No direct production `apply_migration`, schema reset or migration-history repair without explicit go/no-go.
- After green CI, migration rehearsal, application-owner gate and owner-approved production rollout, turn ON live records flags in stages, verify one explicit save/restore, monitor logs, and disable flags to roll back without deleting history.
- Export test records and remove branch-scoped preview storage credentials/flags before deleting temporary development branch to stop billed usage.

## Verified isolated environment evidence (2026-10-31)

See [Cloud Storage Acceptance](Build-Lab-Cloud-Storage-Acceptance-2026-10-31.md). Isolated Supabase branch `lhycwhwopjirbipfblym` has **Scan History revision 2, 1 scan**, and **Work Buckets revision 2, 13 items**. Each preserves two revision-history rows. Browser restore did not change cloud revision counters. The synthetic Manager Plan at revision 1 also passed full browser recovery, with all three records displaying Same. The branch still reports `MIGRATIONS_FAILED` from unrelated historical application migration replay, so this is valid only as a **Build Lab storage-only** test. The temporary branch remains billable until deleted and should be retired after the remaining acceptance steps and export.

## Recovery / rollback

Keep browser JSON backups until a cloud restore has been verified. To roll back application access, switch both records flags off; do **not** drop production tables or delete revision history as a rollback shortcut. Assess and export cloud data before any later schema rollback.
