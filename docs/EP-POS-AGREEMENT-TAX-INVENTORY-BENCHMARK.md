# ElevationPilot Shared Commerce, Agreements, Catalog Tax and POS Benchmark
**Architecture review, October 21, 2026. Protected development branch; not a production financial or legal integration.**

## Primary outcome
One sale/order (from Event Builder, POS, Sponsor Builder, Hangar Store, manual invoice, vendor marketplace, advertising, rental or registration) has immutable **order lines**, each referring to a canonical **item/variant** when known. Each line may also reference **agreements, asset reservations, inventory movements, quote/project allocation, tax outcomes and recipient/payment allocations**. No parallel customer, catalog, inventory or finance ledgers per app.

## What existing Chapel Hill materials actually establish
- **Two connected DocuSign eSign templates, both draft, policy-review-required:** CHGC Golf Outing Agreement (seven signing pages) and CHGC Venue Rental Agreement (four signing pages), each with customer/group signer first and Chapel Hill countersigner second. Do not issue, upload modifications or invite signatures until owner/counsel review.
- The CHGC **Venue Contract Builder - Working Draft** has six exhibits: A Event Details, B Selected Services/Add-Ons, C Food & Beverage, D Pricing, E Insurance/Vendors, F Setup/Timeline. Its pricing categorizes Chapel Hill Golf Course physical venue assets; F&B; EIG management/event services; approved third-party add-ons. It states invoices will be issued by EIG unless otherwise agreed in writing: do not confuse contract parties, line-level seller/service provider, merchant of record, invoice issuer and beneficiary.
- The same venue draft contains **unresolved legal policy text** for cancellation, indemnification, weather, and late changes; final legal wording requires counsel.
- An older Chapel Hill clubhouse/tent rental source includes $1,500 for four hours, $375 extra hour, a 50% deposit, $500 security deposit and cleanup rules, but these terms are *historic draft inputs* and not universally approved current rental prices or policies. Do not silently populate live templates.
- A historic golf tee-sign advertising document includes physical ad placements and a three-year offer. Advertising capacity may be a limited placement/resource without being stocked physical inventory.

## Core tables/records for approved future implementation
- organizations, contacts, locations, product_categories (parent_id), products, product_variants, product_supplier_links, product_photos, price_books, product_tax_profiles, tax_jurisdiction_rules, customer_tax_exemptions;
- stock_movements, stock_levels (materialized projection), reservable_assets, slot_allocations; external_inventory_authorities and provider_sync_keys;
- sales/orders, immutable order_line_snapshots, order_payment_allocations, invoice_lines and an invoice-issued snapshot; financial refund/credit ledger;
- agreement_template_versions, agreement_policies, agreement_obligations, agreement_line_links, signature_envelopes, signed_document_manifest and append-only agreement_audit;
- outbox/notifications only after approved actual email and SMS provider integration; no unsolicited texts.

**Key model rule:** products organize what can be sold; inventory records what is physically stocked or time-slot capacity; tax policies determine treatment based on sale context; agreements define requirements and obligations; payment records what was actually collected. These are independent attributes.

## Catalog category hierarchy and tax policies

Sample category tree (illustrative only):
- Golf Operations
  - Pro Shop > Apparel > Hats / Shirts > size-color variants
  - Golf Fees / Lessons
  - Equipment Rentals / Cart Rentals
- Venue / Facility Rentals
  - Clubhouse / Tent / Pavilion / Event Spaces
- Food & Beverage
  - Prepared Food / Beverages / Catering / Service Charges
- Events & Sponsorships
  - Team Registrations / Sponsor Packages / Scarce Ad Placements
- Advertising & Creative
  - Print Ads / Digital Signage / Design Services / Fulfillment
- EIG Management / Vendor Services
  - Coordination / Setup / Printing / Insurance Coordination

Tax decisions should inherit from seller + location + tax jurisdiction + tax-date rules, then category defaults, item/variant and authorized transaction overrides, customer/resale exemptions with preserved certificate evidence. Support multiple component taxes, inclusive/exclusive pricing, taxable bases/discount allocation, fees and mixed baskets. Each invoiced line preserves the **rate, rationale, jurisdiction, policy version, exception and calculation timestamp** for audit.

Do NOT equate 'noninventory' with 'nontaxable.' Unknown tax classification is 'review required', not 0%. Physical items, services, facility rentals, admissions, food and alcohol can have different rules; this blueprint never determines their legal taxability. Pennsylvania rules and other jurisdictions require qualified tax review. A charitable nonprofit label alone does not grant exemption or deductible-receipt eligibility.

## Contract-to-sale lifecycle

1. Order lines created and linked to authorized organization/contact, event, merchant of record, supplier and catalog items where available.
2. Resolve rule matching at **organization / transaction / category / item / line / resource / event** level. A single order may need multiple separate agreements, each with its own legally responsible parties and template version. No automatic legal boilerplate inference from AI.
3. Preview contract exhibits based on signed-off order-line snapshots, vendor insurance/COI, selected assets, venue layout, dates, guest counts, add-ons, deposit schedules and payment terms.
4. Owner/authorized staff reviews; DocuSign template/envelope draft is prepared with line/order IDs in metadata, so the signed contract is traceable to immutable source lines.
5. E-signing order and consent are explicit. Envelope status changes from verified DocuSign Connect webhook (signature checked, retries/idempotency, tenant authorization), not from browser speculation. Archive signed version and completion certificate in authorized Drive/Storage path.
6. If terms, counts, services or prices change after signing, create an amendment with explicit approval, do not overwrite original signed agreement.
7. Fulfillment/asset reservations or checkout can be conditioned on signature/deposit/insurance requirements by policy. Status must distinguish tentative quote, paid deposit, both signers complete and final confirmation.
8. Supplier/vendor agreements, individual releases, catering agreements, advertising contracts, multi-year sponsorships and rental agreements reuse this engine; not every $2 merchandise sale needs a DocuSign envelope.

**Never double-collect deposits**: deposits and refundable security deposits need distinct accounting obligations from sales revenue, inventory and ordinary cancellation fees.

## Inventory governance and Double Sync
- Use canonical org + product variant + physical location identifiers, not description-based equality.
- One provider owns each stock balance or there is one explicit EP-authoritative ledger. Provider stock changes come from verified webhook/order IDs and idempotent transaction lines.
- Draft/unissued invoice lines do not automatically decrement stock; reservations and fulfillment may have different availability states.
- When an older custom invoice line is matched to a product, propose a missing historical deduction only if fulfilled, not already accounted for and within verified stock authority; require approval/audit.
- Multiple branches, serial/lot items, return/disposal and bundled goods need separate location/resource movements.

## POS comparison based on current official documentation (October 2026)

| System | Adopt the architectural idea | Evidence |
| --- | --- | --- |
| Square | Product/service Catalog Objects, item variations and tax objects; Orders API + Inventory API + webhooks; source version/idempotency | https://developer.squareup.com/docs/catalog-api/build-with-catalog ; https://developer.squareup.com/docs/webhooks/overview |
| Shopify | Variant + InventoryItem + InventoryLevel/location per quantity state; external SKU/barcode mapping; provider-owned inventory | https://shopify.dev/docs/api/admin-graphql/latest/objects/ProductVariant ; https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel |
| Lightspeed Retail X-Series | Outlet tax defaults with product overrides; API OAuth/add-on access and separate sales/tax IDs; practical retailer sync | https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534056135963-Setting-up-taxes ; https://x-series-api.lightspeedhq.com/docs/sync_sale_into_vend |
| Toast | Menu > group > item tax inheritance, independent modifiers, menu/checkout context; specialize as F&B adapter | https://doc.toasttab.com/doc/platformguide/platformMenuManagerWorkingWithMenuItems.html |
| foreUP | Golf tee-sheet and customer/pass/membership/store billing integrated with pro-shop/F&B/POS, not just barcoded products | https://www.foreupgolf.com/golf-course-point-of-sale/ |
| Clover | Catalog items have categories, inventory, stock, assigned tax rates and modifiers | https://docs.clover.com/dev/reference/inventorycreateitem |

**Initial integration candidates**: Square and Shopify for general-purpose item, order and inventory API; foreUP as golf-specific functional benchmark; Lightspeed Retail for outlet/tax structure; Toast for F&B; Clover for flexible merchant POS. No universal winner until integration permissions, contract/API costs, webhook fidelity, terminal/PCI requirements, refund behavior and actual merchant accounts are evaluated.

## Test-first rollout
A. Master Scanner verifies first-party code and open schema gaps; POS benchmarks remain source-cited **research**, not an automated external app crawl.
B. Owner-authenticated OpenAI scanner review analyzes bounded static findings and proposes improvements for approval, not changes.
C. Begin with a fictional sale containing venue rental + food + merchandise + EIG service. Validate mixed tax review, distinct sellers/payees and at least two conditional agreement requirements. Test signed-before-confirmation, deposits and revisions.
D. Implement cross-org RLS and authoritative ledger in isolated Sandbox. Verify no invoice rewritten, double-stock deduction, unsolicited contracts, default zero-tax, tax receipt hallucination or duplicate collection.
E. Add DocuSign Connect with signed envelope lifecycle, then payment processor/POS adapters one at a time; gate a real rollout on owner acceptance and full tests.

## Build status at documentation time
- **Available**: protected Build Lab manual invoice *demo*, product-capture/double-sync *demo*, source Scanner, existing connected DocuSign *draft templates*, bounded OpenAI connection-test route.
- **New draft-only design helpers**: epCommerceContractReadiness.mjs and tests, no data mutations.
- **Not built**: production transaction or catalog database, verified tax engine, real order/contract line joins, DocuSign webhooks, active merchant POS sync or automated external POS scanning. No contracts or messages sent.
