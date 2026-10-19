# Live Edge Functions → Isolated Sandbox: first read-only ports

**Status:** Two vetted, read-only deployed Live function sources are pinned to the existing Sandbox project for an isolated pilot. **The overall application remains locked** until approved runtime services, granular RLS/grants, synthetic user records, outbound restrictions and per-role UI checks are complete.

## Why this is not a rebuild

- The **existing** ElevationPilot frontend and schema are already shared with the Sandbox. Its UI is not reproduced by hand.
- Functions that are actually deployed in Live were recovered using the Supabase management source API. They are not all tracked as source files in the live application's main GitHub branch.
- The source files here are **faithful ports of actual deployed read-only code**, with only an isolated-project exact-URL guard and the canonical Sandbox CORS origin. Each source's Live SHA-256 is in `read-only-pilot-manifest.json`.
- Deploying these files only into the **existing Sandbox Supabase project** creates real endpoints against fictional records, not fake button behavior. Future releases should use captured source versions and reviewed source control to prevent drift.

## First two ports

| Function | Live status | Sandbox restrictions | Intended verification |
| --- | --- | --- | --- |
| `public-event-squawks` | Deployed public Event Hub feed; read-only | `verify_jwt=false` to match public-access semantics; returns only Hub-visible messages for a **published** event; project URL pinned to Sandbox; no outbound network | POST with a draft/unknown slug must fail closed; published *fictional* event may return a bounded public list |
| `golf-my-registrations` | Deployed signed-in golfer roster lookup; read-only | **Tighter than Live**: `verify_jwt=true` plus the unchanged server-side `getUser(token)` identity check; project URL pinned to Sandbox; no external network | Unauthenticated/invalid caller must be denied; approved tester sees only registrations linked to its own Sandbox Auth identity |

Neither function directly sends invitations, emails, Squawks, payments or Drive requests or writes database records. Both use runtime-injected **Sandbox** service credentials only, not copied Live secrets. Importantly, the registration lookup's service-role reads need a separate tenant/ownership review before onboarding external testers or expanding beyond the single approved test account.

## Remaining deployed Live functions: do not bulk-deploy

24 Live Edge Functions were inventoried; the other **22** require further review or test-service substitution. This is a coverage inventory, **not proof the individual functions are vulnerable**:

- **Payments and webhooks:** `create-golf-checkout-session`, `stripe-golf-webhook`.
- **Auth, invitations, team changes, registration writes:** `golf-account-auth`, `platform-invite`, `golf-registration-flow`, `golf-admin-registration`, `golf-bulk-registration`, `golf-team-member`, `golf-team-status`, `golf-team-claim`, `golf-admin-team-registration`, `golf-admin-team-management`.
- **Communications:** `send-squawk-email`, `direct-squawk`, `publish-squawk`, `golf-roster-missing-info`.
- **Google OAuth/Sheets/Drive:** `google-oauth-start`, `google-oauth-callback`, `sync-google-roster`, `golf-import-roster`, `pull-google-roster-edits`, `inception-drive-export`.

Some functions fit multiple categories. Search for any hard-coded Live origin, event identifier, recipient, callback, webhook and external provider before porting. An unchanged production function is **not sandbox safe merely because the database URL differs**.

## Completion gate

1. Run `node --test tests/sandbox-*.test.mjs`, the normal app build, and existing GitHub CI. The new test suite checks isolated project pins, identity/published-event boundaries and the absence of DB writes or external calls in these two source ports.
2. Deploy **only** the manifest-listed functions to Supabase project `publruuuyvpggogrrgwp`. Do **not** deploy to Live project `aszixzrdayrivungodwq`.
3. Verify deployed function names and `verify_jwt` policies against the manifest; check the draft-only event and unauthenticated/invalid caller denial via **Sandbox** requests when safely callable.
4. Do not enable `VITE_SANDBOX_WORKSPACE_ENABLED` until app-level RLS, dedicated test implementations of write functions and complete outbound/redirect verification pass. No broad grants, no mirrored Auth records, no migration into Live.
5. Continue with a small, approved set of read-only app screens, then stage role-specific synthetic create/update flows. Add the existing Universal Scanner's forward/reverse UI-to-service audit as each module goes live in Sandbox.

All approvals, test outcomes and deployed versions should remain versioned in source control so we can refresh a single, genuinely matching Sandbox rather than rebuild it.
