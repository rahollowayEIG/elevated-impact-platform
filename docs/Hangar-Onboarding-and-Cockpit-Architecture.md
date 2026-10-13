# Hanger onboarding and Cockpit contract

**Status:** Working implementation plan (first slice in PR #52)  
**Related:** [Universal Hanger & tracking foundation](https://github.com/rahollowayEIG/elevated-impact-platform/issues/50), [Deal & Redemption Registry](https://github.com/rahollowayEIG/elevated-impact-platform/issues/51)

## One business, one canonical Hanger
Existing `public.organizations.id` is the canonical company/Hanger identifier. `public.organization_profiles` stores its business profile; `public.organization_memberships` attaches permanent users and contextual roles; `public.organization_product_entitlements` controls optional apps. Never introduce an advertiser-specific parallel company account. An EIG-created/unclaimed company does not imply a new login or a new Pilot. Respect `docs/ElevationPilot-User-Identity-Rules.md` for identity claiming.

A company may enter through EIG Command Center, Hometown Magazine, sponsorships, school fundraisers, an event inquiry, or a customer self-serve flow. All entrances should invoke the same *match before create* logic. Name and website are **suggestions for a match**, never evidence of ownership. Show potential matches; verify authority before allowing claim, merge, or access. Distinguish test organizations from production.

## First slice (PR #52)
- EIG admins can create a **real, app-free Hanger** without inventing a customer user identity or being forced to invite a Pilot immediately.
- The server, not only the browser, checks normalized company name and matching website under an advisory lock and refuses to create a duplicate on a hard match.
- It records the authenticated EIG actor, onboarding source and timestamp in a protected audit. The staff-supplied website is not described as AI-verified.
- Optional Pilot invitation reuses the current `platform-invite` identity/verification path. The record survives an email failure so a retry does not provision another Hanger.
- EIG can open the organization's Cockpit; an authenticated Pilot can access it after an authorized invite is accepted. No paid app entitlement is created by onboarding.
- For Hangers without EIE entitlement the cockpit no longer advertises event operations as enabled. The shared core-dashboard section lists Contract, Financial, Ad Proof and Ad Tracking as **pending data integration**, not falsely zero completed operations.
- These changes require migration, build/permission tests, visual validation and approval before production.

## Core Cockpit is not an app subscription
Every Hanger has access to its owned/authorized business profile, contacts, relevant contracts, finances, ad proofs, ad placement schedule/tracking, notifications and approval tasks **as those domain connections ship**. Show only authorized records. Never create a second ledger or forge campaign conversion metrics. Maintain the contract system as the contract source of truth, finance system as the invoice/payment source, InceptionApex as the design/proof source, and campaign/placement registry as the ad schedule/tracking source.

**Display contract:** a panel is a live dashboard only after its ownership-scoped backend query is connected, tested and available. Before that it must state that data integration is pending; no fabricated zero counts, conversion figures, deliverability or statuses.

## App and service activation
A Hanger may have **zero paid apps**. Optional apps are separately entitled, with least-privilege roles and effective dates. EIG-managed, Hybrid, and Hanger-managed are *operating modes per service*, not separate business profiles. Granting profile edit permission does not grant finance, app or identity-administration authority. EIG controls the Hometown Magazine publishing product and inventory; each advertiser retains its own company profile and authorized brand assets.

Apps must use `organization_id` / Hanger ID, `person_id` for permanent users where available, event ID for scoped events, and stable IDs for campaigns, placements, offers and transactions. Never duplicate identities for apps or sub-businesses. Deny cross-Hanger access via server authorization / RLS rather than hiding components only in the UI.

## Next step: shared AI discovery and verification
Onboarding can suggest website, address, phone, public contacts, descriptions, social accounts, logos, and other photographs from documented sources. Each proposed field or asset must retain **source URL, timestamp, confidence, commercial usage rights, approval status and reviewer**. Suggestions must never silently overwrite approved information. No automatic scraping or publication of third-party imagery merely because an image is public. Confirm business ownership before exposing sensitive Cockpit records.

Build discovery once for both business onboarding and venue/map setup, using source-specific adapters. Do not require it to complete a Hanger or send an invitation.

## Future company-within-company extensions
A manufacturer, distributor or retailer could later grant sales people limited team workspaces and branded Product Hubs based on a parent Hanger's approved catalog. Team attribution for leads, quotes, orders, commissions and campaigns should roll up to the parent without duplicating inventory or giving every representative Pilot/Co-Pilot authority. An independent legal dealer generally has its own linked Hanger. This is **architecture capacity**, not part of the initial PR.

## Release gates
1. EIG-only company creation, duplicate / race prevention, contact optionality, unclaimed/claimed access and audit.
2. No paid-app Cockpit, authorized member profile updates, app activation/deactivation, role scope and cross-Hanger isolation.
3. Draft or unverified asset provenance and commercial rights checks.
4. Backend read integration for core panels, consented campaign tracking and accurate billing.
5. Four-pass visual, cosmetic, functional and smell-test audit from the identity rules, including mobile testing.

No production migration or application release is approved solely by adding this document.
