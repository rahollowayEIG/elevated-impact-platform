# ElevationPilot Event Inquiry Account, Tracking, and Notification Blueprint
**Draft for EIG owner review | 2026-10-20 | Not released to Live**

## Owner's requested experience

After someone completes the Hangar's public Event Builder / Outing Inquiry form and clicks **Submit**, open an in-page **Create Account / Sign In** prompt. Keep their request form intact. An existing account signs in, and a new account enters first name, last name, email, username and password, verifies a **six-digit code**, and continues. After verification the system actually submits the event request, binds it to the verified account, and opens a **My Event Requests** dashboard. The organizer receives email and Squawk Box notices whenever the Hangar makes a meaningful change that they need to know about.

Do not create a second account system. Reuse `golf-account-auth` six-digit verification, existing Profiles/Passenger account, `event_requests.submitted_by_user_id`, `event_request_activity`, and existing Squawk recipient/message/email infrastructure.

## Flow and guardrails

1. Visitor fills out existing public inquiry form. Visiting a published public Event Hub or opening an inquiry form itself does NOT require sign-in.
2. Clicking Submit validates the completed form but **does not yet create a request**. Show a modal with **I Already Have an Account**, **Create an Account**, or **Back to My Request**.
3. If they have a verified matching session, skip the modal and finalize directly. Otherwise use the existing sign-in service. If account creation is needed, use `request_signup_code` and `verify_signup_code` from `golf-account-auth`, then sign in.
4. The **verified Supabase Auth user email must match the contact email** on the request. Someone signing in with a different email must return to correct the form or authenticate as the correct person. Never link by unverified form email alone.
5. Server resolves an active Hangar and saves `event_requests.submitted_by_user_id=authUser.id`, with a unique client request UUID for idempotent retries. The server sets `status=submitted`, never trusts user-supplied status or role.
6. After the backend confirms successful persistence, show a receipt and open **My Event Requests**. The requester sees ONLY their own requests.
7. A requester receives a limited view: status, proposed/confirmed dates, venue-facing package/response, contract/deposit statuses, hold deadlines, and a sanitized timestamped activity history. Internal venue notes, staff-only audit, Stripe identifiers, other requester records and org management data are excluded.
8. When Hangar staff meaningfully updates the request, append an immutable activity record and enqueue one requester notification, selecting Squawk in-app + email. Keep notification preference/opt-out, failed delivery, idempotency, and retry handling.
9. When an event is approved and converted to a Flight, link the Flight to this requester account and invite any required organizer Pilot/Co-Pilot roles through the normal role-grant workflow. Submitting an inquiry itself confers **no** Hangar admin or event-operator permission.

### Public versus private

- Public: view a published event Hub, open and fill out a public inquiry form, open an invitation link.
- Authentication-required: finalize an inquiry, view its status, exchange private messages, access Airport, manage a Flight, or use a Hangar/Cockpit/ATC workspace.
- Direct database APIs are independently protected from UI routing. This is particularly important because Live currently has broad `anon` database write grants that require a separate reviewed remediation.

## Dashboard (requester-facing)

**My Event Requests** shows sortable and searchable request rows:
- Venue / Hangar and request name
- Status and last updated time
- Requested date and proposed/confirmed date
- Any reply or next action needed
- Temporary hold expiration and deposit due date
- Contract status
- Link to associated Flight once created

Actions: view details, supply requested information, respond through Squawk, download contracts/proposals, visit Airport. **Never** show internal notes or other people's inquiries. A `passenger` account may be an Event Requester without an organization membership.

## Notifications: explicit cross-channel pipeline

Meaningful requester-facing changes include:
- Request received / acknowledgment
- Hangar asks a question (`needs_response`) or responds to the organizer
- Tentative dates/pricing or attendee capacity updated
- Venue places, extends or releases a hold
- Contract sent / signed / voided
- Deposit pending / paid / waived / refunded
- Event confirmed / declined / cancelled / expiration
- Change to venue-facing terms or important documents

Staff-only internal note edits must **not** generate requester notifications or leak text.

**Recommended architecture:**
- After the Hangar action succeeds, a durable DB outbox row (e.g. `event_request_notifications`) records `request_id`, `owner_user_id`, public change type, delivery channels, unique dedupe key, pending status, attempt count, and scheduled retry.
- Notification worker prepares a private Squawk thread/recipient for that requester and queues the email using the existing Resend connection and sender identity. The existing `send-squawk-email` Edge Function currently expects a **golf registration recipient**; it must be extended safely or a shared generic delivery adapter introduced, not reused incorrectly.
- A successful in-app Squawk is sent through normal Squawk recipient records (`recipient_type='user'`, `channel='in_app'`). The worker should not add the requester to Hangar private org threads or reveal staff messages.
- Each delivered or failed email has a traceable status. A retry must not duplicate Squawks or emails. Bounce/delivery errors should surface to Hangar staff.
- The event requester notification worker must be **DISABLED** in Sandbox, or use inert/fake provider adapters that cannot email genuine users.
- All outgoing links lead to a sign-in-protected request view. No sensitive content or access tokens in URLs.

An event status change made by any authorized tool must be captured. Existing `VenueConfirmationForm` directly updates `event_requests`; additional administrative flows could do the same. Before enabling automated delivery, implement a single audited update path or a carefully reviewed transactional database trigger to capture **all** meaningful changes and enqueue notifications. Do not rely only on a React callback that could be bypassed.

## Security and privileges

- Verify Supabase Auth user and `email_confirmed_at` server-side, not just in JavaScript.
- Require exact verified contact-email match for request ownership. A claimed or shared request must require an explicit re-verification/delegation workflow.
- Restrict each requester list/read query to `submitted_by_user_id=auth.uid()` server-side.
- Validate Hangar membership for staff actions and never grant it from public inquiry submission. No implicit Pilot role.
- Public forms must never have direct unrestricted `SELECT/INSERT/UPDATE/DELETE` rights to sensitive request tables.
- Preserve public request intake with a narrowly scoped server endpoint; separately replace or revoke dangerous anonymous privileges in Live only after compatible flows are tested and the owner authorizes a change.
- Protect endpoints from repeated submissions with UUID idempotency, trusted origin list, rate limits, input length checks, and abuse controls.
- Keep secrets on the server. Use the existing Supabase service role only in trusted Edge code, never in browser bundles.
- No production payments, email blasts, test accounts or data writes without explicit approval.

## Work completed in the protected development branch

- `src/lib/eventInquiryLifecycle.mjs`: request identity matching, validated allowlisted payload, requester-safe projection, and notification decision mapping.
- `src/components/EventInquiryAccountPrompt.jsx`: form-preserving sign-in or account creation with existing six-digit verification flow.
- `src/lib/eventInquiryPortalClient.mjs`: authenticated submission and requester read operations without direct anonymous table writes.
- `src/components/EventInquiryDashboard.jsx`: searchable/sortable requester dashboard, sanitized venue responses.
- `supabase/functions/event-inquiry-portal/index.ts`: **NOT DEPLOYED**; Sandbox-only, explicitly enabled backend supporting authenticated/verified `submit`, `list_mine`, `get_mine`; rejects unrelated orgs and is disabled by default. It does NOT send notifications or change staff actions.
- `src/PlatformApp.jsx`: existing public inquiry form wired to the new account prompt only when BOTH `VITE_EIE_INQUIRY_PORTAL_ENABLED=true` and `VITE_SANDBOX_WORKSPACE_ENABLED=true`. Default off, including Live. Old public submission behavior remains unchanged until safe migration.
- Unit and synthetic browser tests use fictional data only, no real Supabase writes or outgoing emails.

## What is NOT complete or live

- Sandbox deployment of the new Edge function, feature-specific preview environment variables, and end-to-end authenticated request insert/view validation.
- Full role-based requester RLS and event request activity view with policies.
- Durable server-side outbox, delivery worker, status/contract/deposit update hooks, and real Squawk + email delivery.
- Automated notification retries, bounce alerts, organizer response workflow, and conversion to Flight/Cockpit.
- Live anonymous-access remediation and production rollout. No production data, auth configuration or permissions have been changed.

## Staged release/test gates

1. **Architecture + unit/browser pilot:** validate form preservation, existing-account sign-in, new-account six-digit code, mismatched-email rejection, idempotent receipt, dashboard privacy and small-screen usability using fictional browser fixtures.
2. **Sandbox integration:** deploy Edge only to isolated Sandbox and enable explicit environment flags and allowed origins. Confirm the sandbox uses only test organizations and fictional users. Execute real create → save → logout → login → reopen with verified identity.
3. **Staff/notifications:** add auditing and reliable Squawk/email outbox (disabled real email in Sandbox); simulate every staff status transition and verify notification content, dedupe, retries and internal-note privacy.
4. **Security hardening:** separately audit/restrict all Live anonymous database permissions, compare rights of public/Passenger/ATC/Hangar roles, run regression tests against existing public event pages and registration flows.
5. **Owner preview & rollout:** report tests and email templates for approval. Only then consider owner-approved staged Live change with rollback path.

## Required acceptance tests

- Public visitor may view intake form without sign-in but clicking Submit opens the account prompt.
- Existing account sign-in preserves all completed fields; no duplicated record on retries.
- Newly created account needs no DOB or gender; six-digit code verification before creating or claiming a request.
- Wrong email cannot claim or read a request.
- Request only becomes **Submitted** after server save succeeds.
- Request owner receives exactly their own status timeline and no venue-private notes.
- Hangar staff status/terms changes appear in dashboard and reliably enqueue one email and one Squawk notification to the verified owner.
- Internal-only notes enqueue **zero** external notifications.
- Sandbox does not send real customer emails or payments.
- Live/sensitive anonymous API operations are denied after the separately approved hardening.
