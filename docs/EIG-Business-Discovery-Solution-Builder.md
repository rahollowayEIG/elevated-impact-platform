# EIG Business Discovery & Solution Builder
Status: V0.1 DRAFT for owner approval | October 15, 2026
Scope: design/implementation plan only. No live business scanning, provider API spending, provisioning, messaging, production migration or autonomous code changes enabled.

## Product outcome
An authorized business can submit a website, menu, documents and a guided business profile; EIG analyzes permitted evidence, asks targeted follow-up questions, demonstrates a tailored ElevationPilot workspace, and proposes configuration, integrations and (where necessary) new reusable build work. The owner reviews the opportunity before any privileged change. A business does not gain other companies' private data by joining EIG.

## Product architecture
1. Universal Scan Engine: source authorization, capture, extraction, evidence, provenance and confidence. Not the same as Build Lab code inspection.
2. Business Discovery: normalized verified facts, unanswered questions, business goals, capability gaps and opt-in cross-business opportunities.
3. Platform Registry: canonical capabilities, app modules, owner, implementation status, permissions, dependencies, estimated costs and verified integrations. Do not present planned modules as active.
4. Solution Composer: maps business goals and observed constraints to configuration of actual modules, proposed extensions and explicitly speculative concepts.
5. Demo Studio: synthetic/sandbox content and approved branding only, visible functional-versus-mock labeling, safe previews with no hidden real operations.
6. Organization/Hangar Onboarding: canonical existing/match/claim/approval flow with selected services, entitlements, invitations and integration provisioning through owning domain. Never duplicate organization or user identity.
7. Build Lab: proposed missing capabilities -> owner-reviewed implementation tasks -> isolated branch and automated tests -> human-authorized release.
8. Communications + Marketing: platform-shared campaign, email, Squawk, digital displays and approved third-party delivery adapters. Every lifecycle transition maps recipients and nonrecipients, sender, template, approvals, consent, audit and failure routing.

## Phased customer journey
D0 Invitation / public opt-in -> verified requester, scoped source permission and purpose.
D1 Intake -> website, uploads, business type, goals and services; prevent unauthorized website crawl or confidential data collection.
D2 Evidence extraction -> observations linked to exact source; suggested fields remain DRAFT.
D3 Match / review -> detect existing Hangar; authorized representative validates ownership and edits proposed facts.
D4 Opportunity analysis -> available capabilities versus planned capability candidates, integrations, permissions, operational efficiency, marketing/network potential.
D5 Personalized proposal -> illustrated workspace, pricing assumptions separately labeled, clear current/planned/custom status, implementation effort and success measures.
D6 Owner and customer approval -> recorded decisions on modules, services, contracts, privacy, communication and billing; no inferred opt-in.
D7 Provisioning -> idempotent account/service setup performed by canonical owning services with audit, retry and rollback.
D8 Activation -> verify role grants, operational workflows, emails and links using synthetic tests; mark complete only when verified.
D9 Improve -> future authorized rescans and business recommendations, opt-in, quiet-hours and frequency/spend bounds.

## Every app/capability definition MUST specify
Stable id; app owner; requirements and user journeys; implementation and evidence status; system of record; exposed events/APIs; data scopes; security and role-action matrix; who may approve; inbound/outbound integrations; customizations; communication triggers and templates/recipients; marketing surfaces and opt-in rules; failure/retry and audit behavior; acceptance tests; business-network opt-in surfaces; subscriptions/pricing authority; version and last verification date.

## Example: Set the Table
An authorized restaurant website/menu scan can propose digital menu import, specials campaigns, display board playlists, catering/events, Workforce shifts/tasks, commerce/POS integration and participating vendor/advertising opportunities. The output must say which are already built and tested, which are configurable, and which are future builds. Menu pricing, allergen claims and sale details require direct business validation, not AI assertions.

## Employee / operations example
A restaurant or golf course may enable Workforce time clock, shifts, work orders, tasks and event assignments; each employee-role permission and clock record must have separate audit and labor-law validation. Task completion may raise event/screen maintenance updates, and notifications target responsible actors, not all company users by default.

## Onboarding roles and communications contract
Use docs/EIG-Platform-Role-Communication-Contract.md as a mandatory gate, with specific approvals and tests. Initial relevant identities: business applicant, verified Pilot, delegated Co-Pilot, EIG reviewer, setup staff, invited employee, vendor/partner, platform owner, narrowly scoped scanner/provisioning workers. The worker never gains Pilot privileges.
- Submission -> applicant confirmation with appropriate status/action link.
- Needs clarification -> verified applicant/Pilot action-required notice; no unverified scanner detail made public.
- Possible duplicate -> private EIG reviewer alert; never silently merge businesses.
- Approval -> authorized Pilot and assigned setup team; no premature onboarding invitations.
- Role invitation -> specific invited actor with correct scope, expiration and resend path.
- Services ready -> authorized Pilot/delegate receives activation checklist of actual enabled services.
- Setup failure / bounce / expiration -> responsible operator and allowed business contact, recoverable error routing and dedupe.
- Completion -> verified Pilot confirmation only once actual end-to-end tests pass.
For each: recipient and explicit exclusion list, channel, from/reply-to, branding, trigger, timing, unique idempotency key, template version, secure deep link, consent where applicable, resend, error handling, evidence of delivery. No mass marketing without affirmative lawful preferences.

## Business network boundaries
Private organization data never becomes network data by default. Separate opt-in catalog for approved discoverable services, business listings, cooperative campaigns, vendor leads, sponsor opportunities and referrals. Record owner approval, visibility/market scope, per-party sharing permissions, withdrawal and audit. Cross-business campaign matching must not expose rosters, employee records, private contacts or payment details.

## MVP acceptance criteria (pre-code)
- Given an approved synthetic restaurant profile and sample menu, the scanner can generate draft evidence-linked findings, and no record is created without review.
- Proposed company matching must flag possible duplicates before provisioning.
- Every recommendation displays actual registry verified availability versus planned/custom development.
- A demo can be rendered without leaking customer data or silently activating integrations.
- Recipient/permission matrix exists for every triggered workflow, including bounced emails and revoked access.
- Every proposal has traceable sources and a human decision state surviving rescan.
- App-level plans identify reusable components and required adapters, not copies of shared services.

## Prioritized build plan
P0: owner approves architecture, roles and customer-facing claims.
P1: versioned App & Integration Registry schema with draft status and evidence validation, in isolated tests.
P2: Discovery Intake/Opportunity schema and domain adapter mapping with synthetic sources and no external fetch.
P3: evidence-backed proposal composer with explicit implemented/planned/mock state.
P4: interactive synthetic Demo Studio; current data never imported without consent.
P5: owner-reviewed canonical Hangar handoff, notifications and role-specific provisioning.
P6: scheduled rescan and AI-assisted research with separately approved budgets, scopes and protection.
P7: agent-generated isolated PRs and previews on approved tasks, never silent production release.

## Open owner decisions
Define which business types to launch first; who may initiate customer scans; which communication templates to enable; how companies approve network listing/marketing; whether demo creation is free, paid or sales-assisted; when sales proposals require manual review.

## Existing dependencies
PR #53 Build Lab / Universal Scan Engine; PR #52 Hangar onboarding design; docs/EIG-Build-Lab-Project-Architect.md; docs/EIG-Build-Lab-Continuous-Improvement-Agent.md; docs/EIG-Platform-Role-Communication-Contract.md. Actual implementation state must be verified from current code, CI and deployed environment.
