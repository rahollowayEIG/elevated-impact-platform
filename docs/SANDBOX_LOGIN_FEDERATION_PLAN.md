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

## Shared-login prototype status (2026-10-19, draft PR #69)

The Sandbox branch now includes:
- `api/sandbox-sso/start.js`: disabled-by-default OAuth authorization-code start with PKCE, fixed production issuer, exact Sandbox origin, a sealed 5-minute cookie, and no URL-borne auth credentials.
- `api/sandbox-sso/callback.js`: verifies the encrypted state cookie and matching state, exchanges the one-time code server-side using a confidential client, verifies ES256 OIDC ID-token signature against the trusted issuer JWKS, checks nonce / issuer / audience / issued-at / expiry / verified email, and discards Live access/refresh tokens.
- `tests/sandbox-shared-oidc-callback.test.mjs`: synthetic EC key and signed-token tests, malicious token and state denial tests, and disabled-by-default safety checks.
- GitHub Actions **Sandbox routing safety** passed for the corresponding commit.

This is **not working SSO yet**. The callback intentionally returns a locked/unavailable response even after a verified identity. It never issues a Sandbox session, creates an Auth user, assigns memberships, or enables a Live API.
Do not enable `SANDBOX_SHARED_LOGIN_BACKEND_READY` or publish a usable sign-in button until these pending items are implemented and independently validated:
1. A dedicated Live OAuth consent/login page and privately registered confidential client with exact Sandbox callback, narrow scopes and explicit user approval to enable OAuth Server beta.
2. A server-owned, tenant-scoped mapping from verified Live issuer+subject to an explicitly approved Sandbox tester; never trust only an email match or an EIG Admin production role.
3. A supported Sandbox-native Auth session handoff (single use, replay resistant, same origin, no URL tokens) after allowlist checks. This may require a linked internal Sandbox Auth record without a separate password.
4. A complete revocation/sign-out audit, browser-level penetration-style negative tests, and outbound-integrations audit before any real app flows are unlocked.
5. Production OAuth client scoping review: a Live OAuth access token must not inadvertently authorize business API reads just because the client was approved.

Live settings, signing keys, user credentials, production data and deployments remain unchanged. Vercel deployment checks may be rate-limited independently of GitHub CI.
