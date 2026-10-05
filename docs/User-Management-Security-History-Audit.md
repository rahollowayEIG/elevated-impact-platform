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

## Verification

- Production build passes all 49 included Node tests.
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

The additive database migration has been applied and starts capturing future changes. The Edge Function and UI updates remain on this PR branch pending the browser audit. Do not merge or describe the UI as live until that audit passes.

Deploy the updated platform-invite function with JWT verification enabled before enabling the UI. The stored migration is already applied; do not run it a second time. The deployed version 24 was captured as the baseline so this change preserves existing invitation, registration, and recovery behavior.

## Follow-up

Account merges, duplicate resolution, orphan cleanup, report exports, notifications for this action, and session-level UI are outside this build.
