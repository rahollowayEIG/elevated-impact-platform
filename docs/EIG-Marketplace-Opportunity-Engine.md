# EIG Marketplace Opportunity & Warehouse Pilot
Status: isolated draft foundation, **not a live marketplace scanner** | October 15, 2026

## Goal
Identify wholesale products with verifiable demand and profitable marketplace economics, using EIG's available warehouse space where justified. First customer: EIG-owned retail operations. Later: optional Hangar service using canonical EIC Product Registry and services/entitlement controls.

## Current implementation
`src/lib/marketplaceOpportunity.mjs` is a deterministic, offline opportunity scoring contract with regression tests. It validates input financial assumptions and flags supplier authorization, marketplace eligibility, evidence-backed demand, inventory limits, and unit economics. It only marks an item as **eligible for human purchase review**; it never purchases inventory, publishes listings, charges money, scrapes websites, or changes production data.

## Data adapters to implement next
1. **Supplier feed:** approved SKU, GTIN, wholesale price, available quantity, minimum order quantity, lead time, MAP/brand restrictions, fulfillment rights, invoices, timestamp and written supplier authorization.
2. **Marketplace intelligence:** official API or authorized research-source offer, price, availability and historical/sales-demand evidence with provenance. **Do not assume missing offers prove demand.** Check API licenses and rate limits; seller inventory APIs generally reveal *our* inventory, not universal out-of-stock listings.
3. **Fees and shipping:** authoritative per-category fees, measured package size/weight, destination zones, shipping labels, returns allowance, advertising, storage cost, taxes/overhead as appropriate.
4. **Warehouse:** EIG physical bins, receiving, barcode labels, lot/serial where needed, units reserved, pick/pack/ship, tracking, returns and reconciliation. Distinguish available, inbound, committed and damaged stock.
5. **Sales:** merchant-authorized Amazon Selling Partner API and Walmart Marketplace API for eligible listings, inventory and orders, with scoped credentials and idempotency.

## Opportunity pipeline
Acquire permissioned supplier/catalog inputs -> match by exact product identifiers and variant -> enrich with authorized marketplace price/stock/eligibility data -> require independent demand signal -> conservative margin estimate -> review queue -> owner-approved small test purchase -> receiving and verified counts -> reviewed listing -> orders -> shipping and reconciliation -> post-sale margin and returns review.

## Business gates
- EIG or authorized Hangar personnel must approve suppliers, supplier agreement, margin policy, product purchase budget, listing eligibility, and any order before first launch.
- No retail-to-retail dropshipping, marketplace restriction evasion, unauthorized brand listings or inventory misrepresentation.
- No purchases, price changes, public listings, customer messages or fulfillment actions from AI output without their separately approved automation policy.
- Monitor profit **after** fees, shipping, returns, storage, marketing, handling and labor. Reject weak or unreliable data.
- Track forecasting errors, stranded stock, age of inventory, return rates, cancellation rate and actual contribution margin.
- Future automation may reprice within owner-approved floors and synchronize *verified* inventory, but cannot buy stock on its own until explicitly configured and authorized.
- Dedicated staging first; do not migrate production or launch connected APIs without credentials, entitlements and review.

## First pilot acceptance tests
- Import a synthetic supplier price list of at least 25 products.
- Reject malformed, unauthorized or negative-margin opportunities.
- Show exact source evidence and timestamps for all demand claims.
- Output top-ranked items with review status; no auto-purchase.
- Test 3 to 5 physically manageable products using documented wholesale sourcing and seller approval.
- Compare predictions to real delivered margin after 30 days.

## Priority
P0: offline scorer and tests (this branch)
P1: synthetic CSV feed importer, review UI inside private Build Lab and persistent approval/audit
P2: authorized marketplace offer/demand adapters and actual fee schedule
P3: warehouse receiving, bins, pick/pack/ship and synced seller inventory
P4: first approved live listings and pilot orders
P5: Hangar-facing service and fulfillment provider options
