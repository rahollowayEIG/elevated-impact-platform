# Build Lab AI Review, isolated owner preview (2026-11-02)

Status: **development candidate, NOT enabled, NOT deployed, NOT approved for production**.

## Purpose

Turn the existing read-only Master Scanner's bounded module metadata into at most five **unverified** AI planning recommendations. Reuse the existing Scan History, Work Buckets, and owner Review & Fix Plan rather than introducing an autonomous agent or a second Build Lab.

## Data sent to the AI provider

The server runs its own approved read-only Master Scanner, then sends **only**:

- Source version SHA, scan fingerprint, date and fixed provenance warning.
- Up to 20 module identifiers, names, status labels, high-level source-marker observations, verification checks and bounded next checks.

No raw source, SQL bodies, identity records, event registrations, emails, phone numbers, payment details, customer rows, keys, browser-selected files or user-submitted prompts are sent by this endpoint. Model output is untrusted and validated before presentation. It does not confirm defects or functioning workflows.

The call uses OpenAI's Responses API with strict JSON output, no external tools, `store: false`, and `max_output_tokens: 1800`. Model defaults to `gpt-6-luna`; it can be changed via a **server-only** model configuration.

## Flags and credentials (both default OFF)

**Do not enable until the new PR is merged into the approved preview release branch and re-tested.**

- Server-only `OPENAI_API_KEY` stored as a Vercel encrypted Secret. Never put it in source control or in any `VITE_*` variable.
- Server-only `EIG_BUILD_LAB_AI_REVIEW_ENABLED=true`, scoped only to the approved preview environment.
- Optional server-only `EIG_BUILD_LAB_AI_MODEL=gpt-6-luna`.
- Browser UI flag `VITE_EIG_BUILD_LAB_AI_REVIEW_UI_ENABLED=true`, scoped only to the approved preview environment.

The AI handler always uses `authorizeBuildLabOwnerPreview`, which checks approved branch, Vercel preview origin, owner UUID, session validity and EIG-admin membership. All production requests remain denied, even when flags are accidentally on. No user-selected target, URL, SQL, source path, prompt, or autonomous tool list is accepted.

Owner clicks `Run AI Review` explicitly; every call is billable to the configured OpenAI API organization. Configure API account spend limits and review usage periodically. Avoid enabling outside controlled preview. Serverless concurrency limits do not substitute for provider-side spend caps.

## Acceptance gates

1. CI: authorization failures must precede source reads/API calls, production disabled, test source-only payload, strict response schema, forged output rejection, and History → Work Buckets handoff.
2. Verify the real Vercel owner preview using the single approved release branch after a reviewed merge; recheck origin, active session, EIG membership, server flag and UI flag.
3. Manually inspect the quality of recommendations against the underlying evidence. Test empty, malformed, and unavailable provider responses.
4. Confirm every AI finding remains in **owner review**; AI cannot execute a fix, connect to GitHub writers, mutate Supabase, send payments, auto-approve or deploy.
5. Review actual per-scan API cost and privacy notices before any expanded rollout.
6. Production stays read-only; prior migration reconciliation / security release blockers are independent and still open.

**Separate stages not included here:** AI-driven code patches in isolated branches, autonomous agents, continuous monitoring, external website research, deployments, pricing/deal recommendations or an AI bug verdict.
