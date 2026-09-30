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
