-- Event Builder data is intentionally separate from participant registration payments.
alter table public.event_requests add column booking_estimate jsonb not null default '{"version":1,"items":[],"tax":0,"gratuity":0,"other_fees":0,"fee_notes":"","notes":"","subtotal":0,"total":0}'::jsonb;
alter table public.event_requests add column estimate_approved_at timestamptz;
create table public.event_request_workflows (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.event_requests(id),
  golf_event_id uuid references public.golf_registration_events(id),
  agreement_kind text not null check (agreement_kind in ('golf','venue')),
  template_id text not null,
  terms jsonb not null,
  envelope_id text unique,
  provider_attempted_at timestamptz,
  envelope_status text not null default 'local_draft',
  exhibit_attached boolean not null default false,
  signed_at timestamptz,
  synced_at timestamptz,
  deposit_receipt jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.event_request_workflow_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index event_request_workflow_audit_request on public.event_request_workflow_audit(request_id,created_at desc);
alter table public.event_request_workflows enable row level security;
alter table public.event_request_workflow_audit enable row level security;
revoke all on public.event_request_workflows, public.event_request_workflow_audit from public,anon,authenticated;
grant all on public.event_request_workflows, public.event_request_workflow_audit to service_role;

-- Remove legacy policies that let unsigned visitors read or change private inquiries.
drop policy if exists "anon read requests" on public.event_requests;
drop policy if exists "anon write requests" on public.event_requests;
drop policy if exists "anon read event_requests" on public.event_requests;
drop policy if exists "anon write event_requests" on public.event_requests;

create function public.guard_event_request_workflow() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true)='service_role' then return new; end if;
  if tg_op='INSERT' then
    if new.status not in ('submitted','new') or new.event_id is not null or new.confirmed_date is not null
      or new.confirmed_at is not null or new.final_confirmed_at is not null
      or new.hold_started_at is not null or new.hold_expires_at is not null
      or new.contract_status<>'not_sent' or new.contract_document_id is not null
      or new.contract_document_url is not null or new.contract_sent_at is not null or new.contract_signed_at is not null
      or new.deposit_status<>'not_required' or new.deposit_amount is not null
      or new.estimate_approved_at is not null or jsonb_array_length(new.booking_estimate->'items')>0
      or new.deposit_paid_at is not null or new.deposit_waived_at is not null
      or new.calendar_status<>'not_created' or new.calendar_event_id is not null then
      raise exception 'Inquiries cannot supply confirmation, contract or payment state' using errcode='42501';
    end if;
    return new;
  end if;
  if new.organization_id is distinct from old.organization_id or new.event_id is distinct from old.event_id
    or new.contract_status is distinct from old.contract_status
    or new.contract_signed_at is distinct from old.contract_signed_at
    or new.contract_sent_at is distinct from old.contract_sent_at
    or new.contract_document_id is distinct from old.contract_document_id
    or new.contract_document_url is distinct from old.contract_document_url
    or new.booking_estimate is distinct from old.booking_estimate or new.estimate_approved_at is distinct from old.estimate_approved_at
    or new.deposit_paid_at is distinct from old.deposit_paid_at or new.deposit_waived_at is distinct from old.deposit_waived_at
    or (new.deposit_status is distinct from old.deposit_status and (new.deposit_status in ('paid','waived','refunded') or old.deposit_status in ('paid','waived','refunded')))
    or new.final_confirmed_at is distinct from old.final_confirmed_at or (new.status='confirmed' and old.status<>'confirmed')
    or (old.status='confirmed' and new.status is distinct from old.status) then
    raise exception 'Use the authorized agreement and deposit workflow for this change' using errcode='42501';
  end if;
  if exists(select 1 from public.event_request_workflows w where w.request_id=old.id) and
    row(new.confirmed_date,new.confirmed_start_type,new.confirmed_start_time,new.confirmed_capacity,new.confirmed_package,new.deposit_amount,new.contact_full_name,new.contact_email,new.contact_phone,new.group_name,new.event_name,new.event_type,new.locked_fields)
    is distinct from row(old.confirmed_date,old.confirmed_start_type,old.confirmed_start_time,old.confirmed_capacity,old.confirmed_package,old.deposit_amount,old.contact_full_name,old.contact_email,old.contact_phone,old.group_name,old.event_name,old.event_type,old.locked_fields) then
    raise exception 'The agreement has frozen these booking terms. A revised agreement is required to change them.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_event_request_workflow() from public,anon,authenticated;
create trigger guard_event_request_workflow before insert or update on public.event_requests
for each row execute function public.guard_event_request_workflow();

create schema if not exists eig_private;
create function eig_private.active_builder_session() returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id join public.profiles p on p.id=u.id
where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.email_confirmed_at is not null
and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now()) and p.account_status='active');
$$;
revoke all on function eig_private.active_builder_session() from public,anon;
grant usage on schema eig_private to authenticated;
grant execute on function eig_private.active_builder_session() to authenticated;
create policy event_builder_active_master_session on public.events as restrictive for all to authenticated
using(eig_private.active_builder_session()) with check(eig_private.active_builder_session());
-- The legacy master-event ALL policy exposed draft bookings and organizer contacts.
-- Published events remain readable. Anonymous users cannot mutate Master Events.
drop policy if exists "anon read events" on public.events;
drop policy if exists "anon write events" on public.events;
create policy event_builder_public_master_read on public.events for select to anon using(is_published=true);
create policy event_builder_manager_master_access on public.events for all to authenticated
using(public.is_eig_admin() or public.has_organization_role(organization_id,array['organization_admin','organization_staff']))
with check(public.is_eig_admin() or public.has_organization_role(organization_id,array['organization_admin','organization_staff']));
create function eig_private.assert_booking_actor(p_actor_id uuid,p_session_id uuid,p_organization_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.profiles p on p.id=u.id
    where s.id=p_session_id and u.id=p_actor_id and u.email_confirmed_at is not null
      and (s.not_after is null or s.not_after>now()) and (u.banned_until is null or u.banned_until<=now())
      and p.account_status='active' and (p.role='super_admin' or exists(
        select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
        where m.user_id=u.id and m.status='active' and (m.access_starts_at is null or m.access_starts_at<=now())
          and (m.access_ends_at is null or m.access_ends_at>=now()) and
          ((m.organization_id=p_organization_id and m.role='organization_admin') or (m.role='eig_admin' and o.slug='elevated-impact-group'))))) then
    raise exception 'An active Pilot or EIG administrator session is required' using errcode='42501';
  end if;
end $$;
revoke all on function eig_private.assert_booking_actor(uuid,uuid,uuid) from public,anon,authenticated;
grant usage on schema eig_private to service_role;
grant execute on function eig_private.assert_booking_actor(uuid,uuid,uuid) to service_role;

-- Only the server calls this invoker function with a verified actor and session.
-- Service role has table access; normal API users cannot execute it.
create function public.event_builder_action(p_actor_id uuid,p_session_id uuid,p_request_id uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.event_requests; w public.event_request_workflows; t jsonb; v_event_id uuid; v_golf_event_id uuid; org_name text; receipt jsonb;
begin
  select * into r from public.event_requests where id=p_request_id for update;
  if not found then raise exception 'Inquiry not found' using errcode='P0002'; end if;
  perform eig_private.assert_booking_actor(p_actor_id,p_session_id,r.organization_id);
  select * into w from public.event_request_workflows where request_id=r.id;
  if p_action<>'load' and p_payload->>'expected_updated_at' is distinct from r.updated_at::text
    and (p_payload->>'expected_updated_at')::timestamptz is distinct from r.updated_at then
    raise exception 'The inquiry changed. Reload it before continuing.' using errcode='40001';
  end if;
  if p_action in ('prepare','send_check','confirm') and
    (r.status<>'hold' or r.hold_expires_at is null or r.hold_expires_at<=now() or r.hold_released_at is not null) then
    if not(p_action='confirm' and r.status='confirmed' and r.event_id is not null) then
      raise exception 'An active venue hold is required. Extend or renew the hold first.' using errcode='22023';
    end if;
  end if;
  if p_action='prepare' then
    if w.id is null then
      if r.confirmed_date is null or nullif(trim(r.confirmed_package),'') is null or r.deposit_amount is null or r.estimate_approved_at is null then
        raise exception 'Save a date, package summary, approved itemized quote and explicit deposit amount (including zero) first.' using errcode='22023';
      end if;
      if p_payload->>'agreement_kind' not in ('golf','venue') or nullif(trim(p_payload->>'template_id'),'') is null
        or nullif(trim(r.contact_full_name),'') is null or coalesce(r.contact_email,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        or nullif(trim(p_payload->>'venue_signer_name'),'') is null or coalesce(p_payload->>'venue_signer_email','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        or lower(r.contact_email)=lower(p_payload->>'venue_signer_email') then
        raise exception 'Choose the agreement and two different valid authorized signers.' using errcode='22023';
      end if;
      select name into org_name from public.organizations where id=r.organization_id;
      t:=jsonb_build_object('name',coalesce(nullif(r.event_name,''),nullif(r.group_name,''),'Venue booking'),
        'venue',org_name,'date',r.confirmed_date,'time',r.confirmed_start_time,'start_type',r.confirmed_start_type,
        'capacity',r.confirmed_capacity,'package',r.confirmed_package,'deposit_amount',r.deposit_amount,
        'pricing',r.booking_estimate,
        'organizer_name',r.contact_full_name,'organizer_email',lower(r.contact_email),'organizer_phone',r.contact_phone,
        'venue_signer_name',trim(p_payload->>'venue_signer_name'),'venue_signer_email',lower(trim(p_payload->>'venue_signer_email')));
      insert into public.event_request_workflows(request_id,agreement_kind,template_id,terms,created_by)
      values(r.id,p_payload->>'agreement_kind',p_payload->>'template_id',t,p_actor_id) returning * into w;
      insert into public.event_request_workflow_audit(request_id,actor_user_id,action) values(r.id,p_actor_id,'agreement_prepared');
    end if;
  elsif p_action='estimate' then
    if w.id is not null then raise exception 'The agreement has frozen this quote. A revised agreement is required.'; end if;
    if r.status in ('confirmed','cancelled','declined') then raise exception 'This booking cannot accept a new estimate'; end if;
    if p_payload->'estimate' is null or jsonb_typeof(p_payload->'estimate')<>'object' then raise exception 'Invalid cost estimate'; end if;
    update public.event_requests set booking_estimate=p_payload->'estimate',estimate_approved_at=case when p_payload->>'approved'='true' then now() else null end where id=r.id;
    insert into public.event_request_workflow_audit(request_id,actor_user_id,action,detail) values(r.id,p_actor_id,case when p_payload->>'approved'='true' then 'quote_approved' else 'estimate_saved' end,jsonb_build_object('total',p_payload->'estimate'->'total'));
  elsif p_action='begin_envelope_attempt' then
    if w.id is null or w.envelope_id is not null then raise exception 'Agreement draft mismatch'; end if;
    update public.event_request_workflows set provider_attempted_at=coalesce(provider_attempted_at,now()),updated_at=now() where id=w.id;
  elsif p_action='save_envelope' then
    if w.id is null or (w.envelope_id is not null and w.envelope_id<>p_payload->>'envelope_id') then raise exception 'Agreement draft mismatch'; end if;
    update public.event_request_workflows set envelope_id=p_payload->>'envelope_id',envelope_status='created',updated_at=now() where id=w.id;
    update public.event_requests set contract_document_id=p_payload->>'envelope_id' where id=r.id;
  elsif p_action='exhibit_attached' then
    update public.event_request_workflows set exhibit_attached=true,updated_at=now() where id=w.id and envelope_id is not null;
  elsif p_action='send_check' then
    if w.envelope_id is null or not w.exhibit_attached or w.envelope_status<>'created' or p_payload->>'reviewed'<>'true' then
      raise exception 'Review the completed agreement and booking exhibit before sending.';
    end if;
  elsif p_action='sync' then
    if w.envelope_id is null or w.envelope_id is distinct from p_payload->>'envelope_id' then raise exception 'Envelope mismatch'; end if;
    update public.event_request_workflows set envelope_status=p_payload->>'status',signed_at=case when p_payload->>'signed'='true' then (p_payload->>'completed_at')::timestamptz else null end,synced_at=now(),updated_at=now() where id=w.id;
    update public.event_requests set contract_status=case when p_payload->>'signed'='true' then 'signed' when p_payload->>'status' in ('voided','declined') then 'void' when p_payload->>'status'='delivered' then 'viewed' when p_payload->>'status'='created' then 'not_sent' else 'sent' end,
      contract_signed_at=case when p_payload->>'signed'='true' then (p_payload->>'completed_at')::timestamptz else null end,
      contract_sent_at=coalesce((p_payload->>'sent_at')::timestamptz,contract_sent_at) where id=r.id;
    if w.envelope_status is distinct from p_payload->>'status' then
      insert into public.event_request_workflow_audit(request_id,actor_user_id,action,detail) values(r.id,p_actor_id,'signing_status_verified',jsonb_build_object('status',p_payload->>'status'));
    end if;
  elsif p_action='deposit' then
    if w.id is null or r.status<>'hold' or r.deposit_status in ('paid','waived') then raise exception 'This deposit cannot be recorded in its current state'; end if;
    if p_payload->>'status'='paid' then
      if r.deposit_amount is null or r.deposit_amount<=0 or (p_payload->>'amount')::numeric is distinct from r.deposit_amount
        or nullif(trim(p_payload->>'reference'),'') is null or p_payload->>'method' not in ('cash','check','bank_transfer','other') then raise exception 'Enter the exact deposit amount, method and receipt/reference'; end if;
      receipt:=jsonb_build_object('status','paid','amount',r.deposit_amount,'method',p_payload->>'method','reference',left(trim(p_payload->>'reference'),500),'recorded_at',now(),'recorded_by',p_actor_id);
      update public.event_requests set deposit_status='paid',deposit_paid_at=now() where id=r.id;
    elsif p_payload->>'status'='waived' and nullif(trim(p_payload->>'reference'),'') is not null then
      receipt:=jsonb_build_object('status','waived','reason',left(trim(p_payload->>'reference'),500),'recorded_at',now(),'recorded_by',p_actor_id);
      update public.event_requests set deposit_status='waived',deposit_waived_at=now() where id=r.id;
    else raise exception 'A deposit waiver needs a reason'; end if;
    update public.event_request_workflows set deposit_receipt=receipt,updated_at=now() where id=w.id;
    insert into public.event_request_workflow_audit(request_id,actor_user_id,action,detail) values(r.id,p_actor_id,'deposit_recorded',receipt);
  elsif p_action='confirm' then
    if r.status<>'confirmed' then
      if w.signed_at is null or w.envelope_status<>'completed' or w.synced_at is null or w.synced_at<now()-interval '5 minutes'
        or not (r.deposit_status in ('paid','waived') or (r.deposit_amount=0 and r.deposit_status='not_required')) then raise exception 'Verify all signatures and complete the deposit requirement first'; end if;
      if r.event_id is not null then raise exception 'This inquiry already links to an event'; end if;
      insert into public.events(organization_id,name,date,event_date,location,start_time,event_type,status,registration_status,is_published,organizer_name,organizer_email,organizer_phone,max_golfers)
      values(r.organization_id,w.terms->>'name',r.confirmed_date,r.confirmed_date,w.terms->>'venue',r.confirmed_start_time,
        case when w.agreement_kind='venue' then 'Venue Rental' else 'Golf Outing' end,'draft','draft',false,r.contact_full_name,r.contact_email,r.contact_phone,r.confirmed_capacity)
      returning id into v_event_id;
      insert into public.golf_registration_events(organization_id,event_key,name,course,event_dates,public_slug,master_event_id,field_settings,status)
      values(r.organization_id,'venue-booking-'||r.id::text,w.terms->>'name',w.terms->>'venue',jsonb_build_array(r.confirmed_date::text),
        'booking-'||r.id::text,v_event_id,jsonb_build_object('venue_booking_request_id',r.id,'venue_locked_fields',r.locked_fields,
          'event_type',case when w.agreement_kind='venue' then 'Venue Rental' else 'Golf Outing' end,'event_kind',case when w.agreement_kind='venue' then 'general' else 'golf' end,
          'ghin',case when w.agreement_kind='venue' then 'hidden' else 'optional' end,'membership',case when w.agreement_kind='venue' then 'hidden' else 'optional' end,
          'event_start_time',r.confirmed_start_time,'max_golfers',r.confirmed_capacity,'registration_format','individual','team_size',1,'hub_setup_status','needs_setup'),'draft')
      returning id into v_golf_event_id;
      update public.event_request_workflows set golf_event_id=v_golf_event_id where id=w.id;
      update public.event_requests set event_id=v_event_id,status='confirmed',final_confirmed_at=now(),confirmed_at=now(),organizer_handoff_at=now() where id=r.id;
      insert into public.event_request_workflow_audit(request_id,actor_user_id,action,detail) values(r.id,p_actor_id,'booking_confirmed',jsonb_build_object('event_id',v_event_id));
    end if;
  elsif p_action<>'load' then raise exception 'Unknown Event Builder action'; end if;
  select * into r from public.event_requests where id=p_request_id;
  select * into w from public.event_request_workflows where request_id=p_request_id;
  return jsonb_build_object('request',to_jsonb(r),'workflow',case when w.id is null then null else to_jsonb(w) end,
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select action,detail,created_at from public.event_request_workflow_audit where request_id=p_request_id order by created_at desc limit 50)a),'[]'::jsonb));
end $$;
revoke all on function public.event_builder_action(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.event_builder_action(uuid,uuid,uuid,text,jsonb) to service_role;

create function public.guard_booked_event_terms() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.event_requests;
begin
  if current_setting('role',true)='service_role' then return new; end if;
  select * into r from public.event_requests where event_id=old.master_event_id and status='confirmed' limit 1;
  if found and (
    new.master_event_id is distinct from old.master_event_id or new.organization_id is distinct from old.organization_id
    or new.field_settings->>'venue_booking_request_id' is distinct from old.field_settings->>'venue_booking_request_id'
    or new.field_settings->'venue_locked_fields' is distinct from old.field_settings->'venue_locked_fields'
    or (r.locked_fields ? 'confirmed_date' and new.event_dates is distinct from old.event_dates)
    or (r.locked_fields ? 'confirmed_start' and new.field_settings->>'event_start_time' is distinct from old.field_settings->>'event_start_time')
    or (r.locked_fields ? 'confirmed_capacity' and new.field_settings->>'max_golfers' is distinct from old.field_settings->>'max_golfers')
    or new.course is distinct from old.course) then
    raise exception 'Venue-confirmed booking terms need a venue-approved amendment before changing.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_booked_event_terms() from public,anon,authenticated;
create trigger guard_booked_event_terms before update on public.golf_registration_events for each row execute function public.guard_booked_event_terms();

create function public.guard_booked_master_terms() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.event_requests;
begin
  if current_setting('role',true)='service_role' then return new; end if;
  select * into r from public.event_requests where event_id=old.id and status='confirmed' limit 1;
  if found and (new.organization_id is distinct from old.organization_id
    or new.location is distinct from old.location
    or (r.locked_fields ? 'confirmed_date' and (new.date is distinct from old.date or new.event_date is distinct from old.event_date))
    or (r.locked_fields ? 'confirmed_start' and new.start_time is distinct from old.start_time)
    or (r.locked_fields ? 'confirmed_capacity' and new.max_golfers is distinct from old.max_golfers)) then
    raise exception 'Venue-confirmed booking terms need a venue-approved amendment before changing.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_booked_master_terms() from public,anon,authenticated;
create trigger guard_booked_master_terms before update on public.events for each row execute function public.guard_booked_master_terms();

-- Private creative/operations assets must not live in the public Hub's field_settings.
create table public.event_builder_assets (
  event_id uuid primary key references public.golf_registration_events(id),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object' and octet_length(data::text)<6000000),
  version integer not null default 1 check (version>0),
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
create index event_builder_asset_audit_event on public.event_builder_asset_audit(event_id,created_at desc);
alter table public.event_builder_assets enable row level security;
alter table public.event_builder_asset_audit enable row level security;
revoke all on public.event_builder_assets,public.event_builder_asset_audit from public,anon,authenticated;
grant select on public.event_builder_assets,public.event_builder_asset_audit to authenticated;
grant all on public.event_builder_assets,public.event_builder_asset_audit to service_role;

create schema if not exists eig_private;
grant usage on schema eig_private to authenticated,service_role;

create function eig_private.can_manage_event_assets(target_event_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.golf_registration_events e
    where e.id=target_event_id and exists(select 1 from auth.users u join public.profiles p on p.id=u.id
      where u.id=auth.uid() and u.email_confirmed_at is not null and p.account_status='active'
      and (u.banned_until is null or u.banned_until<=now())
      and exists(select 1 from auth.sessions s where s.user_id=u.id and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()))
      and (p.role='super_admin' or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
        where m.user_id=u.id and m.status='active' and (m.access_starts_at is null or m.access_starts_at<=now()) and (m.access_ends_at is null or m.access_ends_at>=now())
        and ((m.organization_id=e.organization_id and m.role in ('organization_admin','organization_staff')) or (m.role='eig_admin' and o.slug='elevated-impact-group')))
        or exists(select 1 from public.event_assignments a where a.user_id=u.id and a.event_id=e.id and a.status='active' and a.role='event_coordinator'
        and (a.access_starts_at is null or a.access_starts_at<=now()) and (a.access_ends_at is null or a.access_ends_at>=now())))));
$$;
revoke all on function eig_private.can_manage_event_assets(uuid) from public,anon;
grant execute on function eig_private.can_manage_event_assets(uuid) to authenticated,service_role;
create policy event_builder_assets_authorized_read on public.event_builder_assets for select to authenticated using (eig_private.can_manage_event_assets(event_id));
create policy event_builder_asset_audit_authorized_read on public.event_builder_asset_audit for select to authenticated using (eig_private.can_manage_event_assets(event_id));

-- Definer scope is narrowly used for atomic compare-and-swap plus append-only audit.
-- It explicitly rechecks the current identity, session, scope and access window.
create function eig_private.save_event_assets(target_event_id uuid,expected_version integer,asset_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.event_builder_assets;
begin
  if auth.uid() is null or not eig_private.can_manage_event_assets(target_event_id) then raise exception 'Authorized event access is required' using errcode='42501'; end if;
  if asset_data is null or jsonb_typeof(asset_data)<>'object' or octet_length(asset_data::text)>=6000000 or expected_version<0 then raise exception 'Invalid event packet data'; end if;
  if expected_version=0 then
    insert into public.event_builder_assets(event_id,data,version,updated_by) values(target_event_id,asset_data,1,auth.uid())
    on conflict do nothing returning * into result;
  else
    update public.event_builder_assets set data=asset_data,version=version+1,updated_by=auth.uid(),updated_at=now()
    where event_id=target_event_id and version=expected_version returning * into result;
  end if;
  if result.event_id is null then raise exception 'Someone saved newer event packet changes. Reload before editing.' using errcode='40001'; end if;
  insert into public.event_builder_asset_audit(event_id,version,actor_user_id) values(target_event_id,result.version,auth.uid());
  return to_jsonb(result);
end $$;
revoke all on function eig_private.save_event_assets(uuid,integer,jsonb) from public,anon;
grant execute on function eig_private.save_event_assets(uuid,integer,jsonb) to authenticated,service_role;
create function public.save_event_builder_assets(p_event_id uuid,p_expected_version integer,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select eig_private.save_event_assets(p_event_id,p_expected_version,p_data) $$;
revoke all on function public.save_event_builder_assets(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_event_builder_assets(uuid,integer,jsonb) to authenticated;

-- Coordinators may download their approved booking costs without receiving venue notes.
create function eig_private.event_booking_quote(target_event_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare quote jsonb;
begin
  if not eig_private.can_manage_event_assets(target_event_id) then raise exception 'Authorized event access is required' using errcode='42501'; end if;
  select jsonb_build_object('estimate',r.booking_estimate,'approved_at',r.estimate_approved_at,'deposit_amount',r.deposit_amount)
  into quote from public.event_requests r join public.golf_registration_events e on e.master_event_id=r.event_id where e.id=target_event_id;
  return quote;
end $$;
revoke all on function eig_private.event_booking_quote(uuid) from public,anon;
grant execute on function eig_private.event_booking_quote(uuid) to authenticated;
create function public.get_event_builder_quote(p_event_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select eig_private.event_booking_quote(p_event_id)$$;
revoke all on function public.get_event_builder_quote(uuid) from public,anon;
grant execute on function public.get_event_builder_quote(uuid) to authenticated;

-- Reuse the established registration/offer/payment provisioner in one transaction.
-- General events keep the same Master Event and EIE records, with golf fields hidden.
create function eig_private.create_regular_event(p_options jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; master_id uuid; registration_id uuid;
begin
  result:=public.create_eie_quick_registration_event(
    (p_options->>'p_organization_id')::uuid,p_options->>'p_name',p_options->>'p_course',
    (p_options->>'p_event_start')::date,nullif(p_options->>'p_event_end','')::date,
    coalesce(p_options->>'p_registration_format','individual'),coalesce((p_options->>'p_team_size')::integer,1),
    nullif(p_options->>'p_max_golfers','')::integer,nullif(p_options->>'p_registration_deadline','')::date,
    p_options->'p_items',coalesce((p_options->>'p_allow_online')::boolean,true),coalesce((p_options->>'p_allow_clubhouse')::boolean,true),
    coalesce((p_options->>'p_allow_split_team_payments')::boolean,false),p_options->>'p_convenience_fee_type',
    coalesce((p_options->>'p_convenience_fee_value')::numeric,0),coalesce((p_options->>'p_clubhouse_hold_days')::integer,3),
    coalesce((p_options->>'p_allow_card_guarantee')::boolean,false),coalesce((p_options->>'p_auto_charge_at_deadline')::boolean,false),
    coalesce((p_options->>'p_google_calendar_sync_enabled')::boolean,false),nullif(p_options->>'p_event_start_time','')::time);
  master_id:=(result->>'master_event_id')::uuid; registration_id:=(result->>'golf_event_id')::uuid;
  if master_id is null or registration_id is null then raise exception 'The event provisioner did not return linked event records'; end if;
  if not eig_private.can_manage_event_assets(registration_id) then raise exception 'An active authorized event session is required' using errcode='42501'; end if;
  update public.events set event_type='Event' where id=master_id;
  update public.golf_registration_events set field_settings=field_settings||jsonb_build_object('event_kind','general','event_type','Event','ghin','hidden','membership','hidden','division','hidden','divisions_enabled',false,'flights_enabled',false)
  where id=registration_id;
  return result||jsonb_build_object('event_kind','general');
end $$;
revoke all on function eig_private.create_regular_event(jsonb) from public,anon;
grant execute on function eig_private.create_regular_event(jsonb) to authenticated;
create function public.create_eie_regular_event(p_options jsonb) returns jsonb
language sql security invoker set search_path='' as $$select eig_private.create_regular_event(p_options)$$;
revoke all on function public.create_eie_regular_event(jsonb) from public,anon;
grant execute on function public.create_eie_regular_event(jsonb) to authenticated;
