# Sandbox EIE Registration Details: second controlled practice save

Status: SANDBOX REGISTRATION DETAILS SAVE ACTIVE, LIVE UNCHANGED (October 20, 2026).

## Purpose
The original EIE Registration Details Save makes separate writes to golf_registration_events, event_offers, golf_event_payment_settings, and the master events deadline. A partial failure can leave inconsistent settings. This change instead uses the existing original UI with one isolated private SQL transaction behind a public security-invoker facade.

## Safety
- One approved verified practice user, active Supabase Auth session and Pilot/Co-Pilot membership only.
- Exactly one tagged fictional Draft event and linked unpublished master, with no registrations, published events or nonfictional organizations.
- No general table write grants. Only the explicit public sandbox_save_practice_registration_details RPC may be invoked through a separate, Sandbox-only feature switch.
- Reject ATC, Passenger, anonymous calls, unrelated event ID, hidden status changes, invalid dates, negative prices, team-size overflow and stale timestamps.
- Keep event Draft; force payment reminder sending and autocharge off. No actual participant registration, Stripe checkout, email, Squawk, Google Sheet, publication, or calendar sync.
- Preserve original Live save handler unchanged when not in opt-in Sandbox mode.

## Files and tests
- sandbox/first-write/04_sandbox_atomic_registration_details.sql: private atomic server save and invoker facade.
- sandbox/first-write/05_atomic_registration_smoke_test.sql: BEGIN / ROLLBACK, approved Pilot/Co-Pilot and denied ATC/Passenger plus malformed-data cases.
- sandbox/first-write/06_rollback_atomic_registration_details.sql: remove only this Registration Details RPC; existing Event Details permission remains intact.
- tests/sandbox-registration-details-save.test.mjs: feature gating, cross-origin and write restrictions, SQL invariants and regression manifest.
- src/EieEventSetupSteps.jsx and isolated Sandbox network guard: reuse real original UI, not a second application.

## Verified in rolled-back Supabase Sandbox transaction
Fictional $480 team price, four-player team, four-day clubhouse hold, Gender required, shirt-size custom field, base offer reuse, linked master deadline and payment settings all saved atomically in the test. Negative and role-isolation tests passed. After ROLLBACK: zero registrations, zero active registration offers, zero saved payment rows and zero broad authenticated table write grants. Original practice event remains Draft.

## Rollout sequence
1. All GitHub CI jobs plus Sandbox routing and application build must pass.
2. Apply narrow server RPC to Supabase Sandbox only; rerun post-install rollback smoke.
3. Deploy Sandbox frontend first with VITE_SANDBOX_REGISTRATION_DETAILS_SAVE_ENABLED absent.
4. Check Live unchanged and all other Sandbox writes/checkout/invites blocked.
5. Add opt-in flag only to Sandbox production Vercel project; redeploy existing Sandbox project.
6. Owner tests a harmless Registration Details Save and browser refresh.
7. Proceed to roster/team management only after separately isolating its administrative functions.

DO NOT merge draft PR into Live or enable the broad workspace flag.

## Activated isolated Sandbox deployment (October 20, 2026)

- All SIX GitHub workflows passed, including Sandbox routing tests, registration gate tests and production build, on code commit e9c84d2f49831af0a91e0f6fcfedbc43dfb8419b.
- Deployed the new original UI on existing Sandbox Vercel project, initially with Registration Details Save OFF. Enabled production-only VITE_SANDBOX_REGISTRATION_DETAILS_SAVE_ENABLED=true after a successful backend smoke; deployed final Sandbox build dpl_Guv3XncA9kWc9cKwXDPHH1hR4BQc, verified READY and live alias elevationpilot-sandbox.vercel.app.
- Installed only the two narrowly scoped Registration Details RPC functions in isolated Supabase Sandbox publruuuyvpggogrrgwp with migration sandbox_first_atomic_registration_details_save_20261020. Executed the same full transaction-only role and malformed-data smoke test AFTER installation; all passed, ROLLBACK with no changed records.
- Audit: only authorized Pilot/Co-Pilot can save the one fictional Draft event; anonymous RPC denied; zero broad authenticated table-write grants; zero registrations, published events, active offers or saved payment rules before owner tests. Normal Event Details Save remains active. Calendar sync, real checkout, participant enrollment, emails, reminders, publishing and roster mutations remain locked.
- Independently verified Live Vercel main SHA remains 755328d18863fb20faa54f5b16d7698cf9097c21. Draft PR #75 remains stacked on Sandbox-only #74 and unmerged.
- Owner acceptance PENDING: set four-day clubhouse payment hold and Gender Required on Practice Scramble Showcase Registration Details, Save, refresh; confirm both persisted. Record browser behavior before progressing to participant-management writes.
- Rollback: remove only the Sandbox Vercel Registration Details feature flag, redeploy safe prior Sandbox build, execute sandbox/first-write/06_rollback_atomic_registration_details.sql. Do not remove existing Event Details permissions.
