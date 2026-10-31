# Activate the first ElevationPilot Sandbox tester

**Status:** Configuration checklist, not a completed activation. Live Supabase and Live Vercel remain untouched. The protected gate is in draft PR #68, and deployment must be confirmed before inviting anyone.

## Intended first tester

Use the EIG owner's **approved existing email address**, provided in the conversation. Do **not** create five fictional Auth users or an `eig_admin` user in the shared business Sandbox. The email can be the same as Live, but its account and Auth session belong to the **isolated Sandbox**. No Live password is copied.

## Preparation steps (Sandbox dashboard only)

1. Open the Supabase project named **ElevationPilot-Sandbox**, project ID `publruuuyvpggogrrgwp`. Check this ID again before editing authentication configuration. Never open or alter the Live project ID `aszixzrdayrivungodwq` for this task.
2. Under **Authentication > URL Configuration**, inspect **Site URL** and Allowed Redirect URLs. Set them only to approved **Sandbox** origins when ready; no Live origin or localhost default. In particular, verify the intended Sandbox Vercel deployment is current and protected before sending any invitation. User should share a screenshot of this settings panel (without secrets) for a safe review.
3. Under **Authentication > Email Templates**, ensure the **Magic Link** template sends a six-digit OTP using `{{ .Token }}`, not a Magic Link via `{{ .ConfirmationURL }}`. This determines whether Supabase's `signInWithOtp` sends a code or clickable link.
4. Confirm the Sandbox email service and rate limits. Auth mail is allowed only for this consenting test recipient. Turn off public user sign-up at the project level; keep **customer marketing email, Squawk, automated registration invitations and outbound integrations disabled**.
5. Only after steps 1-4, use **Authentication > Users** in the Sandbox project to create/invite the one approved email account through official Supabase Auth Admin controls. Do not use SQL to permanently insert rows into `auth.users`. The user never gives anyone their password.
6. Verify that the Sandbox Auth user exists and has **confirmed** email. A dashboard invitation may require acceptance/verification; do not mark an unverified account as an authorized tester by guesswork.
7. A trusted operator can execute `sandbox/roles/05_enroll_first_verified_tester.sql` **only on the Sandbox project**, substituting the approved exact email. This is an operator-only DML script. It requires one already verified Auth user, existing fictional active organization, zero current testers and no EIG Admin grant; it creates only the tester allowlist row with Pilot/Co-Pilot/ATC/Passenger practice roles. It does **not** create a password, email identity, Live account, profile, or customer data.
8. Confirm `VITE_SUPABASE_URL` in the **Sandbox Vercel project only** points to the Sandbox. Enable `VITE_SANDBOX_EMAIL_CODE_ENABLED=true` in the isolated Sandbox preview environment only after steps 1-7. Leave `VITE_SANDBOX_WORKSPACE_ENABLED=false`: full application integrations have not yet been safety approved.
9. Deploy the preview branch, verify the protected pink entry page, then request a six-digit code with the one approved email. On successful verification, user reaches the safe practice-role staging area, not Live. Test each role via real RPC, denial of unauthenticated users, sign-out and no Live effects.

## Known blockers as of October 19

- The last check showed **0 Sandbox Auth users and 0 enrolled testers**, so signing in cannot work yet.
- No Edge Functions are deployed to the Sandbox. The ordinary Live login depends on `golf-account-auth` and must remain unavailable within the Sandbox.
- Vercel returned **402 api-deployments-free-per-day** after more than 100 preview builds. The latest secured branch was not verified as deployed at the time this was written.
- Supabase Auth URL/email template settings cannot be verified from the available read-only project metadata tool. User must check these in the actual Sandbox dashboard.
- Seamless SSO with existing **Live credentials** remains a separate, later project and needs reviewed authentication federation; this temporary path uses the same email but its **own Sandbox session**.

## Audit and rollback

- Inspect `sandbox_ops.practice_testers` and the `sandbox_ops.practice_role_audit` ledger. Role-switch denial and cross-tenant tests are in the Sandbox integration test scripts.
- To revoke the temporary tester, an authorized Sandbox operator can set `enabled=false` in that tester's practice-testers row and revoke their sandbox Auth refresh tokens. This does not affect Live access.
- Do not enable general app DB table grants or side-effect integrations merely to make a preview appear functional.
- Never send service-role keys, Auth tokens or passwords into GitHub issues or ChatGPT.

**Live remains unchanged.** The user's single approved Sandbox login will be operational only once the above steps and real browser test are completed.
