# EIG Marketplace Verified Vendor Reputation
Owner decision: vendors receive ratings, but no Google-style public written reviews. Draft policy architecture, not implemented.

## Primary rule
Reputation must be tied to permissioned, verified commercial engagement and auditable performance, not anonymous comments or emotional opinions. No open review walls, unrestricted public text allegations, or unverified star ratings. Do not manufacture reputation from sales volume or payment for placement.

## Candidate scorecard
- Order completion rate (completed, cancelled by buyer, cancelled by vendor distinguished)
- Promised vs actual delivery / performance window, with documented exclusions and customer-requested changes
- Quote reliability: scope-matched final invoice versus approved quote, with customer-approved change orders isolated
- Order correctness / documented remediation and return rates, separating buyer cause and vendor cause
- Issue resolution timeliness on validated complaints, not mere number of complaints
- Scope-specific measures for printers, freight, hospitality, contractors, merchandise, and digital services
- Verification counts and measurement period alongside score; low-volume suppliers remain 'Not Yet Rated' or show uncertainty, never an artificially low score.

## Fairness & disputes
Link each score component to permitted order, date, evidence and policy version. Limit public display to aggregated factual scores and verified badges where supported. Vendors receive a private performance breakdown, correction workflow, rebuttal opportunity, and appeal/review path. Suppress contested or ambiguous events from scored outcomes while under review where warranted. Protect confidential supplier and buyer documents; no public identifying narratives. Investigate manipulation by either side. Badges require documented eligibility and expiration. Anti-pay-to-rank separation: paid promotions clearly labeled, do not silently increase verified scores.

## Connected workflow
Marketplace quote -> approved supplier order -> fulfillment/invoice facts -> expense attribution -> vendor performance events -> score review and dispute process -> vendor listing + supplier selection panel. Self-sourced external vendors may be added privately for cost accounting, but do not receive verified marketplace ratings absent eligible, consented evidence and onboarding. Users can always choose vendors outside EIG.

## Guardrails
Set published score methodology, weighting, evidence thresholds, grace periods, dispute SLAs, and independent moderation before launch. Test correction, delayed carrier deliveries, split orders, customer-caused delays, incomplete data, cold-start fairness and privacy. Do not auto-blacklist vendors from a single failure or let public accusations become searchable. Financial conflicts disclosed for partner referrals.

## Proof of delivery / proof of service architecture (owner request, October 16, 2026)
Design a common Proof Record linked to the purchase/order/job: organization, supplier, customer, fulfillment leg, proof type, event timestamp with timezone, recorded-by role, source provider, provider event ID, immutable attachment pointers, metadata, verification state, dispute state, retention policy and access controls. Multiple evidence types may be combined; none should be described as infallible.
- **Shipped goods**: carrier integration and tracking status timeline, carrier-supplied delivery confirmation, optional carrier proof-of-delivery image, recipient signature where appropriate, delivery exception and damage evidence. Carrier delivery scan alone does NOT prove contents or condition; delivery photo alone does not prove the package was received by the correct individual.
- **Service jobs**: documented scope, scheduled start/finish, optional before/after photos, approved work-order milestones, completion checklist, customer sign-off, optional third-party verification for expensive/regulated jobs. 'Work completed' and 'customer accepted work' are separate statuses.
- **Photo policy**: notify all parties about capture and legitimate business purpose. Capture only relevant work/property, avoid bystanders/minors, addresses/interiors beyond necessity, identity documents and sensitive information; obtain consent/authorization when required by law and context. Respect property restrictions and employer/worker policies. Record file provenance and upload timestamp; GPS/geotag when enabled and appropriate, with documented user permission and uncertainty. Strip unnecessary EXIF on externally visible images. Store originals access-controlled, hash originals to detect later changes, preserve versioned annotated copies, use limited retention and secure deletion. Never publish delivery photos as open consumer reviews.
- **Evidentiary strength**: independent provider tracking plus delivery photo may give stronger confidence; signed receipt/verified customer acceptance stronger for some outcomes, but fraud, spoofing, mistaken delivery and provider failures remain possible. Apply risk-based additional checks. Set 'verified', 'disputed', 'unverified', 'exception' statuses rather than asserting a rating outcome without review.
- **Disputes**: evidence available privately to both authorized parties; allow documented corrections, customer/vendor appeals and independent moderation. Do not automatically penalize a vendor for carrier failures beyond contractual responsibilities, customer no-show, bad access instructions, changed scope, or declined photo capture. Appeals and privacy redactions must not alter original evidence.
- **Integrations**: EIG ShipHub should evaluate vetted shipping/tracking aggregator options (e.g. licensed carrier APIs or EasyPost/Shippo/AfterShip) for granular tracking and supported photo/signature availability; actual photo-of-delivery access and licensing must be verified per carrier, service level, geography and API. Service proof intake through FlightDocs/Marketplace mobile workflow. Provider webhooks must be authenticated, replay-safe and deduplicated. EIG does not claim these integrations exist yet.
- **Rating boundary**: Verified facts (timeliness, approved completion, quantity and issue handling) can support a published score after eligibility and appeal checks. No open text review, no automatic certainty claim, no punishment merely because a person did not consent to photographs.
- **First pilot**: for 20,000 Chapel Hill printed scorecards, compare printer promise against order/ship/arrival timestamps, request package-condition delivery photos where permitted, log count/print quality at receiving and capture Chapel Hill approval separately. Link invoice to project expense record and vendor's private performance history before scoring.
