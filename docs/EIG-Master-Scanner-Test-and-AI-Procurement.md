# Master Scanner: owner preview test plan and AI/API shopping list
October 16, 2026. Development-only branch. Do not merge/deploy without owner approval.

## What exists now
- One source inspector integrated into owner-only Build Lab preview of PR #53 (four allowlisted files, six static findings in earlier pilot).
- Planning architect and browser-local review drafts.
- Branch-local, NOT connected to preview: scorecard readiness, Chapel Hill sourced scorecard totals audit, and offline adapters in src/lib/masterScannerModes.mjs for course claims, photo metadata, print quotes, scanner health. Tests exist in tests/master-scanner-modes.test.mjs and other targeted test files; running tests, CI, and preview integration are still to be confirmed.
- No automatic arbitrary website crawl, image analysis AI, video scan, supplier price retrieval, browser robot, app repair, or code self-fixing. Self-health audit identifies missing evidence/tests/permissions; it cannot patch code automatically.

## Tomorrow's owner testing (only AFTER a validated preview deployment, not yet ready)
1. Ensure scanner branch CI passes and inspect allowed routes. Confirm owner can access, all other users cannot.
2. Test baseline source scan: fingerprints, evidence, Accept/Revise/Reject, export/reopen and autosave.
3. Test course source intake with two contradictory sourced claims; show both URLs and mark resolution required. Chapel Hill published tee totals have unresolved differences.
4. Test 18-hole scorecard readiness; unknown/planned states are NOT approval.
5. Test photo metadata: license missing and insufficient resolution flagged; no invented image content claims.
6. Compare 20,000-card quotes with same specs; different fold/stock or uncertain pricing marked non-comparable.
7. Run self-scan: missing tests/evidence permission boundary/unapproved writes fail gates, not silently fixed.
8. Verify any scanner crash, malformed data, duplicate findings, missing source provenance, stale sources and mobile states; download results.
9. Confirm no production edits, no external charges, no purchases, no uploads of confidential records without permission.
10. End with prioritized review list (accept/revise/reject), decide which scanner can graduate to preview.

## AI and product services to consider: buy only in phases
**Phase 1, useful to unlock advanced source + photos + research**
- OpenAI API account with billing limit and private backend credential. Multimodal reasoning for photos, documents, website summaries and source-assisted recommendations; compare model costs for bulk vs complex audit. API billing is distinct from ChatGPT subscription. https://openai.com/api/
- Browser automation runtime: Playwright (open source/self-host on Vercel-compatible runner or CI) first. If managed headless browsing requires scaling, Browserbase: Free tier currently listed, Developer $20/month, Startup $99/month, plus usage/model fees. Requires website permission/robots compliance and sensitive session protection. https://www.browserbase.com/pricing
- Research/indexing: permissioned search API, commercial search provider or provider-native search tools; require source URLs, freshness, terms and cost caps. Avoid unauthorized crawling/scraping.
**Phase 2, premium artwork and aerial**
- Adobe Creative Cloud/Firefly commercial plan or API, only if quality/rights and integration requirements justify it. Existing Adobe availability should be evaluated before purchase.
- Mapbox (GL JS + terrain/map/static) for interactive course maps, verify imagery licensing and video export permissions. https://www.mapbox.com/pricing
- CesiumJS/ion only if genuine 3D terrain/camera benefits justify cost and licensed export conditions. Ground GPS distances remain independently surveyed.
- Runway or other video-generation API only for optional branded creative clips, not a substitute for geographically accurate flyover.
**Optional comparisons, not must-buy**
- Anthropic API as second opinion on larger code/document audits, after cost and data handling are tested. https://platform.claude.com/docs/en/about-claude/pricing
- Cloud image/document OCR/vision provider for high-throughput scanned documents only if OpenAI vision plus ordinary extraction fails benchmarks.
- Printer supplier, delivery tracking, inventory, Shopify/Stripe and accounting integrations as needed by business features, not prerequisites for the first scanner.
## Procurement safeguards
- Start with minimal usage pay-as-you-go, per-scan spend estimates and monthly caps. Never put API keys in frontend. Owner confirms legal rights, privacy, image/photo reuse, vendor terms and commercial printed map redistribution before enabling provider.
- The latest rates and account availability must be rechecked during signup. We do not know which paid APIs are already provisioned and have not purchased or subscribed to anything.
