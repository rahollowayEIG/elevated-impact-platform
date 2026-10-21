# Sandbox invoice persistence and optional Product Registry promotion

21 October 2026. Isolated development foundation; no hosted schema installation or Live release.

The Manual Invoice Builder can save an **unissued fictional snapshot**, reopen its original lines, and optionally propose an individual line for the shared commerce catalog. One-time lines need no product or proposal. This is not official invoice issuance, a receivable ledger, a receipt, or verified inventory.

## Inspection and ownership

Inspected the Build Lab branch at `4a7d2b04586df5710ddcd7b6cbeb7b88f9c99df1`, which follows the supplied `90e8c6a` inspection, including the invoice, capture, commerce, unified-store, SponsorBuilder, Event Builder and design-catalog code and existing SQL. Read-only inspection of protected `ElevationPilot-Sandbox` confirmed:

| Existing structure | Responsibility | Foundation decision |
|---|---|---|
| `public.products`, organization/event product entitlements | Platform apps and access | Do not insert merchandise here |
| `public.eic_design_products` | Artwork dimensions/specifications | Keep separate; no conversion to priced stock |
| `public.sponsorship_products` | Event offerings, capacities, sold quantities | Preserve event ownership and existing purchase tracking |
| `epProductCapture.mjs`, `epUnifiedStore.mjs` | Fictional capture, duplicate and commerce concepts | Reuse classification and same-organization matching conventions |
| `epCommerceContractReadiness.mjs` | Shared item kinds and inventory/tax blueprint | Reuse `ITEM_KINDS`; do not infer tax classification from inventory |
| Invoice prototype | Browser-memory preview and simulated payments | Keep its no-issue/no-send/no-pay contract intact |

No persistent universal merchandise/service registry was found in the inspected schema. `ep_sandbox_commerce.products` is the first isolated **shared commerce registry slice**, not an invoice-owned catalog. Future POS, Event Builder and capture adapters should consume the same organization/product IDs after a deliberate rollout. This change does not yet connect those applications or migrate their offerings. The Sandbox registry is not automatically copied into Live.

## Data and review contract

- `invoices` contains the entire validated preview snapshot, issuer/recipient/source/date/tax example and all original lines. `invoice_lines` independently stores description, position, quantity and exact-cents price. Saving identical source-preview IDs is idempotent; changed content requires a new preview. There is no edit/delete API for saved history.
- A separate `reviews` record proposes a product for one saved line. Editing name, SKU, description, price, classification or tracking creates another pending review version. Stale versions cannot be approved. Every mutation appends an actor-attributed audit entry; clients cannot rewrite the audit.
- Approval explicitly creates a product only after duplicate rechecking. Normalized same-organization SKU or name candidates block creation. The operator must correct and save the details or explicitly confirm a link to an existing product. No automatic merge or historical rewrite. An organization-row lock and unique indexes enforce the duplicate barrier across independent reviews.
- A dismissed proposal leaves the invoice and its line intact. Approved and linked proposals are final for this small foundation. Repeated approval fails without creating another product.
- Product links live in review records, independently of invoice text and amounts. Subsequent catalog edits do not change saved invoice history.
- Physical merchandise may track inventory; services, sponsorships, advertising and other nonphysical kinds cannot. Rentals/time slots remain a separate availability concern. Approval does **not** initialize, reserve, deduct or backfill stock. There are no inventory movement, fulfillment, payment or delivery tables/APIs here. The existing double-sync prototype remains proposal-only.
- USD only, up to 30 lines, existing preview monetary limits. Tax remains illustrative/unverified. This slice saves immutable snapshots rather than implementing editable, versioned draft invoices or official numbering.

## Permission boundary

All tables are private, RLS-enabled and deny direct `anon`/`authenticated` access. One invoker public RPC calls a narrowly scoped private definer gateway with empty `search_path`. Every request, including list/read/retry, independently requires:

1. Enabled DBA-only configuration and exact configured owner Auth UID; defaults are disabled and unbound.
2. The existing `eig_private.active_builder_session()` check: verified email, active profile, non-banned user and current nonexpired session.
3. Current, active, in-window EIG admin membership in the active EIG organization.
4. The exact Sandbox JWT issuer (`publruuuyvpggogrrgwp`), and an explicit allowlisted active `is_test` organization.

No mutable email, username, user metadata or frontend role boolean grants access. No service-role key is used by the client. Every foreign key for review/product/line scope includes the organization. This owner-only slice deliberately grants no customer/staff finance permissions; those need a separate scoped policy design.

## Reviewable rollout package — not applied

`supabase/sandbox/invoice-product-foundation.sql` deliberately lives **outside automatic migrations**. It starts disabled and creates no users, organizations, products or customer data. Hosted installation/configuration is a separate release step, not part of pushing this branch.

After an approved isolated rollout, an operator must verify the connected database is `ElevationPilot-Sandbox`, inspect the SQL and prerequisites, install it there, bind the exact owner UID, and allowlist an explicitly fictional test organization. No sample owner UUID or customer account is hardcoded into application configuration. Keep the private schema out of exposed Data API schemas; only the public invoker RPC needs exposure. Run Supabase security advisors after installation.

The UI additionally requires `VITE_EP_INVOICE_SANDBOX_ENABLED=true` and the **exact** Sandbox Supabase URL. Missing flags keep the original browser-only preview. The owner-only Build Lab entry gate is unchanged and currently branch-bound; enabling this new branch requires its own approved preview access setup. No environment settings were changed here. Never broaden the existing owner guard to make the UI visible.

Operator journey after installation: open the private invoice pilot; enter fictional details and leave customer email empty; create preview; confirm fictional data; save snapshot under the approved test organization; reload/reopen it; optionally choose a line; correct catalog details; save review; approve creation or confirm an existing-product link. Editing a proposal hides approval until the corrected details are saved. Search and saved-date sorting are included.

Rollback: disable the private config and frontend flag, then rebuild the isolated preview. Retain snapshots/audit for review. Do not drop shared data as a routine rollback.

## Verification and explicit limits

- Local automated tests execute the actual installation SQL and RPC in PGlite (embedded PostgreSQL), under `authenticated` and `anon` roles, using fictional identities and sessions. They cover disk close/reopen, original line history, one-time lines, idempotency, stale versions, duplicate SKU/name prevention, linking, classification, no stock effects, tenant isolation, session revocation/expiry, membership expiry and direct-write denial.
- Two queued approval requests exercise duplicate rechecking; PGlite serializes connections. This is **not** proof of a hosted multi-connection race test. The SQL organization lock and unique indexes are the code-level concurrency protection; test them on hosted Sandbox before release.
- The repository build and all 10 local foundation tests passed. Chromium/full headless-shell downloads returned invalid archives in this workspace, so the browser journey has been added but has not yet passed locally.
- The browser harness uses the real Supabase RPC client and routes its fictional requests into the actual local Postgres gateway. Its purpose is to verify UI → client → SQL → UI, refresh/reopen, edit-before-approval, duplicates, search/sort and revoked session. This does not test hosted PostgREST, protected login or hosted RLS deployment.
- Hosted Sandbox: schema metadata and the existing active-session helper were inspected read-only. The new schema, owner binding, UI, persistence, duplicate workflow and inventory behavior have **not** been installed or verified there. No Live database changes or real invoices/payments/messages occurred.

Run `npm run test:invoice-persistence`, `npm run test:invoice-persistence-browser` (requires Chromium), and `npm run build`. Dedicated `Sandbox Invoice Foundation` CI installs Chromium and runs the fictional SQL/browser checks without Supabase credentials, migrations or deployment permissions.
