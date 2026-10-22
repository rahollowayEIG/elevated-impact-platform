# EIG Build Lab: Live / Sandbox Environment Audit (2026-10-20)

## Purpose and boundaries

The owner-only **Master Scanner** now allows the EIG owner to choose:
- **Live (read-only):** examine a dated snapshot of the live public database schema and the exact recorded Vercel production deployment identity.
- **Sandbox (read-only):** examine the equivalent dated Sandbox metadata. The separate sandbox database and production deployment are independently identified.
- **Compare Live + Sandbox:** report table/column/index/RLS-policy/function differences and changed files between the two actual deployed source revisions.

Each mode can include the full module catalog or one approved module. No environment mode allows arbitrary paths, URLs, SQL, source files, customer records or target project IDs. The server validates the requested mode/module under the existing protected preview owner grant before reading its fixed allowlist.

This is a metadata comparison using **captured evidence**. It is *not* a fresh Supabase query, a fresh Vercel deployment lookup, or a login/browser visit every time someone clicks Scan. The source and UI markers in the original Master Scanner are read from the **protected Build Lab preview branch**, not from either deployed Live or Sandbox version. Those preview markers must never be interpreted as target functionality verification.

No code was deployed to the production branch; no real or sandbox database records, roles, payments or events were modified; no OpenAI model or automated repair job runs.

## Evidence provenance

* Live Supabase project: Elevated-Impact-Platform (separate existing database). Live Vercel project: `elevated-impact-platform`, production branch `main`, deployed commit `755328d18863fb20faa54f5b16d7698cf9097c21`.
* Sandbox Supabase project: ElevationPilot-Sandbox (separate isolated database). Sandbox Vercel project: `elevationpilot-sandbox`, production branch `feature/sandbox-readonly-live-ui-20261019`, deployed commit `e9c84d2f49831af0a91e0f6fcfedbc43dfb8419b`.
* Live/Sandbox database snapshots saved in `server/eig-master-environment-baseline.json`. Read-only SQL queried public Postgres catalog table structures (name/type/nullability), index counts, RLS flags, normalized policy definition hashes and public function names/identity signatures/definition hashes. No customer data rows or function source bodies are stored.
* Live/Sandbox **deployed source comparison** saved in `server/eig-master-deployment-baseline.json`. Data came from Vercel READY **production** deployment commit IDs and a GitHub comparison between those precise SHAs. The comparison contains filenames and line counts only, no credentials or source bodies.
* All snapshots were captured on **October 20, 2026** and stay dated until updated intentionally.

## Initial results and caveats

- Both projects: 71 public tables with RLS enabled. Names and column type/nullability are the same in the captured snapshots.
- Sandbox: 42 public functions vs 38 in Live. Four Sandbox-only functions deal with practice roles and practice event/registration saves; they are *not* invoked by Build Lab.
- Policies: `events` has 4 in Live versus 5 in Sandbox, and `sponsors` has 3 in Live versus 4 in Sandbox. Definitions are compared after normalizing role names across projects so Postgres role OIDs do not cause false alarms. This is a **difference to review**, not proof of an unsafe policy.
- The Sandbox production commit is 161 commits ahead of the recorded Live production commit; 78 changed files were returned in that GitHub comparison. Event Builder code files are among the changes. Diff presence does not indicate a defect or automatically identify the better implementation.
- These counts are accurate for the **recorded deployment/database snapshots**, not necessarily the most recent state if the targets have changed since capture.

## Future connections, intentionally not enabled

1. **Fresh audited Live/Sandbox metadata checks:** choose a read-only, least-privilege and owner-authorized server-side connection for each project. Never put service-role keys in the browser, never execute arbitrary user-entered SQL, and never expose private customer rows. Report query timestamps and failures accurately. Preserve independent project identities and deny unapproved environment targets.
2. **Read-only live UI inspection:** use explicit owner-authorized browser sessions with no form submissions, mutation calls or payments.
3. **Sandbox functional validation:** use synthetic accounts and fictional data only after the sandbox test harness and write-permission boundaries are reviewed. Tests for event creation, save, reopen, invite, payment state and exports should have isolated fixtures, cleanup and failure reporting. No real Stripe charges or real email delivery.
4. **AI-assisted fixes:** may propose changes in isolated branches after evidence is verified and cost controls are in place. Owner approval remains mandatory for changes affecting production, privileges and money flows.

## Tests

`tests/eig-master-environment-compare.test.cjs`: verifies two actual project/version identities, normalized schema/function differences, module-specific file changes, mode isolation, and no mutation permissions.

`tests/eig-master-scan-access.test.cjs`: confirms server-only owner authorization rejects production-mode requests, arbitrary targets, unknown modules, and untrusted callers before accessing source.

`tests/eig-master-scan-client.test.mjs`: validates requested environment mode, response integrity and safety claims.

`tests/eig-build-lab-browser.cjs`: synthetic UI checks for mode changes, authenticated request payload, correct displayed environment, source scope, and review persistence. This does **not** browse Live or Sandbox.

## Deployment

All development occurs on `feature/build-lab-orchestrator-20261020` behind the dedicated Build Lab owner gate. No production merge is authorized as part of this audit.
