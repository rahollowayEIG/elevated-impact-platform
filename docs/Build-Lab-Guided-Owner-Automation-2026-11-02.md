# Build Lab: guided owner workflow and safe automation ladder

**Release scope:** the Owner Console gains plain-English explanations and one-at-a-time guided decisions in Work Buckets and Review & Fix Plan.

### What is automatic now

1. **Collect:** Existing owner-local Scan History populates Work Buckets; repeated scan evidence is retained.
2. **Explain:** Show a cautious everyday-language explanation for each named area, with Quick / Full / Technical detail. Unknown findings use a generic, evidence-conscious fallback. None of these descriptions turns AI suggestions into confirmed defects.
3. **Prioritize:** Put open, not-yet-planned work in a stable order by severity, with each item available for review.
4. **Remember:** Save the current review item and current plan proposal in owner-local browser storage. Refreshes preserve position on that same browser and origin; no cross-device sync is claimed.
5. **Continue:** Move through one decision at a time. Holding or dismissing is explicit. Approving a finding generates a review-only planning batch from existing rules, then selects the next waiting item automatically.
6. **Handoff:** When there are no open unreviewed items, offer Continue to Review & Fix Plan. Review each plan proposal individually and leave actual execution disconnected.

### Progressive automation, future releases

- **Stage 2, evidence checks:** Automatically find equivalent existing tests, run isolated safe regressions, and attach exact-commit results. Do not claim that a finding is fixed unless a relevant test verifies it.
- **Stage 3, isolated code proposals:** Draft possible changes on a temporary branch, run tests and scanner regressions, show a plain-English before/after summary. Never expose customer data or service credentials to the code model.
- **Stage 4, controlled delivery:** Present a reviewed PR with test evidence, a rollback and the owner’s explicit authorization. Production deployment remains gated; never give an AI reviewer unbounded write or payment privileges.
- **Stage 5, lower-touch iteration:** Remember rejected or held recommendations, avoid repeats, select safe routine checks automatically, and ask the owner only when there are meaningful tradeoffs, blocked tests, money, authorization or release decisions.

**Not included in this PR:** agents, server-side persistent learning/memory, automatic fixes, continuous monitoring, background work, SQL migration, customer queries or production deployment permissions. Source-scanned ideas need independent verification.
