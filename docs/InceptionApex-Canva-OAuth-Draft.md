# Canva Connect for InceptionApex: draft OAuth gateway

**Status October 14, 2026:** Draft code and migration on an isolated GitHub branch only. **Not deployed, not tested with a real Canva account, and not connected to the UI.** The current Canva app remains Draft.

## Owner-facing next step

No action in Canva yet. Leave Redirect URL blank; do not generate or paste a secret into chat.

## Scope and controls

- Pilot is EIG-admin only, using the platform's existing verified interactive Supabase account and session guard. External Canva identity is attached to the existing ElevationPilot person/account; never create a second login.
- The browser must POST with its Supabase bearer and correct `Origin` to the protected function root, which returns the authorize URL. Do not put the platform bearer, user_id or refresh token in the authorization URL. State is 32 random bytes, stored only as its SHA-256 digest, with a 10-minute lifetime. PKCE uses a distinct random S256 verifier.
- Canva redirects to the exact pre-registered function root over HTTPS (same URL as POST initiation, using GET for callback). Callback atomically claims the one-time state before exchanging the code, checks the original EIG session/membership again and retrieves Canva identity at `GET /rest/v1/users/me`.
- Service-role-only tables store encrypted Canva refresh tokens using a dedicated AES-256-GCM key; encrypted bytes are never returned to the browser. No token exchange or new connection when scopes are inadequate. Denial/replay paths display generic text without tokens.
- Feature switch `INCEPTION_CANVA_OAUTH_ENABLED` defaults disabled. No authorization callback can operate until verified deployment and complete configuration.
- No design upload, template autofill, image export or creator-tier access is enabled by this draft; build those as separate app-level authorization steps after verified OAuth.

## Required server-only environment values (never in Vite or browser)

- `CANVA_CLIENT_ID`: public client identifier from Canva Configuration.
- `CANVA_CLIENT_SECRET`: secret generated once; store in Supabase Edge Functions Secrets, never chat or GitHub.
- `CANVA_OAUTH_ENCRYPTION_KEY`: 32 cryptographically random bytes encoded as unpadded base64url. Keep a secure backup: losing the key requires users to reconnect. Key rotation needs an explicitly designed re-encryption job.
- `INCEPTION_CANVA_APP_ORIGIN`: verified full production origin, no slash/path (e.g. https://actual-company-host).
- `INCEPTION_CANVA_REDIRECT_URI`: **exact deployed HTTPS Edge function root** (not a guessed sample URL).
- `INCEPTION_CANVA_OAUTH_ENABLED=true` only after tests, real deployed callback, and owner sign-off.

## Rollout gates / known blockers

1. Restore migration-baseline integrity before applying any new migration. The earlier Supabase preview branch failed migration replay and was deleted. **Do not run this migration against production now.**
2. Validate Edge routing for `/functions/v1/inception-canva-oauth` (POST initiate and GET callback) in a disposable, correctly isolated test environment. Supabase JWT verification must permit Canva's unauthenticated GET to the callback **while leaving POST initiation independently bearer-authenticated**. Evaluate function gateway `verify_jwt` configuration and fail closed.
3. Validate Canva token request encoding, exact scopes, token response fields and `GET /users/me` response against current Canva docs with a real developer test account. Verify denied consent, expiration, concurrent requests, revoked EIG membership, replay and failures without secret leakage.
4. Review database privileges and encryption code, run Node and Supabase DB tests and then CI. Test state expiry, atomic uniqueness, upsert idempotency and append-only audit.
5. Deploy the callback only after environment review. Obtain and confirm its exact HTTPS URL; then owner adds **that exact URL** to Canva Redirect URLs. Only then generate and store the client secret.
6. Add a minimal EIG-admin InceptionApex "Connect Canva" control, test authorization and reconnect/disconnect plus revocation, and then design handoff. No customer enablement or public Canva app submission until security/review requirements are met.

## Selected Canva scopes

`asset:read`, `asset:write`, `brandtemplate:content:read`, `brandtemplate:meta:read`, `design:content:read`, `design:content:write`, `design:meta:read`, `profile:read`.

Brand-template functionality may require specific Canva subscriptions. Keep optional features separate from the minimum required connection scopes during review. No MCP, permissions management, folder management, or comments yet.

Official docs: https://www.canva.dev/docs/connect/authentication/ ; https://www.canva.dev/docs/connect/api-requests/ ; https://www.canva.dev/docs/connect/endpoints/users/get-user-profile/.
