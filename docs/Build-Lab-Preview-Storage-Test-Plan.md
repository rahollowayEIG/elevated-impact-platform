# Build Lab: isolated preview cloud-storage acceptance plan

Status: **preview code staged; backend and UI flags OFF; full browser workflow NOT verified**.
Owner-only release branch: \`release/build-lab-v1-owner-only-20261028\`.

## Why this is separate

Live Build Lab authentication uses the exact EIG owner, active Supabase session and current active EIG admin membership. Preview cloud records must use an **independent disposable Supabase project**, not the central ElevationPilot database, pink Sandbox, or Ticketing database.

- Existing production endpoint: \`/api/eig-build-lab-live-records\`. Remains production-only and disabled.
- New isolated test endpoint: \`/api/eig-build-lab-preview-records\`. Requires the preview-only owner grant and separate record permission.
- Stored keys: \`scan_history\`, \`work_buckets\`, \`manager_blueprint\` only.
- No automatic cloud sync, execution agents, payment changes, event writes or deployments.

## Prerequisites (do not activate prematurely)

1. Create an isolated Supabase development test project or test branch and verify it has **no customer data**. Capture its project reference.
2. Ensure the isolated database has \`auth.users\` and service-role support. Existing ElevationPilot migration replay previously failed on a cloned branch, so never assume it succeeded. Production migration metadata confirms the first historic migration attempts to alter `public.golf_registrations`, which was not present in the clean branch. For this feature, use a **storage-only** test database independent from production authentication: apply only the Build Lab document schema, create synthetic owner UUIDs in test Auth, and verify the separate storage endpoint against it. This avoids trying to repair all legacy product migrations just to test three Build Lab document keys. A broader production-like staging environment will still need a reviewed baseline schema before full-platform end-to-end tests.
3. Seed the isolated storage database with only a synthetic/minimal owner UUID required by the Build Lab document foreign key. No customer account details, passwords, identities, payments or event data should be copied. Owner session authorization still runs independently against the approved Live authentication provider.
4. Confirm the Build Lab tables and RPC grants by isolated database queries. No direct \`anon\` or \`authenticated\` access.
5. Never use the Live or pink Sandbox Supabase service-role key as preview storage credentials.

## Separate Vercel preview settings

**Server-side settings, bound to the exact release preview branch only**:

- \`EIG_BUILD_LAB_OWNER_PREVIEW_ENABLED=true\` (existing owner preview authorization).
- \`EIG_BUILD_LAB_LIVE_OWNER_USER_ID\` (existing owner ID, not user-supplied).
- \`EIG_BUILD_LAB_PREVIEW_RECORDS_ENABLED=true\` (new write/read permission, default OFF).
- \`EIG_BUILD_LAB_PREVIEW_STORAGE_PROJECT_REF=<verified isolated ref>\`
- \`EIG_BUILD_LAB_PREVIEW_STORAGE_URL=https://<verified isolated ref>.supabase.co\`
- \`EIG_BUILD_LAB_PREVIEW_STORAGE_SERVICE_ROLE_KEY\` (secret for **that isolated database only**).

**Browser-build setting**, same branch preview only:

- \`VITE_EIG_BUILD_LAB_PREVIEW_CLOUD_RECORDS_UI_ENABLED=true\`, default OFF.

Do **not** copy preview storage secrets into any \`VITE_\` key. Do not change \`VITE_SUPABASE_URL\` or \`SUPABASE_SERVICE_ROLE_KEY\` to point at the isolated project; those are used for EIG owner authentication and other applications. These preview-specific settings must remain absent/disabled in Live and the pink Sandbox.

The preview adapter requires the exact branch, exact isolated project URL, distinct secret and an explicit enable flag. It rejects the known production, pink Sandbox and Ticketing project refs. The preview route additionally enforces exact owner, origin/host, verified session and EIG membership.

## Acceptance steps

1. Ensure CI tests pass on exact release commit, including \`tests/build-lab-preview-records.test.cjs\`.
2. Verify preview endpoint denies nonowner requests, wrong host/origin, expired sessions, missing flags, wrong project refs and malformed document types.
3. Inspect browser vs. isolated cloud. Confirm no saved documents.
4. Download the current local evidence package.
5. Explicitly save \`scan_history\` and \`work_buckets\`, and optionally \`manager_blueprint\`; confirm revisions increment and saved payloads match.
6. Reload preview, inspect records again, verify the cloud retains all three records independently from browser storage.
7. From a second browser session, produce a stale revision and verify it returns 409 without overwriting the winner.
8. Explicitly restore after downloading and locating the local backup, confirming revised browser content and no unexpected automatic writers.
9. Turn preview flags OFF, verify API denies reads and writes, export any needed test evidence, and delete the test project/branch to stop hourly charges.
10. Only after successful isolated acceptance plan a separately reviewed production migration, backup, owner permission verification, Live flag activation and rollback.

**Current known blocker:** A Supabase development branch created on 2026-10-31 reported \`MIGRATIONS_FAILED\` when replaying pre-existing ElevationPilot migrations. It was useful for isolated Build Lab SQL tests and was deleted after tests, with no production database change. We have not diagnosed the migration failure or completed browser storage tests.

This plan and staged route are NOT evidence that permanent storage is enabled.
