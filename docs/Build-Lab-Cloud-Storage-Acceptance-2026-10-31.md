# Build Lab cloud storage acceptance | 2026-10-31

## Verdict

**Isolated browser save/read/recovery: PASS. Production release: NOT YET AUTHORIZED.**

Testing was performed against temporary Supabase branch `build-lab-storage-only-20261031` / project `lhycwhwopjirbipfblym`, attached to the production project's branch facility without production customer data. The preview client used the isolated storage API with a dedicated server-only test secret and exact release-branch gates.

The test branch currently reports `MIGRATIONS_FAILED` for pre-existing application schema replay, despite being `ACTIVE_HEALTHY` and working for the independently applied Build Lab-only schema. This branch is **not** evidence of a working full-platform staging database.

## Real browser acceptance observations

1. Owner signed into the approved Vercel preview and opened the dedicated **5. Cloud Storage** workflow tab.
2. Initial inspection returned no cloud records.
3. Explicit browser Save operations wrote empty Scan History and Work Buckets, both at revision 1. After browser refresh, both re-inspected as matching.
4. Running the actual Master Scanner produced one locally saved scan; explicit save advanced **Scan History revision 1 to 2**.
5. Opening Work Buckets populated **13 work items** from that scan; explicit save advanced **Work Buckets revision 1 to 2**.
6. Running IA Inspector created a second local scan. With no further cloud save, comparison correctly showed **browser 2 scans / cloud 1 scan**; Work Buckets remained 13 items on both sides.
7. User downloaded a separate browser evidence JSON backup, confirmed the browser restore dialog, and performed the explicit cloud restore. The preview refreshed and re-inspected as **browser 1 scan / cloud 1 scan**, **browser 13 work items / cloud 13 work items**, with both record types marked **Same**.
8. Database read queries independently confirmed each record has **revision 2**, exactly **2 retained revision-history rows**, and the latest revision payload matches the record head. No cloud revision increment was made by the browser restore.
9. Created a clearly labeled synthetic preview-only Manager Plan with execution disabled. Owner explicitly saved it as `manager_blueprint` revision 1; the database independently confirmed it had one matching revision-history entry. No real work was approved or launched.
10. On a new preview URL, empty browser Scan History and Work Buckets were blocked from overwriting nonempty cloud records; a UI binding typo that initially caused a blank screen after inspection was fixed and a regression test added.
11. Owner downloaded a browser backup, performed a second full cloud restore, refreshed the preview and reinspected all three document types. All reported **Same**, with browser 1 scan / 13 work items and cloud 1 scan / 13 work items, at revisions **2, 2, 1**. The test Manager Plan was included and matched. The database independently confirmed those revisions and history heads after restoration. No production records were written.

## Security review performed

- Supabase test project's two `eig_build_lab_*` tables have RLS enabled and deliberately no browser-facing read/write policies.
- Verified `anon` and `authenticated` cannot execute `eig_build_lab_save_document`; `service_role` can.
- Code review of `server/eig-build-lab-owner-preview-access.cjs` and `server/eig-build-lab-durable-records.cjs`: endpoint requires exact owner UUID from trusted server environment, active session, active EIG admin organization membership, matching preview branch and origin, separate records flag, three whitelisted record kinds, strict validation, and revision checks.
- Code review of `server/eig-build-lab-preview-document-store.cjs`: refuses production, pink Sandbox and Ticketing project refs; requires an isolated project, independent service secret and exact preview branch.
- These code/role checks do **not** replace a separately executed live unauthorized-user and revoked-session penetration test.
- Supabase security advisor lists two `rls_enabled_no_policy` informational findings. This is expected for service-only storage. It also lists an unrelated leaked-password-protection warning on the temporary Auth project; this test does not authenticate users through that isolated project's Auth.
- Source CI previously passed on GitHub Actions workflow #59 (8/8 jobs, isolated PostgreSQL). Later preview-specific source/security tests were added; their **latest push-triggered GitHub Actions run has not been directly verified here**. Vercel builds passed, but a Vercel build is not proof of all GitHub Actions jobs.

## Remaining release gates

1. Verify latest release commit's eight GitHub Actions jobs, including preview authorization tests, pass.
2. Run a live negative authorization test against the preview endpoint: missing/expired token, non-owner, wrong origin, wrong type, stale revision, and disabled-flag denial; confirm no data mutation.
3. **Completed:** Preview-only `manager_blueprint` browser save and full cloud recovery of all three record types, with independently verified revision history. Keep this as an explicit acceptance regression for production rollout.
4. Review and commit an actual production Supabase migration with controlled database backup, privilege inspection, owner gate and rollback plan. **Do not apply automatically.**
5. After production sign-off, enable production-only flags in an approved rollout, verify one deliberate owner save/reload/recovery, monitor logs and immediately disable on failure.
6. Prior to deleting the temporary test branch, export evidence and verify local JSON recovery. Turn OFF both preview storage flags and remove the preview secret and branch-specific project settings. Delete test branch to stop the approved **$0.01344/hour** usage charge.

## Safety invariants

- No production or approved pink Sandbox schema/data/config mutations from this acceptance test.
- Never expose a Supabase service/secret key through `VITE_` variables or browser bundles.
- Scanner findings are evidence and proposed work, not automatically verified defects or permission to execute repairs.
- No auto sync, agents, PR merges, deployments, payments, registration edits, or customer table writes.
- Preserve revision history; disabling the endpoint is the rollback, not deleting records.
