# ElevationPilot Universal Store Engine
**Owner direction, October 20, 2026:** Hangars, nonprofit organizations and fundraiser events should share the same core store infrastructure. The system supports self-service, EIG-managed and hybrid operations. Build the technology before large-scale business and user acquisition.

## One engine, three storefronts

| Store | Owner | Context | Offerings |
| --- | --- | --- | --- |
| **Hangar Store** | Verified organization | Organization-wide | Vendor merchandise, services, bookings, eligible gift cards, linked Shopify/store products |
| **Nonprofit Store** | Verified nonprofit organization/Hangar | Organization-wide mission | Nonprofit merchandise, wish lists, sponsorships, single/recurring contribution intents |
| **Fundraiser Store** | Verified event/campaign organizer | Event Builder Flight or campaign | Tickets/registrations, merchandise, sponsorships, pledge intents and wish lists for a chosen beneficiary |

**Nonprofit is an organization type; fundraiser is a campaign/event context.** A for-profit business can organize a fundraiser benefiting a distinct nonprofit without becoming the nonprofit itself.

## Keep legal and financial identities separate

A normalized store distinguishes:
1. **Owning organization:** who created the Hangar storefront and controls its brand.
2. **Event/campaign:** optional parent Flight/fundraising campaign.
3. **Seller / merchant of record:** responsible for each item and related taxes, delivery and refunds.
4. **Intended nonprofit beneficiary:** to whom fundraised contributions or stated proceeds are intended.
5. **Verified settlement/payout recipient:** provider-verified payee, which may be different from owner or beneficiary.
6. **EIG fees:** separately agreed, disclosed fees. An arbitrary link to another store does not generate a commission.
7. **Payment provenance and delivery:** event, product, purchaser consent, ledger entries, status, proof of fulfillment, refund and chargeback.

A selected beneficiary field **does not transfer money**. Do not infer tax-deductible status or promise tax receipts based on store type, nonprofit name, or a donation-like button. Charitable contributions, merchandise, sponsorships and tickets need their own accounting, disclosure and regulatory treatment. Verify terms with the processor and qualified advisors.

## Reuse existing EP capabilities

- **Identity:** same account-first policy and roles for tracked actions; visitors can browse permitted public listings.
- **Universal Product Registry:** products, variants, vendor sources, approved imagery, current prices, fulfillment rules, Shopify and other authorized e-commerce integrations.
- **Event Builder:** fundraiser references its owning Flight/campaign, existing tickets, participants and sponsors rather than recreating the event.
- **EP Registry:** charity wish lists, gift claims and group purchases connected to supported existing and external products.
- **InceptionApex:** approved branding, event artwork, promotional proofing.
- **Squawk Box:** direct consent-aware order, event and donation status updates, after proper permission and outbox checks.
- **Sales Engine:** agreements, provider-specific checkout, separate seller/beneficiary attribution, optional transparent service fees and commission calculation.
- **Operation:** self-service, EIG-managed or hybrid with explicit, revocable delegation, owner approvals and audit history.
- **Build Lab:** proactively detect missing storefront ownership, fundraiser routing, beneficiary verification, charitable receipts and event/store reuse.

## Intended production data model, not yet implemented

- Storefront points to canonical owning organization, optional event, store type, visibility, approval status and operating mode.
- Fundraising campaign points to its beneficiary nonprofit, verified status, date, declared goal and legal disclosures.
- Listings reference existing canonical vendor product IDs; no duplicate shadow inventory.
- Item-level seller, source platform, quote/availability timestamp, price and fulfillment.
- Orders and sponsorship purchase flows distinct from donation/contribution intents and confirmed provider events.
- Reconciliation/receipt, refund/chargeback, consent preferences, delegated access, outbox and immutable history.

**Security:** tenant-scoped RLS and trusted server authorization for each action; generic authenticated access is insufficient. A nonprofit owner cannot access another organization's donor records. Payment provider webhooks must be verified and idempotent. Visitor/public projections never expose payout details or private preference data.

## Private prototype, built in development branch

- src/lib/epUnifiedStore.mjs: pure, no-I/O shared domain with fictional organizations, events, vendor products and contribution placeholder items.
- src/components/EpUnifiedStorePilot.jsx and CSS: protected Build Lab Store Structures tab.
- tests/ep-unified-store.test.mjs: verifies all store types, linked event and beneficiary checks, catalog reuse, no-live-transactions.
- tests/eig-build-lab-browser.cjs: verifies selecting/creating/reviewing three example stores and downloading a safe draft.

The tab offers Hangar Store, Nonprofit Store or Fundraiser Store, owner, optional event, intended nonprofit beneficiary, optional fundraising goal, operating model, and fictional product catalog. Approving a demo draft only locks the private preview.

**Everything is fictional.** This prototype does not read customer records, create a real organization, make any donation, charge a card, issue a gift card, grant EIG access, publish a store, connect a bank account, send notifications or produce a tax receipt. The current Sandbox schema inspection found general organizations, events, products and sponsorship tables, but no dedicated fundraising commerce/donation-ledger implementation.

## Delivery gates

1. **Identity/permissions:** verified owning Hangar, legal nonprofit eligibility verification, scoped Pilot/Co-Pilot/ATC/EIG delegate rights and approval.
2. **Catalog reuse:** vendor-owned products, multiple approved sales channels, event tickets/sponsorships, wish lists; real availability and seller rights.
3. **Payment/giving contracts:** merchant of record by line, verified payee and supported split, tax/receipt disclosures, transparent EIG fees, subscription cancellation.
4. **Synthetic Sandbox journey:** separate business, charity, event, shopkeeper, fundraiser and buyer accounts; no cross-tenant leaks or double order; correct ownership and receipts.
5. **Controlled rollout:** launch only after owner-approved privacy, security, financial and operational tests.

**Do not make a live nonprofit donation form or store checkout merely by turning on the Store Type selector.**
