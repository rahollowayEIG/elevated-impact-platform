# EIG Build Lab / Project Architect: the development engine for the business platform

**Owner direction (October 15, 2026):** Make building the best tool to build more tools our first priority. The eventual product is one integrated software platform where small businesses can access dependable, reusable capabilities rather than stitching together dozens of unrelated applications.

## Mission

Before implementing any substantial new module, clarify the business problem, identify what already exists, inspect evidence where authorized, and ask whether building a reusable scanner/generator/component/automation first would improve the current and future projects. **Do not build infrastructure merely for the sake of it:** when one focused feature is faster, safer and sufficient, recommend that instead.

Build the fullest **EIG Studio** capability set first. Decide which subsets become Creator and Creator Plus only after the core workflows have been verified. Onboarding, entitlements and future per-customer feature choices remain owned by the shared Organization/Hangar provisioning architecture.

## Shared architecture

- EIG Command Center: owner-level control and EIG Build Lab.
- Project Architect: idea/goal -> project brief -> reuse analysis -> proposed build blueprint -> explicit review -> draft tasks.
- Universal Scan Engine: controlled source/evidence intake, validation and human-review contract. UI, functional, document, photo, product and business scans each use a domain adapter.
- UI & Experience Inspector: inspect visual hierarchy, branding, forms, accessible and responsive behavior, then propose mockups and testable UX changes. A screenshot proves a visual state, not hidden behavior.
- Platform Registry: catalog canonical services, components, extensions, owners, permissions, external providers, code locations, migration/schema contracts, capabilities and lifecycle/version status. Inventory still requires future implementation; candidate mentions in the pilot are **not** confirmed registry results.
- Implementation Assistant: with separately authorized repository access, propose draft issues/PRs, tests and dependency plans. Protected CI, migration review, human approval and staging precede rollout.
- Business apps remain systems of record for their own domains: EIE/Event Builder for events, InceptionApex for creative projects, EIC for commerce, Squawk Box for messages, Organizations/Hangars for business identity and onboarding. No duplicate permanent user identity or app-specific customer credential system.

## First coded milestone: EIG Project Architect local pilot

**Location:** Draft Universal Scanner [PR #53](https://github.com/rahollowayEIG/elevated-impact-platform/pull/53), NOT merged or deployed.

- Pure deterministic helper: src/lib/eigBuildArchitect.mjs
- EIG-only UI: src/components/EigBuildLab.jsx and eig-build-lab.css
- Frontend integration: src/PlatformApp.jsx, EIG Command Center. Requires **both** the compile-time VITE_EIG_BUILD_LAB_PREVIEW_ENABLED=true flag, an EIG admin workspace/active membership, and a fresh server-issued **owner-only access grant**. The private pilot does not expose a public deep link. The button stays hidden until verification succeeds; other EIG admins are **not** eligible.
- Input: project name, goal/success, intended audience, existing process, reference notes, project mode and estimated reuse scope.
- Output: declared *proposals* for problem verification, shared registry checks, reusable-vs-scoped strategy, prototype and release testing. Relevant existing app mentions are only candidate matches to verify, not claims that code was analyzed. Optional modes offer specific UI/UX, workflow or scan-evidence checks.
- Review controls: accept, reject or revise suggestions independently. Working drafts autosave in the owner's current browser storage on this preview origin. Export as readable Markdown or strict-schema JSON; JSON can be reopened locally and transferred between devices or preview URLs. **There is no cloud save, cross-device sync or shared project history yet.**
- Explicit warnings: no AI, external site crawling, interactive UI browser scanning, live customer-data scanning, automated PRs, secret handling, backend saves or production actions. The InceptionApex Source Inspector separately permits a small read-only inspection of allowlisted first-party source and existing test-script patterns.
- Navigation guard: autosaves the brief, blueprint, approval decisions and partially edited revision; warns about blocked browser storage and asks for a JSON backup if autosave cannot succeed. Leaving and reentering the same preview origin no longer resets the draft.
- Tests: tests/eig-build-architect.test.mjs, tests/eig-build-lab-access.test.mjs, owner authorization service, targeted Universal Scan workflow and Vite/browser tests (including responsive mobile). This has not been deployed or tested with a live owner login yet.

The scanner's existing shared app_blueprint evidence/review contract remains separate. Do not fake server-issued source refs from the browser or treat a local brief as verified evidence.

## Productive first user test when an EIG preview is approved

1. Sign in as a current EIG administrator in an **isolated preview** with the gate enabled, open EIG Command Center -> Build Lab.
2. Click **Load InceptionApex pilot**, then **Create draft blueprint**. Confirm the output describes a reusable-first strategy and identifies creative/identity modules to verify.
3. Accept one suggestion, revise the UI audit proposal and reject another. Confirm counts and labels update and nothing changes in InceptionApex or a customer Hangar.
4. Download a Markdown preview for sharing, and **also** download reusable JSON. Reopen the JSON; confirm original brief and review decisions reappear.
5. Edit goal and regenerate: ensure the blueprint has a new version and suggestions require fresh human review. Navigate away and back, then reload: verify the brief and decisions restore automatically. Also test half-written revisions, account separation and mobile widths. If browser storage is blocked, verify JSON export is offered and exit warns.
6. Verify non-EIG users, expired memberships and builds without feature flag cannot enter the pilot. No customer exposure or server mutation from this UI.
7. Only after review consider writing a persistent EIG-owned project/version model in an appropriately isolated staging environment, with canonical account roles, RLS and auditing.

## Roadmap driven by the owner's priority

1. **Build Lab pilot UI + pure planning engine**: first usable slice, no billing or migration.
2. **InceptionApex-first inspection**: authorized source maps (screens/components/routes) and controlled visual/interaction audit. Capture truly observed behavior separately from ideas. Use findings to improve a shared EIG UI component.
3. **Actual scanner and evidence capture**: uploads, permissioned screenshot/walkthrough analysis, field-level human review, provenance and source-version tracking using Universal Scan Engine.
4. **AI-assisted analysis**: with controlled provider connection and budget ledger, inspect authorized texts/images and propose alternative UI, workflow simplifications and component reuse. Real validation of functionality still needs code/tests or observed recordings.
5. **Guided build/test**: generate draft issues, proposed code and regression tests behind approvals. Never silently merge, deploy or alter legal/payment/identity data.
6. **Reusable onboarding**: centrally versioned package/feature entitlements and organization provisioning; enable eligible customer-facing subsets of proven capabilities, not cloned customer apps.

## Version and validation rules

Distinguish software/build version, customer edition/version, and each project's proposal/artwork revision. The local pilot versions blueprints and saves the latest working draft only in this browser. It does not preserve immutable server-side revisions, a project library, or cross-device drafts. All app comparisons must record reference version and date when known. Product features require real business evidence and cost/benefit judgment, not AI confidence alone.

The goal is measurable time saved, fewer duplicate implementations, less friction for the end user, higher quality and maintainable shared services. Keep the software a *coherent suite with one account and shared organization context*, not a single monolithic screen or one huge unreviewable codebase.


## Owner-only preview access: no other EIG admins

**Owner approval (October 15, 2026):** Build Lab must be available **only to the owner's existing ElevationPilot login**, not to all EIG administrators or Kellie's account. Do not generalize Build Lab to Creator/Creator Plus or other EIG staff unless the owner separately approves a future policy change.

### Access implementation in this draft

- The official app entry in EIG Command Center is hidden unless the current user has an active EIG admin membership **and** the server confirms their Supabase Auth UID is the one specifically configured as the owner account.
- The owner binding is the immutable account UUID, **not** email, display name, mutable username, organization role alone, GitHub identity, browser storage or a forgeable request parameter. The connection to the canonical permanent person record remains preserved through normal ElevationPilot identity rules.
- **Interactive Vercel preview:** A same-origin, preview-branch-only Vercel API route (api/eig-build-lab-access.js) verifies the Supabase Auth token through getUser, compares the server-only configured owner UUID, and reads that user's current EIG admin membership via authenticated RLS. Production/other branches are explicitly denied. Another EIG admin cannot enter.
- **Future Edge/server operations:** A separate undeployed Supabase Edge Function draft (supabase/functions/eig-build-lab-access) includes an additional live-session assertion using privileged platform RPC. It is **not deployed** and is not part of the local-only Vercel preview. Any future storage, AI or build mutation must independently enforce robust session revocation, ownership, roles and data scope; the initial preview-only route is not sufficient authority for those actions.
- Every entry rechecks authorization on the server. Loading the page or manipulating browser state never authorizes server operations. This pilot only generates local drafts; future app scanning, saved projects, AI usage and build operations **must independently enforce the same owner-only restriction on every server endpoint and storage policy**.
- Both owner guards return a minimal allowed/denied result, not the owner UUID or user profile. Failure, unavailable backend or unset configuration denies access; never fall back to broad EIG admin permission.
- On an actual account merge or owner account change, pause access and deliberately update the exact owner UUID. Do not grant it automatically based on a similar name or email.

### Vercel owner-only preview: setup and rollout

1. **Connected:** Vercel team `rahollowayeigs-projects`, existing `elevated-impact-platform` project, Hobby plan and GitHub draft PR branch were verified October 15, 2026. The preview deployment is separate from production.
2. **Configured:** Vercel *branch-scoped Preview* environment variables `EIG_BUILD_LAB_OWNER_USER_ID` (encrypted, exact verified account), `EIG_BUILD_LAB_ACCESS_ENABLED=true`, `EIG_BUILD_LAB_PREVIEW_BRANCH=feature/universal-scan-foundation-20261013`, `VITE_EIG_BUILD_LAB_PREVIEW_ENABLED=true`. None are configured for Production. Existing Supabase URL/anon key continue to support ordinary login. No service-role key is placed in Vercel.
3. **Implemented:** The Vercel API endpoint verifies login through Supabase Auth and queries owner membership with RLS. It requires `VERCEL_ENV=preview`, matching designated branch variable, and a matching Git reference whenever exposed by Vercel. No wildcard CORS; the browser uses the same-origin route and sends bearer token in request header, never the URL.
4. **Deployment gate:** Build and security CI must pass, then deploy or rebuild this exact preview branch with the new environment settings. Never merge to `main`, release to production or add production migrations just to enable Build Lab.
5. **Manual acceptance gate:** Sign into the preview under the verified owner login. Confirm Build Lab appears in EIG Command Center and the InceptionApex pilot blueprint can be generated/exported/reopened. Confirm another admin including Kellie cannot see or open Build Lab, and missing/expired login cannot fetch a positive owner grant. SSO-protected Vercel previews may additionally require Vercel team authentication.
6. **Security limitation:** This local-only UI cannot make privileged writes or call AI. The preview's membership lookup is a read-only, user-RLS query after Supabase Auth getUser. Session revocation correctness must be separately reviewed before granting access to real data, scan ingestion, documents or background jobs; future actions require server-side checks at every endpoint.
7. **Rollback:** Set `EIG_BUILD_LAB_ACCESS_ENABLED=false` for the preview branch and redeploy, or disable the Vite flag. Neither operation touches live applications.

**Important limitation:** React client bundles are delivered to the browser, so a determined person inspecting public build assets may find non-sensitive UI code even when its entry is hidden. The server-side owner check protects the privileged access and every future server data/AI/build action must enforce it separately. This first pilot has no sensitive backend operations.



## Continuous Improvement Agent and weekly scans

Owner priority: evolve Build Lab from a manual Project Architect into a proactive, **owner-only continuous-improvement agent**. It will eventually examine permissioned EIG code, tests, UI, workflows and changes in the background, then present a deduplicated, evidence-linked **weekly improvement scan** for the owner to review. It may suggest reusable engines, cosmetic/UX refinements and functional fixes; it must never silently merge, deploy, access unapproved customer data or incur uncapped AI costs. See [EIG-Build-Lab-Continuous-Improvement-Agent.md](./EIG-Build-Lab-Continuous-Improvement-Agent.md) for staged implementation and safety gates. **Design only:** no scheduler, monitoring job or AI usage is active yet. The first MVP is a no-AI read-only repo/CI scanner and an InceptionApex UI pilot; the weekly schedule comes after owner selection and implementation.


## Owner-scoped browser autosave (pilot usability improvement)

- The Build Lab page now **automatically restores** the latest brief and pending/generated blueprint when the owner returns to the same preview address and browser profile. This includes accept/edit/reject statuses and the draft text currently inside a Revise textarea. Typing part of a mission before clicking Generate is also saved.
- The autosave key includes the authenticated owner's Supabase Auth UID and is used **only after** the server-authorized owner enters the Build Lab. Different accounts in the same browser do not share the Build Lab application state. This localStorage key is **not** a security boundary: anyone who can inspect the same browser profile's application storage may inspect browser-local text, so **no passwords, private customer records, payment information or secrets** in the pilot.
- On normal exit/reentry, page refresh and reopening the *same preview origin*, the latest owner draft returns without needing to generate the blueprint again. Another account cannot load the owner draft through the app, even if testing bypasses the normal server entry point.
- Local storage is **per web origin**: new uniquely named Vercel preview deployments, another browser profile, another computer, a cleared browser storage or private/incognito tabs do **not** automatically receive the draft. Use **Download reusable JSON** in the original preview and **Reopen JSON blueprint** at the new address. Prefer a verified **stable preview-branch alias** for ongoing owner testing after rollout, if one exists. Do not assume JSON exports include any still-incomplete form changes or an unfinished unsaved revision; switching preview URLs should be done after completing the current revision.
- If the owner chooses **New project** or **Load InceptionApex pilot** while the current draft contains content, require confirmation before overwriting the single saved local working copy. Download JSON if keeping multiple projects. A full versioned multi-project library with cross-device access requires approved owner-only backend storage, data policy, backups, RLS and a safe staging rollout.
- Autosave is local-only and should not alter draft review status, create a verified scan finding, trigger an agent or approve/modify production changes. Continue manual export as a portability and backup mechanism.
- Tests: \`tests/eig-build-lab-draft.test.mjs\` validates incomplete briefs, account-specific keys, review restoration, tamper resistance, corrupt state and blocked browser storage. The browser test exercises route exit/reentry, reload, half-written revisions, JSON import and cross-account isolation.


## First actual scanner: InceptionApex Source Inspector (owner preview)

**Scope:** Deterministic read-only inspection of four allowlisted first-party source/test files. It is not an AI model, a live functional browser audit, competitor scan, screenshot analysis, customer record scan or proof that a code-declared test passed.

**Inputs:** src/components/InceptionApex.jsx, src/components/FlyerEditor.jsx, src/components/inception-apex.css, tests/inception-apex-browser.cjs. The server reads only these fixed source paths from the deployed branch. Do not accept arbitrary URLs or source paths.

**Access:** POST /api/eig-build-lab-scan with target inception_apex. The server independently repeats the same-origin HTTPS, exact owner Auth UUID, current authenticated session, caller-RLS active EIG admin membership, preview environment and expected Git branch checks before touching files. Missing configuration, nonowner requests, other branches, wrong methods, unapproved paths and source errors fail closed. There is no service-role key or token in source reports.

**Evidence:** Each reported observation contains stable rule ID, priority, source file path, original 1-based line number, matched excerpt, and a proposed check. All required source patterns must match or that observation is omitted. Reports include a stable SHA-256 source fingerprint and Git commit when available. Source observations never automatically prove a runtime defect. Existing browser-test code does not prove a CI pass.

**Owner UI:** Click Inspect InceptionApex source under Build Lab. Browse evidence, search and sort findings, and independently accept, revise or reject suggested follow-ups. Reviews and the latest source report autosave only in the verified owner's local browser profile on the same preview origin. Export scan report JSON for backup. New source fingerprint resets prior reviews. Accepting a scan recommendation NEVER changes code, opens an issue, publishes an app, or modifies a production database.

**Modules:** server/eig-inception-source-scan.cjs, server/eig-build-lab-scan-handler.cjs, server/eig-build-lab-preview-access.cjs, server/eig-build-lab-auth-client.cjs, api/eig-build-lab-scan.js, src/lib/eigBuildLabScanClient.mjs, src/components/EigBuildLab.jsx. Tests inspect the actual files, enforce read-before-auth denial, validate report schemas and exercise browser review autosave.

**Deployment:** Draft PR #53 only; read-only private Vercel branch preview. No merge, production migration, paid branch, AI request, cron task, customer data operation or live release. Next phase: permissioned synthetic browser walkthroughs to test actual rendered UI, plus separately authorized CI artifact ingestion. Weekly monitoring requires explicit owner approval and budgets.

## Focused tool navigation (October 21, 2026)

Build Lab has top buttons for Master Scanner, Upgrade Radar, AI Review, IA Inspector, Research, Impact Review, Discoveries, Invoices and Project Architect. Only the selected workspace is visible. Panels stay mounted when switching so existing forms, scan results, AI responses and in-flight work survive tool changes; switching never invokes a scanner or an AI request. The selected tool is a per-owner browser-session preference, not an access grant or a cross-device save. Missing/blocked session storage falls back to Master Scanner. Existing draft persistence and owner authorization remain unchanged.

The AI connection probe and recommendation endpoint have distinct enable flags. A successful probe does not establish that recommendations are enabled. On October 21 the protected orchestrator preview's recommendation flag was verified as enabled, but its latest deployment predated the flag. Rebuilding that same preview picked up current environment configuration; the authenticated owner must still verify a real recommendation response.

## Grouped workspaces and browser scan history (October 21, 2026)

Top navigation now groups tools under Scanners, AI & Research, Planning, Prototypes and History. Individual scanners retain their own controls and tool disclosures beneath the groups. Switching groups never invokes scans or provider requests.

Master Scanner, Upgrade Radar, IA Inspector, AI Review and Change Impact Review save completed results in an owner-scoped browser history on the same origin. History groups records by scanner, supports text search, scan-type filtering, clickable ascending/descending date/module/source sorting, saved evidence and decisions, and JSON download. New successful runs get separate IDs, including repeated runs of the same source; decision edits update that run. Existing latest local source reports migrate into history when their panels mount. Previously overwritten results and AI responses lost before this update cannot be recovered. AI Review restores the latest saved response per module after refresh without calling the API. Change Impact Review reconstructs its saved local report through the existing pure validator.

History keeps up to 20 scans per scanner type and a 1.8-million-character total payload; complete oldest records are evicted when either limit is reached. JSON exports are the portable archive. Storage corruption is preserved and surfaced rather than silently overwritten. Blocked/quota-exceeded storage surfaces an export warning. These saves are not cloud storage, immutable audit records, cross-device sync, an authorization grant or a successful CI result. Existing server owner-only checks remain authoritative.

Planning → Scan Plans saves Daily, Weekly, Monthly and Targeted/on-demand preferences, with scanner and module selection. Defaults recommend focused daily source checks, weekly upgrade review and a broader monthly source review. Targeted scope is independent of cadence. All plans clearly show planning/manual-only status: there are no timers, scheduled jobs, background AI requests or scheduled charges. Implementing automatic execution requires a separately tested owner-only scheduler, current authorization, evidence access and cost controls.

## Manager blueprint review and specialist planning (October 21, 2026)

Planning → Manager now adapts saved scanner results into a locally reviewed blueprint through the existing `buildLabMissionOrchestrator.mjs` entrypoint. It does not introduce a second permissions layer or agent runtime.

- Select 1–10 browser-saved scans using a searchable, sortable list. Up to 100 actionable source recommendations are supported per plan; an oversized selection fails visibly instead of silently truncating the work.
- Merge only exact title/action matches within the same module, preserving all source references and capture dates. Different recommendations remain separate. Mixed source versions and identical titles with differing actions generate warnings requiring owner acknowledgement before handoff review.
- Existing source rejections/holds/parking are omitted. Revised source wording is retained. All resulting recommendations require fresh Manager-level review and independent verification before implementation.
- Proposed specialists: Bob the Builder, Mr. Fixit, The Designer, The Scientist, The Researcher and The Inspector. Assignment suggestions use deterministic keyword rules, not an AI Manager call. The owner may reassign specialists or accept, revise, hold or reject each proposal.
- Approving a fully reviewed plan creates a task dependency graph for accepted/revised proposals only: verify evidence → specialist work → independent inspection. Tasks with intersecting file paths are sequenced. Unknown file scope is sequenced conservatively; independently scoped work can be delegated together by a future runtime. Research/science tasks return evidence and a proposed next step for owner review, rather than implicitly approving implementation of an experiment.
- Every proposed task includes completion criteria, evidence paths and dependencies. Assignments support text search, specialist filtering and sortable task/specialist/stage headings.
- Decisions and plans save under the authenticated owner's browser key; JSON download provides portability. Changing a decision or specialist increments the revision, invalidates the previous local handoff review and clears proposed tasks. Restored tasks are regenerated as Planned, never trusted as completed or running.
- **Execution remains not connected.** Local approval means a planning decision only. No agent starts, provider charge, GitHub action, repository write, migration or deployment is triggered by Manager. Any future dispatcher must independently enforce current owner authorization, bind approval to an immutable persisted blueprint revision and exact source commit, respect dependencies and spending limits, run in an isolated branch/Sandbox, and return test evidence for release review. Browser state and JSON exports can never serve as execution credentials.

Validation covers source deduplication and provenance, source-review decisions, mixed-version warnings, assignment rules, owner edits invalidating approval, dependency ordering, held/rejected work exclusion, conservative unknown-path sequencing and browser restoration without execution authority. End-to-end Playwright coverage also exercises refresh, JSON export, search and account separation; it requires a working Chromium runtime or GitHub CI before claiming browser acceptance.

## One-scanner pilot before builder expansion

Owner priority: prove one scanner through a reviewed blueprint, applied change, independent browser tests and a rescan before expanding other scanner adapters. The first bounded case is InceptionApex tablet-breakpoint test coverage.

IA Inspector v2 classifies its output as verification needed, coverage gap or preserve existing. Its 950px CSS breakpoint check looks for explicit literal Playwright viewport calls at 949, 950 and 951px; comments and string examples do not satisfy that recognizer. Equivalent parameterized/wrapped tests may exist elsewhere, so absence remains a sampled coverage question. It never claims that matching viewport markers prove tests passed. Useful keyboard and save/approval patterns are preserved and do not become duplicate Manager implementation tasks.

The inspector's rulebook is included in its source fingerprint so changed directions invalidate old decisions. Each eligible finding offers **Create blueprint for this finding**: it uses the matching saved report, selected rule, source version, original file/line evidence and a verification checklist. It requires confirmation before replacing an existing Manager draft and opens Manager with just that recommendation pending review. Rejected/held and preserve-existing findings cannot be submitted through this action. An approved plan can be exported for the implementation handoff.

Pilot sequence: inspect IA source → select the tablet coverage finding → prepare its one-finding blueprint → owner reviews/approves → implement only the approved test changes on an isolated branch → run the affected synthetic browser regression → rescan changed source and compare the selected rule. Record the implementation commit, CI run, browser artifacts and after-scan evidence separately. First execution is assisted by Codex; a browser-local approval never starts an agent or grants repository/deployment authorization. Builder automation comes after this cycle is proven. Other scanner tuning is deferred.

## Build, Integrate or Partner research (owner direction, October 22, 2026)

Add an external technology assessment to the development scanner and its blueprint preparation. The purpose is to find existing apps, software, APIs, open-source libraries, services and potential partners that could deliver a capability faster or better than rebuilding it. The owner prefers building reusable EIG capabilities where that creates lasting value, including using OpenAI to connect and coordinate external capabilities inside ElevationPilot. Neither rebuilding everything nor subscribing to everything is the default answer.

**Status and order:** planned research adapter; no technology search, vendor assessment, partner agreement, scheduler or purchasing action is implemented by this note. Complete the one-scanner IA workflow first, then strengthen the builder/Manager. Add this assessment as part of that work; bring it forward only when the approved pilot actually needs an external capability. Preserve the existing owner-only review and execution boundaries.

For each substantial proposed capability:

1. Define the business outcome and acceptance criteria; check verified internal reuse before looking outside. Accept an owner-specified candidate alongside discovery of alternatives.
2. Search current official product/API documentation, pricing, release activity and integration/partner information. Capture source URL, checked date, applicable version/plan and exact supported capability. Keep vendor claims, tested behavior, estimates and unknowns distinct. A public partner program is only a lead, not an agreement or confirmed eligibility.
3. Compare four routes: build internally, integrate an existing provider, pursue a partnership, or use a hybrid (own the ElevationPilot workflow while connecting selected external capabilities). Include a credible internal-build baseline, even if no suitable external candidate is found.
4. Evaluate feature fit, UX consistency, API/SDK/webhook access, permitted embedding/white-label/commercial use, data ownership/export, contextual permissions and privacy, reliability, maintenance, provider dependence and an exit/replacement path. Assess whether OpenAI adds a useful orchestration layer; it does not establish integration rights or replace missing APIs or verified behavior.
5. Estimate setup effort, time to first usable result, ongoing maintenance and total cost at realistic usage levels. Show assumptions, recurring/license/usage/AI costs and uncertainty; do not present estimated build effort or incomplete pricing as verified facts. Prefer a bounded proof of concept when compatibility is uncertain.
6. Produce a dated comparison with a recommended route, rationale, alternatives, unresolved questions and a small validation task. Permit “insufficient evidence” or “defer” rather than forcing a winner. Recheck volatile pricing, terms, capabilities and API availability before an implementation decision.

The Researcher gathers evidence; the Scientist can propose a bounded compatibility experiment; the Manager incorporates the reviewed recommendation, dependencies and verification criteria into the blueprint; Bob the Builder or Mr. Fixit implements only approved scope; the Inspector checks the result. These are intended responsibilities, not a claim that automatic agent dispatch is connected. Research does not approve subscriptions, spend, vendor contact, account connections, data sharing or implementation.

Assess a technology choice when a new build or material capability change makes it relevant. Broader opportunity reviews may be included in future owner-selected weekly/monthly scan plans; this note creates no recurring job. Save research by scan type with its date and sources when the adapter is implemented, and link the selected assessment into its blueprint so later reviewers can understand why EIG built, integrated or partnered.

## Launch Runway (owner direction, October 22, 2026)

Once a product reaches an agreed maturity level, guide it from tested build to controlled launch. Define the target audience, release scope, required workflows, supported browsers/devices and launch criteria in its approved blueprint. The default delivery target is one shared responsive application for phone/tablet/desktop browsers, with an installable PWA where appropriate. App Store/Google Play packages are optional, separately scoped deliverables with their own builds, device tests and distribution requirements; they are not automatic consequences of a web-app pass.

**Status:** planned workflow and product area, not an implemented release service. Preserve the current priority: prove the one-scanner cycle, strengthen builder/Manager, then extend scanners and release automation. This plan starts no agents, deployments, subscriptions or scheduled monitoring.

| Stage | Evidence required to advance |
| --- | --- |
| Working build | Approved scope implemented; core acceptance criteria pass on the identified version. |
| Verified candidate | Independent checks cover required user journeys, applicable permissions/data handling, save/recovery behavior, accessibility and the declared compatibility matrix. Blocking defects have owners and are resolved; unknown or untested requirements stay visible. |
| Private pilot / beta | Selected authorized users complete realistic workflows in an isolated or deliberately approved pilot environment; feedback, failures and fixes are recorded against the candidate. |
| Launch ready | Owner reviews the exact candidate, evidence, known limitations, audience, operating costs, support/onboarding, monitoring, rollback/recovery plan and required release configuration. Payments, communications, migrations, third-party rights and store requirements are checked where applicable. |
| Approved release | Explicit owner approval identifies the version, environment, audience and rollout scope. The authorized release process performs a limited rollout and confirms launch health. |
| Live improvement | Observe failures, feedback and usage against agreed success/rollback thresholds; route new findings into reviewed blueprints and repeat verification for updates. |

A readiness percentage may summarize progress but cannot override a blocking gate. Readiness is scoped to a specific release and audience: internal pilot readiness does not imply public readiness. Every gate records its responsible reviewer, dated evidence and passed/failed/not-tested/not-applicable state; not-applicable needs a reason. Build changes invalidate affected evidence and approval; releasing a different build requires revalidation. Source inspection, executed tests, browser engines, mobile viewport emulation and actual-device/Safari runs must remain distinct.

The Manager coordinates dependencies and presents one launch packet with the release candidate, acceptance results, browser/device matrix, unresolved risks, release notes, support owner and rollback instructions. Builder/Fixit resolve approved work; Inspector independently verifies it; the owner provides the final green light. A failed check returns the candidate to the affected work stage. Approved rollout and post-launch operations require separately implemented execution and observability; a browser-local blueprint approval cannot authorize or trigger them.

### Build Meter

Show a Build Meter for each product/release alongside its Launch Runway. Keep **Build progress** (implemented acceptance criteria / approved applicable criteria) separate from **Verification progress** (criteria with current passing evidence / approved applicable criteria). Display the numerator and denominator, scope/version and last checked date. Unknown or untested items do not count as passes; zero/undefined scope displays “Scope not defined” rather than a percentage. Scope changes can lower progress and must explain why; optional future ideas do not silently expand the current release denominator.

Alongside both meters, show the current stage, blocking issues, untested requirements, next concrete action and responsible specialist/reviewer. Break verification down into core functionality, persistence/integrations, applicable identity/permissions, accessibility, browser/device coverage and operational launch readiness, using passed/failed/not-tested/not-applicable states with evidence links. Browser engine checks and physical devices have separate rows. This is a planned reporting contract, not a new scanner score or an implemented dashboard.

A fully built product can still be blocked from launch. “Ready for owner review” requires every mandatory gate for the declared release scope to be satisfied; “Approved for launch” additionally requires the owner's current explicit release approval. Neither percentage nor an agent's confidence grants release permission. Failed or stale evidence returns the affected criterion to an unresolved state. The Manager computes status from recorded criteria/evidence rather than inventing an AI completion estimate.
