# InceptionApex implementation and setup

InceptionApex is a simple creative app inside ElevationPilot. This release adds its dashboard and shared design workspace while preserving the existing authenticated person, organization and event context. The October 7 creative release is separated from the draft booking workflow.

## Implemented

- App entry from the platform header, organization apps area, Event Builder and `#inception-apex`; event launches preselect the authorized event and return to their original platform view.
- Starter formats for flyers, invitations, sponsor signs, banners, swag artwork, book covers and digital displays. Maps and venue layouts reuse the event packet planner. Swag is artwork only; books are covers only in this release.
- Editable text, template layouts, colors and typography; raster background upload; separate draggable/resizable logos and photos. Exact event facts remain editable text, not baked into AI-generated artwork.
- Personal or event-linked projects, search/filter/sort, favorites, private saves, reopen, compare-and-swap version checks, unsaved-change guards and JSON backup/import. Imports create a new personal project rather than inheriting another event's access context.
- Saved approval of a specific version; immutable revision history; approved artwork snapshots in an authorized event packet. Further edits clear approval. Packet attachment preserves existing maps, layouts and itinerary and causes stale packet saves to fail.
- SVG artwork, exact-facts creative briefs and contextual draft production-request exports. No purchase, payment or order is submitted by downloading a request.
- EIG-only Auto Resizer: destination dropdown, automatic preview, fit with padding or crop with a selected focal point/zoom, custom dimensions, PNG/JPEG/WebP, quality and background controls, and a text field for requested changes with a separate instructions download.

## Auto Resizer rollout and verification

The initial entry point requires a current active `eig_admin` membership in the `elevated-impact-group` organization, with start/end dates checked. Local resize/download works entirely in the browser. Drive saving uses the new `inception-drive-export` endpoint and independently verifies the authenticated account, current interactive session, active account and exact EIG membership before accessing Google. Other Hangars do not get this EIG rollout.

Select up to 20 PNG/JPEG/WebP images, 20 MB / 25 MP each and 100 MB total. Decode one source at a time, retain individual focal points/zoom/change instructions, share destination/format/background/quality across the batch, and download the selected image or a ZIP up to 50 MB. ZIP entries have collision-safe filenames, instructions where provided and a manifest. Queue search and sortable Image/Size headings preserve selection; batch actions explicitly include all loaded images, including search-hidden rows. Cancel discards batch work before download or Drive upload. Animated inputs become still images.

Add to Google Drive saves the selected resized image; Add batch to Google Drive saves its ZIP. Both target EIG's connected shared Drive, under Hangars / Elevated Impact Group / InceptionApex / Resized Images. The four folders were created through the connected Drive and their parents verified on October 7. Service-only folder mappings were seeded from those observed IDs. The endpoint uses resumable uploads internally, stable request IDs and pre-generated Google file IDs to recover retries without creating another file. SHA-256, size, MIME, name, destination and export provenance are verified from Google before confirmation. No Google credential or resumable URL reaches the browser. Export audit rows retain actor, organization, content digest and file/folder IDs. No external notification, sharing change, store publication, event packet modification or project save occurs.

The additive `20261007052358_inception_drive_exports.sql` migration and JWT-protected Edge Function were deployed. Both new tables enable RLS and revoke all anonymous/authenticated access; only the service client has SELECT/INSERT/UPDATE. The advisor's INFO “RLS enabled, no policy” is deliberate for these internal tables, not a missing customer access policy (reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Existing event and inquiry policies are unchanged.

The local browser suite verifies actual image pixels/ZIP entries, independent crops, names, notes, mixed invalid inputs, search/sort, 20-file limits, cancellation, deterministic batch retries, single/batch Drive UI, error recovery and mobile. The nine server tests cover session/membership denial before Google access, fixed destinations, folder hierarchy, verified uploads, audit recovery without duplicates, modified destinations/checksums, unsupported files, safe errors and service-only SQL permissions. The live gateway rejects anonymous requests with HTTP 401. A real signed-in website upload remains an owner smoke test; mocked transport tests and connector-created folders are not a live endpoint upload verification.

See `ElevationPilot-Drive-Folder-Rules.md`: the existing roster writer and three linked event folders still use the old flat registration root, and one unlinked duplicate needs review. Do not claim all Hangars' folders have been reorganized.

Shopify's square product/collection preset is 2048 × 2048, following its official product-media guidance: https://help.shopify.com/en/manual/products/product-media/product-media-types. The EIG Hub artwork preset is 1200 × 340, matching the image area in `api/event-image.js`; a separate 1200 × 630 canvas supports website share images. Website hero/card/logo and display presets are labeled starter sizes rather than universal requirements. Users can adjust custom dimensions for the actual layout.

The change-request field preserves the user's wording for the next edit and downloads it with the selected output filename, destination and dimensions. It does not claim that natural-language editing is connected. Notes remain in the open tool until closed; download them to keep a copy.

`test:auto-resizer` checks the rollout gate, expired/revoked/future access, proportional fit, edge-safe focal cropping, dimensions and filenames. `test:auto-resizer-browser` uses real exported pixels to verify destination dimensions, transparent PNG padding, opaque JPEG padding, left/right focal crops, keyboard controls, instructions download, rejected inputs and desktop/mobile behavior. Recheck the existing InceptionApex browser workflow and production build after integration.

## Database and access

Creative migrations applied to the live platform database on October 7, 2026, after isolated database and desktop/mobile browser checks:

1. `20261007040350_inception_creative_foundation.sql`
2. `20261007040355_inception_apex_projects.sql`

Both migrations are additive: private creative tables, version history, guarded RPCs and event packet storage. They do not alter legacy booking, event, inquiry or registration policies. The larger booking migration in draft PR #19 is deferred.

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

Owner setup steps and exact secret names are in `InceptionApex-Provider-Setup.md`. Keep provider credentials server-side. Do not use `VITE_*` variables for secrets. AI generation should preserve verified wording and logos as editable layers, and never invent operational geography or measurements. Do not label generation, product previews or ordering as connected until their live round trips are verified.

## Verification

`npm run test:inception-apex` executes the two creative-only SQL migrations in PGlite and verifies that legacy event/inquiry policies are unchanged and tests private ownership, anonymous/direct-write denial, active-session/event-authority checks, immutable event context, revision history, approval, stale saves and packet attachment. It also checks format dimensions, image sanitization, SVG escaping, draft labeling, handoff requirements and list behavior.

`npm run test:inception-apex-browser` uses the real React components with synthetic local storage. It exercises desktop/mobile layout, logo upload and movement, details editing, save/reopen, favorites/search/sorting, versioned approval, packet attachment, production-request download, conflict recovery and backup. Screenshots are generated under `test-results/inception-apex/` and are not committed. `CHROME_PATH` can point to an installed headless browser.

The Event Builder browser suite checks that the reused editor and packet changes preserve existing planning workflows. `npm run build` runs both new database/unit suites, existing regressions and the production build. These checks do not assert live provider connectivity or production database migration.

## October 7 release verification

The live legacy event/inquiry policy fingerprint stayed identical before and after both creative migrations. Saved projects, active-session access, event authority, immutable versions, approval and attachment passed against the actual creative SQL in isolated PGlite. The production build passed 60 tests. All three browser suites passed, including actual exported pixels and instructions downloads. Live authenticated save/reopen still needs the owner’s signed-in smoke test; no real user was impersonated. Provider generation and purchases remain pending.

## Preview and My Designs update

The editor has a View Preview action that shows current artwork in a larger keyboard-accessible dialog, including unsaved/draft/approved status and output dimensions. Escape or Close preview returns to the working design. The persistent My Designs shortcut opens the saved library directly, with search, filters, sorting, reopen and per-design previews. Save to My Designs uses the same private, versioned server storage and preserves save-conflict recovery. Previewing a saved design fetches its artwork only on request and does not modify it. New design returns to material selection. These actions send no external notifications and make no changes to authorization or the database schema. Desktop/mobile browser checks cover preview dismissal, edits preserved, saved preview, library navigation and reopen.
