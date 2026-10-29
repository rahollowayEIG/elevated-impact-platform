# ElevationPilot Universal Invoicing: Master Scanner and Manual Draft Pilot

## Owner requirement (21 October 2026)
The first practical outcome is simple: an authorized EIG or Hangar operator creates an invoice manually, reviews it, issues it, and explicitly chooses **Email** or **Text** delivery, or downloads a printable PDF. This must not wait for fully automated integrations. However, demo-mode drafts must never masquerade as officially issued invoices.

One shared invoice system will later support sponsorships, events, stores, advertising/printing, nonprofits, fundraisers and other services. Reuse an established merchant-of-record/payment provider rather than creating duplicate processor ledgers.

## Verified existing foundations
Read-only inspection of Live and Sandbox public schemas on October 21, 2026 found:
- billing_accounts: organization, billing email, external Stripe customer reference, invoice terms, automatic credit preferences and status.
- eig_credit_ledger: scoped credit entries, source reference and lifecycle.
- sponsor_purchases: sponsor/product/event amount and payment status.
- golf_event_payment_settings and golf_team_payment_shares: event-scoped payment rules and responsibilities.
- **No invoices or invoice_lines tables in either environment.** There is no confirmed issued-invoice service or invoice delivery ledger.
- Existing SponsorBuilder has manual invoice_sent tracking, NOT an invoice service.
- Event Budget is a planning view and not proof of received/collected money.

## Built in the protected feature branch
- src/lib/epInvoiceDraft.mjs: safe pure domain validation, exact-cents totals, lines, example tax percentage, recipient and issuer, demo approval, simulated partial payment and copyable demo email/text wording.
- src/components/EpInvoicePilot.jsx and CSS: **Manual Invoice Builder · Private Pilot** in owner-only Build Lab with line-editor, draft review, printable preview / browser Print to Save as PDF, JSON backup, sample email/text copy and simulated balance updates.
- tests/ep-invoice-draft.test.mjs: deterministic tests for monetary precision, fake tax labeling, statuses, no-send and no-payment protections.
- tests/eig-build-lab-browser.cjs: synthetic browser journey for multi-line sponsor invoice, review, text/email wording, local-only approval and mock partial payment.
- server/eig-master-source-scan.cjs: invoice module now actually inspects the fixed allowlisted source/UI/tests, existing sponsor manual tracking and invoice-related DB baseline names. Its report **stays review_needed** because official invoices / invoice_lines storage and payment/delivery architecture are absent.

**Important:** The demo accepts only example/test details; it is not an issued invoice, record of debt, tax-certified bill, or real payment request. No verified payee, official number, live email/SMS, public payment link, connected phone number, merchant charge, auto reminder, production database row or customer record is created. Browser-local fields clear on refresh. The scanner's source and test markers show code exists, not that a user can send a real bill.

## MVP implementation gates

1. **Financial/identity contracts:** verified organization issuer and payee, invoice owner, customer recipient, source app/event/activity, entity status and authorized Pilot/Co-Pilot/EIG delegate. Separate Hangar invoices from EIG invoices.
2. **Secure persistence:** typed invoices, invoice_lines, append-only audit and per-channel delivery attempts under organization-scoped RLS; immutable issued snapshots and atomic, unique organization-specific invoice numbering. Never add public permissive writes or generate invoice numbers in the browser.
3. **Manual composer:** real create/save/reopen/edit draft, add/remove price/quantity/tax/discount/terms, approved branding, issuer address and payee instructions, due date, customer contact, searchable/sortable invoice list. PDF generated from issued snapshot with traceable version.
4. **Owner-approved delivery:** email and SMS outbound with explicit customer channel/consent rules, delivery templates, cost disclosure, retries, recipient checks and immutable send log. No bulk unsolicited texts. PDF attachment via appropriate provider; SMS can link to an authenticated/permission-safe hosted invoice, not assume an attachment is supported.
5. **Actual payments:** card/payment links only after verified payment processor authorization, appropriate merchant of record and contract; manually entered cash/check receipts marked separately from provider-confirmed payments. Partial payments, credits, overpayments, refund/void and chargeback lifecycle reconciled idempotently to the trusted payment source, with no double-count in Event Budget / vertical financials.
6. **Security and functionality scanner:** synthetic Sandbox tests for cross-tenant access denial, owner impersonation, invoice number collision, tax/rounding, stale totals, real draft persistence, email/text send approval (mock provider), delivery failures, exported PDF, correct credits, partial payments and actual outstanding balance. Every automatic finding must cite tested evidence and be reviewable before code changes or release.

## Release rules

Only the protected development branch is modified. The invoice Master Scanner is read-only and uses dated metadata snapshots, not live customer rows. No existing Live/Sandbox schema was migrated, and no real messages or payments were attempted.

Initial launch milestone: one EIG/Hangar operator creates a real invoice with accurate issuer details, saves it, gets an official invoice number, explicitly sends one email or text, reopens the invoice, and sees a verified balance. Expand to automation and external storefronts afterwards.
