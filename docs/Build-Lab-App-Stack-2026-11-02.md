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
