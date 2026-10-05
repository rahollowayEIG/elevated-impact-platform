# User Management security and history build

Date: October 5, 2026. Status: implementation ready for preview review; browser audit pending.

## Behavior

- Administrative labels use trimmed display name, full name, @username, then ElevationPilot User. Same display names remain valid. Existing username/email identifiers stay visible to authorized administrators.
- Manage Roles and Expire / Restore Access shortcuts filter by unique username or immutable account ID.
- Sign Out All Sessions pins the selected account, requires confirmation and a reason, prevents self-targeting and repeated submissions, and records a durable audit event in the same database transaction as session revocation.
- Existing access tokens may work until expiry. This action does not change account status, password, verification, roles, event registrations, or sign-in lock. It sends no email. New sign-ins remain subject to existing restrictions.
- The service-only RPC requires an active, verified, unlocked EIG administrator with an existing session. Reusing a request ID returns the original result and does not revoke a later sign-in.
- Account history records account-status, security-lock, membership-role, event-role, and access-window updates from rollout onward. PostgreSQL triggers capture changes atomically, including paths outside this UI. Trusted service calls carry the validated actor ID; Auth-service writes also receive attributed requested/completed records from the Edge Function.
- History retains immutable actor and target IDs without foreign-key cascades. Auth-service or legacy writes without actor attribution are explicitly shown as System / legacy action. Earlier history is not reconstructed.
- The panel searches and sorts the latest 100 entries. Session revocations have an informational Platform Audit count and account drill-down; they are excluded from the problem count.
- Failed history reads show History unavailable and a refresh instruction, without claiming zero matches or no recorded changes. History-loading errors remain separate from uncertain security-action outcomes. JSON error details from the function are retained when available.

## Verification

- Production build passes all 49 included Node tests.
- Five additional HTTP-handler tests pass under Node 24 (`npm run test:account-security-handler`), exercising active-session validation, exact-account reads and writes, actor attribution, denial, confirmation validation, pagination, and actor labels without real credentials or sessions.
- Edge Function TypeScript syntax passes Node's parser. Full Deno dependency/type checking was blocked by registry connectivity.
- Database rollback fixture passed authorization, self-protection, missing-session rejection, reason validation, exact-account revocation, refresh-token removal, unrelated-session preservation, actor attribution, request idempotency, profile-state history, and membership-role history. Synthetic changes were rolled back.
- RLS and grants prevent anon/authenticated access to audit rows and sensitive RPCs. Definer functions live in the non-exposed eig_private schema; public wrappers use invoker security and are service-role-only.
- Security advisor's RLS-without-policy note for platform_account_audit is intentional: browser roles have no grants and reads go through the authorized Edge Function. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Existing unrelated advisor warnings were not changed by this build.

## Completion audit

- Visual/cosmetic: pending desktop and mobile screenshot review. Uses existing EIG dialog styling, navy card treatment, orange significant-action indicator, focused working panel, keyboard labels, and accessible sortable headings.
- Functional: database and build checks passed. Browser fixtures cover confirmation, cancel/focus restoration, exact target, reason requirement, same-name distinction, history search/sort, failure lockout, self-protection, and mobile overflow; they could not run here because the execution environment denies the sockets Chrome requires.
- Smell test: reviewed immutable targeting, source/derived labels, no impersonation or token collection, no automatic merging, stale async responses, unknown write outcomes, history limits, information severity, and deleted-account drill-down.

## Rollout

The additive database migration has been applied and starts capturing future changes. The shared production Edge Function is deployed as version 25, ACTIVE, with JWT verification enabled. Following Ryan's explicit approval to go directly to production, PR #17 was merged as `5cc4a3c94ffe54dd6fbd45d71c67e33da04617dd`; the production Vercel deployment succeeded and its public assets include the security/history controls. Authenticated acceptance testing with Ryan and Kellie continues.

Ryan and Kellie confirmed the new UI is visible in the Vercel preview. Their screenshot showed the history request failing against version 24, which did not implement `admin_account_history` or `admin_session_signout`. The preview error-state correction is included on this branch. Automatic approval review initially rejected deployment pending explicit production authorization. On October 5, Ryan explicitly approved production deployment; version 25 was deployed at approximately 21:02 UTC. A fresh function read confirmed its source exactly matches the reviewed PR function and JWT verification remains enabled. The database rollback checks and 54 automated tests passed before deployment. No real account sessions were revoked and no emails were sent during deployment verification. Kellie can resume history/session-action testing in the preview.

The stored migration is already applied; do not run it a second time. Version 24 was captured as the deployment baseline. Browser testing of the authenticated workflow remains the next verification step; deployment metadata and public endpoint checks do not substitute for that test.

## Follow-up

Account merges, duplicate resolution, orphan cleanup, report exports, notifications for this action, and session-level UI are outside this build.

Password-change and password-reset-request logging is intentionally excluded at Ryan's direction on October 5; it is not a pending enhancement.

## Revoked-session page behavior

Ryan's test produced a completed session-revocation history record and left zero sessions and refresh tokens for the selected account. Subsequent requests were rejected by Auth with `session_not_found` and returned 401 from platform-invite. Access Dates displayed the generic error alongside a false empty-state message because the browser loaded a cached session without validating it.

The follow-up validates the current session with Auth on page load, token changes, focus, and visibility return, plus every 30 seconds while the tab is visible. A confirmed invalid session clears the current browser's signed-in state using local sign-out; new sign-ins and refreshed tokens are protected from stale checks. Transient outages, rate limits, and server failures do not cause logout. Recovery handling remains separate. Access Dates displays server error details and suppresses its empty-state/list display after a failed read.

Validation: production build and all 61 automated tests pass, including seven session-validity tests and five HTTP-handler tests. Auth/session state was inspected read-only; this follow-up does not revoke sessions, send emails, modify account permissions, or change the production database/function. No visual layout changes are introduced. Full browser acceptance testing remains with Ryan and Kellie.
