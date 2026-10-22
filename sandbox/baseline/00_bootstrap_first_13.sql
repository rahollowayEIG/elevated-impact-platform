-- SANDBOX ONLY: original first thirteen public tables and the isolated operations schema.
-- Retrieved from the sandbox's OWN migration history. No live rows. Do not run against production.
-- For FRESH SANDBOX REBUILD ONLY. Existing sandbox already contains these objects.

-- Original sandbox migration 20261019004500: sandbox_ops_safe_import_control_plane
create schema if not exists sandbox_ops;
revoke all on schema sandbox_ops from public, anon, authenticated;
create table if not exists sandbox_ops.import_runs (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 requested_by text not null default 'operator',
 source_label text not null,
 status text not null default 'blocked' check (status in ('blocked','validated','applied','failed')),
 copied_customer_rows integer not null default 0 check (copied_customer_rows = 0),
 details jsonb not null default '{}'::jsonb
);
alter table sandbox_ops.import_runs enable row level security;
revoke all on all tables in schema sandbox_ops from public, anon, authenticated;
comment on schema sandbox_ops is 'Sandbox-only operations; excluded from production baseline imports.';
comment on table sandbox_ops.import_runs is 'Internal safe-import log. Never store user payloads, secrets or customer records in details.';

-- Original sandbox migration 20261019004602: sandbox_first_three_application_tables
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null, slug text, organization_type text not null default 'business',
 parent_organization_id uuid references public.organizations(id),
 status text not null default 'active', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), is_test boolean not null default false,
 onboarding_status text not null default 'profile_incomplete'
);
create table public.events (
 id uuid primary key default gen_random_uuid(), name text, date date, location text,
 goal numeric, golfers integer, created_at timestamp default now(),
 event_type text default 'Golf Outing', event_date date, golfer_count integer default 0,
 revenue_goal numeric default 0, status text default 'pending_review', notes text,
 updated_at timestamptz default now(), slug text, description text, start_time time,
 registration_deadline timestamptz, max_golfers integer,
 registration_status text not null default 'closed', is_published boolean not null default false,
 banner_url text, organizer_name text, organizer_email text, organizer_phone text,
 organization_id uuid references public.organizations(id)
);
create table public.golf_registration_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 event_key text not null, name text not null, course text,
 event_dates jsonb not null default '[]'::jsonb, member_price numeric, non_member_price numeric,
 divisions jsonb not null default '[]'::jsonb, field_settings jsonb not null default '{}'::jsonb,
 status text not null default 'draft', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), google_sheet_id text, google_sheet_url text,
 google_drive_folder_id text, google_drive_folder_url text, public_slug text,
 master_event_id uuid references public.events(id),
 google_calendar_sync_enabled boolean not null default false, google_calendar_id text,
 google_calendar_event_id text, google_calendar_last_synced_at timestamptz,
 google_calendar_sync_status text not null default 'not_synced'
);
alter table public.organizations enable row level security;
alter table public.events enable row level security;
alter table public.golf_registration_events enable row level security;
revoke all on public.organizations, public.events, public.golf_registration_events from anon,authenticated;
comment on table public.golf_registration_events is 'Sandbox initial schema slice: no production rows, pending full constraints, indexes, policies and function parity review.';

-- Original sandbox migration 20261019004730: sandbox_event_configuration_tables_batch_two
create table public.golf_event_setup (id uuid primary key default gen_random_uuid(),event_key text not null,tournament_format text,format_description text,player_information text,division_details jsonb not null default '[]'::jsonb,itinerary jsonb not null default '[]'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.event_registration_fields (id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),field_key text not null,label text not null,field_type text not null default 'short_text',applies_to text not null default 'golfer',requirement_status text not null default 'optional',options jsonb not null default '[]'::jsonb,placeholder text,help_text text,is_system_field boolean not null default false,include_in_internal_export boolean not null default true,include_in_golf_genius_export boolean not null default false,sort_order integer not null default 0,status text not null default 'active',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.registration_types (id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),name text not null,description text,registration_kind text not null default 'team',team_size integer not null default 4,price numeric not null default 0,quantity_available integer,quantity_sold integer not null default 0,status text not null default 'active',sort_order integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.event_offers (id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),master_event_id uuid not null references public.events(id),golf_event_id uuid references public.golf_registration_events(id),source_app text not null default 'eie',source_module text not null default 'registration',offer_type text not null default 'registration',name text not null,description text,price numeric not null default 0,currency text not null default 'usd',charge_by text not null default 'player',is_required boolean not null default false,is_default boolean not null default false,visibility text not null default 'public',coupon_eligible boolean not null default true,availability_start date,availability_end date,inventory_limit integer,quantity_min integer not null default 1,quantity_max integer,pricing_rules jsonb not null default '{}'::jsonb,metadata jsonb not null default '{}'::jsonb,status text not null default 'active',sort_order integer not null default 0,created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.golf_event_setup enable row level security;
alter table public.event_registration_fields enable row level security;
alter table public.registration_types enable row level security;
alter table public.event_offers enable row level security;
revoke all on public.golf_event_setup,public.event_registration_fields,public.registration_types,public.event_offers from anon,authenticated;

-- Original sandbox migration 20261019005231: sandbox_event_assignments_structure
create table public.event_assignments (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.golf_registration_events(id),
 user_id uuid not null,
 role text not null default 'event_coordinator',
 status text not null default 'active',
 assigned_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 access_starts_at timestamptz,
 access_ends_at timestamptz
);
alter table public.event_assignments enable row level security;
revoke all on public.event_assignments from anon,authenticated;
comment on table public.event_assignments is 'Sandbox-only schema slice. No user identities imported. Policies and original ancillary indexes still pending review.';

-- Original sandbox migration 20261019005412: sandbox_contacts_structure
create table public.contacts (
id uuid primary key default gen_random_uuid(),
organization_id uuid not null references public.organizations(id),
auth_user_id uuid,
first_name text,last_name text,email text,phone text,company_name text,
contact_type text,email_opt_in boolean not null default false,
sms_opt_in boolean not null default false,source text,notes text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
alter table public.contacts enable row level security;
revoke all on public.contacts from anon,authenticated;
comment on table public.contacts is 'Sandbox schema structure only. No real contact details imported. Additional production indexes and policies pending review.';

-- Original sandbox migration 20261019011211: sandbox_event_inquiry_tables
create table public.event_requests (
id uuid primary key default gen_random_uuid(),
event_id uuid references public.events(id),
request_type text,title text,base_quantity integer,additional_quantity integer,status text,notes text,
created_at timestamp default now(),details jsonb default '{}'::jsonb,
organization_id uuid references public.organizations(id),
request_key text,event_name text,event_type text,preferred_date date,alternate_date date,
estimated_participants integer,requested_details jsonb not null default '{}'::jsonb,
coordinator_contact_id uuid references public.contacts(id),submitted_by_user_id uuid,
venue_response text,confirmed_at timestamptz,google_drive_folder_id text,google_drive_folder_url text,
updated_at timestamptz not null default now(),contact_full_name text,group_name text,
contact_phone text,contact_email text,second_alternate_date date,unavailable_date_notes text,
preferred_start_type text,preferred_start_time time,golf_format text,food_needed boolean,
special_requests text,confirmed_date date,confirmed_start_type text,confirmed_start_time time,
confirmed_capacity integer,confirmed_package text,venue_internal_notes text,
locked_fields jsonb not null default '[]'::jsonb,venue_reviewed_at timestamptz,venue_reviewed_by uuid,
hold_started_at timestamptz,hold_expires_at timestamptz,hold_extended_at timestamptz,hold_released_at timestamptz,
contract_status text not null default 'not_sent',contract_sent_at timestamptz,contract_signed_at timestamptz,
contract_document_url text,contract_document_id text,deposit_amount numeric,
deposit_status text not null default 'not_required',deposit_due_at timestamptz,
deposit_paid_at timestamptz,deposit_waived_at timestamptz,
stripe_checkout_session_id text,stripe_payment_intent_id text,calendar_event_id text,
calendar_status text not null default 'not_created',organizer_handoff_at timestamptz,final_confirmed_at timestamptz
);
create table public.event_request_activity (
id uuid primary key default gen_random_uuid(),
event_request_id uuid not null references public.event_requests(id),
created_by_user_id uuid,activity_type text not null,message text,
metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
alter table public.event_requests enable row level security;
alter table public.event_request_activity enable row level security;
revoke all on public.event_requests,public.event_request_activity from anon,authenticated;
comment on table public.event_requests is 'Sandbox structural clone only; no production inquiries, contacts, contracts, or payments copied. RLS policies/index parity pending.';
comment on table public.event_request_activity is 'Sandbox structural clone only; no production activity records copied.';

-- Original sandbox migration 20261019012352: sandbox_event_builder_assets_structure
create table public.event_builder_assets (
 event_id uuid primary key references public.golf_registration_events(id),
 data jsonb not null default '{}'::jsonb,
 version integer not null default 1,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create table public.event_builder_asset_audit (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.golf_registration_events(id),
 version integer not null,
 actor_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.event_builder_assets enable row level security;
alter table public.event_builder_asset_audit enable row level security;
revoke all on public.event_builder_assets, public.event_builder_asset_audit from anon,authenticated;
comment on table public.event_builder_assets is 'Sandbox structure only; nested assets from live are NOT imported. Full indexes/checks/RLS policy parity pending.';
comment on table public.event_builder_asset_audit is 'Sandbox structure only; no live audit history or identities transferred. Full checks/RLS policy parity pending.';

