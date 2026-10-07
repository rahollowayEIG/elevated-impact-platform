# Ella and the boys: golfer video guides

## Owner goal — October 7, 2026

Ryan wants Ella, Marshal and Maverick to tell golfers about a hole-in-one par-3 challenge, its car or other actual prize, and explain the hole itself. Related uses include pre-round announcements and digital sponsor ads. This is a planned connection, not a working video feature in the current release.

## Golfer experience

Open the event's hole card on a phone or scan a QR code on the tee sign. Play a short captioned introduction: Ella welcomes golfers and explains the actual hole; Marshal and Maverick point out verified hazards and a suggested approach; the hosts introduce the approved challenge, prize and sponsor. The same screen shows the facts, accessible text and a View official rules link. Use explicit play, pause/replay and mute controls; do not start audio automatically.

The first release can work through the existing mobile website. A native phone app, location-triggered playback and push notifications are separate future work. Pre-round briefings may link to approved clips through the Event Hub/Airport and authorized Squawk announcements. No notifications are sent by documenting this plan.

## Verified inputs and approvals

Event Builder owns the hole/challenge and sponsor context. Use the course's actual hole map, par, selected tee yardage, hazard locations and approved course guidance. Clearly label suggested strategy as a suggestion. Never invent distances, geography, contest eligibility, tee requirements or rules. Missing information stays pending until the organizer or course supplies it.

Read the prize and conditions from the event's approved challenge record and official rules. A car is an example; each event may have a different prize. Wording describes an opportunity under those rules, never a guaranteed win. Keep sponsor logos, exact text, map labels and QR codes as verified layers rather than generated imagery.

The organizer approves a specific script and rendered video version before publication. Changing the prize, hole, sponsor, tees or contest terms clears approval and prevents a stale clip from representing the current challenge. Preserve the approved version and its source references for future review.

## Creative implementation

Use the approved Ella/Marshal/Maverick references. Ella is the adult golf host; Marshal is the older red male Doberman on the left with his crown tag, and Maverick is the younger, slightly larger red male on the right with his airplane tag. Both have natural ears and docked tails. Review identity, motion and voice consistency before adopting a provider. Do not assume a general video API guarantees character consistency or synchronized speech.

Start with a reusable branded introduction and event-specific verified narration, captions and overlays. Runway is a candidate for motion/video; a voice service such as ElevenLabs is optional if consistent character narration is needed. Implement server-side jobs, authorized assets, usage budgets, retries/cancellation, private output storage and the approval/publishing flow before enabling paid generation. API access and billing must be configured independently of ChatGPT app connections.

InceptionApex owns creative versions. Event Builder owns source facts. Impactertising/signage owns placement; Squawk owns authorized announcements. Apply EIG-Paid-Upgrade-Sponsorship-Rule.md whenever this becomes a paid event upgrade, including the actual cost and event-scoped sponsorship help.

## Course onboarding and illustrated placement maps

Ryan also wants each course that signs up to receive a digital course model, flyovers and a cartoon-like illustrated map for on-course placements. Preferred visual styles are illustrated top-down or isometric. The shared map should support hole guides, sponsor signage, hole-in-one challenges, check-in, food/beverage and other authorized event placements.

Proposed onboarding: identify the course and authorized representative; obtain course-owned maps/GIS or aerial photos with rights for digitizing, styling and commercial app display; create draft hole/hazard/tee/green geometry; have the course review numbering, coordinates and current conditions; then publish a versioned course map. AI may help propose geometry, but review is required and no accuracy is promised from imagery alone. Courses outside imagery coverage must still have an upload/manual-map path.

Keep reusable course geometry and labels separate from each event's placement layer. Event Builder owns event-specific pins; InceptionApex styles the verified geometry without changing its alignment. Styling must preserve the map-to-coordinate transformation, and the course/event team approves real-world placements. Use licensed terrain/3D data or course-supplied footage for custom hole-by-hole flyovers; a 2D illustration alone does not provide verified elevation.

Google Earth Studio's FAQ currently says it does not offer a commercial imagery license. Google Maps Platform standard terms restrict extracting content and creating derived content, including digitizing from satellite imagery. Do not assume Google Earth can automatically scan a course into our proprietary illustrated map. Google Aerial View is a possible separate embedded overview for supported US addresses; it is an address-based aerial view, not automatic hole mapping or a custom per-hole flight, and its videos cannot be downloaded/stored/cached. Check current provider terms, coverage, attribution and billing before implementation.

Official references, checked October 7, 2026:
- https://www.google.com/intl/en/earth/studio/faq/
- https://cloud.google.com/maps-platform/terms (section 3.2.3)
- https://developers.google.com/maps/documentation/aerial-view/overview
- https://developers.google.com/maps/documentation/aerial-view/policies

This onboarding/map/flyover pipeline is planned. The current app already opens the authorized event's existing map/layout planner; no Google scanning or automatic digitization was added in the custom-product release.

## Paid initial mapping and Hangar reuse

Ryan proposed that event organizers can pay for the initial mapping work and share the draft with the course for verification. The approved reusable course asset goes to the course's owning Hangar, giving that Hangar a reason to promote the package for future events. Working interpretation: Course Mapping & Event Setup is the package name; it is a proposal, not an enabled product or settled price.

Before purchase, identify the payer, course's authorized reviewing representative, actual cost, deliverables, turnaround/revision scope and permission for the Hangar to retain/reuse the approved asset. Payment alone never transfers unrelated private event designs or expands membership. The course gets the reusable approved base map; each organizer retains event-specific placement and sponsor layers under existing event authority. Sharing a proof requires explicit scoped access and does not publish private assets. Keep provenance, review status and audit history, and handle rejection/revisions before fulfillment is marked complete.

EIC owns the paid package, checkout and order. The Hangar receives the approved asset after course verification, with its recorded reuse rights. Show the actual price and Ella/Marshal/Maverick reminder from EIG-Paid-Upgrade-Sponsorship-Rule.md on each paid upgrade review, and carry the incremental cost into that event's Sponsor Builder. Any referral fee or revenue split requires a separate owner decision; none is implied here.

## Preferred commercial model — course setup plus event revenue share

Ryan's latest proposal refines the earlier organizer-funded setup idea: charge the course for initial setup, then split the event-use package fee when the course brings an organizer to use it. Treat this as the preferred proposed model. Organizer-funded initial setup remains an alternative, not the assumed default. No price, split percentage or actual paid product has been approved or enabled.

Separate the course setup purchase (map creation, course verification and agreed reuse rights) from each organizer's event package (event-specific placements, sponsor artwork and selected golfer guides). Attribute qualifying sales to the course's immutable Hangar ID through an authorized referral/event relationship, not a mutable name or a client-selected payout recipient. Define the split basis, included sales, refunds/cancellations and payout timing before offering the package. EIC owns collection, revenue allocation and payout records; a course dashboard can show its own referrals and earnings under scoped access.

The course receives a reusable approved asset and an agreed share of qualifying event sales it brings in. Do not charge repeat map creation merely because a new event uses an existing approved map; any event customization or map revision has its own disclosed scope and price. Each paid event upgrade still includes the mandated sponsorship reminder and Sponsor Builder action. This records product direction only; no pricing, checkout, referral payouts or billing connection was implemented.
