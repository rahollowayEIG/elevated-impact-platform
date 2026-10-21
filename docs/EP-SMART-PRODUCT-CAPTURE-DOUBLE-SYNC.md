# Smart Product Capture and Inventory Double Sync
**Owner direction, 21 October 2026:** The Universal Product Registry and POS should accept ordinary invoice lines, online product links, and images taken or chosen on a phone. If a product already exists, avoid a duplicate; if it was previously sold as an uncataloged item, reconcile the old sale and inventory **exactly once**, not once per app.

## Intended full product experience
1. **Manual invoice first**: save user-entered item descriptions, prices, quantities, tax context and buyer as immutable invoice-line snapshots. A sellable catalog ID is optional when making the sale.
2. **Capture anywhere**: product code/name, merchant-authorized product URL, mobile camera/gallery images (multiple views), barcode/UPC, manufacturer SKU, receipt, or label. AI image recognition can suggest metadata but not assert it is verified.
3. **Find online**: user-initiated public product search or permissioned supplier/merchant APIs for current official name, variant, source ID, allowed images, manufacturer, SKU, availability and unit. Do not scrape restricted websites or assume seller photos may be copied into EP.
4. **Match before create**: locate exact canonical organization-owned SKU, GTIN/UPC or provider-scoped ID first. Present possible name/visual candidates for confirmation. Never silently merge organizations, item variants, suppliers, or different product IDs just because the names resemble each other.
5. **Add to Catalog or Review Later**: owner confirms item kind, inventory status, multi-location stock, cost, retail price, tax class, preferred supplier, external identifiers, brand imagery rights, unit/package size, SKU/variant and role permissions. One-time non-inventory services need no physical stock.
6. **Double Sync / Backfill**: after explicitly linking old unrecognized sales to a known catalog item, compare fulfilled posted sale lines against the single canonical stock movement ledger. Propose a stock deduction ONLY if the line truly left inventory and has no previous movement through ANY channel. Require approval for historical changes; save sourceLineId/order/provider transaction id as idempotency keys.
7. **Respect inventory authority**: if Shopify, Square, or another provider owns on-hand quantities, query/reconcile through that authorized provider. Do NOT independently decrement a shadow stock balance and import the provider's decrement later as a second removal.
8. **Preserve history**: never rewrite previously issued invoices or payments merely because a product was added to the registry. Store a link from the old line to the canonical product plus auditable reconciliation decisions. Refunds do not automatically return physical stock unless item is returned/re-stocked; returns and negative movements must also be idempotent.
9. **Catch exceptions**: multiple candidate products, unknown GTIN, insufficient stock, cancellations/drafts, bundled products, serial/lot items, multi-location sales, partial fulfillment, backorder, same item from two sources, currency/tax handling and stale provider inventories require inspection rather than guessing.
10. **Cross-system reuse**: same organization-scoped products can be used by POS, Store Engine, Invoice Builder, Event Builder, advertising, contacts, registries, sponsors, contracts and vendor connections. Permissions and entitlements remain separate.

## Private Build Lab prototype, not production
- src/lib/epProductCapture.mjs: synthetic products and historical sale lines, safe image metadata, sanitized HTTPS merchant link, duplicate matching and idempotent stock reconciliation proposals.
- src/components/EpProductCapturePilot.jsx and CSS: "Product Capture" tab inside My Likes + Marketplace Pilot. Includes user-triggered public shopping search, product link, SKU, notes, take-photo input on mobile, device gallery up to five images, local thumbnails, same-Hangar match review and sample historical sale/double-sync review.
- tests/ep-product-capture.test.mjs: URL/query filtering, image type/size and no upload, exact same-Hangar match and no cross-tenant merge, name-only review, stock guard, already-accounted Shopify, draft invoice, service/no-stock and external inventory authority.
- tests/eig-build-lab-browser.cjs: desktop browser workflow and local synthetic phone-photo selection; follows no real merchant links automatically.
- Master Scanner product-registry module: declared code and test checks are not equivalent to verified production behavior or existing authoritative inventory.

This prototype does NOT import online product details, call a search API, upload or analyze photos with AI, persist a catalog to database, apply live inventory adjustments, reverse sales, update a POS, allocate real invoices or contact vendors. Photographs remain browser-local and cannot be recovered after refreshing. JSON drafts export metadata, not original image bytes. The search button opens a separate public search tab. Real third-party lookup and provider integrations require approved credentials, terms and product image rights.

## Release gates
- Verify canonical organization/variant/location structure and permissions in an isolated Sandbox.
- Confirm a catalog record, ID-mapped source channels, movement ledger and reliable per-sale idempotent reconciliation with real provider events.
- Write test-first failure cases: same sale via Shopify and EP, duplicate quick sale, pending invoice vs fulfilled goods, vendor inventory vs local ledger, repeated webhooks, partial returns, bundle sales, ambiguous product/photo match, wrong Hangar, user permission loss and simultaneous checkout.
- Require manual authorization for backfilled movements and never delete historical financial documents or actual stock because of a fuzzy match.
- Release only after verified real Sandbox data flows and explicit owner approval.
