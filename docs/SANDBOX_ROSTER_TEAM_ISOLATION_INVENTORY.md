# Sandbox EIE Roster / Team Management: next isolation boundary

Status: INVENTORIED ONLY, NO NEW EDGE FUNCTION DEPLOYMENTS (October 20, 2026).

After the first real Event Details save and controlled Registration Details setup save, the next priority is a full fictional captain/team roster flow. The original src/EieRosterMaintenance.jsx is already the main UI and must be reused.

## Eight original Edge Function dependencies

1. golf-admin-registration: read/admin roster actions and participant maintenance.
2. golf-admin-team-registration: manual team creation, captain and teammate slots.
3. golf-admin-team-management: team edits/invite operations, check-in print and Golf Genius export.
4. golf-bulk-registration: batch admin edits, possible cancellation/refund.
5. golf-import-roster: sheet/template creation and import.
6. pull-google-roster-edits: inbound Google Sheet changes.
7. sync-google-roster: outbound Google Sheet sync.
8. platform-invite: sending invitations and onboarding users.

Currently the isolated Sandbox Supabase project has ONLY two active, read-only Edge Functions: public-event-squawks and golf-my-registrations. None of the eight administrative dependencies are deployed there. The Sandbox browser network guard forbids them.

## Recommended safe testing order

- Read-only roster listing of the fictional Draft event, verifying team size and persisted participant field requirements.
- A controlled test-only, anonymous/fictitious four-player team entry WITHOUT creating real Auth users or dispatching email.
- Captain ownership and four slots, TBA placeholders, consistent Team/Entry numbers, and no released team-number holds.
- Team slot replacement and removal, with counts and check-in export verified.
- Golf Genius CSV formatting from fake records: Team #, first/last, gender; unknown golfer details treated as TBA.
- Simulated payment statuses only, no Stripe calls/charge/refund flows.
- Reusable small data-pack creation/reset for repeated automated browser tests.
- External Google roster sync, invites, public registration, checkout and notifications remain disabled until their own separate reviewed isolation gate.

Never clone production functions with live external credentials. Do not run any genuine mail, SMS, payment, Drive, or external provider actions while developing the Sandbox.

Live Supabase and Vercel are unaffected. Draft PR #75 remains Sandbox-only and unmerged.