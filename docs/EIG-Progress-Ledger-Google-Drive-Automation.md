# EIG Progress Ledger: safe Google Drive auto-update

**Status as of 2026-10-26:** GitHub source and CI checks implemented in **draft PR #107**. The `safety-tests` job passed on commit `f6dc5b329c6295d91e7366fd9deb002bc2588371`. The `publish` job was **SKIPPED**, as designed, because Google workload identity is not configured/enabled. No automatic Google writes are operational yet.

## Existing, verified destination (reuse; do not create another directory)

- Native Google Doc: [ElevationPilot Progress & Recovery Ledger](https://docs.google.com/document/d/1CtDS6YJ12r8ODk2oCxhIpOiWaHfJgKJk5gNjrbbONNs/edit)
- Document ID: `1CtDS6YJ12r8ODk2oCxhIpOiWaHfJgKJk5gNjrbbONNs`.
- Parent folder: [EIG Platform Architecture & Product Decisions](https://drive.google.com/drive/folders/1v-PIg03pp0QMyK_rLJV5ZCCsbjkkgte4).
- This ledger is an operational handoff, not the future canonical Supabase software Platform Registry.

## Implemented in PR #107

- `scripts/eig-progress-ledger-sync.mjs`: validates exact GitHub repository, branch and event, uses only known SHA/PR ID/run URL and timestamp, reads exactly the approved document, rejects a missing ledger heading, checks a unique run marker to avoid duplicates, appends with Google Docs `writeControl.requiredRevisionId`, and verifies the marker via a fresh API read.
- `tests/eig-progress-ledger-sync.test.mjs`: validates fail-closed behavior for wrong repo, branch, invalid PR source, missing token, wrong document ID, permission failures, revision guard, idempotency and readback.
- `.github/workflows/eig-progress-ledger-sync.yml`: tests run without any Google token. After review and explicit enabling, trusted `main` changes, user-triggered `main` checkpoints and owner-originated same-repo PR lifecycle events can append **evidence only**, not approvals. The GitHub `pull_request_target` writer checks out **main**, not PR head. An externally owned fork PR cannot write. Only the configured owner GitHub actor is allowed.
- The script never reads Supabase, customer accounts, Google OAuth tokens from Live, or other Google Docs. The document ID is fixed and the writer service account needs access only to that document.

## One-time Google identity setup still required

A Google Cloud / Workspace administrator must configure these once. This operation is not available through the currently connected tools; do **not** copy Live Supabase Google OAuth refresh tokens, Workspace passwords or a JSON private key into GitHub.

1. In an organization-managed Google Cloud project, enable **Google Docs API**. Create a dedicated service account **only for this ledger**. Do not grant it Google Cloud project Editor/Owner or all-Drive access.
2. In Google Cloud IAM, configure a GitHub OpenID Connect **Workload Identity Pool and Provider**, for `https://token.actions.githubusercontent.com`. Restrict its attribute condition to repository `rahollowayEIG/elevated-impact-platform`, actor `rahollowayEIG` and trusted base `refs/heads/main`; use repository numeric ID or a stronger immutable trust binding as available. Grant the provider identity `roles/iam.workloadIdentityUser` on that single writer service account only. Review GitHub OIDC mappings, token audience, allowed refs and service-account impersonation security before activation.
3. Share only the [existing recovery ledger document](https://docs.google.com/document/d/1CtDS6YJ12r8ODk2oCxhIpOiWaHfJgKJk5gNjrbbONNs/edit) with the new service account email as **Editor**. Verify the exact document, not its entire parent directory. If Google Workspace blocks service-account sharing, investigate the approved Workspace-access alternative instead of opening domain-wide sharing.
4. On the **GitHub repository**, set these repository **Actions variables** (not credentials pasted into source):
   - `EIG_GOOGLE_WIF_PROVIDER`: full numeric project resource, e.g. `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`
   - `EIG_GOOGLE_DOCS_WRITER_SA`: dedicated service-account email
   - `EIG_PROGRESS_LEDGER_ENABLED`: keep `false` while preparing; set `true` only after reviewed setup.
5. Review/merge the limited workflow and tests through the normal release process. This workflow's `publish` job is dormant before the variable is `true`; the tests can run in PR without Google credentials.
6. Test from GitHub Actions **EIG Progress Ledger Sync → Run workflow** on `main` with the repo owner identity. Open the ledger and locate `[EIG-AUTO-RUN:<run ID>]`; check the job logs report `written-and-verified`. Rerun the same workflow run and verify the marker is not duplicated. Then test one reviewed PR update. Confirm automatic updates on the next eligible `main` push.
7. Confirm that source-only entries remain `DISCOVERED (NOT TESTED OR APPROVED)`. Verify deployment status via Vercel, runtime via Supabase and the accepted owner decision separately; append those **verified** details through a reviewed completion checkpoint. Only after a successful real readback can we describe Google Drive automatic updates as active.

## Events and limits

- **Automatically covered after activation:** GitHub pushes to `main`, owner-initiated workflow dispatch on `main`, and owner actions on same-repository PRs targeting `main` (open, reopen, synchronize, close). Automatic PR writing runs only from the trusted default-branch workflow, never untrusted PR code.
- **Not automatically covered yet:** ChatGPT conversations, assistant decisions, code in unpushed local edits, Vercel runtime verification, Supabase schema/Edge Function inspection, Google Drive folder hierarchy reconciliation, or Build Lab scan result persistence. Those need explicit authenticated adapters and an accepted entry with evidence. No chat interface can silently guarantee every conversation has been ingested.
- **Safety:** No deletion, folder moves, production deploy, migrations, auto approval, bulk Drive sync, email sending or secret export. Do not call a scheduled or background job complete until an independently verified target readback exists.
- **Recovery:** Set `EIG_PROGRESS_LEDGER_ENABLED=false` to stop new document writes. Existing recorded entries remain in Drive version history and the GitHub source trail. No other platform changes are needed.

References: [Google GitHub Actions auth](https://github.com/google-github-actions/auth), [Google Docs batchUpdate and revision control](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate).
