# EIG Universal Revenue & Budget Dashboards
Owner direction, October 16, 2026. Architecture blueprint only, not implemented or released.

## Golden rule
Every app and every individual revenue-generating function must offer a reusable budget/profitability panel, with rollups to its App Dashboard and its Organization/Hangar Dashboard. EIG Command Center may see authorized EIG-wide rollups. Do not create a new budget table/calculator for each app; implement one financial metric and reporting service.

## Hierarchy
Revenue Activity (e.g. one Chapel Hill scorecard print batch, one ad placement, a flyover sale, an event, sponsorship package, merchandise order, ticket sale, printing job)
 -> App Dashboard (InceptionApex, Event Builder/EIE, EIC, TV Ad Network, etc.)
 -> Hangar Dashboard (one business/organization, multiple apps)
 -> EIG Command Center (EIG-controlled permissions and cross-business aggregates).

Vertical Financials is the person/business financial home, and should DISPLAY authorized budget and earning summaries, not serve as a second ledger. Distinguish rewards (AirCash/Altitude Loot), sales, cash, deposits, accrued revenue, payable commissions and actual partner-held money. No double counting on rollup.

## Reusable input contract for each activity
- organization_id, app_id, activity_id, project/event/item, lifecycle (draft/approved/live/closed), time period, currency, units.
- Budget version, scenario (conservative/base/optimistic), input provenance (estimate/quote/invoice/payment system) and last updated.
- Forecast income by stream: unit sales, sponsor slots, paid upgrades, discounts, subscriptions, commissions; capacity/inventory and sell-through assumptions.
- Forecast costs by stream: COGS, suppliers/printers, marketing, commissions, platform/payment fees, taxes where applicable, shipping, returns, labor and contingency.
- Actual booked sales, collections, refunds, fees and realized costs from canonical domain records, with source IDs and date.
- Break-even quantity/sponsors, expected gross margin, contribution margin and net operating result. Mark estimates separately from actuals; never call forecasted sponsorships cash received.
- Revenue allocation: record who receives each transaction and how EIG, the Hangar, sponsors and partners divide proceeds; permissions/contract controls determine share.
- Attribution and deduplication: transaction line IDs + allocations; roll up once even if visible in Event Builder, InceptionApex and Commerce.
- Manual adjustment permissions, audit history and export.

## Views
Activity panel: input sliders for assumptions + presets + comparison chart + cost-to-revenue break-even + actionable warnings, modeled after the 20,000-scorecard sponsorship example.
App dashboard: activity portfolio, income/cost by product/project, budget versus actual, unpaid invoices, forecast, funnel conversion, sponsor-slot utilization and drilldown.
Hangar dashboard: consolidated eligible apps, period selection, by-app contribution, overall cashflow indicators and outstanding obligations; permissioned personal vs business separation.
EIG command: portfolio operating metrics, platform/service fees and permissioned aggregate cohort insights; no leakage of independent Hangar private financial details.

## Chapel Hill first acceptance test
20,000 cards/year as initial owner estimate; quantity presets 5k/10k/20k, variable print price, sponsor count/rate, placement capacity, artwork, shipping and other expenses. Compute forecast sponsorship - total estimated cost, and sponsor break-even. Allow photos/QR/flyover costs and ad upsell as scenarios. Explicitly distinguish proposed pricing and unreceived revenue from invoices and verified amounts. Quote choice requires course printer approval.
Target lifecycle: Build Lab inspects opportunity -> InceptionApex designs scorecard -> printing quote -> ad inventory sells sponsor slots -> transaction source of truth produces actuals -> app dashboard -> Hangar dashboard -> Vertical Financials summary.

## Engineering and audit gates
- Canonical organization scoped models with RLS, role-level finance permissions and event/project associations; numbers are server-derived for trusted actuals.
- Shared design-system component, not duplicate app-specific business logic. Searchable/sortable tables.
- Supabase migrations additive, staging only, tests for cross-tenant isolation, multi-currency if adopted, discounts/refunds, allocation balancing and duplicate links, cross-app revenue double count.
- No banking accounts or processing assumed, no autonomous transaction/charges. Implement read-only plan/forecast MVP with manual inputs first, then connect actuals to Stripe/EIC/Event Builder and approved accounting connectors.
- Owner approval required before branch merge, production deployment or partner payout implementation.

## Universal Expense Attribution Rule (owner direction, October 16, 2026)
Any expense entered, estimated, quoted, invoiced, paid, refunded or imported anywhere in ElevationPilot must be accounted for against its corresponding business activity/project/event/order and its owning app and Hangar. Expenses not yet attributable must go to a clearly identified unassigned expense review queue, never disappear or be silently allocated. Costs belonging to multiple activities use transparent percentage/fixed-amount allocations, validated to 100%, with no double counting.

Lifecycle: planned budget -> requested/quoted -> committed purchase/order -> invoice -> actual payment -> refund/credit/adjustment. Track budget, committed, accrued/invoiced, paid and outstanding separately; do not collapse these into one expense figure. Capture vendor, category, document/receipt reference, date, tax/shipping, quantity, currency, invoice/payment IDs, creator/approver, activity associations, and approval trail. An expense can be submitted directly in an app, through FlightDocs OCR/invoices, EIC purchasing, event/venue operations, a printer order, shipment, subscription, or approved accounting/payment integration. All routes use one canonical expense ledger and idempotent source IDs. Original documents remain permissioned in FlightDocs; expense records link rather than duplicating them.

Direct costs (printing, card stock, ad design, sponsor fulfillment, hole photography, flyover production) attach to the corresponding project/activity. Shared overhead (software subscriptions, wages, venue costs, equipment) attaches to the Hangar or business cost center by default, with optional explicit allocation to activities. Activity margin reports identify whether overhead is included and disclose allocation method. Record refunds and reversals rather than deleting financial history.

At every level show: original budget, actual incurred, committed but unpaid, remaining budget, projected total cost, variance, related revenue, gross/contribution/net results, unpaid liabilities, and exceptions. Include alerts for exceeding budget, missing receipts, unassigned expenses, duplicate imports, overdue invoices and approvals. Apply permissions and controls at entry and report time; personal expenditures cannot leak into business reporting unless explicitly authorized.

First pilot: Chapel Hill 20,000 scorecards. Add photographer, creative production, printing, delivery, QR hosting and sponsor commission expense lines. A $1,000 printer invoice allocated to the scorecard project should instantly update that project's cost and forecast/actual comparison and roll up once into InceptionApex and Chapel Hill Hangar dashboards. It must not be counted a second time if the invoice is attached to both FlightDocs and a supplier order.

## Vendor-interchangeable expense pricing (owner direction, October 16)
Expense requirements are canonical and vendor-neutral, e.g. "print 20,000 scorecards." Multiple vendor offers may attach to one requirement. Each offer includes supplier ID, provenance and expiry, quote version, quantity/minimum, specifications, unit price, setup, fulfillment/shipping, taxes, discounts, lead time, image/proof/quality terms, and approval status.
Users may switch the selected candidate supplier before purchase, instantaneously recalculating forecast cost, margin, break-even, activity/app/Hangar rollups, and savings against the same comparable scope. Always label hypothetical versus verified vendor quotes; require like-for-like specification and normalized landed cost. Keep vendor quotes and comparisons as history.
When approved, record the committed quote/version and supplier purchase order. Never overwrite past commitments, issued invoices or payments when selecting a new offer; changes after commitment are a new change order or cancellation/replacement with auditable effects.
Marketplace discovers/comparisons suppliers, FlightDocs holds quote/contract/receipts, shared financial engine derives cost variants, EIC/fulfillment manages orders, Vertical Financials reads actual and forecast reports. Supplier search and suggestions may be automated, purchases and payables require authorized approval.
