# Build Lab App Stack and Launch Runway

## Current implemented release

The owner-only Build Lab opens with **App Stack**. All 17 known Master Scanner app areas are visible, including four commerce modules explicitly outside the current production scanning profile.

Each app card contains:
- **Built %** and **Verified %** as separate gauges. They remain **Not measured** until the approved release feature checklist and exact-commit passing test evidence are recorded. A source marker or AI suggestion is never used as a percentage of completion.
- **Source and UI marker signal** and **test-script marker signal**, each labeled as sampled code evidence, not test passes. This helps diagnose whether the scanner has visibility without conflating source matches with completed features.
- Current scanner scope, stage, last saved scan, source commit and evidence reference count.
- Open findings, items on hold, current planning batches, repair execution tracking (explicitly **Not tracked** until implemented), blockers, next action, and launch readiness (**Not assessed** until independent verification).
- A **Review this app** action that opens Work Buckets filtered to the relevant area, preserving the previously released guided Continue workflow.
- A **Continue to Scan** navigation action.

All data is from the owner's browser-local Scan History and Work Buckets. Different browsers and origins can show different records. The App Stack never queries customer tables, edits code, executes agents, or triggers production changes.

## Measurement contract: upcoming

Progress percentages must be computed using a versioned approved app requirement checklist, not simple file counts or AI guesses:

- **Built %** = approved release-scope requirements supported by implementation evidence / all approved release-scope requirements.
- **Verified %** = approved release-scope requirements that have passing relevant tests and accepted owner verification / all approved release-scope requirements.
- **Repair progress** = actual recorded inspect / plan / implement / test / rescan stages from a tracked job, not a guess or an AI suggestion.
- **Launch Runway** = blocker and release gates, with test results and current source commit. No green readiness based solely on code or scripts.
- New approved requirements may lower a percentage without losing previously verified work. Future version ideas are not part of the active release denominator.

Next follow-up is a requirement baseline and verifiable test receipt importer, then genuine live activity events and repair stage telemetry. Keep existing evidence and owner review controls intact.
