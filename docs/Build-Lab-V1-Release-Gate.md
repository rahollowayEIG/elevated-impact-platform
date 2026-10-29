# Build Lab V1: owner-only production release gate

**Status:** Development preview, not cleared for Live.  
**Freeze:** No new scanner, agent, or autonomous repair implementation as a prerequisite for V1.  
**One approved Build Lab branch:** `feature/build-lab-orchestrator-20261020`.  
**Acceptance workflow:** [Build Lab V1 Acceptance](../.github/workflows/build-lab-v1-acceptance.yml). Runs synthetic tests on affected pushes to the existing branch; read-only GitHub permissions and no deploy step.

## October 28 owner-preview V1 operation checkpoint

**Code and preview testing green, production remains gated.** The existing approved Build Lab branch preview alias points to the latest READY Vercel preview. The restricted Live console code now supports **Scan → History → Work Buckets → Review & Fix Plan** with explicit owner-local persistence, plus separately gated cloud recovery. Neither its plan approval nor a source scan invokes code generation or deployment. V1 scans are source-evidence inspection and dated schema metadata, **not** proof of live functionality.

**Verified:** [Universal Scan Foundation: 3/3 jobs passed](https://github.com/rahollowayEIG/elevated-impact-platform/actions/runs/40808605797), including synthetic real-browser scan-to-buckets-to-plan proof; Live API route file bundles now explicitly include the allowlisted source files used by their preview equivalents. The approved Build Lab preview URL is `https://elevated-impact-platform-git-fea-8e8a01-rahollowayeigs-projects.vercel.app`. An actual signed-in owner walkthrough must still be performed; CI synthetic login does not certify owner login.

**Deployment reality check:** Production Vercel currently has ordinary `VITE_SUPABASE_*` variables but does not have the explicitly gated Build Lab owner and privileged server configuration needed for production Live access. The production Supabase document tables and revision RPC have not been migrated. The long-running development branch must not be wholesale merged or promoted. The preview uses browser-local persistence and export/restore; cross-device permanent cloud storage is **not live**.

**Remaining production gates:** (1) real owner signs in and verifies V1 preview experience with an export; (2) review a clean selective production release branch or PR from current main, not all development work; (3) verify exact owner UUID, scoped Vercel secrets and production-only build flags with no browser exposure; (4) explicitly approve and apply the already tested Supabase schema migration, checking RLS grants and backups immediately afterward; (5) re-test production owner access, read-only scanner bundles, record revision/rollback and denial tests; (6) owner gives explicit go-live authorization. Stop/rollback by disabling flags without deleting saved records.

## Real local Supabase Auth + REST API integration: PASSED (October 28, 2026 ET)

**Third storage gate green:** [Build Lab Local Supabase Auth and REST Integration CI](https://github.com/rahollowayEIG/elevated-impact-platform/actions/runs/40806936598) completed successfully with a fresh **unlinked, disposable local Supabase CLI stack**, using Supabase CLI 2.120.0. No paid hosted branch, project, Vercel deployment, production migration or pink Sandbox change occurred.

**Seven passed checks against the actual local Supabase Auth and PostgREST services:**
1. Created two synthetic users via server-role Auth Admin and signed each in with password; verified genuine access tokens through Auth.
2. Verified anonymous and *both* signed-in accounts receive denied results for current and history table reads, inserts, updates and the privileged save RPC, even when supplying another user's ID.
3. Used the server service-role credentials to save version 1, then version 2 through the actual REST/RPC endpoint; inspected current record and immutable revision payloads.
4. Confirmed a stale revision-1 save is rejected after revision 2; then advanced successfully to revision 3.
5. Created another owner's independent scan record, plus owner Work Buckets and Manager plan records. Confirmed all four record scopes remain distinct.
6. Rejected invalid document names, negative expected revisions and an oversized Manager payload; checked no accidental revision was appended.
7. Repeated authenticated owner and different-user access-denial checks *after* the server role populated the documents.

**Protection and reproducibility:** `tests/build-lab-supabase-local-integration.cjs` runs under `.github/workflows/build-lab-supabase-local-integration.yml`. The workflow creates an unlinked local project, makes its migration using the CLI, copies the exact proposed schema SQL, starts only the required Auth/REST/database services, runs genuine API calls, and discards the local Docker database. It refuses non-loopback endpoints, remote credentials, and production context. CI permissions are `contents: read` with no hosted Supabase secrets.

**Current status:** The migration and Auth/Data API permissions are proven in disposable environments. The production EIG project was rechecked read-only and remains without the Build Lab document tables and save RPC. This is **not** approval for live deployment.

**Remaining before release:** confirm exact production Supabase feature/extension compatibility and server-secret access; verify real production owner membership and active-session checks end to end in an authorized pre-release environment; test complete application save/recovery and actual Vercel integration with production-scoped permissions while keeping write flags disabled until approved; review failure/backup/rollback procedures; receive explicit owner go-live authorization. Do not merge the entire long-running feature branch wholesale.

## Real PostgreSQL migration test: PASSED (October 28, 2026 ET)

**Verified in disposable PostgreSQL 17, no EIG database mutations.** The test used the exact versioned SQL proposal in `docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql` and synthetic roles/users only. [Successful isolated migration run](https://github.com/rahollowayEIG/elevated-impact-platform/actions/runs/40806293626).

Seven independently checked stages:
1. Create synthetic `anon`, `authenticated`, `service_role`, and `auth.users` fixtures.
2. Apply the full migration within a transaction, roll it back, and verify neither the table nor the function remains.
3. Apply the proposed SQL to the disposable PostgreSQL instance.
4. Confirm RLS, no browser permissions, service-role-only function access, version 1/2 saves, stale write rejection, historical payload preservation, separate owner IDs, invalid and oversized document rejection.
5. Race two actual simultaneous expected-revision-2 saves; verify one success at version 3, one version-3 conflict, and exactly three immutable recorded versions.
6. Reapply the migration without losing the stored revision or history.
7. Verify `anon` and `authenticated` are denied execution of the save RPC.

The initial disposable run caught an ambiguous PL/pgSQL size-limit expression and revealed incomplete script cleanup; corrected on the feature branch and the next real PostgreSQL run passed.

**Production verification:** read-only schema inspection after the passing test confirms the production EIG project still has **none** of the Build Lab document tables or save function. No pink Sandbox project was modified. No hosted Supabase test branch was created, so no additional Supabase project charge was incurred.

**What this test does NOT certify:** applying the migration to a full Supabase environment with all real extensions/settings and existing platform migrations; server-side service-role credentials and RPC over Supabase Data API; authenticated browser session and owner grants end-to-end; backup and restore against the actual hosted database. These are remaining controlled pre-release gates. The reviewed SQL proposal is not an applied production migration. Do not enable Live flags or treat CI success as authorization to deploy.

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

## Production read-only authorization engineering checkpoint (October 28, 2026)

**Staged on the approved Build Lab development branch; NOT live-enabled or production approved.**

- New dedicated production-only owner verification: `server/eig-build-lab-live-readonly-access.cjs` and server-only Supabase session attestation in `server/eig-build-lab-live-auth-client.cjs`. This is separate from the unchanged preview-only AI/Builder gate.
- New explicitly isolated read-only routes: `/api/eig-build-lab-live-access`, `/api/eig-build-lab-live-master-scan`, and `/api/eig-build-lab-live-scan`. Existing preview endpoints continue to fail closed in production.
- Live access is **OFF by default**. It requires `VERCEL_ENV=production`, the Vercel `main` ref, the exact approved production origin and host, `EIG_BUILD_LAB_LIVE_READONLY_ENABLED=true`, and one explicitly configured owner ID. Neither another EIG admin nor another tenant qualifies.
- The server validates the Supabase Auth user, the active EIG membership, and the active authenticated admin session using the existing privileged `platform_assert_active_admin` RPC. That RPC is restricted to the Supabase `service_role`. The server-only key **must never** be in client-side `VITE_*` settings, source, logs, or exports. The Live Supabase URL is pinned to the existing EIG production project to prevent accidentally validating a Sandbox account.
- Only read-only, allowlisted source scanner handlers accept the new production authorization callback. AI generation, execution, build workers and repair endpoints are NOT authorized by it. No arbitrary paths, SQL, or production record writes are permitted.
- Automated `tests/eig-build-lab-live-readonly.test.cjs` checks allow/deny conditions, wrong-origin attempts, stopped or invalid sessions, cross-tenant memberships, unsupported scan targets, Supabase environment mismatch and explicit separation from preview AI operations.

**Still required before Live enablement:** independently audit the narrow privileged RPC configuration and secret handling; choose a least-privilege server attestation approach; connect a production-specific owner-only UI with only permitted scanner/planning tools; select safe persistent storage; conduct actual authenticated production-readiness checks without customer-data mutations; verify deployment/rollback; obtain explicit owner approval. A mock-backed unit test is *not* a live-session end-to-end test, and the staged routes are not currently usable from the production UI.

## Durable Build Lab records: staged implementation, NOT deployed (October 28, 2026)

**Development-only implementation:** `docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql`, `server/eig-build-lab-document-store.cjs`, `server/eig-build-lab-durable-records.cjs`, `api/eig-build-lab-live-records.js`, and `src/lib/buildLabCloudRecords.mjs`. The SQL file is an owner-review proposal, **not an applied Supabase migration**. The Supabase CLI is not available in this development runtime, so migration generation and genuine database testing remain a separate explicit gate.

- **Database target:** the existing EIG production Supabase project only, never ElevationPilot-Sandbox or EIG Ticketing. The proposed two new tables store owner-scoped current documents and append-only version snapshots for only `scan_history`, `work_buckets`, and `manager_blueprint`.
- **Access:** no browser `anon` or `authenticated` table grants; RLS enabled; service-role-only table and RPC permissions, with the key on the server only. The server independently checks the fixed Live origin, main branch, EIG owner, active EIG membership and active session on every operation.
- **Separate feature gate:** `EIG_BUILD_LAB_LIVE_RECORDS_ENABLED` defaults OFF and is REQUIRED in addition to the already-disabled `EIG_BUILD_LAB_LIVE_READONLY_ENABLED`. Neither flag authorizes AI generation, agents, payments, event registrations, or deployments.
- **Integrity:** database compare-and-swap increments revision atomically and appends history in the same transaction. The browser client makes only explicit manual read/save requests and handles HTTP 409 stale-revision conflicts. It never overwrites newer work automatically or treats a preview-only permission as write access.
- **Validation:** server rejects arbitrary document keys, owner IDs, SQL, unsupported operations, invalid payloads, oversized records, unauthorized sessions and malformed revisions before invoking storage. Existing local v2 JSON export and import remain the current recovery tools.
- **Scope of checks:** CI uses synthetic tests for server/store/client contracts and source-level SQL access checks. **It does not demonstrate real database table creation, real session access, real cross-device sync or completed production UI.**

**Activation sequence, gated:** (1) approve scope and secret handling; (2) create a proper migration with Supabase tooling; (3) apply only to an approved isolated test environment, verify RLS/GRANT/REVOKE and full transactional save/replay; (4) build and manually test production owner UI with cloud restore, local backup, and partial-failure handling; (5) introduce schema into Live via reviewed migration, back up existing records, verify actual owner access, and enable server/UI flags only with explicit owner approval; (6) monitor errors, retain all revision history and retain a rollback path that disables flags without destroying data.

**No existing Supabase schema, payment, roster, customer or event record was altered during this stage.** The pink Sandbox remains untouched.

## Owner cloud backup and recovery UI: development-only (October 28, 2026)

- `src/lib/buildLabCloudBackup.mjs`: inspect all three remote document revisions, compare separately with current browser snapshots, save only explicitly selected record types with a compare-and-swap expected revision, and rebuild a full local v2 evidence package from the cloud for validated owner-controlled restoration. Incomplete cloud backups cannot silently wipe browser Work Buckets.
- `src/components/BuildLabCloudBackup.jsx`: an opt-in panel within Scan History behind `VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED=true` (OFF by default). It shows per-record revisions and differences and offers a deliberate cloud save. Recovery requires downloading the existing local JSON, acknowledging the backup, confirming full replacement and a forced reload to avoid stale React autosave overwriting restored data.
- `tests/build-lab-cloud-backup.test.mjs`: empty/complete cloud snapshots, stale browser edits, HTTP 409 conflicts, corrupted records, account separation and full restore from a synthetic remote.
- `tests/build-lab-cloud-backup-browser.cjs`: isolated real-browser journey with a synthetic authenticated token and simulated records endpoint; no actual Supabase connections or customer data.
- **No automatic sync or merging:** the three server documents are versioned independently and uploaded one at a time. Partial cloud uploads can exist; the UI displays them explicitly, and full restore requires both core records. The Manager blueprint is optional and may be absent in a valid complete snapshot. Browser JSON export remains the practical recoverable backup until real cloud storage is provisioned.
- **Live integration is still blocked:** the current `PlatformApp` owner navigation is preview-only, so this flag alone does not enable the new panel in production. A separate production read-only/planning workspace with exact owner-server verification and without AI execution tools must be wired and verified.
- **Never turn on these flags prematurely:** SQL migration remains unapplied, provider-backed save/restore and RLS checks remain undone, and no end-to-end production session run has been approved.

## Restricted Live owner console: staged, not enabled (October 28, 2026)

A separate minimal production owner workspace has been implemented in the development branch as `src/components/BuildLabLiveOwnerWorkspace.jsx`, with its own typed client `src/lib/eigBuildLabLiveClient.mjs`. The existing full Build Lab preview stays preview-only.

- **Production UI is OFF by default:** `VITE_EIG_BUILD_LAB_LIVE_OWNER_UI_ENABLED=true` must be explicitly set on the intended build, and the EIG Command Center will still hide the entry unless the exact owner obtains a fresh `/api/eig-build-lab-live-access` authorization. A client flag alone grants **nothing**.
- **Server access remains OFF by default:** `EIG_BUILD_LAB_LIVE_READONLY_ENABLED=true` and a valid `EIG_BUILD_LAB_LIVE_OWNER_USER_ID` must be configured on the exact Vercel production/main origin, after separate approval and verification.
- **Explicitly restricted surface:** only Master Scanner and IA Inspector first-party source inspection (never functional test certification), manual JSON downloads, and a separately gated Cloud Backup & Recovery panel. No `EigBuildLab` preview component, AI agents, Builder, auto-repairs, invoices, Event Builder, or deployment controls are imported into the Live workspace.
- **Cloud storage requires further independent enablement:** `VITE_EIG_BUILD_LAB_CLOUD_RECORDS_UI_ENABLED=true` plus server `EIG_BUILD_LAB_LIVE_RECORDS_ENABLED=true`, but these must stay OFF until the reviewed SQL migration has been tested in a dedicated isolated environment and production access/recovery acceptance are independently verified. The Cloud UI flag does not grant storage permissions.
- **Read-only production verification (no writes):** the proposed `eig_build_lab_documents`, `eig_build_lab_document_revisions` and `eig_build_lab_save_document` objects were **not present** in the current production Supabase project when checked. The existing `platform_assert_active_admin` function is executable by `service_role`, but not by `anon` or `authenticated`.
- **Automated tests:** `tests/eig-build-lab-live-client.test.mjs` checks fixed read-only endpoints, precise grant response, rejected AI operations and untrusted scan results. `tests/build-lab-live-owner-render.cjs` verifies Live workspace markup excludes builder/agent tools. Both are wired into CI, with all database and auth providers mocked.
- **Remaining gate:** test a reviewed migration against a truly isolated PostgreSQL environment, verify RLS/GRANT/RPC transaction behavior and SQL rollback plan, test actual owner session and source scanner runtime in an authorized pre-release deployment, confirm backups, then secure explicit owner approval before enabling Live flags or deploying. Do not merge the long-running feature branch wholesale.

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
