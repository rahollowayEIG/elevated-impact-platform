# EIG Development Rule: Resume Scan and Completion Scan

**Owner direction:** Before resuming substantial ElevationPilot/EIG development after a break, review recent work across relevant projects and chats. When a change is implemented, run the existing Master Scanner / appropriate verification checks before calling it done.

**Status:** Operating rule and review contract. This document adds **no** scheduled worker, automatic ChatGPT-history ingestion, new scanner engine, external API usage, production writes, or privilege grants. It reuses the existing Build Lab / Universal Scanner and Master Scanner foundations.

## Checkpoint 1: Resume scan (before building)

Trigger: a work break, return to an older chat, new session, project switch, handoff, or a request to continue work when code/decisions may have changed.

1. **Recover relevant context:** Review the newest available conversation/project summaries, design decisions, owner approvals, unresolved questions, existing rules and related ongoing projects. Search across accessible EIG project records when warranted. Never claim to have scanned a conversation or app that the current environment cannot access.
2. **Confirm systems of record:** For the affected project/app, inspect its current canonical repository and branches, open/merged PRs, CI results, environment/deployment status, applicable schema/migrations and integration flags as permitted. Distinguish **planned**, **draft code**, **deployed preview**, **deployed Sandbox**, and **verified working**.
3. **Consult the registry/blueprints:** Reuse the existing Platform Registry concept, shared components, scanners, contracts, patterns, and source-of-truth documents. If the registry is not deployed, use an evidence-linked interim inventory; do not invent registry coverage.
4. **Deduplicate first:** Identify work already done, partially done, in draft PRs, deployed elsewhere, or blocked. Search before creating a new branch, feature, migration, component, scanner or integration. Prefer extending an existing owner-approved implementation when safe.
5. **Define the next delta:** State the minimum unresolved work and relevant test/acceptance criteria. Surface contradictions between chat expectations and verified code/status, rather than pretending that prior work never happened.

Keep this lightweight: compare evidence that changed since the last verified baseline and broaden only for dependencies or uncertain status. Do not re-run costly scans merely to say a scan happened.

## Checkpoint 2: Completion scan (after implementation, before reporting success)

1. Run **existing targeted scanners first** for the changed app/workflow, plus affected unit/integration tests, build, security and dependency checks. Reuse the Master Scanner foundation for repository code/build checks where applicable.
2. If an isolated Sandbox test is safe and authorized, verify the actual new behavior, role boundaries, routing, storage and integration isolation. Use fictional data; keep Live data, payments, outgoing communications and production write targets outside testing.
3. **Forward + reverse Build/UI/Data coverage for user-facing changes:** Confirm an owner-approved and actually deployed feature is present in the expected ElevationPilot app, route, role, edition, Hangar/event and feature-flag context; then trace the rendered UI control to its real handler, authorized API/RPC, domain data contract and visible result. Consult the two-way audit design in the existing Universal Scan Engine (draft PR #53) rather than inventing another scanner. Intentionally hidden, draft-only and internal backend functions are not automatically defects; mark missing browser/data verification BLOCKED or NOT TESTED.
4. Recheck related modules and open PRs for regressions and duplicated functionality. Confirm the exact commit, environment and deployment alias match what was tested.
5. Classify each result **PASS**, **FAIL**, **BLOCKED**, or **NOT TESTED**. Build/CI passing does not prove an interactive browser journey succeeded. A planned future scan is not a completed one.
6. Record a compact evidence-backed handoff: what changed, what was reused, tests and evidence, environment, unresolved blockers, approval required, recommended next action. Store durable project implementation changes in the repo/registry, not solely in chat.
7. No autonomous merging, production release, permission changes, customer data ingestion, payments, paid provider calls or broad environment unlocks from a scanner result. Existing owner approval and least-privilege gates still apply.

## Reuse, not new scanners

| Existing capability | What it can already do | What not to claim |
| --- | --- | --- |
| **Master Scanner foundation** (draft PR #57, workflow `.github/workflows/master-scanner.yml`) | Read-only repository build/tests; designed for manual, PR and weekly runs | It does **not** presently crawl ChatGPT conversations or prove entire application workflows |
| **Universal Scan + Build Lab** (draft PR #53) | Deterministic evidence/review contracts, Project Architect, selected source inspection, tests | It is not a production autonomous all-app agent |
| **Build intelligence impact inspector** (draft PR #55) | Source/change-risk classification and associated tests | It is not a replacement for end-to-end browser testing |
| **Platform Registry** (architecture blueprint) | Canonical target inventory for apps, owners, permissions, integrations, locations and lifecycle | Fully populated/deployed registry is **not verified** |

Do not create a second `continuity scanner`, `chat scanner` or duplicate Master Scanner to satisfy this rule. Add a **resume-context intake/checkpoint** and **completion gate** to the existing orchestrator if/when that component is activated and authorized. Conversation retrieval should use approved, available context providers, never assumed private cross-project access.

## Initial evidence checklist

- Last known session / date and source(s) reviewed
- Relevant projects and conversation decisions, with links where available
- Canonical repo, PR(s), commit/branch, build and deployment target
- Already complete vs drafted vs verified vs blocked vs truly new
- Reuse candidate and next minimal change
- Existing scanner/test commands used and summarized outcomes
- Outstanding approvals and next checkpoint

**Safety:** These checkpoints apply across EIG projects, including EIE, ElevationPilot Sandbox, InceptionApex, Event Builder, EIC, Squawk Box, Scanner/Build Lab, marketing and creative extensions, but only insofar as authorized context is available. Never copy confidential chats, customer data, tokens or financial information into public repos or scan reports.
