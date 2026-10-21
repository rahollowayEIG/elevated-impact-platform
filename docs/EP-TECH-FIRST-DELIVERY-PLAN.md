# ElevationPilot Technology-First Delivery Plan
**Owner direction:** Build and prove the technology before acquiring publishers, onboarding outside vendors, recruiting business customers or scaling. 20 October 2026.

## Product mission

Create one reusable, consent-first platform connecting:
1. **Identity and My Likes:** Verified account, user-controlled interests, communication preferences, and privacy.
2. **Universal Vendor & Product Registry:** Verified suppliers, product/service catalogs, catering menus, stock/availability, terms, territories, pictures, quotes and prices.
3. **Discoveries:** Optional personalized in-app monthly recommendations, free digests, search, sort, wish lists, and opt-in paid monthly clubs later.
4. **Registries:** Birthday, wedding, shower, charity, golf and custom event gifts; owner approval, shareable Event Hub, voluntary gift claiming, split/group gifting and existing outside-site products.
5. **AI Event & Registry Concierge:** Context-aware draft itineraries, meals, swag, signage, registry suggestions and realistic budgets with supply-side verification.
6. **Creative & Approval Engine:** InceptionApex templates/arts, safe AI creative drafts, brand approvals, explicit channel-by-channel publish consent and immutable proof/version history.
7. **Delivery and Fulfillment:** Order intents, invoicing and payment/fee separation, vendor order workflow, tracking, proof of services and permissible direct Squawk/email.
8. **Universal Sales Engine:** Organization/Hangar-managed self-service, EIG-managed, or hybrid; commissions, transparent platform fees, ad media budgets and licenseable white-label features.
9. **Build Lab:** Finds missing vital platform capabilities and improvements; evidence, proof, test, accept/revise/reject, safe PR and verified retest.

Do **not** build duplicate login, vendor, creative, product, payment or organization frameworks per event type. Apps consume central services via their own explicit entitlements and permission gates.

## Current code baseline

- Passenger profiles already contain `favorite_brands`, `apparel_preferences`, `equipment`, `life_events` and `privacy_settings` fields. `profiles` / `passengers` are the underlying identity structures.
- `products` represents existing platform products/entitlements; **it is not a verified marketplace inventory** and must not be relabeled as one.
- `eic_design_products` and `DesignProductCatalog` represent printable/creative design-product templates, **not real vendor listings or purchasable inventory**.
- Event Builder, InceptionApex, Squawk, Vendor plans, Build Lab and Event Inquiry each have partial foundations.
- The Event Inquiry account-first portal is present behind preview/Sandbox flags but its private edge service and automatic email/Squawk changes are **not yet live**.
- Security audit uncovered broad production anonymous write grants. An independent security fix is necessary before scaling anonymous/public pathways. Do not blanket-remove grants or change Live without explicit owner approval.

## First technology slice: Built in Build Lab

`src/lib/epDiscoveryEngine.mjs` contains the reusable pure business logic:
- Interest categories, explicit consent and privacy-first My Likes state
- Searchable/sortable sample vendor discovery, monthly picks
- Wish list, per-occasion private registry draft and local organizer approval
- Event vendor proposals for golf/birthday with per-attendee pricing and budget checks
- Unsent custom-product requests, to connect with InceptionApex later
- Validation that only deliberately fictional demo inventory is accepted

`src/components/EpDiscoveryPilot.jsx` provides an accessible responsive owner-only UI inside Build Lab. **This is not the real Passenger shopping app.**

Each pilot item shows fictional sample vendors, illustrative prices and unverified availability. The demo uses **no external API, AI model, real customer data, order, purchase, email, text, Squawk, subscription charge, geolocation or background agent**. The owner's temporary demo selections stay only in the open browser tab and disappear on refresh. Approving a registry draft **does not publish or share it**.

## Delivery sequence and exit gates

### P0: Safety & confidence (finish before public launch)
- Lock down effective anonymous write grants while preserving intentional public forms using secure server endpoints.
- Verify the existing account-first form, 6-digit verification, ownership, no duplicate submissions, protected status history.
- Connect real event-request status transitions with consent-aware Squawk/email outbox, retry and delivery tests.
- Establish owner-visible error logs, protected automated preview tests, role gates, migration/rollback review and synthetic Sandbox data.
**Exit:** Critical unauthenticated write paths addressed; synthetic user gets an account-owned request and authorized status notice; no regression in existing event registrations.

### P1: Actual Passenger My Likes + Vendor Registry
- Add secure, user-owned My Likes preferences, controlled visibility and a skip/edit/delete workflow to the current Passenger profile. Never require Likes during account creation.
- Build canonical vendor organization/catalog types: verified listing versus draft; menu, product, price, quote timestamp, fulfillment area, availability, supported customizations, commission terms, approval policy and stock.
- Create owner-only, anonymous-safe discovery projections so neither vendors nor guests see private profiles. Sponsored products must be distinguishable from relevance-ranked products.
- Integrate read APIs via tightly scoped RLS and server workflows. Treat demo catalog data as nonproduction seeding, never real purchase options.
**Exit:** Two synthetic Passengers see independent Likes and permitted products; one synthetic Vendor can modify only its own approved inventory.

### P2: Registry & Event Concierge end-to-end
- Link event forms to verified creator and owned registry; owner creates, reviews and explicitly shares to invited guests via Event Hub/Squawk.
- Reuse vendor catalog for per-golfer swag/catering, birthday registries, group gifts and service bundles. Obtain authorized supplier prices/availability before offers or checkout.
- Support private wish list, outside product references and optional "Create My Own" draft to InceptionApex.
**Exit:** Two independent synthetic event types produce editable registry/vendor proposal; nothing is shared or ordered before explicit approval.

### P3: Creative/agent execution & financial reliability
- Reuse existing InceptionApex + Campaign services, prepare a proof and route it to the correct business/organizer for approval.
- Approval identifies exact version, channels, recipients, budget, expiry, sender and who approved. Dispatch is idempotent with outbox retries.
- Transactions separate seller revenue, media spend, platform fees, payment provider fees, taxes and independent commission terms. Marketplace purchases, subscriptions and refunds require real providers and validated contracts.
**Exit:** Artificial vendor and customer can approve artwork, run a simulated dispatch and trace a complete audit. Real external sends remain disabled until separately authorized.

### P4: Production business tools
- Hangar marketing dashboard for self-service, EIG-managed and hybrid operating models.
- Squawk Nearby discovery and opt-in push; mobile programmatic geofencing via licensed partners, not an unconsented phone-tracking system.
- Publisher/advertising layout engine, print specs, subscription billing, product bundling, renewal programs and cross-tenant reporting.
**Exit:** Pilot tenants and integrations pass load/security/performance tests; cost-to-serve measured; user permissions and consent verified.

### P5: Commercial launch plan (only after demonstrable tech)
- Select an initial narrow use case and a few legitimate test vendors/business users.
- Establish actual costs, pricing, documented effectiveness, onboarding and support.
- Evaluate Lancaster print launch, Berks purchase and Mike publisher software partnership separately, using realistic unit economics and any territory/licensing restrictions.
- Go-to-market, customer acquisition and broader publisher sales are a separate owner-approved workstream, not in-flight now.

## Release decision

Work remains isolated on `feature/build-lab-orchestrator-20261020`, available only via protected Build Lab previews. **No production deployment, DB migration, real-money flow, customer marketing, publisher outreach, or vendor communication is authorized by this plan.**

This sequence deliberately reuses the existing organization, event, role, product, creative, message and financial frameworks. The first proof of the value proposition is a usable end-to-end flow, not a polished slide or a promise.
