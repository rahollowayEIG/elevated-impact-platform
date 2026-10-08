# InceptionApex shared creative app

## Owner decision

On October 6, 2026, Ryan chose InceptionApex as an app within ElevationPilot, connected broadly to other EIG apps. The purpose is to help people get a design they love and make relevant upgrades easier to understand through design previews. Gifts and swag are part of its scope, alongside event materials.

InceptionApex should have its own app entry point and shared design workspace. Other apps can open the same workspace with the relevant event, sponsor, venue, or product already selected. Its separate app identity does not require a separate login or deployment; follow the existing shared identity architecture.

Ryan clarified that the standalone app should be extremely basic. Its value is broad customization of materials and products. Keep the entry experience simple: choose what to customize, start from a template/upload/saved design, then edit, preview and save. Connected apps should enter directly into that same editor with their context filled in. Add specialized controls only when the selected material needs them; avoid making a large dashboard a prerequisite to designing.

## Ownership and connections

| App or service | Responsibility |
| --- | --- |
| EIE / Event Builder | Owns event planning facts, sponsor commitments, course placements, venue layouts, itinerary and event packet context. Supplies authorized facts to the design workflow. |
| InceptionApex | Owns creative projects, uploads, reusable templates, design variants, saved favorites, artwork versions, AI-assisted creation, product mockups and approved design exports. |
| EIC / Commerce | Owns product catalog, purchasable options, prices, cart, checkout, purchases and orders. Receives an approved artwork version and required production specifications. |
| Signage | Owns physical-sign and digital-display fulfillment context; receives designs fitted to the selected output specification. |
| Impactertising | Owns advertising placement and campaign context; uses approved artwork. |
| Squawk Box | Carries design discussion, proofs and approvals with links to the relevant project and artwork version. |

Use the same permanent person identity, organization, and scoped access across apps. Creative projects may exist without an event. An event-linked project retains its Master Event/EIE context; product-only projects retain the authorized product/order context. Connecting apps does not make private artwork or event records public.

## Customer design flow

1. Open InceptionApex directly or choose a design action from a connected app.
2. Bring in saved facts and approved brand assets. Upload photos, logos or a reference design and choose a template, product, size and creative direction.
3. Generate alternatives or edit manually. Keep exact dates, prices, sponsor logos, QR codes and operational measurements as editable verified elements.
4. Compare variants, save favorites, request revisions and preview the design on selected products or output formats.
5. Approve a specific design version. Save it to the project and, where applicable, the event packet.
6. Send that version and production specifications to EIC or the relevant fulfillment app. Further artwork revisions require a new version and any applicable proof approval.

## Material scope

- Flyers, invitations, sponsor signage, banners and digital displays.
- Gifts, apparel and swag, with product mockups tied to the selected catalog product and imprint area.
- Outing books, programs, yardage books, scorecards and related print materials using reusable page layouts.
- Presentation of actual course maps and venue layouts. AI may style artwork around verified geography and measurements; operational placement remains owned by the planning tools.
- Other connected-app creative needs using the same project, asset and approval workflow.

## Upgrades and sponsorship help

Show matching product and design upgrades in the context of the customer's chosen design, with actual prices supplied by commerce and explicit customer selection. Preserve the working design when opening an upgrade or sponsorship workflow.

Apply `EIG-Paid-Upgrade-Sponsorship-Rule.md` to paid event upgrades: Ella, Marshal and Maverick's required reminder and **Help me find sponsors** action accompany the cost review. Carry the incremental cost into the current event's Sponsor Builder. Suggested income is a planning target until committed and received.

## Implementation status

The implementation branch now includes a standalone InceptionApex dashboard within the existing authenticated platform, accessible from the header, organization apps area and Event Builder. It uses the existing login and permanent person identity. The direct app route is `#inception-apex`.

The first version supports flyers, invitations, sponsor signs, banners, swag artwork, book covers and digital displays. Maps and venue layouts open the event's existing planning tools. Users can upload raster backgrounds and separate logos/photos, edit artwork and exact event facts, save favorites, reopen versioned projects, approve a saved version and attach it to the authorized event packet. Approved artwork can be exported as a contextual draft production request; this does not create an order.

Auto Resizer is initially an EIG team tool inside InceptionApex. Offer it only to current active `eig_admin` memberships in the Elevated Impact Group organization, using the existing authenticated session. Other app users do not see its entry point. It prepares local images for Shopify, EIG website slots, displays or custom dimensions, with fit/crop controls and downloadable change instructions. The resizer supports batch preparation and explicit saves to EIG’s connected Drive; the server checks current EIG identity/session/membership and uses a mapped Hangar-down destination. Follow `ElevationPilot-Drive-Folder-Rules.md` for file organization. Broader customer availability remains a later rollout decision. These instructions do not automatically trigger AI edits.

Private project storage, immutable revision history and approval/packet handoff migrations are implemented and tested locally. The creative-only release uses additive migrations independently of the separate booking workflow. Provider connections are visibly pending. Background AI generation, selected-product mockups, multipage books, proof messaging and live EIC catalog/checkout remain to be connected and verified.

See `InceptionApex-Implementation-Audit.md` for validation and release setup. Expand the shared workspace without presenting unconnected integrations as live features.

## Custom product starters and golfer videos

Create Custom Products opens Swag, Apparel, Gifts and Other products. Choose a starter or describe an idea and optionally supply the actual imprint size. Personal/event context and these production specifications follow the existing private project, preview, My Designs, saved approval and draft production-request flow. These are artwork starters, not catalog SKUs; EIC continues to own real catalog options, prices, checkout and orders. Supplier mockups remain pending.

The owner also requested Ella, Marshal and Maverick phone videos explaining each hole and its hole-in-one prize challenge, plus pre-round announcements and sponsor ads. See InceptionApex-Video-Challenges.md for verified inputs, golfer access and approval requirements. Video generation is planned, not connected in this release.

## Owner business direction — empower Hangars and share in generated business

On October 7 Ryan identified the broader goal as avoiding charges to Hangars for joining/getting set up, giving them tools to grow, and letting EIG benefit from the business those tools generate. The current course-mapping proposal uses free Hangar setup and a share of qualifying event-package sales. Preserve this direction when designing future monetization; do not treat it as an implemented platform-wide billing change. Organizer/customer services may be paid, with clearly disclosed prices and any agreed Hangar share. Exact package prices, split percentages, eligible transactions and payout rules require separate decisions. Do not invent a fee on every app action or promise revenue on unpaid activity.

## Shared link and QR requirement — October 7, 2026

Ryan requires an optional destination link and QR code on everything created in InceptionApex, especially tee signs and marketing materials. The shared artwork editor supplies the URL, link text, QR visibility, size and placement for all seven current material types and custom-product artwork. Preserve these settings through My Designs, revisions, shared templates, previews, approved artwork, event-packet attachments and draft production requests. QR geometry is generated locally from the exact verified HTTPS destination with a white quiet zone; AI must not invent or paint it into a generated background. Users should scan-test the actual finished size and medium. Changing the link changes the artwork and requires a new approval. A static code points directly to that URL; it does not provide redirect editing, scan analytics or pass redemption by itself.

Printable event packet sections offer a shared footer link/QR beside maps, layouts and itineraries. This does not overlay or modify operational map pins or the separate rental planner's own downloads. Auto Resizer can add the same QR and text to each raster image after cropping/resizing; downloads, ZIPs and Drive exports use that output. Raster images need their destination link assigned when published; SVG/HTML anchors remain clickable when the file/viewer supports links. Templates retain an explicitly selected URL and should be reviewed before reuse.

Ryan expects to expand the database of products that can be designed. EIC owns the eventual editable product catalog, dimensions/imprint areas, prices and purchases. A catalog product should reuse the shared design/link renderer, with actual output specifications and optional placement restrictions, instead of requiring a separate editor per product. New multipage/video/provider outputs must carry this same optional link/QR requirement when implemented; those generation/editor capabilities remain pending.
