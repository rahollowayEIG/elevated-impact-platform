# Build Lab V1: scanner source scope and release gate

Verified against GitHub Actions run [40815849125](https://github.com/rahollowayEIG/elevated-impact-platform/actions/runs/40815849125) at commit `1da173ec758d40871d2358a87de2b1e6690a3814`.

## Results

- **PASS**: isolated evidence/planning model job.
- **PASS**: diagnostic scanner-to-Work-Buckets test using pinned approved-development source. This is *not* release-package verification.
- **FAIL (expected and mandatory)**: strict scanner-to-Work-Buckets integration because 11 source paths from the development-wide scanner allowlist are absent from the selective release.

## Absent scanner evidence files

| Path | Owner-only V1 treatment |
| --- | --- |
| `src/components/EigBuildLab.jsx` | Review for minimal owner-console port, do not bring AI builder |
| `tests/eig-build-lab-browser.cjs` | Reconcile with new owner-only interface and add browser coverage |
| `src/lib/epInvoiceDraft.mjs` | Exclude unfinished invoice prototype |
| `src/components/EpInvoicePilot.jsx` | Exclude unfinished invoice prototype |
| `tests/ep-invoice-draft.test.mjs` | Exclude invoice prototype tests from owner-only package |
| `src/lib/epProductCapture.mjs` | Exclude unfinished product capture |
| `src/components/EpProductCapturePilot.jsx` | Exclude unfinished product capture |
| `src/components/EpDiscoveryPilot.jsx` | Exclude unfinished discovery |
| `tests/ep-product-capture.test.mjs` | Exclude unfinished product capture tests |
| `src/lib/epCommerceContractReadiness.mjs` | Exclude unfinished commerce prototype |
| `tests/ep-commerce-contract-readiness.test.mjs` | Exclude unfinished commerce tests |

## Release implementation decision

The current `server/eig-master-source-scan.cjs` is a **development-wide** scanner, not yet an owner-only release scanner. **Do not** copy nine unfinished prototype files solely to make the strict test pass, and **do not** remove them from the allowlist without updating and testing the scanner's module evidence contracts.

Next engineering step: explicitly define a V1 release scan profile whose file allowlist and module checks match available production source plus the reviewed owner-only console, and add tests that verify this profile cannot silently downgrade or omit a configured module. Keep a separate development-wide scan profile for future modules. Only then run strict integration and owner-browser tests against release-owned source.

**Blocker remains open:** strict integration must pass on the same candidate commit; no production merge, deployment, Supabase changes, or activation of write flags until approved.
