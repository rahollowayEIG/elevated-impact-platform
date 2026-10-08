# Social Media & Ads inside ElevationPilot

## Owner direction — October 7, 2026

Ryan wants one social media management app to prepare content once and distribute it across connected social accounts, event hubs, course websites and other placements. The commercial starting point is what a Hangar controls physically and online, and what it sells. Make an offer from that inventory, reuse the sponsor information and approved creative, and make selling/delivery easy. Empower Hangars without a setup/access charge; EIG benefits from resulting paid business. No package price, split percentage or new billing rule has been decided.

Social Media & Ads is a descriptive working dashboard label, not a claim that Ryan previously chose a final brand name. It shares ElevationPilot login and identity. Route: `#social-media`.

## Inventory to offer to campaign

For each real inventory item, record its controlling Hangar, authorized manager, location/account, permitted ad formats, availability/dates, capacity and delivery method. A physical space is not automatically available just because it exists on a course map. A social destination checkbox is not an account connection or permission to post.

| What the Hangar controls | Offers it could sell | Preparation/delivery |
| --- | --- | --- |
| Tee signs and holes | Hole sponsor, hole-in-one or skills challenge | Verified map pin, sponsor artwork, approved prize/rules and hole guide |
| Clubhouse, check-in, carts and event spaces | Banners, cart signs, welcome/awards sponsor | Artwork sizes, placement booking and approved production request |
| Digital screens | Screen ads and sponsor loops | Approved images/video and selected display specifications |
| Event hub and registration page | Presenting partner, sponsor spotlight, ad block | Approved hub artwork/link and event-scoped placement |
| Course/venue website | Ad block, event or venue promotion | Website placement and approved embed |
| Social accounts | Spotlight posts, coordinated campaigns, reels and recap packages | Account-authorized publishing, selected channels and per-platform variants |
| Briefings and golfer guides | Video mentions, sponsored challenges and hole introductions | Verified script, approved branded video and captions |
| Email/newsletter and app announcements | Opted-in sponsor communications | Authorized audience, reviewed message and connected delivery service |
| Programs, scorecards and yardage books | Printed ad placements and event packages | Multipage layout/proof and print fulfillment |
| Gifts, apparel and giveaways | Branded swag, prize and product partners | Selected catalog product, imprint specifications and approved design |
| Hospitality and event experiences | Food/beverage, cart, awards and outing packages | Sellable package, availability, sponsor recognition and delivery |
| Results and recaps | Results partner, event highlights and thank-you campaign | Approved results/photos, sponsor rights and follow-up content |

These are candidate offers, not enabled inventory bookings or guarantees that all Hangars control all surfaces. Preserve the asset/source facts and event authority. EIC owns actual catalog items, prices, carts, purchases, inventory commitments, revenue allocation and payouts. Impactertising/signage owns placements and ad delivery context; this workspace prepares and eventually publishes the content. InceptionApex owns artwork and product previews. Event Builder owns event/course facts. Squawk handles authorized discussions/announcements.

## Current foundation

- Shared authenticated app entry and blue EIG dashboard.
- Searchable opportunity starters grouped into Physical spaces, Online channels and Products & experiences.
- One campaign composer with sponsor, headline/message, destination link, public artwork URL, CTA and chosen destinations.
- Optional authorized event context; saved context cannot be reassigned. Personal campaigns remain private to their existing account.
- Content preview, private versioned draft saves, reviewed snapshots, search/filter/sort and draft backups.
- Reviewed static website-ad HTML export for Event hub/Course website. Exact text and links are escaped; only HTTPS links are accepted. The export is downloaded for a site manager to insert manually. It does not install an ad, track metrics, update an existing embed or expire it automatically.
- Campaign start/end and per-post times form saved posting plans in the campaign's recorded time zone. They are not queued provider jobs or live expiration controls.
- Account connection cards link to provider setup documentation and honestly show connection pending. Publish is disabled. Artwork creation opens InceptionApex; automatic asset return/import is future work.

No automatic private-to-public copying, external posts, notifications, payments or supplier orders occur in this release. Social/campaign data belongs to its own domain rather than being saved as an InceptionApex design.

## Publishing and live ad delivery next

1. Choose initial supported networks and media formats. Each network needs an authorized account connection and supported developer API access; connecting an app in ChatGPT does not connect the website.
2. Implement Hangar/account mappings, secure OAuth callbacks with state/PKCE where applicable, scoped permission checks and revocation. Keep tokens server-side. Do not register guessed redirect URLs or paste credentials into chat/frontend code.
3. Import selected approved assets and public event facts with provenance. Exclude participant details, private bookings, payments and operational notes unless explicitly approved for the particular public use.
4. Preview per-platform variants and approve the exact campaign/account/version set. A changed offer, sponsor, prize or creative clears review. Selecting networks never posts immediately.
5. Build server-side schedules and per-destination jobs with idempotency, media readiness checks, failures/retries, cancellation, delivered post IDs/links and partial-success status. Retry failed targets without duplicating successful posts.
6. Add authorized event hub placements and a public ad-serving endpoint/embed with versioning, campaign dates and controlled updates. Validate placement ownership before serving; do not expose private draft tables publicly. Include sponsor disclosure and verified landing links.
7. Report real delivery, impressions/clicks where available, attributed sales, inventory fulfillment and EIC payouts. Never fabricate reach, revenue or sponsor commitments.
8. Add sellable packages and agreed Hangar revenue share through EIC. Every paid event-upgrade review shows the actual price, Ella/Marshal/Maverick reminder and event-scoped Sponsor Builder help under EIG-Paid-Upgrade-Sponsorship-Rule.md.

## Storage and release audit

`social_campaigns` and `social_campaign_versions` use RLS and narrow authenticated RPC writes, fresh verified interactive session checks, existing event management authority, immutable context, compare-and-swap versions and append-only revision audit. Anonymous/direct writes and cross-account personal access are denied. Event access removal also removes campaign access. Saved drafts/reviewed versions are intentional informational states; the scoped dashboard counts and My campaigns provide drill-down. A future central administrative aggregate can report counts without bypassing private campaign visibility.

Database tests execute the actual additive migration in PGlite and cover anonymous/direct-write denial, private ownership, event scope/revocation, inactive/revoked sessions, stale versions, context mutation, review reset and immutable history. Browser checks cover desktop/mobile, opportunity selection, save/reopen, reviewed escaped HTML export, stale-save recovery, backups and unsaved guards. Existing design/Event Builder regressions are also checked. Provider publishing, real organizer signed-in saves and live website installation are not asserted by the synthetic browser suite.

Four-pass review: EIG navy/red visual language and responsive layout; labels/spacing/loading/empty/error states; save/reopen/export/navigation workflow and authorization tests; common-sense review of honest pending integrations, no fictitious billing/delivery and clear static-export limits.

## Official provider setup references

- Meta Pages: https://developers.facebook.com/docs/pages-api/posts/
- Instagram: https://developers.facebook.com/docs/instagram-platform/
- LinkedIn: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- TikTok: https://developers.tiktok.com/doc/content-posting-api-get-started/
- YouTube: https://developers.google.com/youtube/v3/guides/uploading_a_video
- X: https://docs.x.com/x-api/posts/create-post

Current API entitlements, format limits, approval requirements and costs must be verified for each selected provider before it is enabled. Universal support for every social outlet is not promised.

The additive campaign migration was applied to the production Supabase project on October 7. Both tables have RLS, no anonymous read and no authenticated direct insert/update/delete grants; only authenticated scoped RPC preparation is exposed. No new social-workspace security advisor findings appeared, and the live legacy event/inquiry policy fingerprint remained unchanged. No real user's identity was impersonated for verification.

## Campaign templates and schedules — October 8, 2026

Ryan approved ready-made campaigns and scheduling. Four starters create editable post series: Event countdown (14 days, 7 days, 1 day, event day), Sponsor spotlight (first day, 3 days later, 7 days later), Weekly business deal (four weekly posts), and Registration reminders (7, 3, and 1 days before the supplied deadline). The organizer supplies the event/business name, anchor date/time, sponsor and approved offer where applicable. Generated copy is a draft; confirm actual dates, availability, offer terms, and sponsor facts before review. Templates do not infer private event details or prices.

The composer supports up to 24 individually dated and editable posts, campaign bounds, explicit IANA time zone, whole-plan review, and reuse as a new draft campaign. Every content/date/channel/zone change clears the local review state; saving a draft clears the server's review actor/time. Event ownership cannot be reassigned. The new event list and social authorization require an active owning Hangar plus current verified account/session and scoped management authority. Personal campaigns remain account-private; organization-wide campaigns without an event and a full Hangar advertising inventory/onboarding section remain future work.

The scoped calendar combines saved plans with month selection, search, review-state filtering, and sortable chronological agenda. Reviewed entries say **Ready for manual posting**. Draft entries say **Needs review**. These statuses do not mean a provider post was delivered. Calendar data comes from saved versions; an unsaved editor cannot silently alter it. A reviewed plan downloads an RFC 5545 calendar file with UTC times, stable post IDs and revision sequence; importing it provides manual calendar entries, not a guaranteed alarm or automatic social publishing. Website-ad exports remain static and require manual updates/removal.

The database independently validates every planned post, unique UUIDs, bounds, messages, time zones, and local dates; it derives UTC timestamps itself and strips invented delivery state. Nonexistent and ambiguous clock-change times are rejected on both client and server. An author can choose another local time or use UTC. CAS saves and existing append-only revisions capture the exact reviewed plan and actor. No scheduler worker, provider OAuth connection, live ad expiration, paid package, revenue split, notifications, or external posts are introduced.

Hangar onboarding should later collect owned pages/ad locations, website installation contact, advertising preferences and approvers, social accounts and posting preferences, and self-managed/hybrid/EIG-managed service choice. Outside-site embeds require an authorized installation step. EIC retains package prices, sales, allocations, and payouts; do not invent rates or shares while building the planning workspace.

Verification covers all four template/date patterns, UTC/DST conversion, calendar escaping/folding and stable identities, the actual migration's scope/revocation/CAS/audit and canonical timestamps, real Supabase client requests against a browser fixture, edited post save/reopen/review, invalid dates, calendar filters/sorting, ICS download, draft reuse, stale-save backup, denial, and mobile layout. Existing campaign preparation/website exports and the full build regression suite remain required. Production application uses the normal authenticated session; tests do not impersonate a live customer or publish content.

Release audit: the posting-plan migration is applied in production; both campaign tables retain RLS, no anonymous reads, and no authenticated direct writes. Summer/winter UTC conversion was checked against the live helper. Security advisors are unchanged from baseline (38 existing findings, zero new). The full build passed 85 automated checks, both campaign browser flows passed, and desktop/editor/mobile views were inspected. React review retained parallel reads, shared authenticated storage, memoized saved-calendar rows, stable identifiers, disabled saves during requests, explicit labels, and draft guards.
