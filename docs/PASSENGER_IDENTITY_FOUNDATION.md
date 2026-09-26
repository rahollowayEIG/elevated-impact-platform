# ElevationPilot Passenger Identity Foundation

## Purpose

ElevationPilot treats a person as a permanent Passenger identity and treats registrations, teams, results, awards, and Squawks as records attached to that person over time.

A Passenger does not need to create a login account before participating in an event.

## Core model

- `passengers`
  - Permanent person record.
  - Can exist as `unclaimed` before an ElevationPilot login exists.
  - Can later link to one Supabase Auth user through `auth_user_id`.
  - Stores stable profile data such as preferred name, date of birth, gender, and GHIN.

- `passenger_contacts`
  - Supports multiple email addresses and phone numbers.
  - Keeps normalized values for duplicate detection.
  - Tracks primary, verified, active/former, label, and source.

- `passenger_name_aliases`
  - Supports registration names, preferred names, nicknames, former names, and other aliases.
  - Name alone must never be used to automatically merge people.

- `passenger_event_results`
  - Permanent event results/history attached to the Passenger.
  - Supports division, flight, scores, finish, labels, source, and extensible result JSON.
  - Foundation for annual awards, achievements, standings, and Tournament of Champions qualification.

## Existing registration compatibility

`golf_registrations.passenger_id` and `golfers.passenger_id` are nullable.

This means existing registration behavior continues to work while EIE is gradually updated to attach registrations to Passenger identities.

## Account / claim model

1. A captain or event registration can create participant data without forcing account creation.
2. An unclaimed Passenger can retain event history and teammate relationships.
3. ElevationPilot can invite that person by email or phone to create an account.
4. When identity is verified, the existing Passenger record is linked to the Auth user rather than creating a new permanent person.
5. Possible historical duplicates should be confirmed by the person through a Claim History / Squawk flow before merging.

## Registration UX principle

For the first outings, do not require a full profile to play.

Collect the minimum fields the event needs. Contact information gives ElevationPilot a path to invite the Passenger to complete their account/profile later.

DOB and gender are intentionally part of the permanent Passenger record because golf events may use them for tee assignment and competition setup.

## Privacy / security

- Passenger tables use RLS.
- A Passenger can access their own permanent identity after account claim.
- Authorized EIG / organization event managers can access Passenger data only through event relationships.
- Alternate emails and phones remain private identity/contact data, not public profile fields by default.
- Duplicate matching should suggest possible matches, not merge automatically on weak evidence.

## Next implementation steps

1. Wire new/self registrations to create or link a Passenger.
2. Wire captain-entered teammates to unclaimed Passengers without requiring accounts.
3. Send account-claim invitations after registration.
4. Add profile completion prompts for DOB, gender, GHIN, preferred name, email, and phone.
5. Add Claim History confirmation via Squawk.
6. Add teammate history and reusable My Teammates.
7. Add Results import/copy workflow and attach results to Passenger history.
