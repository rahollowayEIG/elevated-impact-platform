# ElevationPilot account invitations

Last updated: 2026-09-26

## Purpose

One permanent ElevationPilot account can hold different permissions in different contexts.

- EIG Admin: platform-level EIG access
- Pilot: Hangar administrator
- Co-Pilot: Hangar staff
- ATC: manager for one assigned event
- Crew: narrower event staff
- Passenger: participant identity

Email is the verified account/recovery address. `profiles.username` is the user's public ElevationPilot `@username`.

## Sign-in

The shared login screen accepts either email or `@username` plus password.

The frontend calls the existing `golf-account-auth` Edge Function. Username lookup happens server-side, so the user's email is not disclosed by the username login flow.

Username rules:

- 3 to 30 characters
- lowercase after normalization
- letters, numbers, dots, dashes, and underscores
- case-insensitive uniqueness
- reserved ElevationPilot/system names are rejected

## Invitation flow

1. An authorized EIG Admin or Pilot enters name, email, and role in ElevationPilot.
2. `platform-invite` verifies the inviter's current server-side role.
3. A pending `platform_invitations` row is created or refreshed.
4. The Edge Function generates a Supabase Auth invite link for a new account or a magic link for an existing account.
5. Resend delivers the branded ElevationPilot invitation.
6. The recipient follows the secure auth link.
7. ElevationPilot checks pending invitations for the verified account email.
8. A new account chooses an `@username` and password. Existing users keep their account and may keep their current password.
9. `platform-invite` validates the invitation again and activates the assigned membership or event assignment.
10. The user lands in Airport. Cockpit or ATC access appears from the activated role.

A pending invitation expires after 14 days.

## Grant rules

- EIG Admin can grant EIG Admin, Pilot, Co-Pilot, ATC, or Crew access.
- Pilot can grant Co-Pilot, ATC, or Crew inside that Pilot's own Hangar.
- Pilot cannot create another Pilot.
- ATC and Crew invitations require a specific event.
- EIG Admin invitations must attach to the EIG Command Center.
- Accepting a lower role never intentionally downgrades an already-higher active role.
- EIG Admin acceptance also sets the internal platform profile role to `super_admin` and creates the EIG `eig_admin` membership.

## Security

- Service-role credentials are used only inside Edge Functions.
- Invite authorization is recalculated server-side on every send.
- Invite acceptance requires the authenticated user's confirmed email to match the invitation email.
- Client-provided role claims are never trusted for authorization.
- Passwords are set with Supabase Auth and are not stored in application tables.
- Direct access to `platform_invitations` is blocked for `anon` and `authenticated`; the Edge Function is the access boundary.
- Existing profile role protection remains in place.
- Username uniqueness is enforced in Postgres as well as checked in the UI.
- Invitation action links are one-time Supabase Auth links and should be treated as secrets.

## Source files

- `src/App.jsx`
- `src/styles.css`
- `supabase/functions/platform-invite/index.ts`
- `supabase/functions/golf-account-auth/index.ts`

## Database changes currently applied

The live EIG Supabase project contains:

- `public.platform_invitations`
- RLS enabled on `platform_invitations`
- no direct anon/authenticated table privileges
- username normalization/reserved-name trigger
- existing case-insensitive unique username index retained

The live schema changes still need to be captured into repository migration history using the Supabase CLI workflow (`supabase db pull <descriptive-name> --local --yes`) when the repo's migration workflow is formalized. Do not invent a migration filename manually.

## QA before production merge

- existing email/password sign-in
- existing username/password sign-in
- invalid username/password returns generic error
- EIG Admin sends a test EIG Admin invite
- new recipient follows invite, chooses username/password, accepts role, lands in Airport
- Pilot sends a Co-Pilot invite
- Pilot sends an ATC invite for a specific event
- assigned ATC lands directly in that event's ATC Center from Airport
- Pilot cannot grant Pilot or EIG Admin
- duplicate username is rejected
- reserved username is rejected
- existing-account invite adds access without creating a duplicate auth user
- Copy Invite Link works
- expired invitation is rejected


## Timed role access

ElevationPilot treats the account as permanent and the role as an assignment layered on top.

- Passenger identity remains permanent.
- Co-Pilot, Pilot, ATC, and Crew assignments can carry `access_starts_at` and `access_ends_at`.
- A blank `access_ends_at` means indefinite access.
- ATC/Crew invite default is immediate access through seven days after the event.
- Pilots can edit accepted Co-Pilot, ATC, and Crew access dates later without issuing a new invitation.
- When an event-role window expires, the elevated permission stops automatically. The person's Passenger identity remains intact.
- Invite expiration is separate from role-access expiration. Secure invitation links currently expire after 14 days.
- Existing accounts accept the role on the same `@username`; new accounts complete username/password onboarding first.
- Existing higher roles are preserved when a lower role invite is accepted.

### Access enforcement

Access-window checks are enforced in database authorization helpers/RLS and in server Edge Functions that use service-role authorization. Frontend Airport/Hangar loaders also filter inactive windows so expired roles do not continue to appear as active workspaces.

### Source-control note

The live database schema now contains the access-window columns and updated authorization definitions. Before production merge, capture the live schema delta into the repository's formal Supabase migration history using the approved Supabase CLI `db pull` workflow. Do not treat this document as the migration itself.
