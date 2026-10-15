# EIG Platform Intelligence Blueprint: Role and Communication Contract
Version: 0.1 DRAFT | 2026-10-15 | Owner approval required

## Guiding rule
Every app, extension, user journey and state change must define its **role-based permissions and communications** before it can be marked functionally complete. Do not leave email, Squawk Box notifications, reminders, error alerts, receipts or follow-ups to a post-launch patch.

## Roles
Canonical identities and memberships remain with ElevationPilot's Organization/Hangar identity and entitlement model. A user may hold multiple roles with different scopes; authorizations must be evaluated for the specific action, event and Hangar, not assumed from a label.

Initial roles to model and verify:
- EIG owner / Command Center administrator: platform-wide governed oversight; Build Lab itself remains owner-account-only unless policy changes.
- EIG operational staff: explicitly assigned operational duties, no blanket Build Lab access.
- Pilot: primary Hangar/organization controller, subject to entitlements.
- Co-Pilot: delegated organization assistant; delegated permissions must be defined, not assumed equal to Pilot.
- ATC: event-level coordinator with event-scoped privileges.
- Passenger / participant: self-service account, own registration, assigned team and scoped event interactions.
- Team captain: participant with authorized team-management/invitation functions.
- Teammate: participant with own slot and own information controls.
- Event organizer, sponsor, vendor, volunteer, merchant, buyer/payer, accountant or other specialist: define contextual permissions separately; these are not necessarily permanent global identity roles.
- Unauthenticated public visitor: only specifically published public resources.

## Every feature must document
1. Role and context permission matrix for view, create, edit, approve, message, export, cancel, refund, manage users and administer settings.
2. State-machine and lifecycle covering success, partial completion, changes, cancellation, rejection, expiration, withdrawal, refund and failure.
3. Communications matrix: event/trigger, intended recipient role(s), who must NOT receive it, to/CC/BCC rules, timing, channel (transactional email, Squawk Box DM, announcement/in-app, push/SMS later, or none), required message fields/template, linked action and correct destination, sending service, delivery status, retry and escalation.
4. Notification preferences: required transactional messages versus optional/marketing notices; consent, opt-outs, jurisdictional rules, accessibility and translations as applicable.
5. Identity/address handling: verified email and member identity, cross-role deduplication, no exposed group recipient lists, protected message scopes, no auth tokens in URLs, no private participant data in public notifications.
6. Operational wiring: verified sending domains and from/reply-to routing, branded subject/preheader/footer, support contact, per-app/event notification defaults, resend controls, delivery audit records, bounce/error handling, owner of failures, idempotency and throttling.
7. Acceptance tests: verify recipients and nonrecipients for every role, no duplicate messages on retries, correct links, changed permissions, multi-role users, first-time registrants, expired invitations, bounced emails, changed or cancelled events, payment/refund transitions, delivery failures, mobile formatting.
8. Evidence of implementation: code and test links, sender/provider configuration confirmation, template version and last verified deployment. Never label a planned integration live without proof.

## Illustrative EIE registration communications (requirements to approve, not statements of completed wiring)
- Captain registers a team: confirmation to captain; invitations to named teammates, never to arbitrary participants; coordinator receives only intended operations notification.
- Teammate claim/replace/withdraw: notify directly affected person and captain as approved; keep roster updates scoped to correct team and event.
- Email delivery bounce on invite: alert captain and/or ATC based on configured event policy with correction/resend path.
- Payment submitted, due, failed, refunded or overdue: receipt to actual payer, outstanding balance to responsible payers, operational status only to authorized staff. No card/payment secrets by email.
- Hub announcement: notify event participants in the authorized audience, with optional direct Squawk and email policy, unsubscribe boundaries and deduplication.
- Contracts, sponsorships and vendors: role-appropriate document requests, signature/status notifications, reminders and escalation without exposing other organizations.

## Build Lab review gate
When analyzing or generating a feature, Build Lab must flag missing role mapping, permissions, notification triggers, recipients, templates, provider wiring, audit logs and failure tests as **incomplete**, even if the UI/code path works. Produce draft acceptance tests and request owner decisions where routing is ambiguous. Its agent may suggest mappings but cannot autonomously grant privileges, message real customers or send billable communications.

## Platform architecture references
- EIG-Build-Lab-Project-Architect.md
- EIG-Build-Lab-Continuous-Improvement-Agent.md
- Universal-Scan-Engine-Architecture.md
- ElevationPilot-User-Identity-Rules.md

This draft does not make code, migration, deployment, scheduled job, mail-provider or permission changes.
