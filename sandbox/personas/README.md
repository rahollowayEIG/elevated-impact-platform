# Sandbox Practice Identities and Role Tests

**Target only:** `https://publruuuyvpggogrrgwp.supabase.co` (ElevationPilot-Sandbox).

## Completed and verified

- Five fictional role definitions exist in `sandbox_ops.demo_personas`; emails end in `@sandbox.invalid`.
- Fictional EIG headquarters (`elevated-impact-group`) and Practice Club organizations exist, both `is_test=true`.
- An unpublished, draft Practice Scramble event exists.
- `02_role_helper_smoke_test.sql` tested EIG Admin, Pilot, Co-Pilot, ATC and Passenger identity predicates.
- `03_rls_visibility_rollback_test.sql` verified **actual RLS row visibility** for these five roles, including isolation of private contacts and draft events.
- BOTH SQL tests use transient mock identities and `ROLLBACK`; the sandbox currently has **zero Auth users**, **zero permanent role assignments** and **zero client table grants**.
- The UI component `src/sandbox/SandboxPersonaLogin.jsx` is enabled only when `VITE_ELEVATIONPILOT_SANDBOX=true`. It uses real `signInWithPassword`; selecting a persona NEVER impersonates a user or bypasses access controls.

## Provision five ACTUAL login accounts safely

**Pending:** the connected Supabase management tools cannot directly invoke Auth Admin `createUser`; do not INSERT permanent login records into `auth.users` with SQL. Use Supabase Auth's supported Admin API through the one-time local script:

`node scripts/sandbox/provision-demo-auth.mjs` is a safe dry run. For actual account provisioning, provide **on your own trusted computer**, through environment variables, all four settings:

- `SANDBOX_SUPABASE_URL=https://publruuuyvpggogrrgwp.supabase.co`
- `SANDBOX_SERVICE_ROLE_KEY`: sandbox's service-role credential (never paste into chats, GitHub, Vercel client variables, or browser).
- `SANDBOX_CREDENTIALS_OUTPUT`: an **absolute** path outside the repository in a private local folder, for example a secure drive. The script creates this as a new 0600-restricted file and will never overwrite it.
- `SANDBOX_PROVISION_CONFIRMATION=CREATE_FICTIONAL_SANDBOX_AUTH_USERS`

Only after setting these, run `node scripts/sandbox/provision-demo-auth.mjs --provision`.

Preflight requires the exact sandbox URL, a sandbox service key, zero existing Auth users, both fictional test organizations and the unpublished practice event. It creates five supported Supabase Auth Admin accounts with confirmed fictional emails and randomized 48-character passwords, avoiding outbound email. It then creates profiles, organization memberships, a scoped ATC event assignment, and the claimed fictional Passenger. Passwords are saved **only** in the operator-controlled credential file, never in source code, SQL migrations, GitHub Actions logs, or terminal output.

Do not rerun on a partially provisioned sandbox without inspecting the accounts. The script intentionally refuses to touch an Auth project that contains existing users. If the script fails after creating some users, preserve the local file securely and reconcile those accounts rather than creating duplicates.

## Additional hard requirements before testing with participants

- All client table/RPC grants are still disabled in the sandbox, even after the Auth accounts exist. This is deliberate; enabling broad access before integration checks would expose the permissive legacy `anon` policies on some tables.
- Audit Supabase Auth Site URL and allowed redirect URLs so no link can route to live.
- Confirm email provider, Resend, SMS, Stripe, Google Workspace and Edge Functions are isolated or disabled.
- Only enable narrowly scoped sandbox grants after running positive and negative role checks with actual signed-in sessions.
- Deploy PR #60 routing and host guards and this persona UI to the **separate protected sandbox Vercel project**. Vercel API deployment quota currently blocks another updated preview build.
- Audit the complete UI and use only test-mode payment keys. Never embed service-role keys in `VITE_*` variables.

## Known permission behavior for later product QA

The parity RLS policies currently let Pilots/Co-Pilots see their organization's fictional contact; event-assigned ATC does not receive general contact access, and Passengers see neither. A global EIG Admin's contact visibility across other organizations requires separate review of the existing contacts policy. **Do not casually grant it globally.**

## Files

`01_demo_personas.sql` creates the sandbox-only metadata. `02_...sql` and `03_...sql` are repeatable rollback-only tests; never execute against a live project. All five practice accounts remain unprovisioned until the secure Auth Admin step succeeds.
