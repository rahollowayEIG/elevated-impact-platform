# OpenAI Universal Scan preview: review-only integration

**Status:** Code in draft PR #53 only. Not deployed, not turned on, no live API call has been made. Requires an isolated staging Supabase project and owner approval of any staging costs.

## Confirmed account setup (owner-reported)

- OpenAI organization: Elevated Impact Group LLC
- OpenAI API project: EIG Shared AI Services
- Prepaid initial balance $10; auto-reload disabled
- Project monthly $10 enforced spending limit; $5 and $10 spend alerts
- OpenAI service-account key stored as `OPENAI_API_KEY` in EIG Supabase Edge Function Secrets. Never expose or copy its value into browser code or GitHub.
- This setup belongs to the OpenAI developer API, not to the ChatGPT app subscription.
- Credential existence is owner-reported; the repository cannot verify secret values. No provider connection or billable live roundtrip has been verified.

## First controlled preview

This phase adds `supabase/functions/ai-scan-preview` with a bounded EIG-only **text** source scan adapter. The provider is OpenAI Responses API `gpt-4.1-mini`, server side, with `store:false`, no tools and structured JSON. Only `restaurant_menu`, `hangar_profile` and `event_brief` are supported. Output is field-level candidates with source quotes for explicit review; no database write or approval.

- Requires verified Supabase JWT, live `session_id`, `platform_assert_active_admin` and an active EIG organization `eig_admin` membership; no cross-tenant impersonation.
- `OPENAI_SCAN_PREVIEW_ENABLED` defaults to disabled. Set to `true` **in staging only** after authorization, cost and rate/usage controls are reviewed. Do not set it in production.
- `SCAN_ALLOWED_ORIGINS` can specify exact approved staging origins; defaults to the production platform URL. This header check is not an authorization boundary.
- Request: `POST /functions/v1/ai-scan-preview` with `Authorization: Bearer <signed-in user's session token>`, JSON `{"target":"restaurant_menu","text":"Authorized sample menu with prices..."}`. Do not use service-role or provider secrets from a browser.
- Source text must be 20–6000 characters, requests limited to 8,500 bytes. At most 16 extracted claims returned, each with a verbatim source excerpt. Invalid evidence, forbidden fields or incomplete model output return an error.
- No source retention, customer database mutation, QR transaction handling, upload, PDF decoding, website scraping or image/video generation. Accepted candidates are untrusted until reviewed and separately validated by their destination domain.
- The provider responds with token counts for inspection, not a durable usage ledger or a monetary charge estimate. Staging rollout must also implement service-side per-user/per-Hangar quotas, throttling and auditable cost controls beyond provider spend limits.

## Status and safety checklist

1. Verify current credential status through a server-side staging function invocation. Do **not** show the key.
2. Provision and validate a separate staging Supabase project/branch after discussing cost, copying only approved migration/configuration and synthetic test inputs.
3. Confirm the existing `platform_assert_active_admin` RPC and organization membership checks work with the staging user/session.
4. Run the focused tests and CI against the PR branch; review prompts/results for prompt injection, false fields and unsupported source claims.
5. Approve a controlled invocation on non-sensitive EIG-owned test text, then check provider usage and spend.
6. Build upload/storage, full review UI and domain adapters before rolling any scanning out to users.

Avoid changing production Edge Functions or migrating production schema as part of this PR.
