# Build Lab permanent-storage migration baseline audit | 2026-11-02

**Status: HOLD on production DDL. Inspection only, no live schema modification.**

## Evidence and affected environments

- Production Supabase project: `aszixzrdayrivungodwq`. **67 migration-history entries** present; 0 Build Lab document/revision tables and 0 Build Lab save function.
- Release branch: `release/build-lab-v1-owner-only-20261028`. **13 SQL migration files** in `supabase/migrations`.
- Only **10 versions match** between the repository and live migration history.
- **57 migration-history versions exist only in production**; **3 local SQL file versions do not match production history**. Do not infer equivalence just because names resemble each other.
- Isolated Build Lab storage-only branch: `lhycwhwopjirbipfblym`. Storage tables and RPC work with server-only permissions, but full branch migration replay reports `MIGRATIONS_FAILED`.
- Vercel production storage flags remain disabled and no production Build Lab tables were created.

## Versions absent from repository SQL migration files

- `20260818023837` · add_golf_stripe_payment_fields
- `20260818041041` · link_golf_registrations_to_auth_users
- `20260818041416` · require_auth_for_golf_registration_insert
- `20260818070833` · default_golf_registration_user_id
- `20260819041453` · add_unique_username_to_profiles
- `20260819070023` · add_golf_admin_notes_and_admin_users
- `20260819072930` · add_super_admin_role_to_golf_admin_users
- `20260819073020` · add_launch_roles_to_profiles
- `20260819073327` · protect_profile_role_from_self_promotion
- `20260819204222` · add_event_assets_storage
- `20260819220811` · add_golf_event_setup
- `20260820030906` · protect_structured_event_divisions
- `20260820031820` · allow_public_read_golf_event_setup
- `20260820081556` · secure_club_championship_roles
- `20260820175401` · add_organization_auto_setup_foundation
- `20260820183545` · add_organization_profile_onboarding
- `20260820183627` · preserve_eig_admin_workspace_access
- `20260902082702` · create_secure_squawk_box_foundation
- `20260902082937` · add_squawk_review_tracking
- `20260902085347` · create_safe_squawk_message_reviews
- `20260902085709` · index_squawk_review_reviewer
- `20260903032312` · complete_squawk_box_foundation
- `20260903032836` · index_squawk_foreign_keys
- `20260903032859` · seed_chapel_hill_squawk_channel_readiness
- `20260903193249` · add_golf_roster_maintenance_foundation
- `20260922175629` · add_entry_number_and_team_id_to_golf_registrations
- `20260922181735` · add_google_drive_folder_to_golf_registration_events
- `20260922205202` · create_golf_roster_info_requests
- `20260923041118` · add_golf_team_registration_model
- `20260923211819` · extend_golf_roster_admin_actions
- `20260924201844` · add_eie_event_payment_and_calendar_foundation
- `20260924202011` · link_master_events_to_organizations
- `20260924211214` · create_eie_golf_event_from_cockpit
- `20260924215841` · fix_eie_event_entitlement_event_id
- `20260924215925` · fix_eie_entitlement_target_second_pass
- `20260925025115` · create_eie_quick_registration_engine
- `20260925034136` · add_quick_registration_event_start_time
- `20260925174910` · public_read_active_offers_for_published_eie_events
- `20260930014126` · add_golf_registration_email_delivery_markers
- `20260930015228` · add_clubhouse_payment_instructions
- `20260930015452` · track_clubhouse_payment_instruction_email
- `20260930015633` · add_cash_payment_option
- `20260930020356` · track_cash_payment_instruction_email
- `20260930043350` · add_auth_email_code_rate_limit
- `20260930043404` · extend_auth_email_code_requests
- `20260930192928` · allow_direct_squawk_thread_and_message_types
- `20261003184114` · add_profile_account_status
- `20261005175759` · user_management_security_history
- `20261007065652` · social_campaign_workspace
- `20261010035043` · eie_player_team_moves_keep_registration_and_payment_with_golfer
- `20261010040805` · eie_captain_all_payment_coverage_by_team_spot
- `20261010040930` · eie_roster_moves_allow_team_payment_covered_slots
- `20261010041331` · pause_auto_team_payment_coverage_pending_person_vs_spot_rules
- `20261010041336` · eie_original_team_fee_owner_when_payer_moves
- `20261010043418` · eie_clear_inherited_team_coverage_on_move_into_unpaid_spot
- `20261010043557` · eie_fully_paid_team_swap_preserving_original_purchaser_allocation
- `20261018202331` · release_cancelled_team_numbers

## Repository-only migration filenames (unmatched versions)

- `20261005175237_user_management_security_history.sql`
- `20261007064246_social_campaign_workspace.sql`
- `20261010052030_eie_budget_comp_value_metric.sql`

## Release blockers and safe remediation plan

1. **Preserve the live state.** Export or snapshot the production schema and capture a database backup before altering any migrations. Do not delete migration history entries or reset production.
2. **Audit the 57 existing migrations.** Compare version, name and SQL source with the live schema. `supabase_migrations.schema_migrations` exposes stored statements, but retrieve/review these only in a controlled environment; stored SQL could include sensitive historical values. The source repo cannot safely be 'fixed' by inventing empty migration files.
3. **Reconcile the 3 version mismatches.** Verify actual schema outcomes and rewrite the repository history only through a reviewed, non-destructive migration-baseline plan. Do not casually run `supabase migration repair --status reverted` on production.
4. **Use the Supabase CLI workflow.** Establish a linked, reproducible test project; run `supabase migration list`, review its local-versus-remote report, then prepare a proper migration using `supabase migration new` after history reconciliation. `supabase db pull` and migration repair are tools for a reviewed plan, not one-click fixes.
5. **Rehearse in a representative database** with a clean baseline, real owner Auth foreign key, Build Lab schema, function privilege tests, concurrent conflict tests and browser recovery. The existing storage-only branch alone does not meet full-platform replay acceptance.
6. **Request an explicit production go/no-go.** Only after baseline, backup, CI and access checks pass should permanent Build Lab DDL be applied. Validate RLS, no `anon`/`authenticated` grants, exact owner/session gates, three document kinds and versioned append-only history.
7. **Rollback without data loss.** Flip production Build Lab server and UI feature flags OFF, retaining tables and revisions for forensic recovery. Never drop Build Lab data as an application rollback shortcut.

## Separate preview and security status

- GitHub Actions *Build Lab V1 Isolated Evidence Acceptance*, run **#80**, commit `1d6fb001`, passed all **8/8** jobs.
- External unauthenticated HTTP negative check was **intercepted by Vercel Authentication** before reaching the application. That verifies the Vercel perimeter only; it is **not** proof of Build Lab's live owner API gate.
- Authenticated protected-deployment API checks require an authorized `vc curl`/short-lived Vercel identity. Never disable Deployment Protection or insert a permanent bypass token into code to make this test pass.
- Browser cloud save and restore of Scan History, Work Buckets and a synthetic Manager Plan passed. Release status still **NOT AUTHORIZED**.

## References

- Supabase official migration guide: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase remote schema pull: https://supabase.com/docs/reference/cli/supabase-db-pull
- Supabase migration repair: https://supabase.com/docs/reference/cli/supabase-migration-repair
- Current schema design: `docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql` (do not apply to production yet).
