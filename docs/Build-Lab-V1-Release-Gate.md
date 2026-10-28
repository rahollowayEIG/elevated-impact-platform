# Build Lab V1: owner-only production release gate

**Status:** Development preview, not cleared for Live.  
**Freeze:** No new scanner, agent, or autonomous repair implementation as a prerequisite for V1.  
**One approved Build Lab branch:** `feature/build-lab-orchestrator-20261020`.  
**Acceptance workflow:** [Build Lab V1 Acceptance](../.github/workflows/build-lab-v1-acceptance.yml). Runs synthetic tests on affected pushes to the existing branch; read-only GitHub permissions and no deploy step.

## V1 scope

- Master Scanner and IA Inspector: source-inspection reports with explicit detection limitations and exact revision evidence
- Scan History and Work Buckets: owner-controlled findings, changes, hold/dismiss, manual intake and clear non-scanner provenance
- The Manager: reviewed, evidence-bearing repair plans that do **not** run agents or deploy changes
- Backup/export of owner-scoped browser-local records
- Existing owner-only authorization and fail-closed preview gate

**Not V1:** automatic repair dispatch, AI source modification, production database writes, scheduled unattended scans, automatic scanner learning, new Preview environments, customer-facing access.

## Automated checks, run together

**A. Scanners and security:** Master Scanner / IA Inspector source tests, negative inputs and allowlist checks; Work Buckets and Manager unit tests; explicit owner-only authorization rejection and safety contracts.

**B. Browser workflow:** Build app; Playwright Chromium tests for Build Lab navigation, local draft save/reload, manual finding reporting, confirmation, approval, Manager evidence transfer, and InceptionApex editor regressions.

**C. Output:** Every acceptance run publishes a GitHub Actions job summary showing the exact SHA and each group result. A GREEN automated result only means those tests passed. A failed or skipped group blocks the automated acceptance gate.

No external tokens, customer datasets, Supabase writes, or Vercel promotion are required for these tests. They use synthetic fixtures.

## Release blockers the automated gate cannot certify

- [ ] Demonstrate meaningful source scanner findings and false-positive handling against representative authorized preview behavior. Source markers alone do not prove a runtime defect.
- [ ] **Before any Live enablement:** create a distinct, verified production owner-only API authorization policy. The current Build Lab server intentionally allows only the approved preview branch. Do not weaken or bypass it.
- [ ] Decide acceptable history durability: documented owner-only local-data pilot with tested export/restore, or access-controlled persistent storage for ongoing operational reliability.
- [ ] Inspect actual production environment configuration, tenant separation, Supabase RLS, secrets and read-only scanner permissions. Confirm zero impact on registrations, payments, customer records and outside businesses.
- [ ] Compare the intended release SHA with the tested SHA; confirm no unresolved release-blocking browser, accessibility, or security regressions.
- [ ] Prepare exact release/rollback steps and recovery checks, and obtain **explicit owner approval** before a production change.

## Known issues and tracked enhancements

- [#110](https://github.com/rahollowayEIG/elevated-impact-platform/issues/110): approved requirements versus source and deployed UI integrity; acceptance enhancement unless an owner-required V1 feature is missing
- [#111](https://github.com/rahollowayEIG/elevated-impact-platform/issues/111): clearer status presentation; polish unless a user cannot distinguish actionable work
- [#112](https://github.com/rahollowayEIG/elevated-impact-platform/issues/112) and [draft PR #114](https://github.com/rahollowayEIG/elevated-impact-platform/pull/114): InceptionApex mouse selection → keyboard focus repair. The code candidate is not merged and still requires scoped review against the latest branch
- [#113](https://github.com/rahollowayEIG/elevated-impact-platform/issues/113): manual issue intake; V1 path implemented and personally exercised, automatic scanner rule learning deferred
- [#115](https://github.com/rahollowayEIG/elevated-impact-platform/issues/115): overlapping text box/image hit targets, investigate before changing design stacking

## Operating discipline

1. Run one consolidated automated acceptance cycle on the existing Build Lab branch.
2. Fix only release blockers in reviewable, scoped commits. Rerun the same workflow; capture its SHA and job summary.
3. Ask the owner for one representative scan + handoff acceptance session, not repeated tests of every field.
4. Until security/durability/rollback gates are approved, use Build Lab only in the authorized preview. **Do not promote a green CI result to production automatically.**
