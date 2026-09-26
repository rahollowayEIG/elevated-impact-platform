# EIE / ElevationPilot Parity Archaeology Audit

Last audited: 2026-09-25

## Audit rule

**KEEP -> MOVE -> TIGHTEN -> ADD**

- **KEEP**: current ElevationPilot implementation is the right source.
- **MOVE**: proven behavior exists elsewhere and should be carried into ElevationPilot.
- **TIGHTEN**: useful prototype exists, but it is event-specific, hard-coded, or should be modularized before reuse.
- **ADD**: desired behavior is not yet fully implemented in the audited sources.

## Sources found

### elevated-impact-platform

| Branch | What it contains | Audit role |
| --- | --- | --- |
| `main` | Core EIG platform, auth, organizations, onboarding, inquiry workflow | Foundation |
| `preview/hangar-cockpit` | 13 commits beyond main. Hangar/Cockpit prototype plus Global Squawk UI/data wiring | Important prototype source |
| `codex/squawk-email-send` | 4 commits beyond main. Strongest Squawk implementation, including real email send function | Best communication source |
| `codex/eie-platform-integration` | 13 commits beyond main. Current EIE architecture, Event Directory, Quick Registration, Master Event link, Public Hub, sponsors/assets/publish | Current target architecture |
| `codex/eie-parity-merge` | Safe working branch based on EIE integration. Roster import port in progress | Merge workspace |

### golf-event-registrations-eig

| Branch | What it contains | Audit role |
| --- | --- | --- |
| `main` | Mature standalone golf registration app. Roster/admin, import, Google roster, Golf Genius export, event setup, Hub, registration settings, payment bridge, event directory | Primary proven-behavior source |
| `codex/roster-maintenance` | Fully merged into main; now one commit behind | Historical only |
| `codex/eie-platform-integration` | Identical to main | No unique work remains |

## Live Supabase backing confirmed

The current EIG Supabase project already contains the tables needed to reunify the prototypes rather than rebuild them:

- `events`
- `golf_registration_events`
- `golf_registrations`
- `golf_event_setup`
- `golf_event_payment_settings`
- `event_offers`
- `event_requests`
- `sponsors`
- `golf_registration_admin_actions`
- full `squawk_*` table family

The current Quick Registration RPC creates a Master Event and links it to `golf_registration_events.master_event_id`. Roster rows link to `golf_registration_events.id`. This is the bridge that lets old proven EIE behavior move into the new ElevationPilot event architecture.

## Master parity map

| Area | Best source found | Status | Action |
| --- | --- | --- | --- |
| EIG auth + organization membership | platform main/current integration | KEEP | Keep current platform auth and permission model |
| Hangar / Cockpit vocabulary and workspace UX | `preview/hangar-cockpit` | MOVE | Carry strongest workspace/navigation behavior into current platform |
| Outing inquiry form | platform main/current integration | KEEP | Current implementation already uses `event_requests` |
| Inquiry review / 24-hour hold | platform main/current integration | KEEP | Preserve current request review and hold workflow |
| Cockpit inquiry attention/count | concept exists, not fully surfaced in current EIE | ADD | Add attention indicator without moving full workflow into Cockpit |
| Global Squawk drawer | `preview/hangar-cockpit` | MOVE | Restore global context-aware messaging entry point |
| Squawk templates / recipients / history | `codex/squawk-email-send` | MOVE | This branch is the strongest communication implementation |
| Squawk email delivery | `codex/squawk-email-send` + live `send-squawk-email` function | MOVE | Integrate rather than recreate |
| Squawk SMS | UI/data concepts exist, provider send not complete | ADD | Keep behind capability/connection state until provider is ready |
| EIE Event Directory | current EIE integration | KEEP | This is the correct new home |
| Quick Registration | current EIE integration | KEEP | Preserve RPC-driven event creation |
| Master Event linkage | current Supabase/current EIE | KEEP | Use as cross-app source of truth |
| Event pricing offers/add-ons | current EIE integration + `event_offers` | KEEP | Newer architecture is stronger |
| Public Event Hub shell | current EIE integration | KEEP | New modular Hub is the target |
| Hub publish/unpublish | current EIE integration | KEEP | Preserve |
| Hub assets/logo/banner/flyer/photos | current EIE integration | KEEP | New asset upload is stronger than old URL-only fields |
| Sponsors on Hub | current EIE integration | KEEP | Master Event-linked sponsor model is stronger |
| Hub announcement block | standalone golf app | MOVE | Restore announcement title/body as an optional Hub module |
| Tee times / pairings link | standalone golf app | MOVE | Restore as optional Event Info/Tournament Center module |
| Live results link | standalone golf app | MOVE | Restore, initially URL-based and later Golf Genius-connected |
| Event format / explanation | standalone `eventSetupEnhancements.js` | MOVE | Move into Event Info |
| Divisions with eligibility/description | standalone event setup/coordinator tools | MOVE | Use existing `golf_event_setup.division_details` |
| Flights toggle/concept | standalone coordinator setup | MOVE/TIGHTEN | Preserve setting, define final public behavior |
| Schedule / itinerary | standalone coordinator tools | MOVE | Strong existing CRUD behavior backed by `golf_event_setup.itinerary` |
| Player information / what-to-know | standalone event setup | MOVE | Fold into Event Info/Hub |
| Coordinator Hub preview | standalone `coordinatorEnhancements.js` | MOVE/TIGHTEN | Recreate natively inside current EIE instead of DOM enhancement |
| QR sharing | standalone coordinator tools | MOVE | Attach to current public event URL |
| Registration field requirements | standalone golf app + current Quick Registration defaults | MOVE/KEEP | Current defaults plus old configurable behavior |
| Custom registration fields | standalone golf app | MOVE | Preserve event-specific custom field builder |
| Team registration settings | standalone golf app | MOVE/TIGHTEN | Captain team name, partial team hold, team size, payment responsibility |
| Captain pays all | standalone golf app settings | MOVE | Generalize into current team registration flow |
| Split equal / each-player payment concepts | standalone golf app settings + current payment settings | TIGHTEN | Reconcile naming with current `allow_split_team_payments` model |
| Public participant account/sign-in | standalone EventsDirectory/bootstrap | TIGHTEN | Keep concept, but use ElevationPilot shared auth instead of separate golf shell |
| Old standalone Events Directory | standalone `EventsDirectory.jsx` | TIGHTEN | Do not copy shell; preserve useful event discovery behavior for future AirSpace |
| Registration payment choice UI | standalone `PaymentBridge.jsx` | MOVE/TIGHTEN | Proven Stripe/clubhouse flow, but currently hard-coded to Club Championship |
| Stripe checkout | standalone PaymentBridge + live edge functions | MOVE/TIGHTEN | Generalize by current event ID/offers instead of event constants |
| Clubhouse payment | standalone PaymentBridge/live registration flow | MOVE/TIGHTEN | Generalize due dates/holds from event settings |
| Payment status / Mark Paid | standalone roster + live admin function | MOVE | Restore inside ATC roster |
| Comp player + reason | standalone roster + live admin function | MOVE | Restore inside ATC roster |
| Withdraw / Cancel / Reactivate | standalone roster + live admin function | MOVE | Restore with confirmations and audit |
| Add Golfer Manually | standalone roster + live admin function | MOVE | Restore inside ATC roster |
| Manage-row center/highlight behavior | standalone roster main | MOVE | Preserve the version fixed on 2026-09-22 |
| Bulk roster actions | standalone main | MOVE | Strongest source includes bulk select/actions |
| Team assignment / move team | standalone main/live admin function | MOVE | Restore for team events |
| Upload Roster CSV/XLSX | standalone `RosterUpload.jsx` | MOVE | Already being ported on parity branch |
| Roster field mapping / review | standalone roster importer | MOVE | Preserve |
| Duplicate detection | standalone importer/admin function | MOVE | Preserve |
| Missing-info email requests | standalone importer + live function | MOVE | Preserve |
| Google Import Source sheet | standalone importer + live function | MOVE | Preserve |
| Pull Google roster edits back into EIE | standalone main + live function | MOVE | Preserve |
| Required Roster Sheet | standalone importer/live function | MOVE | Preserve |
| Golf Genius CSV export | standalone roster enhancement/main | MOVE | Preserve confirmed-only behavior and team/entry normalization |
| Golf Genius entry numbering by team size | standalone main | MOVE | Preserve |
| Direct Golf Genius integration | not fully implemented | ADD | Existing links/export are stepping stones |
| Invoice/email/message from roster | communication branch concepts exist, direct roster workflow incomplete | ADD/MOVE | Connect roster actions to Squawk templates instead of separate messaging code |
| Automatic action emails, e.g. withdrawal | backend/UI not fully unified | ADD | Event-driven notification after roster action |
| Event Budget | only newer architecture concept/reference found | ADD | Build on Master Event rather than old app |
| Notifications / Cockpit attention items | concept but not complete | ADD | Inquiry, unpaid balances, incomplete teams, setup issues |
| Page-type interaction standards | design requirement, not centralized yet | ADD | Create reusable patterns for roster, directory, setup, detail, etc. |

## Important source-quality decisions

### 1. Do not merge whole prototype branches

`preview/hangar-cockpit`, `codex/squawk-email-send`, and `codex/eie-platform-integration` all diverged from the same older platform main branch. Whole-branch merges would collide inside the large monolithic `src/App.jsx`.

Instead, extract the useful behavior into reusable components/modules and attach them to the current EIE architecture.

### 2. Do not copy the old golf shell

The standalone golf app has good behavior but also event-specific routing and constants such as the Club Championship event key and public path. Preserve the behavior, not those hard-coded assumptions.

### 3. Current EIE owns event identity

New work should resolve the active event from the current ElevationPilot event record:

`Master Event -> golf_registration_events -> registrations / payment settings / offers / setup / communications`

### 4. Squawk should be the communication layer

Do not create a second parallel email/message system inside roster maintenance. Roster actions should open or trigger Squawk with event and participant context.

### 5. The standalone app is now a feature library

The old app is no longer the destination. Its strongest pieces should be moved deliberately into:
- EIE Event Operations / ATC
- Event Info
- Public Hub
- Squawk Box
- AirSpace where appropriate

## Recommended merge order

1. **ATC / Roster Operations**
   - roster table
   - Manage row behavior
   - add manually
   - upload
   - paid / comp / withdraw / cancel / reactivate
   - team assignment
   - bulk actions
   - Google roster round-trip
   - Golf Genius export

2. **Squawk communication restoration**
   - global drawer
   - event context
   - participant recipients
   - templates
   - email send
   - roster-to-Squawk actions

3. **Registration + team/payment parity**
   - participant fields
   - custom fields
   - captain/team setup
   - incomplete team hold
   - split payment rules
   - generalized Stripe/clubhouse flow

4. **Event Info parity**
   - tournament format
   - divisions/flights
   - itinerary
   - player info
   - announcements
   - tee times/results
   - QR sharing

5. **Public Hub completion**
   - expose Event Info modules conditionally
   - connect Golf Genius links/exports
   - retain new sponsors/assets/offers/publishing system

6. **Cockpit intelligence**
   - inquiry count
   - unpaid/incomplete team attention
   - unread Squawk indicator
   - setup/publish warnings

## Current parity branch state

`codex/eie-parity-merge` is intentionally isolated from production.

Work already parked there:
- `RosterUpload.jsx`
- `rosterImport.js`
- XLSX dependency
- roster compatibility styling
- initial roster maintenance component scaffold

Before merging this branch, complete native wiring, build/preview validation, and a real test-event pass.
