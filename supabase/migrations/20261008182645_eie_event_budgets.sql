-- EIE owns budget planning. Read-only source aggregation; no payment/order mutations.
create function eig_private.can_manage_event_budget(target_event_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select eig_private.active_builder_session() and exists(
  select 1 from public.golf_registration_events e join public.organizations org on org.id=e.organization_id
  where e.id=target_event_id and org.status='active' and (
   exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='super_admin')
   or exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.status='active' and o.status='active'
    and (m.access_starts_at is null or m.access_starts_at<=now()) and (m.access_ends_at is null or m.access_ends_at>now())
    and ((m.organization_id=e.organization_id and m.role in ('organization_admin','organization_staff')) or (m.role='eig_admin' and o.slug='elevated-impact-group')))
   or exists(select 1 from public.event_assignments a where a.user_id=auth.uid() and a.event_id=e.id and a.status='active' and a.role='event_coordinator'
    and (a.access_starts_at is null or a.access_starts_at<=now()) and (a.access_ends_at is null or a.access_ends_at>now()))));
$$;
revoke all on function eig_private.can_manage_event_budget(uuid) from public,anon;
grant execute on function eig_private.can_manage_event_budget(uuid) to authenticated;

create function eig_private.valid_budget_amount(v jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='number' and v::text ~ '^[0-9]+$' and (v::text)::numeric<=100000000000,false)
$$;
create function eig_private.valid_event_budget(b jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; r jsonb; ids text[];
begin
 if b is null or jsonb_typeof(b)<>'object' or octet_length(b::text)>800000 or b->'schema' is distinct from '1'::jsonb or b->>'currency' is distinct from 'USD' then return false; end if;
 if not eig_private.valid_budget_amount(b->'goal_cents') or not eig_private.valid_budget_amount(b->'sponsor_package_cents')
 or not eig_private.valid_budget_amount(b->'contingency_percent') or (b->>'contingency_percent')::numeric>100
 or not eig_private.valid_budget_amount(b->'live_targets'->'registration') or not eig_private.valid_budget_amount(b->'live_targets'->'sponsors')
 or jsonb_typeof(b->'notes') is distinct from 'string' or length(b->>'notes')>3000 then return false; end if;
 foreach k in array array['costs','income'] loop
  if jsonb_typeof(b->k) is distinct from 'array' or jsonb_array_length(b->k)>250 then return false; end if;
  ids:=array[]::text[];
  for r in select value from jsonb_array_elements(b->k) loop
   if jsonb_typeof(r)<>'object' or coalesce(r->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or r->>'id'=any(ids) or r ? 'source_key' then return false; end if;
   ids:=array_append(ids,r->>'id');
   if jsonb_typeof(r->'name') is distinct from 'string' or length(btrim(r->>'name'))=0 or length(r->>'name')>160
    or jsonb_typeof(r->'vendor') is distinct from 'string' or length(r->>'vendor')>160
    or jsonb_typeof(r->'notes') is distinct from 'string' or length(r->>'notes')>1000 then return false; end if;
   if k='costs' then
    if coalesce(r->>'category','')<>all(array['Venue & course','Food & beverage','Gifts & swag','Prizes & contests','Signs & printing','Marketing','Staff & services','Fees & insurance','Other'])
     or not eig_private.valid_budget_amount(r->'quantity') or (r->>'quantity')::numeric not between 1 and 100000
     or not eig_private.valid_budget_amount(r->'unit_cents') or (r->>'quantity')::numeric*(r->>'unit_cents')::numeric>100000000000
     or (r->'actual_cents' is distinct from 'null'::jsonb and not eig_private.valid_budget_amount(r->'actual_cents'))
     or not eig_private.valid_budget_amount(r->'paid_cents') or (r->>'paid_cents')::numeric>coalesce((r->>'actual_cents')::numeric,0) then return false; end if;
   else
    if coalesce(r->>'category','')<>all(array['Registration','Sponsorship','Donation','Sales','Other'])
     or not eig_private.valid_budget_amount(r->'target_cents') or not eig_private.valid_budget_amount(r->'committed_cents') or not eig_private.valid_budget_amount(r->'received_cents')
     or (r->>'received_cents')::numeric>(r->>'committed_cents')::numeric then return false; end if;
   end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function eig_private.valid_budget_amount(jsonb),eig_private.valid_event_budget(jsonb) from public,anon;
grant execute on function eig_private.valid_budget_amount(jsonb),eig_private.valid_event_budget(jsonb) to authenticated;

create table public.eie_event_budgets(
 event_id uuid primary key references public.golf_registration_events(id),
 data jsonb not null check(eig_private.valid_event_budget(data)), version integer not null check(version>0),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table public.eie_event_budget_versions(
 event_id uuid not null references public.golf_registration_events(id), version integer not null,
 data jsonb not null, source_snapshot jsonb not null, actor_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(event_id,version)
);
create index eie_budget_editor_idx on public.eie_event_budgets(updated_by);
create index eie_budget_history_actor_idx on public.eie_event_budget_versions(actor_user_id);
alter table public.eie_event_budgets enable row level security;
alter table public.eie_event_budget_versions enable row level security;
revoke all on public.eie_event_budgets,public.eie_event_budget_versions from public,anon,authenticated;
grant select on public.eie_event_budgets,public.eie_event_budget_versions to authenticated;
create policy authorized_budget_read on public.eie_event_budgets for select to authenticated using(eig_private.can_manage_event_budget(event_id));
create policy authorized_budget_history on public.eie_event_budget_versions for select to authenticated using(eig_private.can_manage_event_budget(event_id));

create function eig_private.event_budget_sources(target_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare reg_committed numeric; reg_received numeric; reg_count integer; paid_without_amount integer; source_plan jsonb; sponsor_target numeric; sponsor_paid numeric; plan_version integer;
begin
 if not eig_private.can_manage_event_budget(target_event_id) then raise exception 'Authorized event budget access is required' using errcode='42501'; end if;
 -- One row per registration. Team captain carries the team price; do not add team shares again.
 -- Keep money retained on cancelled/withdrawn registrations; omit full refunds and comps.
 select coalesce(sum(case when payment_status='comp' or payment_status='refunded' or refunded_at is not null then 0
  when registration_status='active' and coalesce(spot_hold_status,'') not in ('released','expired') then greatest(coalesce(price,0),net_received)
  else net_received end),0),coalesce(sum(net_received),0),count(*) filter(where registration_status='active' and coalesce(spot_hold_status,'') not in ('released','expired')),
 count(*) filter(where payment_status='paid' and amount_paid is null and refunded_at is null)
 into reg_committed,reg_received,reg_count,paid_without_amount
 from (select r.*,case when payment_status in ('comp','refunded') or refunded_at is not null then 0
   when amount_paid is not null then least(greatest(coalesce(price,0),0),greatest(amount_paid-case when payment_reference='clubhouse' then 0 else coalesce(convenience_fee,0) end,0))
   when payment_status='paid' then greatest(coalesce(price,0),0) else 0 end as net_received
  from public.golf_registrations r where r.event_id=target_event_id) r;
 select data->'sponsors',version into source_plan,plan_version from public.event_builder_assets where event_id=target_event_id;
 select coalesce(sum(greatest(coalesce((s->>'quantity')::numeric,0),0)*greatest(coalesce((s->>'unit_price')::numeric,0),0)),0),
 coalesce(sum(case when s->>'paid'='true' then greatest(coalesce((s->>'quantity')::numeric,0),0)*greatest(coalesce((s->>'unit_price')::numeric,0),0) else 0 end),0)
 into sponsor_target,sponsor_paid from jsonb_array_elements(case when jsonb_typeof(source_plan->'sales')='array' then source_plan->'sales' else '[]'::jsonb end) s;
 return jsonb_build_object('refreshed_at',now(),'registration_count',reg_count,'status_only_paid_count',paid_without_amount,'sponsor_plan_version',plan_version,
  'income',jsonb_build_array(
   jsonb_build_object('id','00000000-0000-0000-0000-000000000001','source_key','registration','name','EIE registrations','category','Registration','vendor','EIE roster','notes','Event registration amounts; convenience fees excluded. Full refunds and comps excluded. Paid status used when no amount is recorded.', 'target_cents',0,'committed_cents',round(reg_committed*100),'received_cents',round(reg_received*100)),
   jsonb_build_object('id','00000000-0000-0000-0000-000000000002','source_key','sponsors','name','Sponsor Builder sales','category','Sponsorship','vendor','Saved event packet','notes','Saved sales are targets until marked paid. Legacy sponsor tables are not added again.', 'target_cents',round(sponsor_target*100),'committed_cents',round(sponsor_paid*100),'received_cents',round(sponsor_paid*100))));
end $$;
revoke all on function eig_private.event_budget_sources(uuid) from public,anon;
grant execute on function eig_private.event_budget_sources(uuid) to authenticated;

create function eig_private.read_event_budget(target_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; history jsonb;
begin
 if not eig_private.can_manage_event_budget(target_event_id) then raise exception 'Authorized event budget access is required' using errcode='42501'; end if;
 select to_jsonb(b) into result from public.eie_event_budgets b where event_id=target_event_id;
 select coalesce(jsonb_agg(v order by version desc),'[]'::jsonb) into history from
 (select version,actor_user_id,created_at from public.eie_event_budget_versions where event_id=target_event_id order by version desc limit 10) v;
 return jsonb_build_object('budget',result,'sources',eig_private.event_budget_sources(target_event_id),'history',history,'history_count',coalesce((result->>'version')::integer,0));
end $$;
revoke all on function eig_private.read_event_budget(uuid) from public,anon;
grant execute on function eig_private.read_event_budget(uuid) to authenticated;
create function public.read_eie_event_budget(p_event_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select eig_private.read_event_budget(p_event_id)$$;
revoke all on function public.read_eie_event_budget(uuid) from public,anon;
grant execute on function public.read_eie_event_budget(uuid) to authenticated;

create function eig_private.save_event_budget(target_event_id uuid,expected_version integer,budget_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.eie_event_budgets; sources jsonb;
begin
 if not eig_private.can_manage_event_budget(target_event_id) then raise exception 'Authorized event budget access is required' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or not eig_private.valid_event_budget(budget_data) then raise exception 'Invalid event budget data'; end if;
 sources:=eig_private.event_budget_sources(target_event_id);
 if expected_version=0 then
  insert into public.eie_event_budgets(event_id,data,version,updated_by) values(target_event_id,budget_data,1,auth.uid()) on conflict do nothing returning * into saved;
 else
  update public.eie_event_budgets set data=budget_data,version=version+1,updated_by=auth.uid(),updated_at=now()
   where event_id=target_event_id and version=expected_version returning * into saved;
 end if;
 if saved.event_id is null then raise exception 'Someone saved a newer budget. Export your draft, then reload before saving.' using errcode='40001'; end if;
 insert into public.eie_event_budget_versions(event_id,version,data,source_snapshot,actor_user_id) values(target_event_id,saved.version,saved.data,sources,auth.uid());
 return eig_private.read_event_budget(target_event_id);
end $$;
revoke all on function eig_private.save_event_budget(uuid,integer,jsonb) from public,anon;
grant execute on function eig_private.save_event_budget(uuid,integer,jsonb) to authenticated;
create function public.save_eie_event_budget(p_event_id uuid,p_expected_version integer,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select eig_private.save_event_budget(p_event_id,p_expected_version,p_data)$$;
revoke all on function public.save_eie_event_budget(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_eie_event_budget(uuid,integer,jsonb) to authenticated;
