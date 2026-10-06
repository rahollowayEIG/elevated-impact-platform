# InceptionApex implementation and setup

InceptionApex is a simple creative app inside ElevationPilot. This draft adds its dashboard and shared design workspace while preserving the existing authenticated person, organization and event context. It is not yet merged or enabled in production.

## Implemented

- App entry from the platform header, organization apps area, Event Builder and `#inception-apex`; event launches preselect the authorized event and return to their original platform view.
- Starter formats for flyers, invitations, sponsor signs, banners, swag artwork, book covers and digital displays. Maps and venue layouts reuse the event packet planner. Swag is artwork only; books are covers only in this release.
- Editable text, template layouts, colors and typography; raster background upload; separate draggable/resizable logos and photos. Exact event facts remain editable text, not baked into AI-generated artwork.
- Personal or event-linked projects, search/filter/sort, favorites, private saves, reopen, compare-and-swap version checks, unsaved-change guards and JSON backup/import. Imports create a new personal project rather than inheriting another event's access context.
- Saved approval of a specific version; immutable revision history; approved artwork snapshots in an authorized event packet. Further edits clear approval. Packet attachment preserves existing maps, layouts and itinerary and causes stale packet saves to fail.
- SVG artwork, exact-facts creative briefs and contextual draft production-request exports. No purchase, payment or order is submitted by downloading a request.

## Database and access

Apply migrations in this order to an isolated staging database:

1. `20261006022154_event_builder_booking_and_packet.sql`
2. `20261006185600_inception_apex_projects.sql`

The first migration includes booking and event-policy changes; follow its separate release audit before production. Both migrations remain unapplied to the live project as of this draft.

InceptionApex stores projects in `inception_projects` and revision snapshots in `inception_project_versions`. RLS denies anonymous access and direct writes. Authorized RPCs require a current active platform session. Personal projects belong to their existing owner identity. Event projects require current event-management authority, even for their creator; losing that authority removes access. No extra user accounts are created.

The app only fetches design metadata for its recent-project list, then loads artwork when opened. A missing migration produces a setup-pending message and permits a project backup. Verify saved-project reopen, revocation and packet attachment against staging before enabling live saves.

## Integration setup still needed

| Connection | Current boundary | Required next setup |
| --- | --- | --- |
| OpenAI | Downloadable creative brief and artwork upload; no model calls | Server-only API credentials, authorized generation jobs, output storage, usage limits, billing rules and revision history; verify a real generation/edit round trip |
| Adobe / Canva | Connection-pending status | Confirm supported developer API operations and account licensing, authorized connection flow and export/import behavior; ChatGPT app connections do not grant this website API access |
| EIC / fulfillment | Approved SVG and versioned draft production request | Catalog product and imprint specifications, real prices, proof approval, cart/order API and order status |
| Squawk Box | Project/version identifiers available for future messages | Authorized project conversation and proof-review links |
| Paid upgrades | Repository rule recorded; no new paid checkout in this draft | Show the actual incremental cost with Ella, Marshal and Maverick's required reminder and the event-scoped sponsorship action at every paid upgrade review |

Keep provider credentials server-side. Do not use `VITE_*` variables for secrets. AI generation should preserve verified wording and logos as editable layers, and never invent operational geography or measurements. Do not label generation, product previews or ordering as connected until their live round trips are verified.

## Verification

`npm run test:inception-apex` executes both SQL migrations in PGlite and tests private ownership, anonymous/direct-write denial, active-session/event-authority checks, immutable event context, revision history, approval, stale saves and packet attachment. It also checks format dimensions, image sanitization, SVG escaping, draft labeling, handoff requirements and list behavior.

`npm run test:inception-apex-browser` uses the real React components with synthetic local storage. It exercises desktop/mobile layout, logo upload and movement, details editing, save/reopen, favorites/search/sorting, versioned approval, packet attachment, production-request download, conflict recovery and backup. Screenshots are generated under `test-results/inception-apex/` and are not committed. `CHROME_PATH` can point to an installed headless browser.

The Event Builder browser suite checks that the reused editor and packet changes preserve existing planning workflows. `npm run build` runs both new database/unit suites, existing regressions and the production build. These checks do not assert live provider connectivity or production database migration.
