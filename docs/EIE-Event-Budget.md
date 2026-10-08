# EIE event budget

EIE owns one versioned USD planning budget per golf_registration_events record, connected to the same Hangar and Master Event as registration. Open EIE → event → Budget. This tool records plans and source snapshots; it does not move money, create orders, change roster payments, or send notifications.

## Connected sources

The database reads current sources at open, on focus, every 30 seconds, on explicit refresh, and on save. A refresh updates source figures while preserving manual drafts. A failed refresh visibly labels the last good totals. Private, authorized RPCs expose only event-scoped aggregate amounts, not customer details or payment identifiers.

- EIE roster: sum golf_registrations once. Current team checkout assigns the full team price to its captain and zero to other players, so do not add golf_team_payment_shares or team rows again. Active, unreleased registrations contribute expected income; comps and full refunds contribute zero. Retained received amounts from withdrawn/cancelled registrations still count. Recorded amount_paid less convenience_fee is capped to the registration price. Clubhouse entries do not subtract online convenience fees. If amount_paid is absent on a paid registration, use recorded price and show a count of these status-based receipts.
- Sponsor Builder: read saved event_builder_assets.data.sponsors.sales. Quantity × unit price is a target; only paid sales count as committed/received because the current source has no separate commitment status. Catalog prices alone are not sales. Legacy sponsors/sponsor_purchases tables are not added, preventing automatic duplication across the two sponsorship models.
- Editable registration and sponsorship targets are goals for their connected rows; never additional receipts. Projected income uses the larger target or committed amount for each row.

Partial refunds are not persisted by the current golf webhook as refund amounts. Provider processing fees, bank payouts, external purchases, ticketing, EIC orders and legacy sponsor purchases are **not connected in this release**. Enter outside amounts as manual rows (refunds/fees as manual costs), and do not repeat amounts already in a connected source. No bank-balance or complete accounting claim is made. Later adapters must map stable source IDs, currency, money states and corrections to the same event before inclusion; never sum two representations of one payment.

## Manual planning

Costs record whole quantity, estimated unit price, optional actual total, and paid total. Blank actual uses estimate; actual zero replaces it. Paid cannot exceed actual. Income records target, committed total (including received), and received. Received cannot exceed committed. All entered amounts use integer cents, bounded individually and by row total; up to 250 costs and 250 income rows. Starters suggest categories with zero amounts, not supplier pricing.

Cost forecast sums actual where entered, otherwise estimate. Contingency is a separate percentage of estimated costs. Projected net is projected income less forecast and reserve. Additional funding needed is forecast + reserve + event net goal minus committed income, floored at zero. Cash remaining is received less costs paid; it reflects application records rather than a bank. Suggested sponsor count divides the funding gap by an editable package value and rounds up; it is a target, not promised income.

Manual lists search visible names, categories, sources and notes; headings sort numeric amounts and case-insensitive text with stable ID tie breaks. Filters never change total-budget calculations. Fixed two-row connected sources do not need search/sort. CSV includes source provenance, refresh time, planned/actual/paid amounts and summary. Text formulas are escaped. Unsaved exports identify themselves as drafts.

## Permissions and history

Budget access requires a verified, unbanned active account and current auth.sessions session, an active owning organization, and an authorized scope: trusted super_admin profile, active EIG administration, owning Hangar Pilot/Co-Pilot membership, or event-specific ATC assignment. Membership and assignment start/end windows are freshly checked on every read/save; Crew/Passenger and unrelated events have no budget access. User-editable metadata is never authorization.

Exposed tables have RLS, no anon access, and no direct authenticated writes/deletes. Public invoker RPC wrappers call narrowly scoped private definer functions that recheck authorization, validate input and compare expected versions. Each save atomically appends immutable budget data, authoritative source totals at save time, actor ID and timestamp. Stale saves keep the draft and offer export/reload. Budget history shows the count and latest 10 editor/time records as the event's informational audit drill-down; snapshots are retained for audit, with no restore/delete flow.

Changes are guarded on event/app navigation and browser unload. Sponsor/roster source actions save pending budget changes before navigating. Paid purchase flows are not introduced here; the EIG paid-upgrade sponsorship reminder still applies wherever future checkout is added.

## Completion audit — October 8, 2026

- Visual/cosmetic: EIG navy/blue cards, red primary actions, focused editing panel, responsive layouts, contained horizontal tables, accessible labels and headings.
- Functional: real Supabase client RPC requests tested against isolated browser fixtures; actual migration executed in PGlite for aggregation, permissions, fresh sessions, scope, revoked access, validation, compare-and-swap and audit snapshots. Save/reopen, manual validation, automatic refresh without draft loss, conflicts, CSV, source navigation and mobile width covered. Existing event packet browser flow retained.
- Smell test: system rows remain read-only; prices do not become receipts; received is not added a second time to committed; full team payments are not multiplied by roster size. Financial source limitations are visible. No customer payment/order changes or communications were used in tests.
