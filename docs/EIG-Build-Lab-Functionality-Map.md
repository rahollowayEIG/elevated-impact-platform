# Build Lab: intended functionality and reusable audit checks

Reviewed October 22, 2026 against preview commit `6a6ab8f0693ba9ef0c77797c60130d20a77f11ed`.

This is the requirements and audit-reuse map for the next scanner pass. It does not add a detector, query customer records, change an account or establish that any feature works. The current scanner directions, source recognizers and Work Buckets remain in use.

## What scanners must compare

For each meaningful capability, retain the intended outcome separately from observed implementation and executed verification. A component name, table, successful API response or matching test declaration cannot substitute for the outcome.

Each capability record needs:

| Field | Required information |
| --- | --- |
| Stable requirement ID | Identifies the same expected behavior across rescans and apps. |
| Decision and authority | Owner decision, canonical architecture, proposed acceptance test or unresolved question; dated source/reference. |
| Applicability | App, Hangar, event, actor, lifecycle state and environment to which the rule applies. |
| Trigger and outcome | What the user does and what should happen afterward. |
| Data owner and connections | Canonical identity and domain records, expected links, downstream views and integrations. |
| Exceptions | Invited/unclaimed people, TBA reservations, cancelled records, draft features, retries and partial failures. |
| Verification | Positive, negative, persistence and permission scenarios; reusable checks and missing checks. |
| Evidence envelope | Exact commit/deployment, environment, scope, capture time, executed check version, completeness and sanitized actual/expected result. |
| Finding and next action | Evidence assessment separate from repair/upgrade/build intent, owner disposition and implementation capability. |

Requirements are versioned independently of evidence. A changed requirement makes earlier results due for review; a code change does not silently rewrite the requirement. Missing permission, unavailable evidence or incomplete reads produce **Not checked / Incomplete**, not a pass or a confirmed defect. A deliberate lifecycle exception produces an explicit explanation, not a repair job.

## Recovering decisions from chats

Search available project chats alongside repository architecture and current source. Prefer explicit, applicable owner decisions over assistant suggestions. A later decision supersedes an older one only within its stated scope; otherwise record the conflict. Keep deferred ideas out of the current repair queue. Assistant statements that something shipped require exact-branch and runtime evidence.

The following records summarize retrieved chat context, not full transcripts. Retrieval is selective and does not establish that every project conversation was reviewed. Dates/times below are UTC where supplied by retrieval. Conversation URLs were not returned; none are invented. The two recent relevant project threads, **Share Yesterday's Updates** and **Implement Invoice Persistence**, were included in the search. Current-session instructions also apply.

| Decision ID | Retrieved source | Requirement and status |
| --- | --- | --- |
| DEC-IDENTITY | September 26 and September 30 identity/User Management discussions; canonical identity rules | Accepted architecture: one permanent person identity; event activity remains in Registration and links to the person. A Passenger can exist before a claimed login. Preserve history during claim; do not create a duplicate account per app. |
| DEC-FALL-CUP | September 29, 23:30:57 | Accepted target: **Fall 8\" Cup Scramble**, event key `chapel-hill-golf-course-fall-8-cup-scramble`, slug `fall-8-cup-scramble`. The accidental Fall 8in Cup is not the target. Verify actual event ID before investigating records. |
| DEC-CLAIM | October 9, 20:34:44 captain-flow acceptance | Captain registration was accepted for release; teammate/TBA/swap/payment tests were deferred in that conversation. Do not extend that acceptance to the entire registration lifecycle. |
| DEC-CANCEL | October 18, 20:21:19 | Accepted: cancellation releases the visible roster number for reuse while retaining permanent internal identity and history. This supersedes the older idea of keeping the cancelled visible number reserved. |
| DEC-TWO-WAY | October 19, 19:40:56 | Requested: audit intended builds into visible UI, and reverse-audit visible buttons/forms/menus into real functionality and stored results. The chat describes the requirement, not an active automated audit. |
| DEC-ACCOUNT-FIRST | October 21, 01:11:44 | Accepted: trackable user submissions require an account; basic signup uses first name, last name, email, username and password, with event-specific fields afterward. This changes older DOB/gender-at-signup requirements. It does not mean a staff roster import must fabricate a login for every invitee. |
| DEC-STUDIO | October 15, 16:18–16:22 | Accepted direction: one shared InceptionApex/EIG Studio; derive customer tiers later. Canva remains an EIG testing pilot. Customer entitlements/onboarding should be repeatable; customers should not need their own developer secrets. Package details remain open. |
| DEC-INVENTORY | October 21, 18:02:32; Share Yesterday's Updates context | Accepted: match existing products, reconcile a historical sale only once and preserve invoice history. Phone-photo/online-product intake is desired; prototype support is not live-import proof. |
| DEC-INVOICE | October 21, 18:57:11; Implement Invoice Persistence | Accepted: preserve original invoice-line details independently; allow one-time items. Optional Product Registry promotion requires editable details, duplicate review, stock/non-stock classification and explicit approval. Promotion itself must not move stock. Live issuance/payments/messages remain outside the approved prototype. |
| DEC-RENTAL | October 21, 18:28:04 | Deferred: property/Airbnb contract-and-inventory extension. Do not treat its absence as a current defect. |
| DEC-BUILD-REUSE | October 22, 02:56:49 | Requested: development/upgrades research compares build, integrate and partner options using current technology. Current metadata-only AI review does not perform that external research. |
| DEC-BUCKETS | Current October 22 session | Latest workflow: scan → Work Buckets → bucket review and saved work plan. Defer agent development until scanners and fixes are understood. Older mandatory per-finding accept/revise/blueprint/agent-selection sequences are superseded for normal review. |
| DEC-AUDIT-GOALS | Current October 22 session | Review audit functions for reuse and break intended functionality into checks. Include final chat decisions in requirements. The reported Cup/user-list mismatch remains unverified. |

**Known mismatch to investigate:** `tests/account-identity.test.mjs` still describes DOB/gender as mandatory for new accounts, and samples corresponding UI fields. That is evidence of an older contract on this branch, not proof that current deployed signup enforces it. Verify all signup entry paths against DEC-ACCOUNT-FIRST before changing them. Do not overwrite older historical test evidence or silently restore the superseded policy.

## Audit functions already available

This inventory is source-reviewed. It does not establish the functions' current production deployment or runtime health.

| Existing function/source | Useful scanner behavior | Limits and reuse decision |
| --- | --- | --- |
| `supabase/functions/platform-invite/index.ts`, `admin_audit` | Invalid/missing Auth email, unverified accounts, duplicate normalized Auth emails, failed/expired invitations, profiles/memberships/event access pointing to missing Auth accounts; explicit test-account inventory and session-revocation information. | Reuse detection logic through an explicitly authorized, read-only adapter. The endpoint returns private records and allows platform admins; Build Lab remains exact-owner-only. Do not call it from the browser scanner or copy its payload into local scan history/AI context. Unverified, expired and test states need lifecycle interpretation, not automatic repair. |
| Same file, `listAllAuthUsers` | Existing bounded Auth paging pattern and `truncated` signal. | Maximum ten pages of 1,000 Auth users. Related table reads need independent pagination/completeness checks. Never call an Auth link orphaned merely because its account is outside an incomplete sample. No global clear result from a partial dataset. |
| Same file, user-management listing and invitation acceptance | Listing joins Auth, profiles, Passengers, contacts, memberships, event assignments and invitations. Claim logic updates a registration's `user_id`, `passenger_id` and claim state. | These are evidence for expected relationships, not an independent audit. Reuse field semantics in reconciliation; do not invoke acceptance as a scanner. A valid registration does not imply its person has already claimed an account. |
| `src/lib/courseCardSourceAudit.mjs`, `auditCourseCardSource` | Pure comparison of published and calculated yardage totals; ambiguous tee-dependent par flags; explicit source attribution. | Good deterministic audit candidate using authorized input. Retains published values and requires course approval. No GPS, flyover, measurement accuracy or print approval established. Validate adapter inputs and source provenance. |
| `src/lib/masterScannerModes.mjs`, course/photo/quote modes | Missing/conflicting attributed course claims, supplied photo rights/resolution/hole metadata, noncomparable or unverified supplied printer quotes. | Offline helpers; they neither retrieve sites nor establish license validity/current vendor prices. Read-only findings can be adapted to common buckets after schema/permission validation. |
| Same file, `scanScannerHealth` | Checks declared test, evidence-validation, permission-boundary and unapproved-write metadata. | Self-declared booleans are insufficient health evidence. Bind them to exact-version CI/security results before treating the output as a verified scanner audit. |
| `src/lib/epProductCapture.mjs`, duplicate/reconciliation helpers | Same-organization SKU/title candidates and simulated historical-sale reconciliation proposals. | Demo inputs and preview proposals only. Do not merge products or move live stock. Duplicate candidates require review; prevent a repeated sale from deducting twice. |
| `src/lib/epCommerceContractReadiness.mjs`, hierarchy/readiness helpers | Cyclic/missing category parents, explicit tax-review states and proposed agreement requirements. | Blueprint checks only; no legal/tax correctness, signed agreement, reservation or provider outcome established. Test with fictional examples; preserve unresolved classification states. |
| `server/eig-master-source-scan.cjs`, `server/eig-inception-source-scan.cjs` | Fixed-source observations, configured-check counts, verification criteria and stable scanner identities. | Already integrated. Preserve source/runtime distinction and read allowlists. They are not substitutes for data reconciliation or browser execution. |
| `platform_account_audit`, `event_builder_asset_audit`, role history | Durable evidence that an authorized action or version change was recorded. | Logs are evidence inputs, not detectors. An absent log alone does not establish a failed action unless completeness, retention and the logging contract are verified. Never replay a mutation to generate audit evidence. |

### Specific Platform Audit blind spot

`admin_audit` reads Auth users, profiles, Passengers, memberships, event assignments, invitations and session-history records. Its returned issue rules do **not** compare `golf_registrations` with those identity records or verify the resulting user-list view. It checks **profile → existing Auth account**, but not **claimed account → required profile**. Passengers are loaded but no Passenger/registration consistency rule appears in that issue list.

This is a source-confirmed coverage gap. It is not a diagnosis of the live Fall 8\" Cup report. A registration can legitimately be an unclaimed invite or TBA, and an account can exist but be hidden by a list filter, role scope, stale view or incomplete query.

## First detailed workflow: registration to User Management

Requirement family `registration-person-link`, shared by Registration, Accounts and the user directory. Canonical identity rules remain authoritative: `person_id` is the architectural identity; inspect actual schema mappings rather than assuming every existing table already uses that column. The reviewed code currently uses `passengers.id`, `passengers.auth_user_id`, `profiles.id` and registration `passenger_id`/`user_id` links.

| Check ID | Scenario and expected outcome | Verification and exceptions |
| --- | --- | --- |
| REG-01 | An authorized staff/import/captain-created roster spot remains attached to the correct event and team. | Separate staff-created/unclaimed participants from authenticated self-submission. TBA spots are not fabricated users. Wrong event/legacy accidental event must not be reconciled into the intended outing. |
| REG-02 | A person who creates and verifies an account has the expected shared account/profile/Passenger relationship. | Verify the full create/verify/login flow and underlying links. Check missing required profile, missing Passenger and conflicting links in both directions using complete scoped datasets. Never inspect passwords. |
| REG-03 | An existing person signs in or claims an invitation without a duplicate login, person or registration. | Repeated claim/retry is safe. Email/name similarity alone does not authorize an automatic merge or historical claim. Preserve permanent IDs and domain history. |
| REG-04 | A verified claim links the existing roster spot to the correct person/account and appears in that person's Airport/Main Cabin. | Registration `user_id`, `passenger_id`, claim status and Passenger Auth mapping agree. Reject cross-account takeover; a valid user does not gain unrelated event access. |
| REG-05 | The authorized EIG user-management view can locate the claimed account; the identity-review view can show appropriate unclaimed people. | Record active search/filter/page/context. A person absent from an active-account-only view may be a correct unclaimed record, not a failed database write. Test UI query/pagination and displayed counts independently. |
| REG-06 | Required signup fields follow the current basic-account decision; event requirements are collected in their owning workflow. | Test new/existing accounts, general signup, public event signup, staff captain claim and teammate invite. Optional profile enrichment must not silently become permission or an unrelated account prerequisite. |
| REG-07 | Save/reopen, refresh and later sign-in preserve links and event history. | Test with synthetic accounts and a fictional event in isolated development/Sandbox; fail explicitly on interrupted writes. A local browser save does not demonstrate a durable shared profile. |
| REG-08 | Cancellation releases the visible roster number while preserving internal identity/payment/history according to the approved cancellation workflow. | Verify cancelled versus active numbering, TBA/replacements and team scope. Do not delete account history or infer payment/refund actions from cancellation alone. |
| REG-09 | Scanner results remain read-only and meaningful when data is unavailable or incomplete. | Include expected/unclaimed/not-applicable, discrepancy and not-checked outcomes; distinguish capture time from present state. Fail closed on permission/read errors. No auto-create, merge, invite, message or backfill. |

For the reported Cup case, first establish the exact live event, the specific missing people and whether they claimed accounts. Then compare authorized identity links and the user-list query. The report contains no customer names or live record results because none were retrieved in this review.

## Initial module coverage map

This covers the current seventeen Master Scanner targets. It is **not** a complete inventory of every application or every final requirement. Outcomes below combine existing module verification obligations with the dated decisions above. The scenarios are proposed acceptance checks, not new feature approvals or verified defects. Split each row into smaller capability records when its detector is built.

| Target | Intended outcome and connections | First verification scenarios | Requirement/evidence source |
| --- | --- | --- | --- |
| `event-builder` | Authorized event details/settings and registration configuration persist and reopen for the same event. Links reach the intended creative/registration tools. | Create/save/reopen; dates/time boundaries; draft versus published; role/event isolation; clone preserves settings without copying registrations/payments/history. | Existing Master verification; DEC-TWO-WAY; retrieved September 28 clone decision. |
| `registration` | Shared people attach to the correct team/outing; existing accounts claim existing spots; completion and account state remain distinct. | REG-01–09, captain/teammate/TBA, repeat claim, correct Airport return and incomplete registration. | Canonical identity rules; DEC-IDENTITY, DEC-CLAIM, DEC-ACCOUNT-FIRST. |
| `payments` | Authorized payment allocations, remaining amounts and refunds reflect the correct purchaser, team and shares. | Fictional full/split/partial/refund cases; retry/idempotency; move/replace scenarios; clubhouse instructions; no live charges. | Existing Master verification; project payment rules require further dated reconciliation before full policy is treated as final. |
| `roster` | Staff can maintain event-scoped people/teams without losing permanent identity or history. | Add/remove/replace/TBA, captain restrictions, active/cancelled numbering, save/reopen and scoped export. | Existing Master verification; DEC-CANCEL; canonical identity rules. |
| `accounts` | One shared identity, verified claim, scoped roles and correct account visibility across apps. | REG-02–06; role matrix; expiry/recovery; both directions of missing links; account/profile/invite states separated. | Canonical identity rules; DEC-IDENTITY, DEC-ACCOUNT-FIRST; Platform Audit inventory. |
| `squawk` | Contextual communications reach only authorized intended recipients with accurate state. | Fictional recipients across Hangars/events; no unauthorized reads; unread/notification state, repeat send and quiet-hours behavior using intercepted delivery. | Existing Master verification; `docs/EIG-Platform-Role-Communication-Contract.md`. |
| `sponsors` | Correct event sponsorship offers, prices and approved assets flow into registration/creative output. | Offer selection, save/reopen, price/availability updates and role scope; verify existing shared catalog before adding another. | Existing Master verification; shared-app architecture. |
| `event-packet` | Event-specific packet content/design references persist and export without leaking another event's data. | Save/reopen/export actual packet; shared InceptionApex handoff; interrupted save; cross-event isolation. | Existing Master verification; DEC-STUDIO; `docs/InceptionApex-App-Architecture.md`. |
| `event-budget` | Event budget inputs persist and totals remain reproducible from the intended domain records. | Arithmetic/rounding, save/reopen, missing values, authorized event links, changed roster/payment inputs; distinguish estimates from receipts. | Existing Master verification; event-budget implementation contract. |
| `inception` | One shared creative app preserves editable artwork, versions, approval and contextual handoffs. | Save/reopen/approve, unsaved-change protection, keyboard/mobile, print constraints and shared design references. | Existing IA/Master verification; DEC-STUDIO; canonical creative architecture. |
| `social` | Campaign drafts retain creative references, dates and controlled publication state. | Draft save/reopen, artwork linking, date changes, permission denial and mocked publication failure/retry. | Existing Master verification. Actual provider publication remains unverified. |
| `build-lab` | Owner runs scanners, reviews deduplicated bucket work and retains scoped plans/evidence. | Owner denial, no extra approval loop, repeat scans preserve decisions, stale evidence invalidates currentness, restore/backup and explicit capability limits. | DEC-BUCKETS; current Build Lab architecture. |
| `maps` | Course facts/assets preserve provenance and approved relationships to creative outputs. | Reuse course-card/claim/photo audits; tee-specific totals/par, hole association, missing/conflicting sources and export approvals. | Existing Master verification; course audit helpers. Flyovers/GPS are separate planned capabilities, not proven by a map canvas. |
| `invoices` | Immutable original invoice lines persist; one-time lines are valid; optional reviewed catalog promotion is independent. | Save/reopen with fictional issuers; later catalog edits preserve invoice history; duplicate review; promotion never moves stock. | DEC-INVOICE; `docs/EP-MANUAL-INVOICE-READINESS.md`. Separate PR/deployment evidence required before claiming persistence is shipped here. |
| `product-registry` | Product intake matches existing scoped items; historical sales reconcile once without rewriting invoice history. | Link/photo intake review; ambiguous SKU/name candidates; organization isolation; repeated reconciliation and correction provenance. | DEC-INVENTORY; `docs/EP-SMART-PRODUCT-CAPTURE-DOUBLE-SYNC.md`. Existing helpers remain demo proposals. |
| `contracts` | Relevant agreement requirements attach to the correct transaction/event/asset with versioned approval/signature evidence. | Reuse agreement-readiness planner; missing version/approval/signature; correct issuer and scoped references; provider mock failures. | Existing Master verification; commerce-readiness blueprint. Detailed legal/provider policy remains separate from scanner acceptance design. |
| `pos-tax` | Shared category/item/availability and explicit tax-review context remain coherent across commerce tools. | Hierarchy missing parent/cycle, product override versus category default, unclassified/exempt review states and non-stock items. | Existing Master verification; commerce-readiness blueprint. No tax/legal correctness or live POS integration implied. |

Additional capability families need their own records beyond this target list: Organization/Hangar onboarding and provisioning, entitlements, public Event Hub/navigation, email/countdown/invitation delivery, check-in/export, account recovery, external-provider connections, accessibility and browser/device coverage. Existing audit documents/tests are candidates to inspect; a mention here is not confirmation that their scanner exists.

## Common adapter and finding contract

1. Start with a stable requirement and exact actor/environment scope. Resolve the latest applicable decision before executing checks.
2. Reuse a pure deterministic audit where available. For private data, run a separately authorized server-side read-only collector; preserve Build Lab's exact-owner check even where the original audit permits other administrators.
3. Validate scope, reference integrity, input bounds, pagination/completeness and timestamps. Never infer a pass from an empty, failed or truncated query. Samples describe their sample only.
4. Emit sanitized expected/actual observations, check/version IDs and aggregate counts with protected evidence references. Keep customer names, emails, tokens and raw audit rows out of browser-local scan history, generic exports and AI metadata.
5. Separate informational/expected lifecycle state from confirmed discrepancy, coverage gap and not checked. A source-only observation remains needs verification. Automated confirmation requires a complete, applicable, independently validated check of the actual outcome.
6. Adapt findings into existing Work Buckets with stable identity and proposed completion criteria. Preserve revisions/holds/dismissals and provenance. Do not automatically mark older work fixed because a finding disappears.
7. Bucket approval remains scope review. It does not run a repair, change data, grant access, send a message or authorize a release.

## Implementation order

First finish decision recovery and capability breakdown for the shared identity/registration chain, including the actual directory view. Extract/reuse audit predicates with synthetic fixtures covering missing links in both directions, valid unclaimed people, TBA, duplicates/ambiguous matches, truncation, scoped authorization and retries. Run the end-to-end scenario in isolated development/Sandbox before adding a protected live read-only reconciliation adapter.

Then extend the same requirement/evidence contract across the existing module targets and additional capabilities. Implement the missing detectors and UI/data round-trip checks rather than merely increasing source-marker counts. Build agents only after these jobs, required tools, permissions, evidence and repair boundaries are proven. No agent or autonomous repair is introduced by this map.

## Repository references

- `docs/ElevationPilot-User-Identity-Rules.md`
- `docs/EIG-Build-Lab-Project-Architect.md`
- `docs/User-Management-Security-History-Audit.md`
- `docs/EIG-Platform-Role-Communication-Contract.md`
- `docs/InceptionApex-App-Architecture.md`
- `docs/EP-MANUAL-INVOICE-READINESS.md`
- `docs/EP-SMART-PRODUCT-CAPTURE-DOUBLE-SYNC.md`
- `src/lib/buildLabScannerDirections.json`
- `src/lib/eigMasterScanTargets.mjs`
- `server/eig-master-source-scan.cjs`
- `server/eig-inception-source-scan.cjs`
- `supabase/functions/platform-invite/index.ts`
- `supabase/functions/golf-admin-team-registration/index.ts`
- `src/lib/courseCardSourceAudit.mjs`
- `src/lib/masterScannerModes.mjs`
- `src/lib/epProductCapture.mjs`
- `src/lib/epCommerceContractReadiness.mjs`
- `tests/account-identity.test.mjs`
