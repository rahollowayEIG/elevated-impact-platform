# Event Builder implementation and release audit

This draft connects venue inquiries and EIE creative/operations planning to the existing Hangar and Master Event. It adds regular-event creation alongside golf outings. It has not been merged, deployed, or migrated into the live database. Contract policy edits remain deferred at the owner's direction.

## Implemented behavior

| Area                     | Behavior in this draft                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cost estimate            | Itemized quantity × price, explicit tax/gratuity/fees, printable download while drafting, venue approval, frozen copy in the booking exhibit. Authorized coordinators can download their booking quote from the event packet.                                                                               |
| Agreements               | Golf and venue-space-only templates remain separate. Server prepares an unsent Docusign draft with both signers and an allowlisted booking exhibit. Sending requires completed policy review, configuration, an active hold and an explicit send confirmation.                                              |
| Deposit and confirmation | Record an exact existing payment with method/reference or a documented waiver. Fresh provider verification of both signatures plus the deposit requirement creates one unpublished Master Event and linked EIE record. Repeating confirmation returns the same event. No card is charged.                   |
| Regular events           | Reuses the existing registration, offers and payment provisioner in one transaction; sets general-event metadata, hides GHIN/club membership, defaults to individual registration, and retains the existing event and organization IDs. Flights are hidden in regular-event setup.                          |
| Flyer maker              | Saved event facts fill editable text boxes. Drag, keyboard move, corner resize, typography/colors, three starter layouts, safe background-art upload, SVG export, reusable JSON templates and an AI creative brief. Bound templates do not carry another event's facts.                                     |
| Course map               | Actual venue image upload; contest/vendor/sponsor pins, drag/keyboard movement, hole/location and notes. Includes closest to pin, long drive, Pot of Gold and other activities. No fictional course geography is supplied.                                                                                  |
| Rental spaces            | Integrates the owner-provided CHGC planner in an isolated frame. Saves dimensions, furniture placement, seats and notes into the event's private packet. Supports additional areas. Only the 40 × 60 ft tent is treated as supplied; other starter dimensions are explicitly placeholders.                  |
| Itinerary                | Dated venue-local start/end times, activity, location, owner and notes; search and stable sorting; saved alongside the layouts.                                                                                                                                                                             |
| Sponsorship              | Starter inventory/package names from the coordinator workbook, with sample prices and sales excluded. Configurable offers, committed price snapshots, availability checks, buyer/contact details, manual payment references, per-benefit fulfillment, course pin placement and formula-safe sign-maker CSV. |
| Materials                | Invitations, tee signs, banners, event programs, digital signs, apparel and other requests. Event facts prefill wording; stores quantity/specifications, artwork URL, proof state, due date, department and notes. Exports a draft EIC handoff with Hangar, Master Event and EIE IDs.                       |
| Packet                   | Private, versioned save; conflict detection; unsaved-change warning; printable flyer, map/legend, layouts, itinerary, sponsorship fulfillment and materials list; complete JSON export. Drafts remain visibly marked.                                                                                       |

Private creative, sponsor and production data is stored in `event_builder_assets`, not public Hub settings. Only an active authorized organization manager, EIG administrator or assigned event coordinator can read/save it. The booking approval API requires a verified active Pilot/EIG administrator session and rechecks account, session, organization and access window in the database. No extra person or authentication accounts are created.

## Required release work

1. Review and apply `supabase/migrations/20261006022154_event_builder_booking_and_packet.sql` in an isolated staging project first. It intentionally removes the legacy anonymous ALL/read policies for private inquiries and Master Events. Public Master Event reads require `is_published=true`; public registration writes remain in their existing tables/workflow. Regression-check the deployed public Hub and registration application before production migration.
2. Set server-only configuration using `event-builder-config.env.example`. Never expose the service-role key, signing-user private key or integration credentials as `VITE_*` values. The migration is the single schema source; the SQL test fixtures are snapshots only.
3. Connect an actual Docusign developer integration and signing-user consent, first in a demo account. The connected ChatGPT Docusign account/templates do not automatically grant this web app API access. Demo and production templates/account IDs must match their environment. Complete a real demo envelope round trip before enabling production sends.
4. Complete the deferred policy cleanup on both agreements: prices/fees, deposit and cancellation rules, weather, deadlines and remaining placeholders. The prepared exhibit records approved booking facts; it does not finalize those policies. Keep `DOCUSIGN_SEND_ENABLED=false` and `DOCUSIGN_POLICIES_APPROVED=false` until reviewed.
5. Connect the exported production request to the existing shared EIC catalog/cart/checkout/order service, and its approved artwork/proof workflow. This draft exports a valid contextual planning handoff; it does not submit orders, pay vendors, create a proof message, upload to Hangar/Drive folders or reserve signage inventory.

The existing production CHGC templates are saved as DRAFT — Policy Review Required:

- Golf outing: `a24f9b57-659c-4188-a867-b099fc3b3920`, role `Group Authorized Signer`.
- Venue space only: `669a24c1-a867-4c14-81c6-3b8e74910075`, role `Renter Authorized Signer`.
- Venue countersigner role for both: `Chapel Authorized Representative`.

Docusign draft creation uses a stable workflow transaction ID, looks up interrupted creation before retrying, and uses document ID `999` for the booking exhibit. Docusign transaction-ID recovery lasts seven days; older attempted drafts require reconciliation rather than automatic duplicate creation. Sending and confirming always refresh provider status. There is no Connect webhook yet; operators use Verify signing status or the confirmation action. Database state is never manually marked signed.

## Deferred integrations and cleanup

- Shared AI creator: an exact-facts creative brief plus background-art upload/export are implemented. Shared model/account access, generation billing and saved AI-generation history are not connected.
- Sponsor planning: manual received-payment status is not a payment processor. Included foursomes/course-challenge package metadata does not yet create registrations or entitlements. Planned sponsor sales do not automatically publish to the existing public Hub sponsor table.
- Venue confirmation creates draft event records. Participant pricing, payment setup and public Hub publication remain their own setup steps; contract venue-rental totals are not substituted for ticket prices. No external calendar is reported confirmed by this workflow.
- Venue-approved amendments, void/refund handling, cancellations after confirmation and revising a frozen quote need a separate audited workflow before release. Direct editing of frozen terms is blocked in both EIE and Master Event records.
- The regular-event builder reuses legacy registration infrastructure. Admission pricing and general-event metadata are tested locally; the independently deployed `golf.elevatedimpactgroup.net` registration/payment experience still requires general-event wording and end-to-end review.
- Detailed table planning from the supplied Google Sheet is queued for later, as requested. This change does not edit that workbook or spreadsheet. Reference: https://docs.google.com/spreadsheets/d/1i0Gziy9bmYSlnnpfDIpIEe7EcyMsjZ-lKxTK7OfwyGg/edit
- The original venue planner reference is https://www.chapelhillgolf.net/interactive-tent-layout/. The supplied coordinator workbook is used only as a read-only schema/content reference for the sponsor starter catalog; original data is unchanged.

## Validation and four-pass audit

**Visual:** synthetic desktop/mobile previews reviewed. Flyer boxes and data-bound text render; rental planner is embedded; responsive tools wrap without page-width overflow. Placeholder dimensions remain visible. Screenshot results are generated locally under `test-results/event-builder/` and are not committed.

**Cosmetic:** consistent raised working panel, readable controls, draft and save status, print layout, source-bound template wording, search/sort controls. New code is formatted for review. Existing broad app files receive small scoped edits.

**Functional:** `npm run test:event-builder` exercises the actual migration in PGlite, server handlers with a synthetic provider, legacy provisioner snapshots, private reads, revoked/expired access, approved frozen pricing, exact deposits, provider signer checks, idempotent confirmation, locked Master/EIE terms, packet compare-and-swap and audit, draft-order context, markup and CSV escaping. No production data or envelopes are written. `npm run build` runs the new checks and existing regression suite.

`npm run test:event-builder-browser` starts an isolated Vite fixture and exercises the real editor components with synthetic storage: flyer editing and save/reopen, itinerary, embedded tent save/reopen, sponsor catalog/sale/fulfillment, pin drag without duplicate creation, materials handoff, printable packet, mobile width and stale-save export blocking. Install a Playwright browser first (`npx playwright install chromium`); `CHROME_PATH` can point to an existing headless shell. The preferred agent-browser check was attempted but this execution environment disallowed its daemon socket; the Playwright headless-shell path was used successfully. Browser fixtures do not assert live Docusign, EIC, calendar or public-registration connectivity.

**Smell test:** both event types retain one Hangar/Master Event context; private operational data does not publish automatically; state transitions require verified authority; saving is versioned; sending contracts and submitting paid orders are not implied by downloads. Outstanding live integrations and policy decisions are listed explicitly above.

## Provider references

- Docusign official OpenAPI: https://github.com/docusign/OpenAPI-Specifications/blob/master/esignature.rest.swagger-v2.1.json (collection document update accepts an EnvelopeDefinition with `documents`; individual update accepts binary bytes).
- Docusign documents update reference: https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopedocuments/update/
- Repository identity and list rules remain authoritative: `ElevationPilot-User-Identity-Rules.md`, `ElevationPilot-List-Interaction-Rules.md`.
