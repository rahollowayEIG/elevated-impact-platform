# ElevationPilot Mini Practice Packs

**Status, October 2026:** Six **small fictional sample-data packages** have been prepared. They can be validated and previewed offline. They are **not imported to Supabase or connected to a Load Example button yet**. No live event, customer, transaction or advertisement data has been copied.

## Purpose

- EIG builders can repeatedly exercise one tiny scenario when testing an application.
- Future business users can start from an **empty workspace** and optionally load one miniature example for hands-on training.
- User-created practice work should be saved between sessions, until its owner explicitly requests removal or reset.
- No copy from Live is necessary for basic practice.

## Initial sample packages

| Pack | Contents | Exercise |
| --- | --- | --- |
| Event Builder | 1 draft event | Build and edit a fictional outing |
| Golf Registration | 1 draft golf event, 4 fictional golfers | Manage one team |
| Advertising Studio | 1 ad creative, 1 unpublished campaign | Preview and edit an ad |
| Sponsors | 1 draft event, 1 package, 1 fictional sponsor | Practice sponsorship |
| Coupons | 1 draft coupon offer | Preview offer terms |
| Vendors | 1 fictional vendor, 1 draft service | Edit a sample product |

**Total: 14 logical records**, split into six independently selectable packs. Every email is on a reserved .example domain, every outbound/public/payment setting is disabled, and the data stays fictional. The amounts are illustrations, never real charges.

## Files and verification

The catalog is at sandbox/practice-packs/catalog.json and each pack lives in a JSON file beside it. The pure validator is src/sandbox/practicePacks.mjs.

To validate all packages (no Supabase connection):

    node --test tests/sandbox-practice-packs.test.mjs

To list the packages and their sizes (read-only, no import):

    node scripts/sandbox/preview-practice-packs.mjs

To preview one:

    node scripts/sandbox/preview-practice-packs.mjs golf-foursome-starter

The catalog and previews are data definitions only, not a working import button.

## Requirements before enabling Load Example in the pink sandbox

1. Verify **server-side** that the destination project is the isolated sandbox Supabase project and that the tester has an authorized sandbox session and current role. Pink styling or a front-end role dropdown alone do not authorize writes.
2. Translate each logical record kind into supported table/extension writes using its actual module adapter. Do not write arbitrary JSON into production tables, or enable broad legacy table grants to make a pack work.
3. Let the tester choose one pack and view a short preview of the number and type of records. **Do not load anything automatically**.
4. Insert all pack records transactionally into the tester's own practice workspace, assign sandbox-only IDs, and use an idempotency key of tester workspace + pack ID + version + logical record key.
5. Track the IDs created by that import in a **practice-pack ledger**. The removal control must delete only those exact practice records and reverse their dependencies safely. Never clear other testers' practice projects or base security fixtures.
6. A separate Reset My Practice Workspace action clears only the signed-in tester's created practice entities, after explicit confirmation. Changes on production must remain impossible.
7. Keep all outgoing email/SMS, payment, voucher redemption, TV scheduling, publishing, file uploads, and webhook delivery disabled or routed to controlled sandbox-only testing systems. No real customer messages.
8. Reject new data kinds and changed database schemas until adapters and permissions are reviewed. Add further packs for Ticketing, Contracts, Store/Registry, Live Scoring and other extensions only when those app flows become sandbox-ready.

## Implementation boundary

The sandbox still needs secure tester login reuse, true role permissions, selective client access, integration quarantine, and a sandbox-only loader service. This branch contributes small reproducible **sample packages and safety validation**, not those backend/UI features.

Keep the sandbox empty by default. No real customer records, identity credentials, or Live data import.
