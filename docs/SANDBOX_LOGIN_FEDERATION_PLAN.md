# Existing ElevationPilot Credentials for the Isolated Sandbox

**Status: design and security-gate proposal, NOT an enabled login bridge.** No production Auth settings, signing keys, URLs, sessions, passwords, or data have been changed by this document.

## Goal

An approved tester signs in once using the same **existing ElevationPilot login** as Live, then receives a **different independent Sandbox session**. A sandbox-only Practice Role selector operates with the tester's separate sandbox membership records. Practice events, ads, rosters, messages, payments and settings can never modify the live application.

We do **not** copy production passwords, use a production JWT as the sandbox database credential, pass tokens in URLs, or give sandbox browser code a service-role key.

## Preferred secure connection to evaluate

Supabase documents an **OAuth 2.1 / OpenID Connect server** feature where the existing Live Supabase Auth project can act as an identity provider. This is currently labeled **beta**, so do not enable it on Live without a separate reviewed plan and explicit approval.

Official docs:
- https://supabase.com/docs/guides/auth/oauth-server
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/third-party/custom-oidc

Proposed flow:

1. Tester clicks **Sign in with ElevationPilot** on the Sandbox; Sandbox never renders or receives a password form for Live credentials.
2. Browser redirects using **OAuth authorization code + PKCE**, exact registered callback, short expiry, nonce and state. User authenticates on the **actual Live ElevationPilot sign-in origin**, not on a sandbox form.
3. A trusted authentication broker validates issuer, audience/client ID, PKCE state, nonce, signature via approved JWKS, expiry and the verified user identity. Reject unverified email, unauthorized clients, and mismatched redirects. Make sure OAuth client scopes are minimal: identity only.
4. The broker uses **only the verified identity assertion** to locate or provision a **separate sandbox Auth user with a sandbox-specific UUID** through the official Supabase Auth Admin API. No password copying, direct persistent SQL inserts into auth.users, or shared Auth session.
5. Create a new **sandbox-native session** using an official one-time sandbox Auth sign-in exchange (details to prove in a private prototype). Never place the Live provider's access token, Sandbox session token, Auth Admin key, or one-time secret in the browser URL, local logs, or third-party referrers.
6. Enroll the separate sandbox user in its isolated practice organization and scoped tester allowlist under trusted operator controls. Role switching is handled by the sandbox-only RPCs in PR #66 and ordinary application RLS.
7. Keep Live and Sandbox sessions, cookies, refresh tokens, logout and permissions independent. Stop/disable access if tester authorization is revoked.

**Important:** A Live-issued OAuth access token may itself be valid for Live APIs. Strict production `client_id`/audience-scoped access and RLS review are required before turning on an OAuth client. The broker must discard that access token as soon as identity is verified; no sandbox process may use it to request live user or business data. OIDC ID tokens may require switching the production issuer to an **asymmetric JWT signing key**. Such a change affects Live and requires separate migration and regression planning. Do not treat the beta OAuth feature as something that can be enabled silently.

## Why not simply add Live Supabase JWTs as Sandbox credentials?

Sandbox database schemas use normal `auth.uid()` values and FKs to **its own** `auth.users` identities. Third-party OIDC auth directly at the sandbox API would retain the provider's subject ID rather than automatically minting a compatible, independent sandbox Auth user. That can break existing FK and permission semantics and improperly mix identity domains. The broker's independent sandbox account/session avoids that problem.

## What can be completed without touching production now

- Install and verify the single-tester Sandbox role-switching backend in the isolated test project (done, October 19).
- Test transactional role changes and unauthorized/cross-tenant denials with rollback-only fictional identities (done, October 19).
- Keep the sandbox-only role selector and pink branding in draft GitHub branches; do not merge to Live.
- Build the read-only optional miniature Practice Pack catalog (created in separate draft PR #65).
- Prepare Sandbox-safe mail capture and narrowly scoped RLS permissions after identity tests.

## Outstanding decisions and preflight before activating shared login

- Confirm that OAuth 2.1 Server beta is appropriate for the Live production Auth setup, its plan, token signing keys and client scoping.
- Inspect Live Auth URL and provider configuration without changing anything; choose a dedicated consent/login path if needed.
- Decide whether to use the beta OAuth provider or a dedicated broker supported by an existing external IdP. Both must be reviewed before production integration.
- Implement and security-test broker callback/session exchange in a sandbox-only preview, with one-time codes, replay prevention, CSRF, exact origins and sign-out semantics.
- Test with one deliberately approved internal tester before inviting business users.
- Confirm mail, Stripe, SMS, Google Workspace, screen scheduling and outbound webhooks are disabled or redirected to isolated test services.

**Never interpret a green build or pink pages as proof that existing-credential SSO has been activated.** It has not.
