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

Auto Resizer is initially an EIG team tool inside InceptionApex. Offer it only to current active `eig_admin` memberships in the Elevated Impact Group organization, using the existing authenticated session. Other app users do not see its entry point. It prepares local images for Shopify, EIG website slots, displays or custom dimensions, with fit/crop controls and downloadable change instructions. Broader customer availability remains a later rollout decision. These instructions do not automatically trigger AI edits.

Private project storage, immutable revision history and approval/packet handoff migrations are implemented and tested locally. They have not been applied to the live database. Provider connections are visibly pending. Background AI generation, selected-product mockups, multipage books, proof messaging and live EIC catalog/checkout remain to be connected and verified.

See `InceptionApex-Implementation-Audit.md` for validation and release setup. Expand the shared workspace without presenting unconnected integrations as live features.
