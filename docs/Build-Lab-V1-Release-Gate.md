# Build Lab V1: owner-only production release gate

**Status:** Development preview, not cleared for Live.  
**Freeze:** No new scanner, agent, or autonomous repair implementation as a prerequisite for V1.  
**One approved Build Lab branch:** `feature/build-lab-orchestrator-20261020`.  
**Acceptance workflow:** [Build Lab V1 Acceptance](../.github/workflows/build-lab-v1-acceptance.yml). Runs synthetic tests on affected pushes to the existing branch; read-only GitHub permissions and no deploy step.

## Owner priority decision (October 28, 2026)

**One active development priority: Build Lab.** Complete a secure, production-ready, owner-only Build Lab and strengthen its controlled AI-assisted development capabilities in a subsequent reviewed phase. Defer choosing and developing business applications until Build Lab's workflow and release safeguards have been established. Do not create competing Build Lab or Sandbox previews, merge the divergent feature branch wholesale, or deploy without explicit owner approval.

**Invoicing explicitly deferred.** Owner will use the basic external invoice process already in place for current bills. The existing ElevationPilot manual invoice builder remains a non-issuing demonstration, with no real customer invoice issuance, ledger writes, emails, SMS, payment collection, or migration from the outside invoice process. When invoicing is reconsidered, first define issuer scope separately for EIG and Chapel Hill, authorized operator roles, historical-record ownership and approval, and exact accounting boundaries. Do not assume the user wishes to issue invoices for third-party Hangars or fold outside invoices into the platform.

**Build Lab release sequence:** (1) core scanner/bucket/manager evidence workflow and owner-only security, recovery and rollback; (2) independently verified production deployment only after approval; (3) extend approved, isolated AI candidate generation, testing and review to support complete app development before choosing app-specific projects. No autonomous production edits or releases.

## Owner architectural principle: shared platform and cross-application dependencies

**Decision recorded October 28, 2026.** Do not choose the first post-Build-Lab business app yet. EIG Publishing / magazine publishing, EIE / event management, or another application could become the next priority based on the business opportunity and deadline.

ElevationPilot is one interconnected platform, **not unrelated standalone applications**. Shared capabilities must be modeled as reusable, securely scoped platform services rather than copied independently into each app. Examples include identity and the universal user/business records, role permissions, contacts and customer records, InceptionApex creative assets and ad creation, the Product Registry and inventory, invoicing/payment capabilities when approved, contracts, communications/Squawk Box, and audit/history. These are architectural targets; do not presume every integration is implemented or ready.

Build Lab's **future cross-app dependency / impact analysis contract** should:

1. Inventory each application's capabilities, actual implementation status, exposed interfaces, data ownership and shared dependencies; use code and verified owner-approved requirements instead of assumptions.
2. Map which modules call or share which platform services and which roles/businesses have access. Distinguish **implemented**, **planned**, **deferred**, and **not verified** dependencies.
3. Before approving a build/repair, identify upstream/downstream apps, schema/API contracts, permissions/RLS, source and deployment versions, shared assets and event/payment side effects.
4. Add regression checks spanning affected apps. Do not call an isolated feature green if a shared component breaks another app.
5. Preserve one source of truth for shared business/user/product records, while retaining separate organization ownership, permissions, invoices/payments and audit boundaries.
6. Present an owner-reviewable dependency/impact map and proposed reuse approach **before** starting new app development. Do not automatically deploy or make production data changes.

These goals inform the Build Lab architecture, but a full dependency engine is **not** a reason to block a limited, secure, owner-only V1 scanner/planning release; add and verify coverage incrementally. Future first-app choice remains uncommitted.

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
