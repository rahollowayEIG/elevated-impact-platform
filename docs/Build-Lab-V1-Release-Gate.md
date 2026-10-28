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

## Standing architecture: One Database, One Milky Way Galaxy

**Owner's governing vision (October 28, 2026):** Elevated Impact Group and ElevationPilot operate as **one connected galaxy** of applications, all working together to serve their authorized participants. Maintain **one central, logically unified database and source of truth** for the platform's shared operational records, rather than isolated app-owned identity/customer/product databases. Each app specializes in its function and reuses shared platform capabilities. This is a design rule for all future features, not a claim that every current integration is complete.

- **Shared identities and relationships:** one universal user identity linked to the relevant organizations, contacts, roles and activities; no duplicate user records for separate app signups.
- **Shared reusable services:** identity, organization and customer registries, product registry/inventory, communications, media/design assets, contracts, billing/payment when later authorized, audit and approvals. A service has one defined owner and contract.
- **App-specific domains:** EIE events, EIG Publishing magazines/books, EIG Golf, InceptionApex, Squawk Box and future apps keep their distinct workflows and data structures while interoperating through shared references and services.
- **Security boundaries remain absolute:** one database is not one unrestricted data pool. Use organization/tenant scoping, authorization, RLS and least-privilege actions; prohibit accidental mixing of customer, issuer, financial or private records across businesses.
- **Cross-app impact checks:** Build Lab must maintain a verifiable map of actual dependencies, app integrations, role visibility, canonical records and change propagation. Before any proposed change, identify what uses the affected data/API and which regression tests need to run.
- **Avoid dual-source synchronization:** prefer a single canonical record with references and purpose-built views, not separate authoritative copies requiring fragile two-way sync. Where cached/projection data is necessary, document ownership and reconciliation.
- **Physical implementation:** honor the user's one-database goal as the preferred core architecture. Do not silently introduce separate production databases or app-specific registries. Treat strictly necessary infrastructure isolation, ephemeral test data and backups as explicit, reviewable exceptions; these must not become independent sources of truth.
- **Release discipline:** this long-term galaxy architecture guides Build Lab V1 design; do not hold up a limited, secure owner-only release until every planned service is implemented.

## Galaxy rule: standalone apps and shared integrations

**Owner examples (October 28, 2026):** A first-class platform app must be usable **independently** for its own purpose and also **integrated** by other apps wherever authorized. Being heavily used by one app does not make it a subfeature owned by that app. Avoid duplicate implementations or separate authoritative data sources.

### Set the Table

- **Within EIE:** event-specific meals, banquet/outing food services, catering, menus, and hospitality should be attachable to event records, schedules, registrations and permitted payment workflows.
- **Standalone:** restaurants or caterers should be able to use Set the Table for their own food-service operations without needing to create an EIE event or subscribe to EIE.
- **Reuse:** the same Set the Table capabilities and underlying records/services should work in both contexts, with EIE adding event relationships rather than becoming a required parent.

### InceptionApex

- **Integrated:** shared creative functionality can be called from EIE, EIG Publishing, EIG Golf, advertising and other authorized applications.
- **Standalone:** a person can use InceptionApex independently for personal creative work, for example editing a personal picture and printing it, without first entering a magazine, event or other business workflow.
- **Reuse and privacy:** use one creative engine and shared service contracts. Personal designs are private to their authorized owner; organization assets and publishing approvals remain appropriately scoped. Context-specific presets, products, fulfillment or billing should not force unrelated app dependencies.

### Build Lab architecture acceptance checks

1. For every app, identify its **standalone entry point** and all **integrated entry points**, treating supported contexts as first-class.
2. Model required shared services versus optional integration adapters. Failure/unavailability of an unrelated app must not break a standalone workflow.
3. Require canonical records and stable IDs; context links (event ID, advertiser, organization, personal owner) are scoped references rather than separate duplicates.
4. Test both independent and integrated use cases, including access isolation and transitions between contexts.
5. Before changing a shared component, enumerate every consuming app and run the relevant cross-app regressions.
6. Label the examples above as the **intended capability model**: confirm actual implemented behavior through source and authorized runtime tests before calling an integration finished.

Keep this rule in all future app designs and in the dependency map; it does not add another standalone database, scanner, or production release prerequisite.

## Release readiness update: local evidence recovery and production access boundary

**Development checkpoint, October 28, 2026:** `0fa9e5eba7cbbd52a5a8e21f10fc3497a994876b` passed the existing Universal Scan Foundation workflow in all three jobs, including new evidence recovery tests. Vercel marked the existing approved Build Lab preview READY. **This is not production approval.**

- **Implemented in the development preview:** a versioned, owner-bound evidence package now includes scan history, Work Buckets and the current Manager blueprint. Scan History offers explicit import/restore with file validation, replacement confirmation, read-back verification and best-effort rollback. Older v1 evidence exports are **not** accepted for restore; re-export as v2 from the original browser where possible. This is still owner-local browser storage.
- **Storage remaining:** choose and verify durable, centrally backed owner records and restoration/reconciliation before relying on Build Lab for long-running critical business operations. Local JSON exports are a recovery aid, not guaranteed backup or cross-device sync.
- **Security boundary remaining:** the Vercel server routes still use `authorizeBuildLabPreviewOwner`, whose strict branch/environment gate deliberately DENIES production. The separate Supabase edge status gate does not independently authorize Vercel scanner reads. Production rollout must specify and independently test exact Live origin, trusted session validity, one configured owner, active EIG membership, scoped endpoints, least privileges and revocation.
- **Prevent accidental capability escalation:** do **not** simply change the preview helper to accept Live. It protects multiple endpoints including AI code generation. Define production read-only scanning/planning authorization separately from the preview builder/AI execution grant, and reject disabled or unknown operations by default.
- **Release isolation:** `main` and the approved pink Sandbox remain unchanged; the long-running Build Lab branch must be selectively packaged and integrated, not merged wholesale. Require source SHA parity, tests, recovery checks and owner release approval.

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
