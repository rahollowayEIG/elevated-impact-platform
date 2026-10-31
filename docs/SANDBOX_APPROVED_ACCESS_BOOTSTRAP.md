# ElevationPilot Sandbox: Approved Tester Entry Gate

**Status, October 19, 2026:** Sandbox-only implementation staged in a draft branch. **Email-code delivery is disabled by default**, full app workflows are disabled by default, and no real tester has been enrolled. This does **not** implement seamless Live-credential SSO and does not change Live authentication, user accounts, SMTP, RLS, payment settings, or data.

## Why this interim step exists

The separate ElevationPilot-Sandbox Supabase project `publruuuyvpggogrrgwp` currently has **zero Auth accounts and no Edge Functions**. The normal application login calls `golf-account-auth`, a function present only in Live. Reusing that login in the sandbox would be an unsafe cross-environment dependency.

For early builder/QA testing, we are preparing an **approved-tester-only, independent Sandbox email-code session**, using the same verified *email address* where appropriate but **never requiring a Live password**. This is distinct from the longer-term goal of federating the existing ElevationPilot login via a reviewed and authorized identity broker.

## Current access boundaries

1. Every Sandbox route is wrapped in `SandboxAccessGate` **before** normal app screens mount. Live routes never use the gate.
2. The gate checks `sandboxSupabase.auth.getUser()` and requires a confirmed email from the **isolated** Supabase Auth project.
3. The gate calls `public.sandbox_practice_role_status` to confirm a server-enrolled, enabled tester with business-practice membership. No user can self-assign roles in the client.
4. Customer sandboxes categorically exclude the `eig_admin` role. Business practice roles currently supported: Pilot, Co-Pilot, ATC, Passenger. Vendor will be added after its true permissions are designed.
5. By default `VITE_SANDBOX_EMAIL_CODE_ENABLED` is **not** `true`. The UI says invitations are not enabled and performs **no email-code request**.
6. Even when a Sandbox Auth user has been authorized, the regular frontend stays behind `VITE_SANDBOX_WORKSPACE_ENABLED === 'true'`. By default it displays a staging page and **cannot invoke the normal event/payment/advertising/messaging flows**.
7. Client authentication uses only the existing `src/lib/supabase.js` client, which fails closed unless `VITE_SUPABASE_URL` is the dedicated sandbox project. No second client points at Live.

## Steps to activate email-code entry, when EIG explicitly approves a tester

- Confirm the isolated Supabase project's public signup is **disabled** for general users. Approval and role enrollment must remain server-side.
- Configure the **Sandbox Auth Email template** as a six-digit email code using `{{ .Token }}`, not a magic link `{{ .ConfirmationURL }}`. Supabase `signInWithOtp` sends a magic link by default when its template contains ConfirmationURL. Verify it is truly an OTP before enabling this feature.
- Confirm the Sandbox Auth email service is dedicated, rate-limited and sends messages **only to enrolled, consenting, verified internal testers** for login. No real customer, bulk, marketing, Squawk, or roster invitations. Confirm that redirects and Site URL are sandbox-only.
- Provision an explicitly approved user through **Supabase Auth Admin** on the sandbox project only. Do not use SQL to insert permanent `auth.users` rows. No passwords are copied. Record that the recipient approves receiving a Sandbox code.
- Create that independent tester's empty fictional sandbox organization if necessary and enroll their **sandbox-specific Auth UUID** into `sandbox_ops.practice_testers`, with allowed business roles and enabled status. Use a trusted backend administrative operation, never a client-visible INSERT. Do not enroll an EIG Admin on a customer practice environment.
- Configure **only** the isolated Sandbox Vercel project's `VITE_SANDBOX_EMAIL_CODE_ENABLED=true` after verifying the code email template. Leave `VITE_SANDBOX_WORKSPACE_ENABLED` false.
- Test: invalid or unapproved emails do not self-register, valid enrolled testers receive the email code, verified codes produce a **Sandbox** session, unapproved sessions see a locked screen, only approved roles appear, logout clears Sandbox only, and no Live Auth session was issued or reused.
- Only after a separate integration review and RLS verification may a team enable the actual app via `VITE_SANDBOX_WORKSPACE_ENABLED=true`. Validate every outbound client/Edge Function, cross-origin URL, media SDK, message, registration, marketing and payment integration first.

**Important:** `shouldCreateUser: false` in the OTP helper prevents just-in-time sign-up, but it does **not** substitute for disabling general public signup at the project level or restricting who can be enrolled.

## Future seamless login

The final user experience remains **Sign in with ElevationPilot** using existing credentials through a trusted, federated login. That connection is described in `docs/SANDBOX_LOGIN_FEDERATION_PLAN.md`. It has **not** been enabled. Live OAuth/OIDC configuration, keys and deployments must not be changed to achieve a quick Sandbox preview without approval.

## Verify this change

```sh
node --test tests/sandbox-approved-access-gate.test.mjs
node --test tests/sandbox-*.test.mjs
```

GitHub's Sandbox routing safety workflow executes the Sandbox test suite. Passing tests verify the code and fail-closed defaults, **not** delivery of real OTP emails or end-to-end user login. Those steps depend on a deliberately authorized tester and isolated Auth configuration.

**Live has not changed.** No production rows, passwords, payments or real mail integrations are used in this access-gate implementation.
