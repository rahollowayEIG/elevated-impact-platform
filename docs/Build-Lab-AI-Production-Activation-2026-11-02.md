# EIG Build Lab AI Review: production activation checklist (Nov 2, 2026)

## Strict scope

This release enables **owner-initiated, read-only AI planning** inside the existing Build Lab owner console on ElevationPilot production. It does not enable agents, automatic code edits, SQL migrations, cloud evidence writes, payment actions, deployment buttons or AI-generated feature execution.

The API runs the approved allowlisted Master Scanner on the server, then sends a limited metadata summary to OpenAI Responses API with `store:false`, strict JSON schema and **no tools**. AI recommendations remain unverified work candidates. No customer rows, credentials or raw SQL bodies are sent. History and Work Buckets remain owner-local until separately migrated/reviewed.

## Independent production authorization

1. Vercel `VERCEL_ENV=production` and source branch `main`.
2. Production `EIG_BUILD_LAB_LIVE_READONLY_ENABLED=true` plus existing owner UUID and active EIG-admin membership.
3. Server-only `EIG_BUILD_LAB_AI_PRODUCTION_ENABLED=true` (separate from preview `EIG_BUILD_LAB_AI_REVIEW_ENABLED`).
4. Existing owner gate verifies the fixed production host/origin, bearer user, active session via Supabase privileged RPC, and current EIG-admin membership.
5. The UI flag `VITE_EIG_BUILD_LAB_AI_REVIEW_UI_ENABLED=true` only reveals a button. It never grants server access.
6. `OPENAI_API_KEY` is stored as a Vercel server-side sensitive environment variable, **not** in source or a `VITE_*` variable. Configuring a credential can create billable API usage when the owner clicks the button. Reuse a key only if its provider limits and billing owner are acceptable.

If any security check fails, the handler denies access **before reading scanner files or contacting OpenAI**.

## Go-live verification

- [ ] CI tests production/preview environment isolation, owner, role, session, host, optional flags, payload restrictions, no code writes and Work Buckets handoff.
- [ ] Full current application build and existing account/registration/payment regressions pass.
- [ ] Production deployment verified READY on exact approved `main` SHA.
- [ ] Production flags and server-side credential present, AI and cloud-record write routes remain separate.
- [ ] Owner signs into production and uses AI Review once. Confirm 1 AI History entry and up to 5 Work Buckets, all pending review. Inspect cost and models used.
- [ ] Verify other users cannot see the owner console; disabled AI flag returns 403 without invoking model.
- [ ] Keep the previous production deployment available for immediate rollback.

The presence of the source code or passing mocked tests does **not** certify a real OpenAI API request or authenticated production browser flow.
