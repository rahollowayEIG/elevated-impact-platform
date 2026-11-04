# Build Lab App Stack and Launch Runway

## Current implemented release

The owner-only Build Lab opens with **App Stack**. All 17 known Master Scanner app areas are visible, including four commerce modules explicitly outside the current production scanning profile.

Each app card contains:
- **Built %**, **Verified %**, **Integration %** and **Overall %** as separate gauges. They remain **Not measured** until the approved release feature checklist and exact-commit passing test evidence are recorded. A source marker or AI suggestion is never used as a percentage of completion.
- **Source and UI marker signal** and **test-script marker signal**, each labeled as sampled code evidence, not test passes. This helps diagnose whether the scanner has visibility without conflating source matches with completed features.
- Current scanner scope, stage, last saved scan, source commit and evidence reference count.
- Open findings, items on hold, current planning batches, repair execution tracking (explicitly **Not tracked** until implemented), blockers, next action, standalone readiness and full ecosystem readiness (**Not assessed** until independent verification).
- Candidate app-to-app integrations, clearly labeled as proposed architecture links rather than proved functionality or owner-approved launch requirements.
- A **Review this app** action that opens Work Buckets filtered to the relevant area, preserving the previously released guided Continue workflow.
- A **Continue to Scan** navigation action.

All data is from the owner's browser-local Scan History and Work Buckets. Different browsers and origins can show different records. The App Stack never queries customer tables, edits code, executes agents, or triggers production changes.

## Measurement contract: upcoming

Progress percentages must be computed using a versioned approved app requirement checklist, not simple file counts or AI guesses:

- **Built %** = approved release-scope requirements supported by implementation evidence / all approved release-scope requirements.
- **Verified %** = approved release-scope requirements that have passing relevant tests and accepted owner verification / all approved release-scope requirements.
- **Integration %** = owner-approved required app-to-app connections backed by passing, exact-version end-to-end tests / all approved required app-to-app connections. A connection existing in source code is not a passing integration.
- **Overall %** = a future owner-approved weighted composite of Built, Verified and Integration. No score until the three denominators, weights, requirements and proof are agreed. Scope changes may lower the overall percentage without removing earlier functioning features.
- **Standalone readiness** = approved independent use case and its own acceptance criteria passed; **Ecosystem readiness** = standalone readiness plus all in-scope required integration links passing. An app can be standalone-ready while integrations are outstanding.
- **Repair progress** = actual recorded inspect / plan / implement / test / rescan stages from a tracked job, not a guess or an AI suggestion.
- **Launch Runway** = blocker and release gates, with test results and current source commit. No green readiness based solely on code or scripts.
- New approved requirements may lower a percentage without losing previously verified work. Future version ideas are not part of the active release denominator.

Next follow-up is a requirement baseline and verifiable test receipt importer, then genuine live activity events and repair stage telemetry. Keep existing evidence and owner review controls intact.

## Evidence source proposal

The current ElevationPilot Progress & Recovery Ledger on Google Drive includes automated GitHub checkpoint entries. It can be used for provenance and discovering changed requirements, but `DISCOVERED` entries are not evidence of a successful build, test, integration or release. Later authorized read-only ingestion should reconcile each ledger entry with exact GitHub commits, tests, verified Vercel release SHA and the approved feature/integration contract before changing a gauge. Until that connector is developed and authorized, the App Stack reads browser-local Build Lab scans and work records only.


## Hangar Connections & Adoption: owner-only read-only inventory

The owner console includes a separate **Hangar Connections** view, in addition to app-level Built / Verified / Integration / Overall gauges. This prevents a standalone app's development progress from being conflated with the adoption status of a specific business.

The server authenticates the same **production EIG owner, active session, exact approved origin, and EIG admin membership** used by the existing live Build Lab. Only then does it read bounded organization metadata, Squawk channel status, Drive folder mappings and social campaign record counts using approved server-side credentials.

- Real Hangars are shown by default. Demo Hangars and EIG HQ are separately labeled and hidden until the owner opts to include them.
- For configured Squawk channels, show **verified / configured**, based on a connected state plus a recorded last verification time. Verification is a point-in-time record, not guaranteed present health.
- For channels with setup required, missing verification or compliance work, show the recorded state and a plain-language next action. No access tokens, auth identities, recipients, message contents or personal contact fields are fetched.
- Drive folder mappings are **inventory evidence only**, not proof that a Hangar has a valid Google OAuth connection.
- The number of saved social campaigns is **activity evidence only**, not proof of posts sent, external platform permissions or published results.
- The existing Social Media app lists Facebook, Instagram, LinkedIn, TikTok, YouTube and X. Those provider sign-in, consent, token storage and posting workflows are not currently wired. Report **Platform integration pending**, not **Hangar disconnected**, and exclude the six from the Hangar setup denominator until the connectors exist.
- **Overall Hangar adoption %** stays **Not measured** until the required connector checklist is approved for that Hangar and verified actual provider connections are available.
- No connector setup action, token exchange, release, data export, code modification or background monitoring is enabled by this view.

### Future first-class Hangar connection workflow

Hangar admins should eventually see a friendly **Connect** action for each supported provider. The user signs in *with the provider* via OAuth, sees scoped permissions, selects which managed Page/Channel belongs to the Hangar, and returns to ElevationPilot. Server-only credentials must be encrypted, renewable/revocable, tenant-scoped and audited. A provider's capabilities, consent, compliance and API status must be checked before posting. The connection status must be bound to that Hangar and not inherited from an EIG-wide token.

Only after those requirements and provider test receipts are implemented should the Hangar card calculate required integrations, connection freshness, publish tests and overall adoption progress. Give the owner a way to help each Hangar adopt useful connections without penalizing businesses for connectors that ElevationPilot has not built.


## Application-first App Stack hierarchy

The owner clarified that **EIE is the application**, not 7 separate apps. The App Stack's landing view therefore shows **top-level applications** with four whole-app gauges and their aggregated review counts. Clicking **EIE** opens its constituent scanner components: Event Builder, Registration & Main Cabin, Team Payments, Roster & Team Maintenance, Sponsor Management, Creative Event Packets, and Event Budget.

The detail page keeps each component's existing source evidence, individual gauge placeholder, open/held findings, approved planning batches, proposed integration links, and a direct **Review this component** action that opens the scoped Work Buckets. A breadcrumb and Back button return to the main application stack.

The product registry also groups scanner areas under InceptionApex, Social Media & Ads, Squawk Box, Commerce & Stores, EIG Platform & Accounts, EIG Golf Tools, and Build Lab. Each of the existing 17 scanner areas belongs to exactly one main application for count roll-ups.

Known and planned EIE parts not yet separately defined in the current Master Scanner, including Event Directory & Outing Inquiries, Public Event Hub, ATC operations, Check-in, Vendors/Volunteers, and Donations/Raffles, appear under **Additional parts to map into scanner coverage**. These entries do NOT mean the features are missing, approved, implemented or verified. They are visibility reminders until their approved source/test coverage is registered.

**Whole-app Built, Verified, Integration and Overall percentages remain Not measured** until an approved, versioned per-component requirements checklist, required integrations, passing exact-version test receipts, and an agreed whole-app weighting exist. Parent issue counts can be summed now without claiming finished work. New components and requirements will expand the scope denominator only when approved.

No production scanners or customer data were changed by this hierarchy/navigation update.


## App component inventory and scanner ownership gate (November 2)

The parent app inventory includes more feature-level candidates across EIE, InceptionApex, Social Media & Ads, Squawk Box, Commerce & Stores, Platform & Accounts, EIG Golf Tools and Build Lab. The candidate list records planned or investigated functionality, not proof of implementation. Code path hints, where available, identify where a reviewer might look. They do not claim that a feature works, that end-to-end tests exist or that the live scanner covers the whole feature.

**Build Lab Scanner Coverage Gate** adds a non-mutating GitHub PR check:

- The source-coverage-audit script reconciles all eight main applications with the existing seventeen scanner module IDs and the restricted production source allowlist (thirteen currently in scope; four commerce areas deferred). It validates that candidate source hints reference existing files.
- On pull requests, the check uses Git diff to discover newly added first-party code under src/, server/ and api/. New code without an explicit owner assignment in the source-owner registry fails CI. The owner must assign each new file to one main app and existing scanner component and explain its pending scanner status.
- An authorized owner assignment with scannerStatus of review_pending allows a PR to continue but does NOT add that file to the live Master Scanner, approve any tests, or mark functionality complete.
- Modified pre-existing source files outside the allowlist are reported for review without assuming they are new features. The check cannot infer if a change inside a previously allowlisted file added new functionality; that requires explicit feature-level requirements and testing.
- The App Stack application drilldown shows candidate parts and likely source locations under Additional parts to map into scanner coverage, while preserving seven existing EIE scanner components and their own findings.

This is the first scanner-enrollment safety gate, not a full automatic scanner generator. Future work should add versioned feature requirement IDs, risk-based test mapping, controlled scope updates, and exact-commit passing test receipt reconciliation.

No new production scanner permissions, external targets, customer database reads or auto-fix/release permissions are included. The owner-only Hangar Connections view is unaffected.


## November 4: EIE feature requirement baseline (first measurable evidence step)

The EIE application now has a **proposed** versioned requirement baseline, maintained in `src/lib/buildLabEieRequirements.mjs`, with 26 acceptance criteria spread across all seven existing EIE scanner components. Each requirement has a stable ID, component ownership, behavior that needs proving, and relevant cross-app integration candidates. Seventeen requirements have a mapped test-script reference; nine do not. The UI can therefore truthfully show **17/26 proposed requirements with a mapped test script (65% test-mapping coverage)**. This is NOT a Built, Verified, Integration, Overall or launch-readiness score.

Mapped test references are checked by the GitHub App Stack CI workflow against exact script paths and anchors. The test suite intentionally verifies the **existence of the mapping**, not that the mapped scenario was run in the current deploy. It does not conflate source markers, unit-test text or plan approvals with independent passing regression receipts. Browser and unit tests still require actual CI execution and appropriate end-to-end testing before any feature is marked verified.

Registration-to-universal-people reconciliation is explicitly called out, including captain/teammate claims, manual ATC registration, named players and safe TBA exclusions. These items currently have no accepted test mapping. There is **no** database reconciliation, user record change, production payment action or automatic fix in this increment.

The EIE whole-app and each component's four completion gauges remain **Not measured** because this proposed baseline has not been approved as a complete release scope, additional EIE feature areas remain outside the 26-item denominator, implementation evidence is not yet tied to each requirement, and exact-version passing feature/integration test receipts are not yet linked. This avoids a misleading percentage.

Next phase: reconcile the full owner-approved EIE functionality baseline (including existing unscoped EIE parts), create real safe tests for registration identity and TBA, capture independent passing receipts by exact commit, then calculate scoped component and whole-app meters using an owner-reviewed weight policy. Adding requirements to an approved denominator must never erase historical test results.
