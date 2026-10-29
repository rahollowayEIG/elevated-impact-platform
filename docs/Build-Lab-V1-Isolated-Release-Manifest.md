# Build Lab V1 owner-only selective release candidate

Status: **packaging in progress, not deployable or approved**.
Base: production `main` commit `0593ba8d3219c9181734a10c39d0f2d6ac8c2748`.
Source: approved development branch `feature/build-lab-orchestrator-20261020` at `4cf7bf4ee99ba98aee6f93b199df02a44e2e635d`.
Destination: `release/build-lab-v1-owner-only-20261028`.

## Packaging rules
- Copy reviewed files selectively from the approved source branch, never merge the whole feature branch.
- Keep all production server/UI storage and scanning feature flags disabled until separately approved.
- No Supabase migration, production deploy, pink Sandbox modification, secret change, AI builder, autonomous writes, invoicing or unrelated application changes.
- Pin final release tests to the **candidate branch SHA**; passing development-branch CI is not a substitute.
- Review and test live auth, EIG membership, source scan permissions, tenant/data separation, cloud conflict/recovery, and rollback before requesting owner go-live permission.

## Candidate dependency map (to resolve before copying)
- **Owner console:** `BuildLabLiveOwnerWorkspace.jsx` imports Scan History, Work Buckets, Live Plan Review, Cloud Backup and live scanner client.
- **Planning:** `BuildLabLivePlanReview.jsx` depends on Work Buckets and Manager Blueprint modules and their storage contracts.
- **Cloud backup:** `BuildLabCloudBackup.jsx` -> `buildLabCloudBackup.mjs` -> cloud records, evidence package/recovery, scan history, work buckets and manager blueprint.
- **Production API:** `api/eig-build-lab-live-{access,scan,master-scan,records}.js` -> isolated Live auth, session provider, allowlisted scanner handlers and durable document store. Avoid importing preview AI/builder routes into the Live UI.
- **Integration points:** current main `src/PlatformApp.jsx`, `vercel.json`, tests, exact source bundle allowlists. These must be modified minimally against current main, not overwritten with feature versions.

## Next acceptance sequence
1. Resolve all direct and transitive import dependencies and distinguish genuine V1 requirements from unrelated feature code.
2. Selectively port small cohesive modules with fail-closed test coverage, then run install, build, node tests and isolated browser tests.
3. Verify exact deployed source package and controlled owner authentication with no production write flags enabled.
4. Verify hosted synthetic cloud save/recovery in an authorized test context. Migration to production requires separate approval and rollback plan.
5. Present final tested SHA, no-change assurance for unrelated apps, and request explicit go-live approval.

Cross-reference: GitHub issue #117 and `docs/Build-Lab-V1-Release-Gate.md` on the approved development branch.

## Packaging checkpoint: dependency and release-order audit

- Confirmed isolated branch still at original manifest-only SHA `0c346eed6e830ec89ee76eb9335b91792a5ea4bd`; no production changes.
- Bulk transfer of privileged server/auth and records files was blocked by the connected tool. No files were copied; do not treat branch as a functional release package.
- Safest port order: (1) independent pure browser validation and evidence model modules with their tests, (2) limited owner UI with existing main interfaces reconciled, (3) reviewed read-only scan routes and allowlisted source handlers, (4) dedicated server auth and cloud records code after separate security review, (5) minimal main routing and Vercel packaging configuration changes.
- Run build and scoped tests after each coherent port. Never insert server credentials into code, public `VITE_*` variables, or test fixtures.
- Stop at first unresolved import or source mismatch; do not copy the long-running feature branch wholesale.
