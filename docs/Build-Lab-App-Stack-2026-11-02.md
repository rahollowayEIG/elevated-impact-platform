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
