# ElevationPilot Sandbox Role Switching (Single Tester Session)

**Status:** Staged on a separate GitHub branch. The role-control interface and database migration are written, but the role backend has been installed and tested in the isolated sandbox. The EIG-role-lock follow-up migration is reviewed separately. Browser use still requires sandbox login federation and app RLS grants. Shared authentication with a user's existing Live credentials is **not yet implemented**. Never enter a Live password in a sandbox login form.

## What changes

The sandbox now has a proposed **Choose Practice Role** control that:
- recognizes only a currently authenticated Sandbox user;
- queries `public.sandbox_practice_role_status` to retrieve server-approved roles;
- calls `public.sandbox_switch_practice_role` when the user chooses a different authorized role;
- performs an ordinary same-origin reload, letting the existing organization membership, event assignment, and RLS checks choose the correct application view.

There are **no fictional-person credentials to juggle** and no browser-side role impersonation. The role selector is intentionally locked if there is no authenticated sandbox tester or the backend is not installed.

## Scope and security

The SQL lives in `sandbox/roles/01_sandbox_role_switch.sql`, **not** in general production migrations. It:
1. refuses to install unless the dedicated fictional sandbox fixtures exist and the project has no non-test organizations;
2. adds a `sandbox_ops.practice_testers` enrollment allowlist controlled only by the sandbox database operator;
3. adds an append-only role-switch audit ledger;
4. grants authenticated callers access **only** to role-status and role-switch RPCs; no grants on underlying practice tester tables;
5. permits only server-approved Pilot, Co-Pilot, ATC and Passenger roles; **EIG Admin is not a selectable business practice role**;
6. updates the tester's memberships in that tester's fictional practice organization only; no headquarters role or global EIG Admin membership is created;
7. refuses unexpected external memberships or assignments instead of deleting them;
8. requires a draft event in the test organization for ATC, and otherwise asks the tester to first create one as Pilot.

**Important:** Reserve EIG platform administration for a **separate EIG-only test environment** when the team needs it. No outside business sandbox can be granted EIG Admin through this selector or its underlying practice tester allowlist. EIG staff should not have cross-tenant practice access. The existing shared sandbox project is treated as business-practice compatible, with EIG Admin locked out.

## Before enabling for people

1. Complete the secure identity broker / federation so Live sign-in credentials are validated through the production identity provider **without sending passwords to Sandbox, reusing Live database sessions or putting Live tokens into URLs**. The Sandbox must issue its own session. This integration is still pending.
2. Ensure the signed-in tester has a profile, Passenger identity, and its **own sandbox-only** practice organization, initially empty. Use supported Supabase Auth/administrative setup, not direct permanent `auth.users` table inserts.
3. After a code/security review, apply the SQL in the **ElevationPilot-Sandbox project ONLY**, and verify the two RPCs. The production project and Vercel production deployment must remain unchanged.
4. Enroll an approved tester by matching its Sandbox Auth UUID, verified email, owned sandbox practice organization and explicitly authorized role set. Only the isolated server-side administrator may enroll testers; do not add a public sign-up-to-admin operation. Leave an account `enabled=false` until confirmed.
5. Test both success and denials across all roles, including role transitions Pilot -> ATC -> Passenger, wrong tenant, unauthorized EIG Admin, and role-switch audit history.
6. Review and enable **narrow** sandbox-only app-table/RPC access after RLS checks. Existing client table grants are deliberately absent. Verify all email, SMS, Stripe, Google, and webhooks are isolated or disabled before any user workflows.
7. Add explicit "Load Example" and "Reset My Practice Workspace" only after each participating app has a safe adapter. Start empty by default.

## Not included in this change

- A shared Live/Sandbox login broker or credential reuse.
- Creation of actual Auth users, orgs or passwords.
- A working Vendor role (the platform roles must support it first).
- A generic RLS bypass, extra live permission, customer-data copy, or automatic imports.
- Production deployment, live accounts, and automatic sandbox DB migrations.

## Verification

Run `node --test tests/sandbox-*.test.mjs` in this feature branch. This includes structural, permission, and fail-closed checks. A passing source-level check does **not** replace real RLS security integration tests against a real signed-in sandbox user.

## EIG internal isolation (locked down in normal sandbox)

Normal sandbox role choices are Pilot, Co-Pilot, ATC, and Passenger. Vendor will be added only when the platform's vendor role is implemented. **EIG Administrator never appears in another company's sandbox.** Staff administration is a distinct use case that should be performed inside a separate, EIG-controlled internal sandbox database/deployment, not by granting a global `eig_admin` membership inside a shared customer practice database. The client-role migration `03_business_sandbox_eig_lock.sql` removes the capability to assign EIG Admin even through the RPC. The backend also rejects users with pre-existing EIG HQ admin membership instead of deleting or repurposing that access. This is enforced server-side and requires security review before allowing additional tenant organizations.
