# ElevationPilot Universal Scan Engine - shared intake foundation

Status: **Phase 0 contract and tests only; NOT a live scanning service** (October 13, 2026)
Owner: EIG Platform / Shared Services

## Decision

Build one shared, EIG-managed Scan & Create infrastructure for Hangers and authorized EIG operators, with domain-specific adapters, not a new independent identity system or separate copies of business records.

**Scan once; review before reuse; write only through the owning app.** An AI interpretation is a proposed draft, never an accepted operational fact. A QR scan used for attendance/redemption is a different transaction validator and does not bypass this intake review model.

Initial source kinds: website, document, image, spreadsheet, GIS, and entered text. Future source adapters can handle QR/barcode, POS/catalog integrations, 3D imagery, voice/transcription and industry data feeds without changing the review contract. Input collection and model extraction are separate stages.

## Current code in this PR

`src/lib/universalScan.mjs` provides a pure, dependency-free contract:

1. `createScanRequest`: validates a proposed source/destination reference, not a grant or URL fetch.
2. `normalizeScanSuggestions`: accepts bounded field-level suggestions only for a named destination schema, with source evidence and optional confidence; unsupported writes and duplicates are rejected.
3. `reviewScanSuggestions`: requires accept/edit/reject for **every** suggestion; the AI cannot approve its own output.
4. `prepareScanHandoff`: groups approved fields into a provenance-preserving, **requires_domain_validation** handoff. It does not write records or publish them.

No UI, database migration, uploads, scraping, AI calls, storage bucket, network request, action trigger, billing or production deployment is included in this first slice. The tests intentionally exercise untrusted field rejection, explicit review and provisional handoffs.

## Ownership and future adapters

| Destination | System of record | Example inputs | First validation |
| --- | --- | --- | --- |
| `hangar_profile` | Canonical Organizations / Hanger onboarding | Authorized business website, marketing brief | Existing-org match and claim; never create/merge automatically |
| `restaurant_menu` | Set the Table menu model (future) | Restaurant-owned PDF, photos, spreadsheet | Names, variants, accurate prices, tax and allergen review |
| `event_brief` | EIE Event Builder | Proposal, flyer, inquiry, itinerary | Organizer, dates, place, source authority; draft only |
| `product_catalog` | EIC commerce | Shopify/merchant catalog feed, supplier sheet | SKU/variant match, catalog ownership, supplier rights |
| `venue_map` | Hanger Mapping Studio (future) | Venue plans, licensed imagery, GIS files | Coordinates, geometry, permissions, course manager approval |

Other planned uses share the same intake engine but require their own schema and handoff adapter: sponsor agreements, Hometown Magazine print ads, fundraising deals, contracts, registration/rosters, equipment inventory and printed scorecards. Keep live payment, attendee identity, prices, operational geometry and legal terms owned and validated by their relevant domain.

## Trusted server stages (not implemented yet)

1. Verify signed-in identity, live session, active scoped membership and app entitlement. Never accept an organization/user/role ID asserted by the AI or untrusted client. EIG-managed work must still be scoped to an explicitly selected and authorized Hanger.
2. Verify the business authorized collection and reuse of source data. Honor website access policy, privacy, robots/rate controls and source terms. Web fetches require host allowlists or DNS/IP/redirect validation to prevent SSRF; accepting an HTTPS URL in the pure module does **not** authorize fetching it.
3. Store uploaded material in a private Supabase Storage bucket with service-issued opaque IDs. Apply MIME/extension and content inspection, upload-size limits, malware protections where appropriate, retention policy and checksum/idempotency metadata. Never use EIG's shared Drive folders as authorization boundaries.
4. Route each source type through the appropriate extractor: deterministic CSV/PDF parsing when available, image/document AI only where useful, GIS files to a geometry adapter, and website discovery through an explicit controlled fetcher. All provider API keys stay server-side in Supabase secrets.
5. Persist an immutable source reference, provider/model/version, date/time, actor and proposed field-level evidence in a scan-job ledger. Track actual AI cost and usage by provider, Hanger, user and task.
6. Present every candidate to an authorized human reviewer. Accept/edit/reject choices are recorded with the reviewer, original value, evidence and time; manual edits never erase the source claim. All important claims remain draft until the owner approves.
7. Hand approved candidates to a **domain-owned** validator/transaction using a stable request ID and idempotency key. Check current permission again. Match before create, resolve duplicates, and reject unknown/inconsistent fields. Import never implies publicity, invitations, external messaging, charges, menu publishing, signed contracts, POS updates or event registration.
8. Preserve version history and source provenance, and expose rollback/correction paths. Avoid multiple stores for canonical business identity, company logos or active merchant products.

## Staged development plan

- **Phase 0 (this PR):** shared schema, validated request/review/handoff contract, tests and account checklist. No production touch.
- **Phase 1:** create isolated Supabase development branch or separate staging project after cost approval; implement protected scan-job tables/Storage policy, upload/website staging, EIG-only review UI and provider budget ledger. Use test/dummy or zero-cost extraction first.
- **Phase 2:** connect one EIG-owned OpenAI API project. End-to-end test: restaurant PDF -> extracted fields -> manager review -> **draft** menu adapter. Separately support canonical business onboarding from PR #52 and simple event inquiry extraction. Don't ship any app adapter without scoped auth and automated tests.
- **Phase 3:** add licensed geospatial/GIS processing with expert course verification, richer product/Shopify source APIs, QR transaction validators, print media, social and professional workflows as individual capabilities.
- **Phase 4:** expose Creator and Creator Plus tiers through existing app entitlements; keep EIG Studio the fullest toolset. Apply included budgets, per-tenant quotas and provider commercial licensing. Clients never see or share the underlying EIG provider keys.

## Interaction with open work

- [PR #52](https://github.com/rahollowayEIG/elevated-impact-platform/pull/52) is a **draft** canonical Hanger onboarding proposal, not a live scanner. `hangar_profile` must plug into that single organization/claim flow after the PR's security and migration review; do not add a second company table or duplicate onboarding UI.
- [Issue #50](https://github.com/rahollowayEIG/elevated-impact-platform/issues/50) owns cross-app campaign and advertiser identity rules. [Issue #51](https://github.com/rahollowayEIG/elevated-impact-platform/issues/51) requires offers to be issuer/merchant-approved, not automatically republished from scanning books.
- [InceptionApex architecture](./InceptionApex-App-Architecture.md) owns creative projects, approved versions and exports; EIC owns commerce/orders; Set the Table will own menu data; Event Builder owns event facts.
- [User identity rules](./ElevationPilot-User-Identity-Rules.md), [Drive organization rules](./ElevationPilot-Drive-Folder-Rules.md) and the existing Event Builder authority requirements remain binding.
- Never merge or deploy migration changes to production without isolated tests, access-boundary review, and explicit launch authorization.

## EIG owner setup checklist

### Needed first

1. Create an **EIG-owned OpenAI API project** (suggested label: `EIG Shared AI Services`) at https://platform.openai.com/, with separate API billing and a conservative budget/alert. ChatGPT subscription billing is independent. Do **not** paste API keys in chat or GitHub; later store `OPENAI_API_KEY` in the restricted backend secrets manager when the endpoint is ready.
2. Approve a **separate Supabase development environment** after reviewing its cost. Current Elevated-Impact-Platform project `aszixzrdayrivungodwq` had no development branch on October 13. Do not test migrations in production.
3. Gather **permissioned pilot samples**: a restaurant-owned PDF/menu photo, a business website to audit, and a Chapel Hill course map or event document that EIG may use. Strip real attendee/customer private data from early samples.
4. Choose an EIG staff reviewer (Pilot/co-Pilot and EIG staff permissions come later). Review of restaurant prices/allergens, geospatial measurements and account matches requires a responsible human.

### Not required to start

No new Canva, Adobe Firefly, ElevenLabs, Runway, MapTiler, Cesium, camera or drone purchase for the Phase 0/1 import foundation. Existing ElevenLabs Creator and creative subscriptions can stay as-is. Provider business API entitlements and commercial image rights need verification before Hangar-facing release or flyover exports.

### Later

If Phase 2 passes, set budgets, decide included AI allowances for Creator/Creator Plus, and create explicit provider-by-provider usage limits. Connect ElevenLabs/Runway for optional narrated maps/social videos only when workflows and billing gates are implemented.