# Post-recovery account switch

## Purpose and scope
After a successful isolated password reset, offer a deliberate fresh sign-in for the exact verified account instead of resuming an unrelated saved browser account. Do not change the passed recovery token verification or password write path.

## Action contract
- Target: the immutable user ID and verified email returned by completed recovery, kept in component/controller memory. No email, tokens or passwords are put in a new URL or browser history.
- Trigger: a successful reset exposes **Sign in as [verified email]** with a warning. Opening a link or finishing the password write does not itself sign out the current browser account.
- Consent: clicking that labeled button after the warning authorizes local browser-session sign-out. There is no global sign-out. Tabs sharing the same session can be affected; other independent devices are not targeted.
- Preconditions: local sign-out must succeed and the shared session must read back as empty before the credential form appears.
- Authentication: the user must enter the new password again. The fixed email is read-only, and the controller uses its pinned value rather than reading the DOM. Reuse the existing `golf-account-auth` `sign_in` workflow.
- Verification: validate the returned bearer with Auth `/user` against the completed reset's ID/email before `setSession`; confirm stored/session identity before opening the application.
- Concurrency: detect another tab's login both before the credential request and before installation. Stop and require renewed explicit switching instead of overwriting it. Do not promise independent accounts in separate tabs of one shared browser profile or atomic cross-tab transactions.
- Failure: no automatic fallback to an old login, no silent successful navigation, and no automatic retry. A failed password can be re-entered; an uncertain browser-session change requires a new switch. Duplicate clicks/submissions are blocked.
- Communication: no extra email or Squawk is needed merely to switch this browser. The existing reset email and authentication policies are unchanged. Passwords and grants are never logged by this UI/controller.
- Audit footprint: reuse standard Auth sign-in/sign-out events; no new permanent account state is created. This patch does not implement the separately pending EIG/Pilot reactivation-request notifications or durable security audit dashboard.

## Verification
New unit tests cover consent, exact identity, local-only sign-out, existing/no sessions, repeated clicks, errors, stale tab state, incorrect password, wrong identity, and readback. New browser tests exercise the actual recovery completion and switch form with synthetic responses only; the final application document is a landing probe. Existing recovery and account-state unit/build suites and recovery browser scenarios remain regression checks.

CI/preview completion is recorded in the pull request, not assumed from this document. Desktop/mobile screenshots require review. Final human acceptance remains: stay logged in as an admin, reset the controlled account, choose its explicit sign-in button, enter its new password, confirm the intended account opens, and privately confirm the admin password is unchanged.

No production accounts, passwords, roles, locks, email templates, database schema or Edge Functions are changed by this source update or its synthetic tests.
