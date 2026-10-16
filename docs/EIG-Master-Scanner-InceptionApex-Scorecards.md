# EIG Master Scanner -> InceptionApex -> Chapel Hill Scorecards
**Draft implementation slice (Oct 15, 2026). No production release.**

## First customer outcome
Deliver printable Chapel Hill scorecards with accurate course facts, approved sponsor placements, durable QR link, high-quality editable print master, home-print PDF and a minimal mobile score entry experience. Do not delay printing for GPS, 3D world, avatars, green reading, or a native mobile store release.

## What exists vs what is newly built
- Existing EIG Build Lab in draft PR #53: owner-only Project Architect, browser-local draft/reviews, allowlisted read-only InceptionApex source inspector (4 files, 6 findings in pilot). It is not a universal live AI/browser scan.
- Existing Universal Scan Engine: validation/review/handoff contract only, not external scanning or automatic production import.
- Existing InceptionApex architecture: creative editor and initial exports, with multipage scorecard production and many provider connections still pending verification.
- **New in this branch:** `src/lib/scorecardReadiness.mjs`, a read-only, evidence-driven readiness evaluation contract and tests. It does NOT query GitHub or Vercel automatically, inspect live UI, generate artwork, write scorecards, or fabricate verified capability status.

## Dedicated master scan domains
1. Source code inspection: source paths, revision commit, test references; no runtime claims solely from source.
2. Browser journeys: open IA, build/edit scorecard, save, revisit, approve, PDF export, responsive screen, QR to event/course; capture screenshots and results in authorized preview.
3. Course data: canonical course, tees, 9/18 routing, holes, pars, handicaps, yardages; verify with Chapel Hill staff.
4. Creative output: exact publisher/card dimensions, folded/flat faces, artwork layers, sponsor slots, bleed, safe zones, 300dpi assets, print preflight; test print.
5. Platform integration: event registration/team scoring, rounds archive, profile consent, access, EIC if orderable.
6. Sponsorship and marketing: slot owner, approved advertisers, ad specs, duration/term, QR destination, consent and reporting.
7. Mobile/golf: saved round, online/offline, tee GPS accuracy, map licensing, flyovers, print current round; native versus PWA assessment.
8. Research inspector: evidence-linked competitors, print shops, GPS mapping and green-data APIs, rights and pricing.
9. Gap review: owner Accept / Revise / Reject; no autonomous purchase, publishing, deployment, user messaging or charges.

## First implementation sprint
- P0: verify existing IA design editor and scorecard-specific files/UX against source and isolated preview.
- P1: import a real Chapel Hill scorecard or approved course/tee spreadsheet. Confirm folds, stock, printer constraints, and all 18-hole data.
- P2: implement reusable Scorecard Design Spec + output templates sharing canonical hole/tee/sponsor data with PDF/print preflight and reprint mode.
- P3: create permanent QR landing destination: responsive scorecard, course intro, sponsor positions; activate only tested functionality.
- P4: round storage and share/print flows with secure event/player role access; attach Map/GPS separately once surveyed.
- P5: derive yardage-book pages, flyover links, Hall of Fame, course sponsors and optional immersive clubhouse experiences from the same verified data.

## Gates
- A scanner recommendation does not imply a functioning product.
- New or modified records pass the domain owner; marketing cannot access private individual profile preferences without permitted sharing and consent.
- Advertisements must not compromise scoring, print legibility, hole measurements or navigation.
- App stays behind existing EIG permissions; no test changes to live course data, real registrations or production apps.
- Scorecards, tee data and sponsor names are approved by Chapel Hill before printing.

## Next required input
Current Chapel Hill scorecard (PDF, image or original design file) plus any course tee/yardage changes and preferred printer finished/folded format. These inputs are needed to make an accurate physical scorecard.
