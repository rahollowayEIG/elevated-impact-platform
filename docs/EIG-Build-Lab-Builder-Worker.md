# First bounded IA implementation worker

Status: implementation for review; disabled by default. This is a candidate-generation and isolated-verification handoff, not a fully automatic Manager, PR author, merge service or release agent. Build Meter and Launch Runway remain lower-priority backlog work.

## What this slice does

Manager step 4 offers candidate generation for one approved, current IA pilot finding assigned to Builder or Fixit. The server independently verifies the configured owner's live session, active EIG membership, preview branch and feature flag. The browser's saved approval is only the requirement being submitted, never an authorization credential. Current committed source is rescanned on the server; mismatched versions/fingerprints, resolved findings, unapproved plans and unsupported assignments are rejected before any provider call.

The owner explicitly consents to sending the four allowlisted first-party IA component/style/test files, the requirement and proposed edits to OpenAI for generation and separate source review. At most two requests use the existing gpt-4.1-mini provider path with store:false and no tools: generation has an 8,000 output-token ceiling, source review has a 4,000 output-token ceiling, and both share a total 45-second deadline. There are no autonomous retries or loops. This is not a global account spending cap. The owner controls each request; repeated generation incurs additional provider usage. No customer records, credentials or database snapshots are supplied.

The model can decline with “blocked,” or return up to four exact unique substring replacements in the three IA component/style files. Tests, workflows, dependencies, server/auth code and other apps are not writable. Scope validation rejects unsupported changes. Generated source is untrusted and unexecuted at this stage; exact substring checks are not proof of correctness or a security audit.

A candidate is bound to the current source commit, all four source hashes, scanner fingerprint, finding, exact owner requirement and passing source review, then HMAC-signed after rechecking current owner access. The signature expires after 30 minutes. The short-lived bundle is kept in component memory and can be downloaded; it is not saved into an immutable job ledger. A manual owner retry within its validity window is possible; there is no automatic retry or single-use ledger.

## Isolated verification

The owner-started `Build Lab bounded IA builder` workflow additionally restricts the repository, GitHub actor and exact preview branch, and requires a repository enable variable. The signature-validation job has the signing secret and executes only the committed validation script. It uploads a validated candidate. A separate verification job receives no signing or provider secrets, checks out the signed commit with persisted git credentials disabled, verifies all original source hashes and applies only allowlisted edits. It runs fixed unit/build checks and the existing IA browser regression in Chromium, Firefox and WebKit.

The review artifact contains the candidate patch, source before/after reports, owner requirement, AI-assisted source-review evidence, per-browser screenshots and actual verification outcome. Skipped browser runs remain skipped/not-run. Source markers and executed browser results remain separate. Actual Safari and physical phones/tablets are not covered. A marker-based finding may remain after a valid improvement; the result does not automatically label the finding fixed. Review the requested acceptance criteria independently.

No branch is pushed and no PR, merge or deployment is performed by this worker. Codex/owner review and application of the resulting patch remain a separate step. Generated browser code runs against synthetic harness data only. This first slice does not permit generated Node tests, dependency installation changes or backend execution.

## Activation prerequisites (not performed by this change)

1. Review and merge the implementation to the isolated Build Lab preview branch; verify its CI and deployment.
2. Configure `EIG_BUILD_LAB_BUILDER_ENABLED=true` only on that Vercel preview branch. Reuse its existing server-side `OPENAI_API_KEY`; never expose it in browser or workflow inputs.
3. Generate a dedicated cryptographically random signing key of at least 32 bytes. Store the same value as `EIG_BUILD_LAB_BUILDER_SIGNING_KEY` in the preview's server environment and the repository's GitHub Actions secret. Never paste secrets into chat, source, blueprint exports or screenshots.
4. Register the reviewed manual workflow on the repository's default branch as required by GitHub's workflow_dispatch behavior, without merging the Build Lab app changes to production. This needs a separate workflow-only rollout review. See https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow .
5. Enable the GitHub repository variable `EIG_BUILD_LAB_BUILDER_ENABLED=true`. The workflow still requires the exact preview branch and owner actor, plus a valid server-issued signed candidate. Provider secrets are not needed in GitHub.
6. Generate a candidate from a fresh approved IA finding, download the JSON and manually start the workflow on `feature/build-lab-orchestrator-20261020` with that JSON. Review its artifacts and request any preview application separately.

No live provider request or signed production worker run is established by fixture-based tests. Connecting secure dispatch/status reporting directly into Build Lab, durable run history, single-use grants, broader builder scopes and automatic draft PR creation are follow-on work. The existing single-owner server policy must remain authoritative for any future endpoints or dispatch service.

## Candidate quality gate (October 22 follow-up)

The first live owner test returned a native-confirm rewrite with placeholder comments and the original `window.confirm` call. Review rejected it before execution. A separate issue allowed clicking Accept after Revise to discard the owner's revised wording.

The follow-up preserves source-scan and Manager revisions through acceptance, reassignment, approval, restoration and both provider requests. Step 4 displays the exact requirement being submitted. Accepting revised wording keeps the decision as `revise`; it does not reset to the scanner recommendation.

Generation now demands a complete implementation or a blocked result. Conservative source checks reject newly introduced placeholder markers and refuse a native-confirm replacement while the native call remains. These are narrow source heuristics, not a general program-correctness proof. A second, separately prompted model request inspects the proposed source against the owner requirement and returns criterion/evidence pairs, unmet criteria and unresolved issues. Missing/malformed evidence, a rejection, an unmet criterion or an unresolved issue prevents signing. Provider errors and timeouts fail closed. Both requests share a total 45-second provider deadline inside the existing 60-second function limit. Owner authorization is refreshed before the second request and again before signing.

Consent explicitly covers generation plus source review (at most two requests). Only the same allowlisted first-party files, requirement and proposed source are shared, with `store:false` and no tools. The second model sees source rather than the generator's summary. It uses the existing provider configuration; no new secrets, network tools or writable paths are introduced.

A successful source review is included in the signed version-2 handoff and displayed with the candidate. Signing and worker validation reject missing or failed reviews and legacy version-1 packets. This AI-assisted review can still miss defects: the UI continues to state **Not tested**, and isolated build/browser verification plus owner review are still required. No candidate is automatically applied, pushed, merged or deployed. Fixture tests prove the gates and data flow, not live model quality or successful implementation of an accessible dialog.

Validation covers the rejected stub, unchanged native-confirm behavior, failed/malformed/incomplete review evidence, revised requirements, one shared deadline, authorization revocation before/after review, and the signed worker lifecycle. Browser fixtures cover revised wording, blocked generation, source-review evidence, JSON download and mobile layout. Existing browser-local selection/result persistence and agent-assignment explanations remain follow-up items; no cloud save is added by this change.

Completion audit: focused contract/access/Manager checks, Manager rendering and Vite build passed locally. Universal Scan run 39729983162 passed the complete suite, Build Lab browser fixtures and all three IA browser-engine jobs on the implementation commit. No live provider retry or signed worker execution is implied by those fixture results.

## Approved work versus held findings

The builder selects exactly one accepted/revised IA finding from an approved Manager blueprint. Held/rejected findings may stay in the same blueprint and do not enter generation. The selected item can appear anywhere in the proposal list. A shared browser/server helper validates its assignment and IA finding/source references; the special one-finding pilot metadata is optional. When present, that metadata must still match, including the source fingerprint checked on the server. Normal scan-stack blueprints are bound through their IA finding references to the exact current server commit and a fresh authoritative rescan. Unknown/preserved findings, stale commits, mixed provenance, pending review and multiple accepted items remain blocked before provider access. Exact owner/session/membership/preview authorization and signing/review gates are unchanged.

Regression evidence: reproduced the owner-exported state (one revised Fixit item, two held items, approved handoff, no pilot marker), verified it selects the intended native-confirm requirement, and added endpoint/browser coverage with the active item after a held item. No private owner export is committed. Saved selections, results, automatic agent explanations and cloud persistence remain separate follow-ups.

## Failure diagnostics

A live owner attempt returned the old generic 502 message. Deployment logs did not retain details identifying which provider or validation step failed, so its original cause remains unconfirmed. Do not present fixture success as a diagnosis of that attempt.

The endpoint now returns a specific safe error category, phase and random support reference for provider quota/rate/configuration/service/network failures, deadline expiration, incomplete/token-limited output, invalid JSON, edit count/scope/size/matching errors, malformed review evidence and handoff size. The visible message names generation, source review or edit validation in plain language. Application logs contain only the fixed event name, reference, phase, allowlisted category and optional numeric HTTP status. Raw errors, provider bodies, proposed source, request headers, credentials and owner identity are excluded. No candidate is signed on failure and there are no automatic retries. Existing owner authorization, source binding, 45-second total deadline, file/edit limits and review/signing gates are unchanged.

The generator input now explicitly states the pre-existing bounds: at most four edits, 12,000 characters per before/after string, 100,000 characters per resulting file, and a 55,000-byte payload budget including review evidence. These instructions do not relax validation. Return blocked if the implementation cannot fit.

Validation simulates provider failures, body-read timeouts, incomplete output in either generation or review, malformed JSON, excessive/mismatched/unsupported edits, and invalid review evidence. Assertions verify safe diagnostics exclude sentinel private source, provider-body text, tokens, keys and owner IDs, and that the browser client surfaces the safe message. Browser fixtures verify the diagnostic appears and a prior download disappears on failure. Completion review must still distinguish deployed instrumentation from the unresolved original live failure.
