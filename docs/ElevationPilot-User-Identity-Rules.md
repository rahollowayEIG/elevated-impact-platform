# ElevationPilot User & Identity Rules

**Status:** Approved working architecture  
**Owner:** Elevated Impact Group LLC (EIG)  
**Canonical use:** This document is the implementation reference for identity, accounts, profiles, invitations, roles, permissions, user management, duplicate resolution, history claiming, external account connections, and related user-facing functionality across ElevationPilot.

## 1. Core Identity

1. One real person should ultimately have one ElevationPilot identity.
2. Every person receives an immutable internal `person_id`. It never changes and is never based on email, username, organization, role, or app.
3. Every EIG application references the same `person_id` rather than creating its own user identity.
4. A person's identity can have many roles, organization memberships, event relationships, registrations, tickets, purchases, volunteer activities, and app relationships.
5. A person can appear in imported, invited, or historical activity before claiming an ElevationPilot account.
6. Interactive authenticated use of ElevationPilot requires a claimed account with a verified email address.
7. A login belongs to the person, not to a company, Hangar, event, or individual application.
8. One person has one Squawk Box identity across ElevationPilot.

## 1A. Test Data and Sandbox Architecture

ElevationPilot distinguishes test data from real customer data explicitly rather than inferring it from names, email addresses, inactivity, or other heuristics.

1. A **Test Account** is explicitly marked by an authorized EIG administrator and is eligible for the protected test-account cleanup workflow.
2. A real person who participates in or helps test a Draft/Test event is not automatically classified as a test account.
3. **Test Organizations** and **Draft/Test Events** are independent statuses and do not automatically convert associated people into test identities.
4. Test status must be visible in administrative views and must never silently mix test data with production data.
5. Permanent removal is reserved for explicitly identified test accounts/test data and requires an auditable confirmation step.
6. Test-account cleanup must not be used as a shortcut for legitimate account closure, identity merging, or removal of historical business records.
7. ElevationPilot should support a future **isolated Sandbox** for whole-system demonstrations, onboarding, development, and safe testing.
8. A Sandbox should be separated from production data while using the real ElevationPilot workflows and realistic demo records.
9. A future Sandbox may provision a demo organization/Hangar, Pilot, Co-Pilot, ATC/Crew, Passenger accounts, events, registrations, sponsors, vendors, Squawk conversations, stores, and reports.
10. Sandbox data should support a controlled reset/retirement process.
11. Sandbox-to-Production should be a deliberate provisioning process, not a bulk copy of demo records into production.
12. Sandbox architecture should preserve the same identity, role, permission, privacy, and audit principles as production while preventing sandbox records from becoming production records accidentally.

## 2. Identity Fields

The permanent identity hierarchy is:

- **Permanent Person ID**: invisible, immutable, used by every app and relationship.
- **Verified Email**: required for account access, verification, and recovery.
- **Username**: unique public/social handle used by Squawk Box, AirSpace, mentions, search, and profile links.
- **Display Name**: flexible human-facing name used throughout the interface.

Changing email, username, or display name must not break history or relationships.

## 3. Username Rules

1. Usernames are globally unique across ElevationPilot and compared case-insensitively.
2. Usernames are separate from email addresses.
3. Default target length is 3-30 characters.
4. Supported characters are lowercase letters, numbers, periods, underscores, and hyphens.
5. Spaces are not allowed.
6. Email addresses cannot be used as usernames.
7. EIG may reserve system, brand, security, and administrative names.
8. Users may change usernames under platform policy.
9. Username history is retained so old mentions and links can continue resolving to the same `person_id`.
10. Old usernames are not immediately released for reuse.
11. The exact rename cooldown/frequency remains a configurable policy decision.

## 4. Search, Claim, and Duplicate Prevention

1. **Search before create.**
2. **Claim before duplicate.**
3. Name alone is never sufficient evidence to merge identities.
4. Possible matches may use verified email, verified phone, name, organization/event context, and other appropriate signals.
5. ElevationPilot should prefer user confirmation over administrator guessing.
6. When likely historical activity is found, the user may receive a secure prompt asking whether the activity belongs to them.
7. The user can confirm the activity, reject it, or leave it unresolved.
8. A rejected match is recorded so the user is not repeatedly asked about the same item.
9. Weak or ambiguous matches go to EIG Identity Review rather than being merged automatically.

## 5. Claiming History vs. Merging Accounts

1. Claiming an activity and merging two login accounts are different operations.
2. A registration, ticket, volunteer record, purchase, or other activity can be linked to the correct `person_id` without merging login accounts.
3. Activity remains in the application that owns it. Registration stays Registration data, Ticketing stays Ticketing data, and so on.
4. User Management provides the shared identity and relationship layer across those applications.
5. If two real login accounts belong to the same person, ElevationPilot may offer a user-confirmed account merge.
6. The user confirms ownership of both accounts.
7. The user chooses the surviving account/login path and sets the password they want to use going forward.
8. Related history is re-linked to the surviving `person_id` in the systems where that history belongs.
9. Account merges, history claims, and re-links are fully audited.
10. Merge operations must be designed for recovery/undo.

## 6. Invitations and Unclaimed People

1. An unclaimed person/activity record is not the same as an active ElevationPilot account.
2. Captains, Pilots, ATC, imports, and other workflows may create invited or unclaimed activity using an email address.
3. ElevationPilot should strongly encourage invitees to claim their identity.
4. Unclaimed records may remain valid operational records, but authenticated functionality requires account claim and verification.
5. Claiming should unlock obvious value such as Airport access, registrations, tickets, payments, team tools, Squawk Box, history, profiles, and future AirSpace functionality.
6. Invitations should reuse an existing identity whenever a match is confirmed instead of creating a duplicate.
7. Invitation lifecycle should remain visible and auditable.

## 7. Account and Membership States

Account state, profile completeness, organization membership, role assignment, event relationship, registration state, roster state, and payment state must remain separate concepts.

A consistent account vocabulary should include concepts such as:

- Invited
- Unverified
- Active
- Disabled
- Locked
- Archived
- Merged

Membership/event vocabularies are separate and should be standardized independently.

## 8. Administrative Boundaries

### EIG Admin

- Has platform-wide administrative authority.
- Can manage accounts, identities, roles, memberships, invitations, recovery actions, and identity review.
- Must not impersonate a user or operate inside that person's Airport as the user.
- Never sees or chooses the user's password.

### Pilot

- Manages basic user administration inside the Pilot's own Hangar.
- May see members, new users, invited/unclaimed people, permitted account states, and authorized roles.
- May initiate password-reset/recovery flows.
- Cannot see or set a user's password.

### Co-Pilot

- May receive the same Hangar-level people/access capabilities when the Pilot explicitly delegates them.
- Delegation must be permission-based and auditable.

### ATC

- May see people and identity status needed for an assigned event.
- Cannot modify the person's master ElevationPilot identity or account.
- Event operations remain separate from platform account administration.

## 9. Roles and Permissions

1. Roles are contextual, not permanent labels attached globally to a person.
2. The same person may be EIG Admin, Pilot for one organization, ATC for one event, vendor representative elsewhere, and Passenger in another event.
3. Roles are access grants, not just labels.
4. Permissions define what the person may actually do.
5. Every role assignment must have an explicit scope, such as platform, Hangar, event, app, or other approved context.
6. Every role assignment must record the exact date and time it became effective.
7. Role history should preserve `assigned_at`, `assigned_by`, and, when applicable, `removed_at` / `revoked_at` and `removed_by` / `revoked_by`.
8. Role and permission timestamps should be stored as timezone-aware timestamps (UTC in the database) and displayed in the viewer's appropriate local time.
9. Roles may support scheduled start and end date/time for temporary access.
10. Sensitive or high-level role changes may require a reason/comment.
11. No privilege increase should happen silently; elevated access creates an auditable event.
12. Delegation is limited by authority. A Pilot or Co-Pilot may only assign roles/permissions they are authorized to delegate.
13. High-level roles such as EIG Admin, ownership-level, or finance-sensitive access may require an additional approval/confirmation step.
14. Removing a role never erases the historical fact that the person held it.
15. Current access is determined by active role assignments; historical assignments remain available for audit and reporting.
16. Role and permission changes are independently auditable and should be reversible where practical.
17. Adding profile information never grants operational permission.

## 10. Profiles, Privacy, and Visibility

1. Every claimed account receives a reusable Basic Profile.
2. Additional profile areas may be added progressively, such as Golf, Work & Skills, Volunteer, and Event Preferences.
3. Each profile area has independent completeness and visibility controls.
4. Information may be private, event-specific, connection-only, or public.
5. Verified internally does not mean public externally.
6. AirSpace publication is opt-in and field-specific.
7. Public/profile visibility may be removed even when EIG must retain underlying operational records.

## 11. Account Closure and Retention

1. Full deletion is heavily discouraged where records are tied to legitimate business operations or required retention.
2. The preferred user-facing action is **Close Account** or **Deactivate Account**.
3. EIG will be transparent that some records may need to be retained under applicable law, contractual obligations, financial/business recordkeeping, fraud prevention, or other legitimate requirements.
4. Formal retention periods and legal wording are maintained in a separate approved retention/privacy policy.
5. Closing an account may disable login, public visibility, AirSpace presence, messaging availability, and other user-facing access while preserving records that must remain.
6. Closure and reactivation are audited.

## 12. External Connections

1. ElevationPilot may link a user's identity to accounts in outside systems.
2. Linking an external account does not mean copying that system's data into ElevationPilot.
3. Outside systems remain the source of truth for their own data unless EIG explicitly defines otherwise for a specific feature.
4. Connections support three conceptual modes:
   - **Link only**
   - **Import selected data**
   - **Ongoing sync**
5. The user chooses the level of connection where supported.
6. Only outside data that creates real ElevationPilot value should be imported or synchronized.
7. Importing/syncing should be field-selective rather than collecting everything an API exposes.
8. Useful examples may include golf handicap, selected rounds, home course, or other data that directly improves ElevationPilot functionality.
9. Imported or synchronized information should retain source/provenance and update context.
10. External connection metadata should use the permanent `person_id` and a provider/external-account mapping.
11. External systems should never blindly create a new ElevationPilot person when an identity may already exist.

## 13. Progressive Permissions and User-Controlled Enrichment

1. Ask for the minimum information and permissions needed at the time.
2. Ask for more only when a new feature provides a clear reason.
3. **Value before permission.**
4. Every enrichment request should make clear:
   - what ElevationPilot is asking for,
   - why it helps the user,
   - and whether the user can change the choice later.
5. Profile enrichment is progressive rather than a giant mandatory onboarding form.
6. Users choose which optional outside connections and profile modules they want to activate.
7. As ElevationPilot functionality expands, it may ask for additional information or permissions relevant to that new functionality.

## 14. Advantage Connections

**Advantage Connections** is a permanent block on the user's main Airport/account page.

Its purpose is to show connections or actions that make the account more valuable, not to act as ordinary Account Settings.

Potential cards include:

- Claim Your History
- Connect a Golf Account
- Complete Your Golf Profile
- Verify Mobile
- Add Work & Skills
- Connect Calendar
- Future app/provider connections

Rules:

1. Advantage Connections is dynamic to the user and their roles/interests.
2. It should surface useful next actions rather than a generic checklist.
3. Account Settings remains focused on security, password/recovery, privacy, notifications, and account mechanics.
4. Advantage Connections focuses on increasing utility, history, identity richness, and optional functionality.

## 15. Long-Term Platform Direction

ElevationPilot is intended to be an identity-centered, activity-rich, integration-ready functional social platform.

The platform should:

- make a user's identity more valuable as they use more EIG functionality,
- let users build and claim a portable history of real participation inside ElevationPilot,
- use confirmed relationships and history to improve trust and reduce fake/duplicate identities,
- keep private operational data separate from what a user chooses to publish,
- connect social/discovery features to real functionality,
- and become cleaner over time through identity resolution rather than accumulating duplicate users.

## 16. Implementation Guardrails

Before implementing or modifying identity-related functionality:

1. Reuse the canonical `person_id`.
2. Do not create app-specific user identities when the shared identity can be used.
3. Search for an existing identity before creating a new one.
4. Keep activity in the owning application and link it to the person.
5. Preserve contextual roles and scoped permissions.
6. Preserve auditability and recovery for sensitive identity changes.
7. Do not impersonate users.
8. Do not expose or administratively choose user passwords.
9. Preserve explicit privacy/visibility boundaries.
10. Do not automatically import outside data beyond the user's selected connection mode.
11. If a requested implementation conflicts with this document, stop and resolve the architecture decision before coding.

## 17. Open Decisions

The following remain intentionally open until separately approved:

- exact username rename cooldown/frequency,
- exact confidence thresholds for automated user-match prompts vs. EIG Identity Review,
- final account/membership status vocabulary and UI labels,
- detailed retention periods and legal/privacy wording,
- provider-specific import/sync rules for future external integrations.
