# EIG Build Lab: Essentials & Wow Radar
**Protected Preview Product Quality Scanner | 20 October 2026 | Owner Review Required**

## Why this exists

The Master Scanner answers **What evidence of implementations and tests is present?**

The Essentials & Wow Radar separately asks:
1. **What essentials does a reliable, secure, usable platform need?**
2. **What delightful, reusable experiences could make ElevationPilot exceptional?**
3. **Which capability deserves investigation, testing, or a blueprint next?**

It must detect and suggest patterns **without waiting for a human to name them**, such as the "account-first for every trackable action" idea. This does **not** mean that every suggested feature is confirmed missing or broken.

## Current implementation and safety

- Appears in the existing **owner-only EIG Build Lab** directly below the Master Scanner; no new public auth path or Supabase permissions are introduced.
- Calls the **same approved, authenticated, read-only Master Scanner endpoint** and its static 17-file source/test allowlist, rather than creating a second privileged reader.
- A fixed rulebook in `server/eig-essential-wow-scan.cjs` identifies candidates in two lanes: **Essential Foundations** and **Make It Awesome**.
- The actual 15-module scanner catalog provides optional single-module targeting, or scan the entire platform.
- Server returns bounded evidence with allowed file path, line and excerpt; client revalidates all returned fields before rendering. The report's source fingerprint includes the rulebook so new reviews reset when a rule changes.
- Per-owner decisions `Accept for blueprint`, `Revise`, `Park idea` save **in this browser only**. Full backlog and individual Upgrade Brief JSON exports include impacts, dependencies, verification steps and owner approval gates.
- **No Live or Sandbox data writes, external website visits, AI calls, code changes, automatic fixes, emails, payments or deployments** occur when running this radar. A button to export a draft only downloads a file.

### What the evidence grades really mean

- **Source signals found**: the requested code markers were found in the protected Build Lab preview's source sample. This does *not* verify behavior.
- **Partial signals**: some markers found, but require examination.
- **Not observed in source sample**: none found in this fixed sample. A capability might still exist in another repository file, service, external integration, or deployment.

The scanner NEVER automatically labels an opportunity "confirmed missing", "production broken" or "fully implemented" based on substring matches.

## The rulebook

**Essential software foundations:** account-linked actions, least-privilege API access, unified My Activity, reliable Squawk/email delivery, audit timelines, draft autosave and recovery, validation/idempotency, WCAG accessibility, search and sorting, automated functional tests and release rollback, data portability, integration health, performance/mobile experience, and privacy/consent.

**Make-it-awesome capabilities:** personalized everything-at-a-glance homepage, event request-to-Flight handoff, next-action companion, AI-approved workflow helper, action cards within Squawk, instant design previews, mobile Event Day HQ, maps/GPS/flyovers, sponsor value reporting, customizable event-type extensions, isolated AI repair/retest workflows, and thoughtful onboarding moments.

Each rule contains:
- Priority and estimated effort/impact (planning estimates, not measured ROI)
- Why it matters
- Suggested implementation
- Evidence counts, exact source locations, and explicit "unverified" claim
- A verification plan, dependencies, and benchmark source
- Owner review state

### Evidence and guidance sources

- [OWASP Application Security Verification Standard 5.0](https://asvs.owasp.org/): authentication, authorization, security logging and control validation.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/): accessible interactions and content.
- [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): status visibility, preventing errors, consistency and user control.
- [Google Core Web Vitals](https://web.dev/articles/vitals): responsive, stable, interactive experience metrics.

These sources inspired **the authored fixed rubric**; the radar does not dynamically retrieve, parse or crawl them when a scan runs. This is not a comparative evaluation of external vendors or a real-time industry update.

## Relevant verified project observations

**Account-first:** the protected preview has an owner-requested Event Inquiry account prompt and a private dashboard, but the new account-owned portal remains disabled by default and its dedicated server endpoint is not yet deployed. The rule calls for account-first across *all* trackable actions, not just that single event form. Nothing about this new Radar changes the guarded preview feature or its production behavior.

**Security:** a separate, authorized read-only database review identified unusually broad Live anonymous write privileges, compared with Sandbox. That is a security finding to investigate and remediate with an owner-approved migration, not a finding produced by this source-only Radar. The Radar's security rule prompts a proper **effective grants/RLS/function permission scan** before changing public inquiry routes.

**Communications:** Squawk's messaging and recipient constructs already exist, but the event-request status-to-email/Squawk pipeline is not connected. The Radar detects relevant code signals but recommends a reliable outbox, recipient verification and delivery tests.

**Automated testing:** existing browser tests and CI exist for some workflows. Presence of `chromium.launch` is not proof that all Event Builder registration details, financial transactions or every browser scenario have been tested. Rule asks for targeted, actual Sandbox flow tests.

## Recommended upgrade blueprint gates

1. Confirm existing feature and test coverage. Do not duplicate something already built.
2. Compare the underlying Live and Sandbox implementation and role gates with independent evidence.
3. Use the change-impact engine to identify affected roles, payments, contracts and data.
4. Define exact acceptance tests, performance/accessibility criteria, rollback and owner approval.
5. Implement on protected development branch or isolated Sandbox only.
6. Execute synthetic functional/regression tests without real payments, marketing emails or customer records.
7. Present measured test results, unresolved risk and verified improvements to owner for acceptance.
8. Only owner-approved release mechanisms may affect Live.

## Next enhancements (not yet built)

1. **Full repository registry:** tie capability rules to services, components, permissions, deployed environments and migrations without relying on an incomplete static sample.
2. **Authenticated UI exploration:** browse Sandbox with approved synthetic test accounts and capture which features are actually accessible, navigable and functioning.
3. **Database security scanner:** compare effective `GRANT` permissions, role membership, RLS policy logic and function SECURITY DEFINER scopes; report verified evidence.
4. **External benchmark reader:** compare chosen external software through authorized public documentation, screenshots and tests, respecting copyright and terms of use.
5. **AI capability analysis:** connect existing OpenAI cost-controlled review with attributed evidence, owner review and prompt safety controls.
6. **Weekly or pre-release radar:** track changed evidence and regression outcomes over time, notifying only if material owner-actionable improvements appear. This is a future scheduled capability, not running today.
7. **Blueprint handoff:** allow an accepted idea to populate the existing Project Architect and change-impact scanner automatically, without granting deployment rights.

## Tests

- `tests/eig-essential-wow-scan.test.cjs`: fixed rubric, distinct priorities, scopes, evidence integrity, no overclaims, no production action.
- `tests/eig-improvement-radar-client.test.mjs`: client source validation and owner-authenticated endpoint reuse.
- `tests/eig-improvement-radar-browser.cjs`: fictional UI review, local draft persistence, blueprint download, scope changes, search, filters and mobile overflow.

All new code targets `feature/build-lab-orchestrator-20261020` only. **Production deploys, database policies and connected apps remain unchanged.**
