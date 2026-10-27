# ElevationPilot Platform Rule 3: One Approved Version

**Status:** Approved working rule, 2026-10-26  
**Applies to:** EIG Live, the pink ElevationPilot Sandbox, Build Lab, Golf/EIE, Airport, Hangar, Cockpit, ATC and every future extension.

**Cross-system evidence baseline:** [October 26 chat/GitHub/Supabase/Vercel/Google Drive reconciliation](EIG-Platform-Cross-System-Reconciliation-20261026.md). Review this snapshot before suggesting a new master directory or current Sandbox URL. Its evidence is dated and must be refreshed before implementation.\n\n## Principle

For **each deployed workspace and route**, there is exactly **one explicitly approved version**. A green build, a passing GitHub check, or a working preview URL is **not** approval.

Once a newer version is tested, approved and promoted, **retire obsolete versions from everyday use**. Do not leave outdated pages, confusing links, role selectors, or old login screens available as apparent alternatives.

This extends Rule 1 (Searchable Lists) and Rule 2 (Sortable Fields) as **Rule 3: One Approved Version / Retire the Rest**.

## Required lifecycle

1. **Inventory:** Record the application/repository, environment, route, active domain, Vercel project and deployment, Git branch and immutable commit, backend project, auth mode, visible UI signature and responsible owner. Scan the deployed UI as well as code. Use `config/elevationpilot-approved-versions.json`.
2. **Compare:** Label each candidate `candidate`, `approved`, `superseded`, `retired` or `blocked`. Check that a newer UI does not regress real workflow or omit features from another active branch. Never choose the latest timestamp alone.
3. **Test:** Check visual appearance, functional navigation, signed-in role switching, permissions/RLS, account/identity data, notification behavior, deep links, integrations and build checks. For pink Sandbox, *pink theme + approved-account login + real Switch Role* are mandatory; the old fictional-name persona login is NOT the accepted UI.
4. **Approve:** An EIG owner explicitly signs off on the exact immutable commit and canonical URL. Record a working recovery/rollback commit and backups if the change involves data. Block live promotion until approval. Test credentials, production secrets or customer PII are never copied into a preview.
5. **Promote atomically:** Attach the canonical domain/route to the approved deployment and update its registry entry, navigation, bookmarks, docs and scanner targets. Promotion is separate for Live and Sandbox.
6. **Retire old interfaces:** Remove their links from navigation, onboarding, documentation, Build Lab selectors, examples and normal test paths. Mark replaced PRs and branch entries **SUPERSEDED / DO NOT USE**. Prefer archival/closing of obsolete PRs before deletion.
7. **Safe cleanup:** After confirming all consumers moved and rollback is tested, remove obsolete preview aliases, unused Vercel deployments/branches or deprecate old routes with safe redirects. *Never* delete live customer records, audit history, migrations, data, secrets, contracts or payments under this rule. Retain a minimal rollback/reference commit and any legally required history.

## Non-negotiable release gates

- **Every link must match its approved registry entry:** project + environment + source branch + immutable commit + domain + UI signature + Auth/Supabase target.
- **Sandbox and Live cannot cross:** a Sandbox build must use Sandbox Supabase and display the pink Sandbox identity/role controls. Live cannot accidentally use Sandbox auth/data.
- **No invented “current” links:** if the actual active deployment cannot be proved, mark it `verification_required` and do not recommend it as approved.
- **Old is not necessarily unused:** draft builds, external integrations, webhook callbacks, email links, published QR codes, staff bookmarks and public deep links need impact review. Keep safe redirects where links may still be in circulation.
- **No destructive cleanup without a rollback:** deleting branches/preview aliases/deployments requires explicit owner approval and a dependency check. Never mass-delete by age or name.
- **After each promotion:** rerun visual, functional, technical, smell tests; test Login + Switch Role + Airport, then scan for any visible stale screens.

## Build Lab scanner: "Approved Version & Route Integrity"

Treat a mismatch as a **blocked/review finding**, not an automatic self-healing deployment. The scanner checks:

- canonical approved source and Vercel alias versus current deployment commit;
- old UI/login/role-switcher routes still exposed;
- duplicate pages/components that appear to have replaced one another;
- documentation, invitations, links and tests referencing superseded URLs;
- mismatched Git branch / Vercel project / Supabase target and preview-only flags;
- stale PRs and deployment aliases still linked or offered to users;
- any scanner/tool that proposes implementation against a non-approved branch.

**Build Lab workflow:** Scan → Buckets → Review → Deploy → **Verify & Retire**. A scanner may suggest retirement, but a human authorizes destructive actions.

## Immediate correction: October 26

The `feature/sandbox-personas-auth-foundation-20261018` branch builds the older fictional-name persona login; it is **not** the current Switch Role UI and must not be presented as today's Sandbox. The genuine pink Switch Role build has now been located in the historical **October 19** Vercel production deployment `elevationpilot-sandbox-9e3a2ifda-rahollowayeigs-projects.vercel.app` (branch `feature/sandbox-session-header-20261019`, SHA `eb399c0e`). It contains the approved-account email-code gate, top-right account/role header and real Switch Role control, not the fictional-name persona selector. **However**, Vercel currently assigns the canonical alias `elevationpilot-sandbox.vercel.app` to a **different main-branch deployment** (`b96f2c10`), overwriting the older alias mapping. This explains why the normal URL can open the wrong application. No new owner approval or promotion has occurred: Sandbox remains `verification_required` in the registry. The downloadable PWA foundation (`feature/installable-dual-pwa-20261018`, SHA `94d8211`) is another separate, unmerged feature-preview branch. Its manifest is not proof that the installed desktop icon currently points to the Switch Role deployment. Before marking an app approved, confirm the exact URL behind the user's installed desktop launcher and integrate PWA + Switch Role under one reviewed baseline.

Draft PR #106 contains useful email UI code but is **based on the wrong legacy persona branch**. Port the change to the verified Switch Role source only after registry acceptance, and retire the wrong candidate. Do not silently merge PR #106 into Live or the active Sandbox.

## Responsibilities

EIG owner approves active/retired status and risk acceptance. Build Lab maintains the inventory, detects drift and proposes safe cleanup. GitHub holds code, history and reviewed PRs. Vercel holds routing and deployment evidence. Supabase holds application data. **No environment, deployment, or branch is “the real one” because a tool happened to find it first.**
