# EIG Build Lab: Continuous Improvement Agent

**Owner direction, October 15, 2026:** Treat Build Lab as a proactive, owner-only **improvement agent** for EIG's ultimate connected small-business platform. Analyze EIG-owned apps, UI, workflows, code, test results, infrastructure changes and authorized market/reference material. Surface improvements without requiring the owner to discover every opportunity manually. Summarize meaningful findings in a weekly review.

**Status:** Approved product direction and implementation blueprint **only**. No recurring agent, scheduler, AI usage or automatic app modification is enabled by this document. Current EIG Build Lab is a local deterministic brief-to-blueprint and review pilot in draft PR #53.

## Desired experience

- The agent can run in the background on scheduled and event-based triggers, subject to frequency and spend limits; "always-on" means recurring monitored work, **not** a single infinite-running process.
- When an EIG engineer merges code, an existing CI test fails, a design-system component changes, or a known dependency becomes outdated, the agent can identify affected apps, investigate in an isolated read-only manner, and open a reviewable finding.
- A **weekly owner digest** categorizes findings by user impact, severity, evidence quality, cost and estimated reuse; includes what has changed since the last scan, newly discovered opportunities, already-known findings, accepted/rejected status, and results of verified tests.
- Owner can accept/edit/reject a finding and decide whether the correct response is a small scoped fix, shared design-system component, reusable workflow engine, scanner/automation, or a new app extension.
- A separately authorized builder can create an **isolated draft branch/PR** and run permitted tests on an approved item. Do not merge, publish, release, migrate production, alter permissions, access user/customer data, spend on external services, or buy products autonomously.
- Past decisions and measurable before/after outcomes guide *future suggestions*; do not modify agent prompts, model weights, source-of-truth records or live permissions without owner approval.

## One orchestrator, multiple targeted inspectors

1. **Code & Platform Inspector:** Compare canonical source and registry to recent diffs, code health, dependency alerts, duplicated features, owner boundaries, authorization and test coverage. Read only approved repos through tightly scoped tokens.
2. **UI & Experience Inspector:** Review authorized screenshots and synthetic test interaction traces at desktop/tablet/mobile, visual hierarchy, EIG brand, contrast, keyboard access, forms, state feedback, error handling and unnecessary steps. Browser-based walkthroughs must use test accounts and synthetic data.
3. **Workflow & Business Inspector:** Map EIE Event Builder, InceptionApex, commerce, Hangar onboarding and other connected apps for re-entry of information, inconsistent navigation, gaps, one-account reuse opportunities and safe automation.
4. **Reference & Opportunity Inspector:** Optional, permissioned research of public information, documentation and app feature descriptions to generate *proposed* features. Never copy competitors' private source, bypass logins or assert unverified behavior.
5. **Test & Regression Inspector:** Collect existing test/CI results and compare behavior against known accepted baselines. Flag regressions; distinguish flaky/inconclusive tests from verified failures.

The orchestrator de-duplicates findings, preserves provenance and version information, and asks the owner to choose the next high-value improvement.

**Required future coverage: forward + reverse Build/UI/Data audit.** Reuse the [Universal Scan Engine's two-way Build ↔ UI ↔ Database audit contract](./Universal-Scan-Engine-Architecture.md): (a) check each approved and deployed *user-facing* EP capability against its intended screen, role, edition and feature flag, and (b) trace each visible control back through routes, handlers, authorized APIs/RPCs and relevant persisted domain data. Report intentional hidden/admin-only/unreleased work distinctly from missing UI, and label unsupported runtime journeys **NOT TESTED**. Trigger this check at resume and after approved feature completion, alongside existing CI; there is **no** live all-app crawler, runtime DB-to-UI mapper or new scheduled worker yet.

## Cadence design

- **Event-triggered (default first):** Run light inspections after an authorized repo PR, test failure or package/design-system change. Use existing CI results rather than re-running full suites wastefully. No AI provider charge required.
- **Daily or periodic (opt-in):** Check owner-approved repos and issues for *meaningful changes since previous check*, with rate limits and quiet mode when nothing changed. Do not schedule costly full-site crawls.
- **Weekly deep scan and report (planned):** Compare each enabled app/module to the last reviewed baseline; prioritize UX, broken features, security, reusability, compatibility and dependencies. Produce a concise owner-only dashboard/digest. Owner chooses the weekday and approximate delivery time before enabling.
- **On-demand deep dive:** User can ask the agent to inspect a particular EIG page/workflow, upload authorized screenshots or test logs, or explain a report finding.

Scheduler options: initially, least-privilege GitHub Actions (for code/CI inventory) plus a verified owner-only API/report viewer, or a separately approved background task platform. A ChatGPT recurring task could eventually send a weekly summary, but is not a substitute for the Build Lab's authenticated scan implementation and evidence store.

## Finding evidence contract

Each finding should include:
- stable finding ID, project/app/Hangar scope, source evidence links, scan time, source version/commit and observed viewport/test context;
- observation type: **verified** from code/test/authorized walkthrough, **inferred** hypothesis requiring reproduction, or **proposed** improvement/feature;
- severity and business value, user-facing impact, estimated fix complexity, confidence *with supporting evidence* and affected modules;
- existing shared component/service to reuse; whether to create a scanner/engine before implementing, with cost/benefit reasoning;
- proposed acceptance criteria, exact regression checks and known limitations;
- owner review state (pending/accept/edit/reject/defer), timestamp, version and authorized next action;
- delta relative to last weekly scan, deduplication key and no-change signal.

Never use an AI model's text alone as evidence that a live workflow, feature, competitor capability or fix has been verified.

## Access, privacy and cost

- **Owner-only, no exceptions by EIG admin role:** Only the single configured owner can view findings or enable scans/approve work. No other EIG admins, Kellie, Pilots, ATCs or customers. The agent's worker is a narrow service identity, not an impersonation of the owner; every report API and eventual storage RLS must enforce the exact owner Auth UID, live session and scopes. Current preview UI guard does not by itself protect a future worker.
- Credentials in server-side stores only; scoped GitHub permissions, safe origins, source allowlist and isolation of preview/prod. Do not embed user IDs/tokens/secrets in client code, files exported to others or source-control variables.
- Do not process personal customer, payment, contract, membership or private contact data until permissions, retention, provider processing, audit and billing are independently approved.
- Start with **zero-provider-cost** deterministic scans using existing authorized repo metadata, CI/test reports and sample UI checks.
- AI analysis is opt-in with configurable model, request count, token budget, hard spending cap, errors/rate limits and a clearly labeled "pause all scans" control; never charge unexpectedly.
- Disable by default outside the owner-approved environment. Cron, workflows and alerts require separate rollout approval. No production schema migrations, billable Supabase branches or unattended deployments.

## Recommended MVP in sequence

1. **Passive change scanner:** Read-only diff of EIG repo and existing GitHub checks, with a structured finding format and recorded stable source versions. Generate first report for the owner's review. No AI or schedule yet.
2. **UI pilot:** Scan InceptionApex's first-party code and recorded test/screenshots, flag verified/possible usability issues, and recommend one reusable design-system improvement. Test desktop/mobile and keyboard behavior. The dark field-label contrast observed during owner pilot is an initial human-observed issue; determine exact contrast from CSS rather than assuming.
3. **Review dashboard:** Show accepted/rejected/open findings, search/sort, dedupe and prior-scan deltas in EIG Build Lab; store versions only after an approved safe persistent environment is ready.
4. **Weekly schedule:** Owner selects day/time, targeted repos/apps and report destinations. Run limited authorized scans and email/notify only meaningful findings. Verify read/write permissions and rate/spending caps.
5. **Draft implementation assistant:** Only after individual item approval, prepare a branch/PR with tests and screenshots in a sandbox. Never merge or deploy on its own.
6. **Expand to additional domains:** Event Builder, Hangar onboarding, commerce, Squawk Box and planned extensions through their canonical registry/integration ownership.

## Measures of success

Track developer hours avoided, number of duplicate implementations prevented, accepted findings that passed tests, usability regressions caught before release, repeated admin clicks eliminated, number of reusable patterns created, time to approve/reject a change, and scan/AI cost per approved fix.

**Core rule:** The agent should be able to think, notice and recommend frequently; it should be unable to silently change EIG's production business platform or access information beyond what the owner authorized.
