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
- Review controls: accept, reject or revise suggestions independently. Export as readable Markdown or strict-schema JSON; JSON can be reopened locally. The editable file is a user-managed export, not cloud storage.
- Explicit warnings: no AI, app scanning, source crawling, repository analysis, changes to business records, automated PRs, provider API calls, secret handling, backend saves, or production actions.
- Navigation guard: warns when leaving with an unexported local draft.
- Tests: tests/eig-build-architect.test.mjs, tests/eig-build-lab-access.test.mjs, owner authorization service, targeted Universal Scan workflow and Vite/browser tests (including responsive mobile). This has not been deployed or tested with a live owner login yet.

The scanner's existing shared app_blueprint evidence/review contract remains separate. Do not fake server-issued source refs from the browser or treat a local brief as verified evidence.

## Productive first user test when an EIG preview is approved

1. Sign in as a current EIG administrator in an **isolated preview** with the gate enabled, open EIG Command Center -> Build Lab.
2. Click **Load InceptionApex pilot**, then **Create draft blueprint**. Confirm the output describes a reusable-first strategy and identifies creative/identity modules to verify.
3. Accept one suggestion, revise the UI audit proposal and reject another. Confirm counts and labels update and nothing changes in InceptionApex or a customer Hangar.
4. Download a Markdown preview for sharing, and **also** download reusable JSON. Reopen the JSON; confirm original brief and review decisions reappear.
5. Edit goal and regenerate: ensure the blueprint has a new version and suggestions require fresh human review. Navigate away with unexported changes and verify warning. Test phone screen widths.
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

Distinguish software/build version, customer edition/version, and each project's proposal/artwork revision. The local pilot only versions exported draft blueprints. It does not preserve immutable server-side revisions. All app comparisons must record reference version and date when known. Product features require real business evidence and cost/benefit judgment, not AI confidence alone.

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
