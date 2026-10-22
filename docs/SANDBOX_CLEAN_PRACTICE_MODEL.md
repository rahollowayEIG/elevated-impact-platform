# ElevationPilot Sandbox: Clean Practice Workspace

**Status:** Approved product direction / implementation in progress. This document defines the desired operation, not a claim that the login bridge, role switcher, data reset, or mail sink is already active.

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

The isolated sandbox currently has schema parity and a small fictional Practice Club / EIG organization setup and one unpublished draft practice event used for structural tests. It has **no live customer data**, currently zero real Auth users, zero public-table/client RPC grants and no deployed Edge Functions. These platform fixtures are not a request to populate normal user workspaces with sample campaigns. Hide/reset scenario fixtures as needed once the safe UX is built.

Avoid any default "Load Latest Live Version" importing data. Future refreshes should update **reviewed schema/configuration code only**, never live customer records or secrets. Require explicit audited field-level approval for any later sanitized settings import.

## Sandbox launch checks

- Pink shell, badge and title appear consistently on login, Airport, Cockpit, ATC, event and creative pages; Live remains unchanged.
- New user starts with no practice campaigns/registrations and can create realistic examples.
- Role switches use valid sandbox permissions, deny cross-tenant access, and retain a record of who tested as which role.
- Created data remains until reset, and reset cannot touch fixtures outside the tester's scoped practice workspace.
- All outgoing communications are captured or verified-tester-only; payments are test-only.
- All cross-origin registration and third-party integration routes reject live destinations.
- Never merge draft sandbox branches or enable public table/RPC grants until validation and user approval.
