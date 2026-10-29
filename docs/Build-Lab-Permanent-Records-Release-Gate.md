# Build Lab permanent records: staged release gate

Status: **code staged, not activated, database proposal not applied**.
Branch: `release/build-lab-v1-owner-only-20261028`.
Owner-only preview scanning and local Scan → History → Work Buckets → Review & Fix Plan are already verified in an authenticated session. Cloud persistence is **not** verified or available in the current UI.

## Files staged for review

- `api/eig-build-lab-live-records.js`: typed read/save endpoint, independent server-side owner check.
- `server/eig-build-lab-durable-records.cjs`: strict document validation, size limits, optimistic revision checks and fail-closed storage errors.
- `server/eig-build-lab-document-store.cjs`: fixed Supabase project/table/RPC adapter; no client-supplied table, SQL or owner.
- `docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql`: **unapplied design proposal**, RLS and service-only grants, versioned append-only history, atomic compare-and-swap.
- `src/lib/buildLabCloudRecords.mjs`, `src/lib/buildLabCloudBackup.mjs`, `src/components/BuildLabCloudBackup.jsx`: already-staged explicit inspect, backup, compare, and restore controls.
- `tests/eig-build-lab-durable-records.test.cjs`: server authorization, wrong owner, revoked session, malformed inputs, stale revisions, outages, and schema contract.
- `tests/build-lab-cloud-records.test.mjs`, `tests/build-lab-cloud-backup.test.mjs`: client and backup recovery contracts.

## Explicit rollout boundaries

1. **No production or pink Sandbox schema changes now.** Do not execute the SQL design proposal directly. Create and review an actual migration with Supabase CLI, then test against an isolated database before considering deployment.
2. **No automatic cloud writes or sync.** Cloud save and restore must be deliberate owner actions with visible revision comparison; local JSON export remains the safe recovery path until verified.
3. **No feature activation.** `EIG_BUILD_LAB_LIVE_RECORDS_ENABLED` and `VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED` stay disabled. The backend also denies Preview today. Do not weaken the production owner/session gate to permit preview writes.
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

## Next authorized work

- Convert the **unapplied** schema proposal to a real migration using the Supabase CLI workflow. Test that migration in a new isolated database or explicitly authorized test environment; do not infer PostgreSQL correctness from static tests.
- Add integration tests against that isolated database, especially the permission matrix and concurrent compare-and-swap.
- Add a **separate preview store adapter** bound only to test data and require explicit feature flags before testing cloud save/restore.
- Once a verified cloud backup exists, expand additional scanners and connect **approved planning handoffs** to developer work packages and CI, never automatic production changes.

## Recovery / rollback

Keep browser JSON backups until a cloud restore has been verified. To roll back application access, switch both records flags off; do **not** drop production tables or delete revision history as a rollback shortcut. Assess and export cloud data before any later schema rollback.
