# ElevationPilot Sandbox: Clean Practice Workspace

**Verified status, October 19, 2026:** The isolated Sandbox **has one real verified tester, six-digit Sandbox email-code sign-in and server-enforced Pilot/Co-Pilot/ATC/Passenger practice roles**. The pink entry notice, account/role header and role switching were browser-tested by the owner. **The full ElevationPilot application is still locked**, and shared-credential sign-in, mail sink, payments/test adapters, reset and full UI scanner have NOT been activated. This document distinguishes the working baseline from future functionality.

## What a business owner should experience

Open the separate pink **ElevationPilot Sandbox**, sign in once as an approved tester, select a role to practice, and use the same screens and workflows as the real platform.

1. **Clean starting workspace.** No live customers, event registrations, payment details, email conversations, coupons, or ad campaigns. An owner can create an event, build an ad, add players, and practice fulfillment. Do not automatically import production data.
2. **Stay saved during practice.** Work persists within this isolated practice workspace while testers change pages and roles. Avoid clearing work on each page load or logout.
3. **Easy reset.** Later add an explicitly confirmed **Reset My Practice Workspace** action scoped to the tester's sandbox-only organization and practice entities. Never run it on the production project. Keep a separate protected system-setup fixture for role/security tests if necessary; do not expose it as a real customer record.
4. **Same product experience.** Use the existing event and creative builders, player management, ad campaign tools, contracts and other modules as the application gains sandbox-ready integrations. Keep workflow behavior close to Live without creating a second implementation.
5. **Unmistakable practice branding.** All pages served by the sandbox origin have bright pink shell and navigation styling, a visible SANDBOX badge and a different window title. Live's EIG colors do not change. Page color is only a human-visible cue, **never** the isolation boundary.

## Identity and role testing

Target UX: the authorized tester uses their existing real ElevationPilot identity to authenticate through a **trusted identity federation / broker** that grants an independent, restricted sandbox session. Do not duplicate or sync passwords, use production session tokens as sandbox DB credentials, place privileged keys in the browser, or give the sandbox access to production records. The same address can be used as the tester's contact identity when separately verified.

Present a role selector for EIG Admin / Pilot / Co-Pilot / ATC / Passenger / Vendor. Role switching must use **actual sandbox-scoped identity/permission contexts**, not a front-end drop-down that only hides pages while bypassing database RLS. Permit authorized test roles only, log the tester responsible for each action, and keep test organizations/records tenant-scoped.

**Current implementation differs:** PR #63 has five fictional personas and a real password-based account switcher; those five Auth logins are not yet provisioned. Shared-identity login and easy role switching are a *proposed simplification* that requires a secure sandbox-only identity broker and RLS end-to-end testing before release. Do not ask businesses to repeatedly create five accounts as the final design.

## Practice communications and payments

- Route all sandbox emails/Squawk notifications and simulated invitations to a sandbox mailbox/capture viewer, with **opt-in** copy to the verified logged-in tester; identify the intended fictional recipient. No real customer mail, SMS or third-party webhooks.
- Use only fake or isolated payment providers/test mode; show TEST prominently. No real Stripe charges, payouts or live refunds.
- All links, callback URLs, OAuth redirects, storage references and API clients must stay on allowed sandbox origins and dedicated test services. Block contact with live endpoints even when a link or app configuration is wrong.

## Minimal system data

The isolated sandbox has **verified metadata parity** with Live: 71 public tables, 971 columns, 403 constraints, 222 indexes, 131 RLS policies, 25 triggers and 1 view. Sandbox also has two additional sandbox-only practice-role functions, one verified Sandbox Auth tester, a small fictional Practice Club and an unpublished practice event. It has **zero real customer rows copied**, **zero direct browser table grants**, and **2 deployed read-only Edge Functions** versus 24 Edge Functions deployed in Live. The two Sandbox functions are `public-event-squawks` and `golf-my-registrations` (each source byte-verified in Supabase). Their HTTP behavior is not yet browser-tested. These platform fixtures are not permission to auto-populate real customer content or enable all workflows.

Avoid any default "Load Latest Live Version" importing data. Future refreshes should update **reviewed schema/configuration code only**, never live customer records or secrets. Require explicit audited field-level approval for any later sanitized settings import.

## Sandbox launch checks

- Pink shell, badge and title appear consistently on login, Airport, Cockpit, ATC, event and creative pages; Live remains unchanged.
- New user starts with no practice campaigns/registrations and can create realistic examples.
- Role switches use valid sandbox permissions, deny cross-tenant access, and retain a record of who tested as which role.
- Created data remains until reset, and reset cannot touch fixtures outside the tester's scoped practice workspace.
- All outgoing communications are captured or verified-tester-only; payments are test-only.
- All cross-origin registration and third-party integration routes reject live destinations.
- Never merge draft sandbox branches or enable public table/RPC grants until validation and user approval.

## Getting the same Live experience safely (scanner prerequisite, October 19)

**Application parity is a release contract, not a literal production clone.** The protected Sandbox frontend currently descends from deployed Live commit `755328d18863fb20faa54f5b16d7698cf9097c21` with Sandbox-only guards and branding. Keep the **same EP UI/components/routes** by continually syncing reviewed Live releases into the Sandbox branch, checking intended UX differences and actual deployed commit/alias. Never copy real production users, messages, contact lists, registration rows, API credentials or payment methods. Separate test databases and services are a feature, not a parity defect.

**Before enabling `VITE_SANDBOX_WORKSPACE_ENABLED`:**
1. **Browser and server egress:** Use pinned Sandbox Supabase SDK, Sandbox-only browser fetch allowlist (draft implementation in `src/sandbox/sandboxBrowserFetchGuard.mjs`), and independently review XHR, WebSocket, SDKs, Vercel APIs, server webhooks, dynamic redirects, email, SMS, Drive, embeds and payments. Browser fetch guard **alone is NOT sufficient**; block at platform/network/integration boundaries too. Keep full workflow flag OFF until the cross-origin escape inventory and negative tests pass.
2. **Authorized data/API contracts:** Preserve verified schema parity. Grant only minimal reviewed table/RPC access to enrolled tester identities with proven RLS tenant boundaries. Populate only isolated fictional records for the exact module being enabled; independently test denied roles. Do not copy Live grants wholesale: Live currently has 759 direct table grant records and Sandbox intentionally has zero.
3. **Edge Functions and providers:** Live has 24 deployed Edge Functions; Sandbox now has 2 reviewed read-only ports. The remaining 22 still require separate review. Implement/deploy only reviewed test-safe service equivalents or mocks, **never** reuse production Stripe keys, webhook URLs, sender lists, OAuth tokens, service-role keys or file destinations. Safe stubs must report simulation, not pretend real integrations succeeded.
4. **Staged release:** Unlock one verified module at a time through a server-enforced Sandbox-only entitlement or fine-grained feature gate. Start with a read-only scanner/UI parity pilot, then Event Builder and safe registrations with synthetic persistence; follow with Sponsors, InceptionApex, Squawk, payments and other extensions only after their specific guards pass. A single global flag must not bypass isolated module approvals.
5. **Two-way scanner:** For each approved Live release compare intended feature → Sandbox UI and visible Sandbox UI → actual service/data result, using source commit, environment, role, entitlement, synthetic browser trace and PASS/FAIL/BLOCKED/NOT TESTED. Explicitly distinguish intentional placeholders/draft-only work. Reuse existing Master Scanner and Universal Scan Engine; do not create a separate clone scanner.

**Current security posture:** The app-wide workflow gate stays **disabled**. A successful frontend build, matching database schema or visible pink shell does **not** prove a module is functional. Do not turn on the global flag for convenience.
