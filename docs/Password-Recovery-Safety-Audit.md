# Password Recovery Safety Audit

Date: 2026-10-04
Scope: password-reset callback isolation and the failed frontend build.
Status: automated local checks passed; deployment and real email acceptance tests must be recorded separately.

## Incident and containment

The prior flow could show a password form after a failed recovery link while
retaining another person's signed-in session. The form then called the shared
client's updateUser. That is not an acceptable recovery boundary.

An earlier source-edit attempt also duplicated component definitions in
src/App.jsx. The failed edits are replaced with a small entry router. The normal
application is preserved in src/PlatformApp.jsx using the exact App.jsx blob
from successful commit 22273d3ab7706f7b820cf9e8ad66bdbc6aa4406d
(blob 307fd78064a3345677b90f81824044aa37601ef0). Other platform features, schemas,
roles, and email-sending functions are not changed by this patch.

## Action contract

- Purpose: let the holder of a valid Supabase recovery grant set that account's password.
- Authority: the recovery token verified by Supabase Auth, never an email query parameter or an already signed-in account.
- Identity: use the verified immutable Auth user ID. An optional email hint can reject a mismatch, but cannot grant access.
- Isolation: no shared Supabase client, persisted sessions, localStorage, cookies, or normal application initialization on recovery pages.
- Save: revalidate the pinned bearer and user immediately before submitting; PUT /auth/v1/user uses that exact bearer.
- Failure: no recovery grant means no password form and no fallback to a signed-in session.
- Account security: banned accounts remain banned. Recovery does not unlock or reactivate an account.
- Communication: existing self-service and admin reset email senders remain in place. A failed link does not send another email automatically. The support link opens the user's mail client; it does not claim a tracked reactivation request was submitted.
- Audit: Supabase Auth remains the source for password-update events. No password, callback token, or full recovery URL is logged by this implementation.
- Completion: a successful API response must identify the same user. The in-memory recovery credential is discarded and only that recovery session is ended.
- Uncertain network result: never claim success or automatically repeat the password update.

## Implemented paths

1. Admin emails: token_hash plus type=recovery, verified through Supabase Auth.
2. Self-service emails: implicit callback bearing type=recovery, with identity validated by Supabase Auth.
3. Invalid, expired, reused, disabled, and missing-credential links: stop with a clear problem screen.
4. Legacy non-recovery verification emails that incorrectly carry recovery=1: remove only that inappropriate hint, then use the existing verification path.
5. PKCE or unknown credential shapes: fail closed with instructions to request a supported new link. No existing browser session is consulted. A future PKCE/provider rollout requires a dedicated tested callback contract.

Callback secrets and email hints are removed from browser history before render.
A no-referrer document policy and explicit request policy prevent referral leakage.
The normal application is lazy-loaded only for non-recovery routes. Legacy recovery
code in PlatformApp is retained with the preserved source but is not the recovery
entry point. Future changes must not route email recovery back through it.

## Automated checks

Run: npm run test:recovery
The normal build runs these tests before Vite.

26 tests cover normal route preservation, verification-vs-recovery separation,
token-hash and implicit callbacks, URL scrubbing, missing/invalid/banned links,
ambiguous inputs, no persisted-session reads, cross-account identity isolation,
StrictMode/repeated redemption, mismatched identities, revalidation before save,
concurrent submission, short passwords, exact HTTP authorization, provider errors,
network uncertainty, configuration failure, and unexpected update responses.

Local execution: 26 passed, 0 failed. New JSX files passed TypeScript transpilation
syntax checks. These are synthetic tests, not real account/password changes.

## Release acceptance still required

- Confirm the new deployment is successful and the production alias serves it.
- Invalid or banned link while another account is signed in: no password form and no password change.
- Valid target-account link while another account is signed in: display the verified target email before entry; change only that target's password.
- Confirm both users' sign-in results privately. Never paste passwords or reset tokens into chat.
- Check the actual recovery screen on desktop/mobile and confirm clear focus, readable identity, errors, and success state.
- Check normal sign-in, Event Hub, Airport, and invitation routes.

## Separately pending

Tracked reactivation requests, EIG/Pilot notifications, broader account-status
enforcement, and the remaining User Management actions are outside this security fix.
No account is automatically unlocked, reactivated, or assigned a new password by
shipping this code.
