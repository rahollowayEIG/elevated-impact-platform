# Build Lab isolated Supabase contract test | 2026-10-31

## Scope and isolation

- Temporary Supabase preview branch: `build-lab-isolated-storage-20261031` (test project ref `plqgraecwlmdjzfpxtwt`), forked from `aszixzrdayrivungodwq`.
- Production project `aszixzrdayrivungodwq` and approved pink Sandbox were not modified.
- Temporary branch was verified to contain 0 Auth users and 0 public tables before the Build Lab test.
- Applied the reviewed `docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql` with the Supabase migration API **only on the temporary branch**.
- Inserted two explicitly synthetic Auth user identifiers in the temporary branch only. No real identities, registration records, payment data, or customer content were used.
- The test was conducted directly against the isolated Supabase Postgres service, not a mock.

## Verified PASS

1. Both new Build Lab tables have RLS enabled.
2. `anon` and `authenticated` have no direct select access to the tested tables and no execution rights on the save RPC.
3. `service_role` is allowed to execute the save RPC; executing it as `service_role` saved a new `manager_blueprint` document revision 1.
4. Save `scan_history` revision 0 to 1; update 1 to 2; stale expected revision 1 rejects as conflict with current revision 2.
5. A deliberate recovery saved payload from revision 1 as revision 3; revisions 1 and 2 remained intact.
6. A second synthetic owner's `scan_history` revision 1 did not modify the first owner's revision 3.

## Environment limitation: not suitable for browser rollout yet

Supabase branch reported `MIGRATIONS_FAILED` while replaying the **existing ElevationPilot migrations**. The branch was accessible for direct database queries and Build Lab storage contract tests, but its broader application schema was incomplete. This failure was NOT caused by applying the Build Lab schema (which succeeded afterward). A reliable root cause for the existing migration replay was not established in this test.

The isolated branch is **not approved** as an end-to-end browser environment. Do not assume the migration replay is repaired or that the owner-only browser cloud save/restore path works.

## Still pending

- Establish a fully functional isolated Supabase environment or repair source-controlled baseline migration replay in an isolated context.
- Bind a protected preview test API to its own server-only storage credentials, distinct from production credentials and authentication checks.
- Verify live preview owner session gating, rejected nonowner/expired sessions, browser save/reload/retrieve and explicit backup/restore.
- Check revision conflicts from simultaneous browser sessions and failure/recovery without data loss.
- Keep production feature flags `EIG_BUILD_LAB_LIVE_RECORDS_ENABLED` and `VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED` disabled until the full release gate passes.
- Do not enable automatic implementation, agent execution or deployment.

## Related CI evidence

- GitHub Actions Build Lab workflow #58: 8 jobs successful, isolated PostgreSQL security check included.
- GitHub Actions Build Lab workflow #59: 8 jobs successful, isolated revision recovery contract included.
- Current isolated release branch contains the database schema and SQL integration tests.

This report records tests performed on a temporary environment; it is not a statement that cloud storage is available to end users.
