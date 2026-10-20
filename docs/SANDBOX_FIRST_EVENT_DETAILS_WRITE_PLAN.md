# Sandbox first-write slice: original EIE Event Details (review gate)

Status: **STAGED AND TESTED IN DRAFT PR / NOT DEPLOYED / NO WRITE PERMISSIONS GRANTED**

## Implementation progress (October 20, 2026)

- The existing real Event Details form is now conditionally wired to a single
  atomic Sandbox RPC, but only when the separate
  VITE_SANDBOX_EVENT_DETAILS_SAVE_ENABLED flag is enabled.
- The private implementation and public invoker facade are staged at
  sandbox/first-write/01_sandbox_atomic_event_details.sql.
- The complete SQL was created and exercised inside a rolled-back transaction
  on the existing Sandbox project. Pilot and Co-Pilot save checks passed;
  ATC and Passenger, anonymous users, stale saves and publishing attempts
  were rejected. No functions or data remained after rollback.
- Six GitHub CI workflows, including Sandbox routing tests and a production
  application build, passed on commit fd0a44e16a284f40bb1ce75f2de2e714daa59c27.
- The first-save flag and full-workspace flag are both absent from Sandbox Vercel.
  No new write grants, functions, or fixtures have been deployed; Live is untouched.
- Next safety gate: independent review and explicit approval before applying
  the narrow RPC to Sandbox or enabling any real practice save.



## Observed Live UI flow

The existing `src/EieEventSetupSteps.jsx` `saveEventDetails` handler makes **three sequential, non-atomic updates**:
1. `golf_registration_events`: name, location, dates, divisions, and field settings.
2. Linked `events` master: name, date, start time, location, maximum golfers.
3. `golf_registration_events`: calendar sync configuration.

The read-only Sandbox fetch guard appropriately blocks each UPDATE. Authenticated users have **zero table WRITE grants**. Existing public RLS UPDATE policies by themselves do not authorize the first-write test, and broad `GRANT UPDATE` should NOT be copied from Live.

## Proposed smallest safe editable vertical slice

- Reuse the original `EieEventSetupSteps` screen and its existing form. No duplicated Event Builder.
- Stage a **Sandbox-only, server-authorized transaction/RPC** to save Event Details for **exactly the tagged fictional Draft fixture** under the one approved tester's practice organization, with a verified active Auth session and active Pilot/Co-Pilot membership.
- Validate an **explicit allowlist of Event Details fields**, strict length/type/date/team/division limits, and optimistic concurrency against the fixture's last updated timestamp. Reject unknown fields, unauthorized roles and other event IDs.
- Update both `golf_registration_events` and its linked `events` master **atomically**. Preserve status Draft / pending_review and all unrelated fields. Force calendar sync off, disallow event publishing, real Google linkage and outbound messages.
- Add one narrowly allowlisted POST RPC target to the **Sandbox** preview guard, only when a separate `VITE_SANDBOX_EVENT_DETAILS_SAVE_ENABLED` flag is set on the Sandbox Vercel project. Full workspace flag remains unset; all other writes remain denied.
- Update the Sandbox preview banner to tell users that ONLY Event Details can save. Do not imply Pricing, Registration, Budget, Creative, Hub or Roster are editable yet.
- Keep `Live` event handler and deployment unchanged. All Sandbox-specific conditionals must be gated by the verified Sandbox origin/project and the separate feature flag.

## Acceptance tests before enabling

1. Draft fictional event (no registrations or published events), Pilot and Co-Pilot authorized; ATC and Passenger not authorized to this first slice.
2. Transactional server test: save one harmless event detail, read both records with matching values, then rollback; verify no persisted changes.
3. Reject malformed values, changing `status`, changing `organization_id`, changing `is_sandbox_fixture`, unrecognized keys, stale `updated_at`, other event ID, and requests without an authenticated active session.
4. Verify **zero INSERT/UPDATE/DELETE table grants** to authenticated; only the narrowly scoped RPC becomes executable.
5. Confirm Google/calendar/email/payment/Stripe/roster access remains disabled, and no external network call can be made.
6. Confirm the untouched Live deployment and independent Supabase Live project.
7. Run Sandbox routing tests and build; owner then saves a reversible harmless change via the original Event Details screen and reloads to confirm it persisted only in Sandbox.
8. Provide explicit rollback for RPC privilege, deployment feature flag and the test fixture change.

**No user Live data or Live credentials will be copied to Sandbox. No migration or Vercel flag is applied by this document.**
