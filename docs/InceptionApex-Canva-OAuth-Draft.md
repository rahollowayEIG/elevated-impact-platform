# Canva Connect for InceptionApex: draft OAuth gateway

**Status October 15, 2026:** Draft code, migration, and feature-gated EIG-only Connect Canva UI on an isolated GitHub branch. **Not deployed, not tested with a real Canva account, and not enabled in the live UI.** The current Canva app remains Draft. The owner's test design is named `InceptionApex-Flyer`.

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
- Browser flag `VITE_INCEPTION_CANVA_CONNECT_ENABLED=true` is non-secret, intentionally unset by default. It only displays an EIG-admin pilot panel; backend authorization still validates the user and scope. Do not set in the live production deployment yet.

## Rollout gates / known blockers

1. Restore migration-baseline integrity before applying any new migration. The earlier Supabase preview branch failed migration replay and was deleted. **Do not run this migration against production now.**
2. Validate Edge routing for `/functions/v1/inception-canva-oauth` (POST initiate and GET callback) in a disposable, correctly isolated test environment. Supabase JWT verification must permit Canva's unauthenticated GET to the callback **while leaving POST initiation independently bearer-authenticated**. Evaluate function gateway `verify_jwt` configuration and fail closed.
3. Validate Canva token request encoding, exact scopes, token response fields and `GET /users/me` response against current Canva docs with a real developer test account. Verify denied consent, expiration, concurrent requests, revoked EIG membership, replay and failures without secret leakage.
4. Review database privileges and encryption code, run Node and Supabase DB tests and then CI. Test state expiry, atomic uniqueness, upsert idempotency and append-only audit.
5. Deploy the callback only after environment review. Obtain and confirm its exact HTTPS URL; then owner adds **that exact URL** to Canva Redirect URLs. Only then generate and store the client secret.
6. The feature-gated EIG-admin InceptionApex "Connect Canva" and "Refresh status" controls are drafted. Confirm them in an isolated preview, test actual OAuth/reconnect/revocation, implement disconnect and then design handoff. No customer enablement or public Canva app submission until security/review requirements are met.

## Selected Canva scopes

`asset:read`, `asset:write`, `brandtemplate:content:read`, `brandtemplate:meta:read`, `design:content:read`, `design:content:write`, `design:meta:read`, `profile:read`.

Brand-template functionality may require specific Canva subscriptions. Keep optional features separate from the minimum required connection scopes during review. No MCP, permissions management, folder management, or comments yet.

Official docs: https://www.canva.dev/docs/connect/authentication/ ; https://www.canva.dev/docs/connect/api-requests/ ; https://www.canva.dev/docs/connect/endpoints/users/get-user-profile/.

## UI flow prepared

The InceptionApex footer offers Connect Canva and a non-secret connection-status check only if (a) the existing membership-based `canUseResizer` EIG admin eligibility is true and (b) `VITE_INCEPTION_CANVA_CONNECT_ENABLED=true`. The server independently rechecks the account, interactive session and current EIG admin membership for both requests. The backend POST operation is either `connect` or `status`; Canva calls back to the same Edge function root with GET. UI redirects to Canva's verified authorization URL and, on return to ElevationPilot, checks status again.

**No user action currently needed.** The `InceptionApex-Flyer` is saved in Canva as an owner-selected pilot design, but this draft does not read or edit it. Real Canva design exchange, disconnect, environment validation and test-run sign-off remain blockers.

## Repeatable onboarding and version-entitlement architecture (required before customer rollout)

**Owner requirement, October 15, 2026:** This Canva connection must become a reusable step in ElevationPilot's shared provisioning/onboarding flow based on the edition or service package chosen. The EIG-only pilot is NOT the final entitlement system. Do not simply remove the admin-only guard to make Canva customer-facing.

### Single provisioning flow

1. **Organization / Hangar** is the provisioning master, not an isolated Canva account.
2. Identify organization type and selected services; select an **approved offering/edition** and its **published version/revision**, not an unversioned free-text plan name.
3. Resolve **entitlements** (which apps/extensions, actions, provider connectors, quotas/limits and specific eligible features), then contextual **permissions** (Pilot/Co-Pilot/ATC/Passenger or another approved role) from the canonical identity model.
4. Provision shared apps, organization resources (approved brand assets/templates, workspace and mapped Drive/Store resources where selected), and display only the setup steps relevant to the user's actual selections.
5. Offer **Connect Canva** only when the resolved entitlement, scoped role and current platform account permit it; grant no provider authority solely because a frontend button exists. Show capability limits and a safe alternative when the selected Canva account's independent subscription/API entitlements lack a requested feature.
6. Connect an external account only after the person explicitly authorizes it. Use the canonical permanent \`person_id\` plus provider account and organization/context mapping. A Supabase login ID alone is not sufficient as the long-term global identity key. Keep each person's/organization's tokens and designs isolated.
7. Preserve user choice of **link only / import selected data / ongoing sync**, where supported. Request progressive minimum scopes. Do not automatically sync every design, do not silently upload sensitive assets, and do not promise provider features unsupported by the linked account.
8. Store the onboarding outcome, source edition/version, effective entitlements, connection ownership, consent scope and audit/provisioning status. An interrupted onboarding attempt should be safely resumable/idempotent, with no duplicate Hangar, users, Drive folders, accounts or records.

### Distinguish three different "versions"

- **ElevationPilot selected package/edition revision**: Determines what we offer, who may use it, usage/seat limits and what upgrade paths are shown. Exact commercial tiers/prices are open owner decisions; **do not invent tiers, charge Hangar signup fees, or wire speculative billing**.
- **Canva subscription and actual API capabilities**: Independent of ElevationPilot's offering. Verify the connected account's available operations at use time and provide appropriate fallbacks rather than inferring availability from a UI label. Higher-level provider features must not automatically appear for everyone.
- **InceptionApex software release + artwork version**: Release compatibility and design revision/approval history are separate from both commercial entitlements. A later package change must not rewrite or silently re-approve prior artwork.

### Lifecycle and minimum tests

- New signup, existing Pilot adding InceptionApex, existing user in multiple Hangars, EIG internal pilot, and invited user with no entitlement.
- Connect, deny, expired callback, resume onboarding, revoked platform session, reconnect, explicit disconnect/revoke and opt-in selective import.
- Upgrade, downgrade or suspend a selected edition without sharing tokens or deleting legitimate approved artwork; server must recompute access rather than trusting stale browser controls.
- Canva account unable to use an advanced feature: show honest limits and supported alternatives, avoid forced upgrade/purchase.
- Separate sandbox vs production, secret storage, role/organization boundaries, audit, and no cross-tenant data leakage.
- Automated configuration/provisioning tests for each published offering version before exposing it to users.

**Required engineering changes before extending beyond EIG:** Replace the hard-coded \`eig_admin\` rollout gate with centrally resolved, server-enforced app/feature entitlements plus scoped role checks. Migrate pilot-only OAuth connection ownership from \`actor_user_id\` toward the canonical \`person_id\` and explicit provider/account/organization context with a reviewed migration and access policy. Do not expose EIG pilot credential mappings to other organizations. Align with [ElevationPilot User & Identity Rules](ElevationPilot-User-Identity-Rules.md) §§1, 9, 12, 13 and [InceptionApex App Architecture](InceptionApex-App-Architecture.md). This is a **design requirement**, not code already implemented.
