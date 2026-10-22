# First bounded IA implementation worker

Status: implementation for review; disabled by default. This is a candidate-generation and isolated-verification handoff, not a fully automatic Manager, PR author, merge service or release agent. Build Meter and Launch Runway remain lower-priority backlog work.

## What this slice does

Manager step 4 offers candidate generation for one approved, current IA pilot finding assigned to Builder or Fixit. The server independently verifies the configured owner's live session, active EIG membership, preview branch and feature flag. The browser's saved approval is only the requirement being submitted, never an authorization credential. Current committed source is rescanned on the server; mismatched versions/fingerprints, resolved findings, unapproved plans and unsupported assignments are rejected before any provider call.

The owner explicitly consents to sending the four allowlisted first-party IA component/style/test files and the requirement to OpenAI. One request uses the existing gpt-4.1-mini provider path, store:false, no tools, 8,000 output-token ceiling and 45-second timeout; there are no autonomous retries or loops. This is not a global account spending cap. The owner controls each request; repeated generation incurs additional provider usage. No customer records, credentials or database snapshots are supplied.

The model can decline with “blocked,” or return up to four exact unique substring replacements in the three IA component/style files. Tests, workflows, dependencies, server/auth code and other apps are not writable. Scope validation rejects unsupported changes. Generated source is untrusted and unexecuted at this stage; exact substring checks are not proof of correctness or a security audit.

A candidate is bound to the current source commit, all four source hashes, scanner fingerprint and finding, then HMAC-signed after rechecking current owner access. The signature expires after 30 minutes. The short-lived bundle is kept in component memory and can be downloaded; it is not saved into an immutable job ledger. A manual owner retry within its validity window is possible; there is no automatic retry or single-use ledger.

## Isolated verification

The owner-started `Build Lab bounded IA builder` workflow additionally restricts the repository, GitHub actor and exact preview branch, and requires a repository enable variable. The signature-validation job has the signing secret and executes only the committed validation script. It uploads a validated candidate. A separate verification job receives no signing or provider secrets, checks out the signed commit with persisted git credentials disabled, verifies all original source hashes and applies only allowlisted edits. It runs fixed unit/build checks and the existing IA browser regression in Chromium, Firefox and WebKit.

The review artifact contains the candidate patch, source before/after reports, per-browser screenshots and actual verification outcome. Skipped browser runs remain skipped/not-run. Source markers and executed browser results remain separate. Actual Safari and physical phones/tablets are not covered. A marker-based finding may remain after a valid improvement; the result does not automatically label the finding fixed. Review the requested acceptance criteria independently.

No branch is pushed and no PR, merge or deployment is performed by this worker. Codex/owner review and application of the resulting patch remain a separate step. Generated browser code runs against synthetic harness data only. This first slice does not permit generated Node tests, dependency installation changes or backend execution.

## Activation prerequisites (not performed by this change)

1. Review and merge the implementation to the isolated Build Lab preview branch; verify its CI and deployment.
2. Configure `EIG_BUILD_LAB_BUILDER_ENABLED=true` only on that Vercel preview branch. Reuse its existing server-side `OPENAI_API_KEY`; never expose it in browser or workflow inputs.
3. Generate a dedicated cryptographically random signing key of at least 32 bytes. Store the same value as `EIG_BUILD_LAB_BUILDER_SIGNING_KEY` in the preview's server environment and the repository's GitHub Actions secret. Never paste secrets into chat, source, blueprint exports or screenshots.
4. Register the reviewed manual workflow on the repository's default branch as required by GitHub's workflow_dispatch behavior, without merging the Build Lab app changes to production. This needs a separate workflow-only rollout review. See https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow .
5. Enable the GitHub repository variable `EIG_BUILD_LAB_BUILDER_ENABLED=true`. The workflow still requires the exact preview branch and owner actor, plus a valid server-issued signed candidate. Provider secrets are not needed in GitHub.
6. Generate a candidate from a fresh approved IA finding, download the JSON and manually start the workflow on `feature/build-lab-orchestrator-20261020` with that JSON. Review its artifacts and request any preview application separately.

No live provider request or signed production worker run is established by fixture-based tests. Connecting secure dispatch/status reporting directly into Build Lab, durable run history, single-use grants, broader builder scopes and automatic draft PR creation are follow-on work. The existing single-owner server policy must remain authoritative for any future endpoints or dispatch service.
