# Build Lab migration reconciliation runbook (2026-11-02)

## Evidence and scope

The ElevationPilot production Supabase migration table reported 67 version rows, each with nonempty recorded SQL statements. The owner-only Build Lab release branch currently carries 13 migration SQL files: 10 exact version matches, 57 historical database-only versions, and 3 repository-only versions.

Source-of-truth evidence: `docs/audits/build-lab-migration-recovery-manifest-20261102.json`. It contains names and SQL digests, **not SQL bodies, credentials, customer data or authorization tokens**.

### Safety rule

This is a read-only **reconciliation**, not a request to reset migration history. Preserve all production migration records and all business data. No replay against live production, no `migration repair`, no `db reset`, no blind re-application of existing historical DDL.

## Review sequence

1. Confirm the production project identity and current migration versions again through a read-only, access-controlled connection. Check that metadata still matches the dated snapshot.
2. Use `node scripts/build-lab-compare-migration-manifest.mjs` against the source branch, and review its generated classification. SQL hashes can be different because migration statements may be serialized differently from file contents; a mismatch is NOT proof of a schema defect.
3. Recover recorded statement bodies only into a private, access-controlled location, using the authorized database administration interface. The public GitHub repository MUST NOT contain those production SQL bodies until independent secret and data review. Do not log them to Actions or tickets.
4. Review recorded statements for hard-coded identities, security-definer grants, RLS changes, storage policies, event registrations, payment behavior, and environment-specific seed data. Obtain independent approval before publishing or executing anything.
5. For each of the 57 historical database-only versions, verify the recovered SQL matches the corresponding version metadata; preserve original exact version ordering and immutable hashes in a private archive.
6. Resolve the 3 source-only versions individually:
   - `20261005175237_user_management_security_history.sql` versus production version `20261005175759` (similar name; **not proven equivalent**).
   - `20261007064246_social_campaign_workspace.sql` versus production version `20261007065652` (similar name; **not proven equivalent**).
   - `20261010052030_eie_budget_comp_value_metric.sql` has no exact recorded production version; investigate whether it was never applied, was manually applied, or is superseded.
7. Rehearse the full ordered migration chain against a disposable isolated database with no production credentials or customer data, verify table/routine/policy structure and regression tests, then compare the resulting schema with a sanitized production schema snapshot.
8. Only after explicit owner review, formulate a *separate* migration and release plan. Keep Build Lab's existing owner-gate, approved preview fingerprint and Rollback/Rule 3 protections.

## Known release gates

- Preview integrity scan and Work Buckets path: owner browser evidence available, read-only scan report for release SHA `669e022`.
- Isolated scanner acceptance suite: passed in Actions.
- Recovery audit: offline tests and report artifact passed in Actions.
- Historical SQL body recovery + secure review: **not completed**.
- Isolated replay/complete schema-equivalence proof: **not completed**.
- Production owner login and access authorization in a real released environment: **not completed** (owner validated a controlled preview only).
- Supabase security advisor warnings (2026-11-02): 2 mutable search paths, 13 anonymous-callable and 13 authenticated-callable security-definer findings, and 1 leaked-password-protection warning. These are observations needing contextual review, not authorization for arbitrary grants or edits.

If a step cannot be verified, mark it BLOCKED with evidence rather than labeling it PASS.
