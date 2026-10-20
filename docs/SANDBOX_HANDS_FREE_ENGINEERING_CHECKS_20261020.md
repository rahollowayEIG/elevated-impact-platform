# ElevationPilot Sandbox: hands-free engineering checks

Date: October 20, 2026
Environment: EXISTING isolated Sandbox, Supabase project publruuuyvpggogrrgwp, never Live.
Status legend: PASS / PARTIAL / BLOCKED INTENTIONALLY / NOT TESTED.

## Evidence collected without an owner browser session

| Area | Status | Evidence / next action |
|---|---|---|
| Protected login / fictional practice roles | PASS | Existing independent tester, Pilot / Co-Pilot / ATC / Passenger server role tests |
| Live-derived Cockpit / EIE Directory | PASS (owner UI) | Original components display one fictional Draft golf event |
| Event Details display | PASS (owner UI) | Proper ISO date and team fixture, no Live records |
| Registration & Pricing reads | PARTIAL | EIE uses event_offers, golf_event_payment_settings, events; scoped reads verified, saves locked |
| Roster / team management | BLOCKED INTENTIONALLY | Read-only lists supported but mutating registration/team/invite Edge Functions and provider sends locked |
| Event Info / Hub | PARTIAL | Existing read/view available; updates and file storage not authorized |
| Creative / Event Packet read | PASS (owner UI) | Owner confirmed this panel works; save RPC blocked |
| Budget read | PASS (owner UI) | Owner confirmed original budget view; save RPC blocked |
| Airport / passenger profiles | PARTIAL | golf-my-registrations read-only clone; profile and saved-payment tables not granted |
| Squawk Box | BLOCKED INTENTIONALLY | RLS exists, but read grants and send/publish mutations not yet cleared |
| InceptionApex / Social Media | NOT TESTED | Full provider and app-specific integration review outstanding |
| Universal Scanner | PARTIAL | Scanner architecture and draft regression checks exist, not a continuously running comprehensive browser scanner |
| Full end-to-end event registration | BLOCKED INTENTIONALLY | No published events, registrations, customer emails or checkout |

## Verified Sandbox metrics

- Source scan: EieEventSetupSteps, EieRosterMaintenance, PlatformApp, ElevationAirport, SquawkCenter, EventPacketStudio, eventBudgetStore, InceptionApex, SocialMediaApp.
- One independent Auth user, two fictional organizations, one Draft fictional golf event, zero registrations, zero saved budgets, zero saved packets.
- Sixteen direct authenticated public-table SELECT grants, zero authenticated public-table write privileges.
- Read permissions for passenger_profiles, passenger_payment_methods and eight Squawk-related tables are still missing intentionally; do not enable without RLS review.

## First atomic Event Details save: staging progress only

1. Traced original saveEventDetails handler. It performs three separate remote writes (golf event, master event, calendar settings). Broad Live UPDATE grants are not a safe shortcut.
2. Tested all three updates in one explicit DB transaction with the fictional practice event, confirmed consistency and Draft/calendar flags, and rolled back to original state.
3. Staged sandbox/first-write/01_sandbox_atomic_event_details.sql. Private SECURITY DEFINER implementation behind a public SECURITY INVOKER RPC; exact event allowlist and strict auth/role/payload checks.
4. Tested the exact staged SQL in a rollback-only Sandbox transaction. Pilot and Co-Pilot saves succeeded. Stale write and attempted status=published rejected. ATC and Passenger rejected. Anon had no EXECUTE, authenticated had no table UPDATE. Both records stayed consistent. After rollback, new functions did not exist; fictional event remained unchanged.
5. Added sandbox/first-write/02_rollback_atomic_event_details.sql, and staged frontend code behind opt-in VITE_SANDBOX_EVENT_DETAILS_SAVE_ENABLED. The opt-in flag is OFF and has not been enabled in the deployed Sandbox.
6. No write RPC, function, or grant from this first-save prototype has been deployed to any database. Full workspace flag stays OFF. Live remains untouched.

## Who does what

ASSISTANT WITHOUT OWNER: Code review, DB schema and RLS audit, role/session verification with transaction rollbacks, safe staged changes, regression tests, CI and build checks, dependency mapping, deployment comparisons and external integration inventories.

OWNER ONLY: Decisions on enabling actual practice saves, acceptance of screen layout/behavior, and any separately approved Live changes.

Do not ask for repetitive screenshots when automated checks can replace them. Do not promise any background work beyond this active turn unless a scheduled automation is created.

## Next gate

Run CI/build on the staged draft PR, audit any failures, verify first-write feature flag is absent from the active Sandbox Vercel project, and leave actual write capability OFF until explicit approval. Keep draft PR unmerged.

## Rollout update: first practice Event Details save ACTIVE

After the user returned ready to test, the assistant performed an additional production safety review and:

1. Added repeatable transactional smoke SQL and static regression coverage. Sandbox routing tests and build passed; the unrelated image-loading InceptionApex test passed on one rerun; remaining four checks also passed.
2. Deployed the first-save UI code to the **existing Sandbox Vercel project only** with the switch OFF, then installed the exact pre-tested, narrowly scoped server function ONLY in Supabase Sandbox as migration `sandbox_first_atomic_event_details_save_20261020`.
3. Executed `sandbox/first-write/03_transactional_smoke_test.sql` against the installed function and confirmed Pilot/Co-Pilot allowed, ATC/Passenger denied, unknown event/stale version/status-injection/invalid date/invalid team size rejected, and full rollback.
4. Enabled only the Sandbox production flag `VITE_SANDBOX_EVENT_DETAILS_SAVE_ENABLED=true` and deployed `dpl_9LYLWT2QesCV45a9XuQQAGY5oAJj`. Verified `elevationpilot-sandbox.vercel.app` now points to this READY build, UI SHA `fe22b3e6bc3ec2a5bd545a3b40ad2c2b5610a265`.
5. Independently verified Live deployment SHA remains `755328d18863fb20faa54f5b16d7698cf9097c21`; PR #75 remains draft/unmerged; no customer data/imports, published events, registrations, or broad table writes.

**Owner browser test pending:** change a harmless Event Details field on **Practice Scramble Showcase**, click Save Event Details, refresh and verify persistence. This is the sole newly enabled write workflow. All other workflows remain blocked. Rollback instructions are maintained in the first-write plan.
