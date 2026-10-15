# ElevationPilot Repository Implementation Rules

Before making changes that affect users, authentication, profiles, invitations, organizations, memberships, roles, permissions, registration identity, Squawk Box identity, AirSpace identity, account recovery, duplicate resolution, history claiming, or external account connections, read:

- `docs/ElevationPilot-User-Identity-Rules.md`

Treat that document as the canonical identity and user-management architecture for this repository.

Implementation requirements:

- Use the shared permanent person identity rather than app-specific duplicate users.
- Preserve contextual roles and scoped permissions.
- Search/claim before creating a new identity.
- Keep application activity in its owning domain and link it to the canonical person.
- Preserve auditability, privacy boundaries, and recovery for sensitive identity changes.
- Never implement administrator password visibility or user impersonation.
- If a proposed change conflicts with the canonical rules, do not silently work around them. Surface the conflict and resolve the architecture decision first.

The broader ElevationPilot HQ architecture remains authoritative for platform structure. This repository rule exists to make the user/identity decisions difficult to accidentally bypass during implementation.

## List and table interaction rules

Before creating or materially revising a roster, directory, table, or other record list, read:

- `docs/ElevationPilot-List-Interaction-Rules.md`

Treat those rules as the platform default for list usability.

Implementation requirements:

- Add search when users may reasonably need to locate a record in a meaningful collection.
- Make sensible field or column headings clickable for stable ascending/descending sorting.
- Search, filters, tabs, sorting, and bulk-selection behavior must work together coherently.
- Do not expose unauthorized or hidden data through search.
- Do not make action columns or fields without meaningful ordering sortable.
- If search or sorting is intentionally omitted, the workflow should provide an obvious reason rather than relying on accidental inconsistency.

## Paid upgrade sponsorship reminder

Before creating or changing paid upgrade flows, read:

- `docs/EIG-Paid-Upgrade-Sponsorship-Rule.md`

Every paid upgrade review must include Ella, Marshal, and Maverick's sponsorship reminder and an event-scoped action to get sponsorship help, with the upgrade price visible before purchase.

## InceptionApex shared creative app

Before adding creative tooling or routing artwork between apps, read:

- `docs/InceptionApex-App-Architecture.md`

InceptionApex is the shared creative app. Event Builder tools are an entry point into its design workflow. Reuse saved designs and contextual event/product facts across connected apps, and preserve EIC's ownership of purchases and orders.

## Google Drive organization

Before adding Drive folder creation, exports or sync writers, read `docs/ElevationPilot-Drive-Folder-Rules.md`. Resolve the authorized Hangar first and use stable folder mappings. Event files belong under their owning Hangar and event. Do not claim existing Drive organization is complete until legacy writers and folder parents have been verified.


## EIG Build Lab owner-only pilot

Before changing Project Architect, app/functionality scanners, UI inspector, build assistants or Build Lab endpoints, read docs/EIG-Build-Lab-Project-Architect.md and the shared identity rules.

**Owner decision (October 15, 2026):** Build Lab is exclusive to the single explicitly configured EIG owner account, **not** all EIG admins, Pilots, Co-Pilots, or customers. Do not broaden this simply because another feature is customer-facing.

- Every new server endpoint, background job, storage rule, AI/provider request, document scan, project-save action, implementation assistant or export of private Build Lab data must enforce an exact configured owner Auth UID, verified active session, current EIG admin membership and appropriate source permissions. Never rely on a frontend flag, hidden button, mutable email/display name, user-supplied UUID or local role boolean.
- Keep the server and browser Build Lab flags disabled by default; a missing owner-ID configuration must **fail closed** rather than permitting all administrators.
- The current draft access function is supabase/functions/eig-build-lab-access; its return value only authorizes showing a private pilot panel. Do not mistake a prior allowed status as sufficient for privileged actions later.
- Reuse permanent person identity and canonical Hangar boundaries elsewhere; owner-login changes must undergo deliberate re-verification. Future customer editions or staff access require a separate explicit owner policy decision and server-side access redesign.
- Do not deploy the draft, configure production secrets, or run migrations without an approved, isolated rollout and the owner's launch authorization.
