-- OPT-IN SANDBOX SETUP ONLY. Deliberately outside migrations: never auto-apply to Live.
-- Reuses canonical auth, organizations, sessions and membership; not a financial ledger.
-- Configuration starts empty/disabled. No customer, product, stock or org seed is installed.
begin;
create schema ep_sandbox_commerce;
revoke all on schema ep_sandbox_commerce from public,anon,authenticated;
grant usage on schema ep_sandbox_commerce to authenticated;
create table ep_sandbox_commerce.config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 owner_id uuid references auth.users(id),
 project_ref text not null default 'publruuuyvpggogrrgwp' check(project_ref='publruuuyvpggogrrgwp')
);
insert into ep_sandbox_commerce.config(singleton) values(true);
create table ep_sandbox_commerce.organizations (
 organization_id uuid primary key references public.organizations(id)
);
create table ep_sandbox_commerce.invoices (
 id uuid primary key,
 organization_id uuid not null references ep_sandbox_commerce.organizations,
 source_preview_id text not null,
 snapshot jsonb not null,
 status text not null default 'sandbox_unissued' check(status='sandbox_unissued'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,source_preview_id),unique(organization_id,id)
);
create table ep_sandbox_commerce.invoice_lines (
 id uuid primary key,
 organization_id uuid not null,
 invoice_id uuid not null,
 position integer not null check(position between 1 and 30),
 description text not null check(length(trim(description)) between 2 and 160),
 quantity integer not null check(quantity between 1 and 10000),
 unit_cents bigint not null check(unit_cents between 0 and 50000000),
 total_cents bigint generated always as (quantity::bigint*unit_cents) stored,
 foreign key(organization_id,invoice_id) references ep_sandbox_commerce.invoices(organization_id,id),
 unique(invoice_id,position),unique(organization_id,id),
 check(quantity::bigint*unit_cents<=200000000)
);
-- First persistent commerce-registry slice. NOT public.products (app entitlements),
-- eic_design_products (artwork specs), or sponsorship_products (event offerings).
-- Shared by future POS/Event Builder adapters, rather than invoice-specific products.
create table ep_sandbox_commerce.products (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references ep_sandbox_commerce.organizations,
 name text not null check(length(trim(name)) between 2 and 160),
 sku text not null default '' check(length(sku)<=48),
 description text not null default '' check(length(description)<=1000),
 kind text not null check(kind in ('physical_merchandise','noninventory_service','rental_asset','time_slot','sponsorship','advertising','gift_card','membership','contribution_intent')),
 track_inventory boolean not null,
 unit_cents bigint not null check(unit_cents between 0 and 50000000),
 name_key text generated always as (trim(regexp_replace(lower(name),'[^a-z0-9]+',' ','g'))) stored,
 sku_key text generated always as (upper(regexp_replace(sku,'\s+','','g'))) stored,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 check(not track_inventory or kind='physical_merchandise'),
 check(length(trim(regexp_replace(lower(name),'[^a-z0-9]+',' ','g')))>0)
);
create unique index sandbox_product_sku on ep_sandbox_commerce.products(organization_id,sku_key) where sku_key<>'';
-- Conservative same-name block, reviewed by linking or correcting the product details.
create unique index sandbox_product_name on ep_sandbox_commerce.products(organization_id,name_key);
create table ep_sandbox_commerce.reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 line_id uuid not null,
 details jsonb not null,
 version integer not null default 1,
 status text not null default 'pending' check(status in ('pending','approved','linked','dismissed')),
 product_id uuid,
 reviewed_by uuid references auth.users(id),
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 foreign key(organization_id,line_id) references ep_sandbox_commerce.invoice_lines(organization_id,id),
 foreign key(organization_id,product_id) references ep_sandbox_commerce.products(organization_id,id),
 unique(organization_id,line_id),
 check((status in ('approved','linked'))=(product_id is not null))
);
create table ep_sandbox_commerce.audit (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references ep_sandbox_commerce.organizations,
 action text not null,record_id uuid not null,snapshot jsonb not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
alter table ep_sandbox_commerce.config enable row level security;
alter table ep_sandbox_commerce.organizations enable row level security;
alter table ep_sandbox_commerce.invoices enable row level security;
alter table ep_sandbox_commerce.invoice_lines enable row level security;
alter table ep_sandbox_commerce.products enable row level security;
alter table ep_sandbox_commerce.reviews enable row level security;
alter table ep_sandbox_commerce.audit enable row level security;
revoke all on all tables in schema ep_sandbox_commerce from public,anon,authenticated;

-- No client-set role booleans or user_metadata. Config is DBA-only. Fresh revocation
-- and membership checks apply on EVERY request, including reads and retries.
create function ep_sandbox_commerce.allowed(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and eig_private.active_builder_session() and exists(
 select 1 from ep_sandbox_commerce.config c
 join ep_sandbox_commerce.organizations a on a.organization_id=target
 join public.organizations demo on demo.id=a.organization_id
 where c.enabled and c.owner_id=auth.uid() and demo.is_test and demo.status='active'
 and auth.jwt()->>'iss'='https://'||c.project_ref||'.supabase.co/auth/v1'
 and exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 where m.user_id=auth.uid() and m.role='eig_admin' and m.status='active'
 and o.slug='elevated-impact-group' and o.status='active'
 and (m.access_starts_at is null or m.access_starts_at<=now())
 and (m.access_ends_at is null or m.access_ends_at>now())))
$$;
revoke all on function ep_sandbox_commerce.allowed(uuid) from public,anon,authenticated;

-- One narrow gateway serializes writes per demo organization. No direct table grants.
-- Invoice saves are immutable/idempotent. A changed preview gets a new snapshot ID.
create function ep_sandbox_commerce.command(p_org uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare inv ep_sandbox_commerce.invoices; rev ep_sandbox_commerce.reviews; prod ep_sandbox_commerce.products;
 l jsonb; d jsonb; result jsonb; matches jsonb; selected_line uuid; inv_id uuid; n integer:=0;
 subtotal bigint:=0; tax integer; total bigint; target uuid; saved uuid; expected integer;
begin
 if not ep_sandbox_commerce.allowed(p_org) then raise exception 'Sandbox owner access required' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>50000 then raise exception 'Invalid request'; end if;
 -- Row lock avoids duplicate creation across concurrent reviews in this organization.
 perform 1 from ep_sandbox_commerce.organizations where organization_id=p_org for update;
 if p_action='list' then
  return jsonb_build_object(
   'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from ep_sandbox_commerce.invoices i where i.organization_id=p_org),'[]'::jsonb),
   'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name_key,p.id) from ep_sandbox_commerce.products p where p.organization_id=p_org),'[]'::jsonb),
   'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc,r.id) from ep_sandbox_commerce.reviews r where r.organization_id=p_org),'[]'::jsonb));
 elsif p_action='read' then
  select * into inv from ep_sandbox_commerce.invoices where organization_id=p_org and id=(p_data->>'id')::uuid;
  if not found then raise exception 'Invoice unavailable'; end if;
  return jsonb_build_object('invoice',to_jsonb(inv),'lines',(select jsonb_agg(to_jsonb(x) order by position) from ep_sandbox_commerce.invoice_lines x where invoice_id=inv.id));
 elsif p_action='save' then
  d:=p_data->'invoice'; inv_id:=(p_data->>'id')::uuid;
  if p_data->'fictional_confirmed' is distinct from 'true'::jsonb or inv_id is null or d is null or jsonb_typeof(d)<>'object' or
   not (d @> '{"kind":"ep_manual_invoice_preview","schemaVersion":1,"status":"draft_not_issued","invoiceNumber":null,"simulatedPaymentCents":0,"verifiedPaidCents":0,"realPaymentStatus":"not_connected","realCustomerContacted":false,"publicInvoiceUrl":null,"publicPaymentUrl":null,"actualInvoiceIssued":false,"actualTaxVerified":false,"approvalRequired":true,"privacy":"in_browser_memory_only","source":"fictional_or_user_entered_preview_not_persisted"}'::jsonb) or
   coalesce(d->>'status','')<>'draft_not_issued' or
   coalesce(d->>'actualInvoiceIssued','')<>'false' or
   coalesce(d->>'verifiedPaidCents','')<>'0' or coalesce(d->>'simulatedPaymentCents','')<>'0' or
   coalesce(d->>'realCustomerContacted','')<>'false' or
   d->'invoiceNumber' is distinct from 'null'::jsonb or
   d->'publicPaymentUrl' is distinct from 'null'::jsonb or
   d->'publicInvoiceUrl' is distinct from 'null'::jsonb or
   coalesce(d->>'customerEmail','!')<>'' or
   coalesce(d->>'issuerId','') not in ('demo-eig','demo-hangar','demo-nonprofit') or
   coalesce(d->>'currency','')<>'USD' or
   coalesce(d->>'id','')!~'^demo-invoice-[0-9a-f-]{36}$' or
   coalesce(d->>'sourceType','') not in ('manual','event','sponsorship','advertising','store','other') or
   coalesce(length(d->>'recipient'),0) not between 2 and 140 or
   coalesce(length(d->>'notes'),0)>500 or coalesce(length(d->>'reference'),0)>100 or
   coalesce(d->>'issueDate','')!~'^\d{4}-\d{2}-\d{2}$' or
   coalesce(d->>'dueDate','')!~'^\d{4}-\d{2}-\d{2}$' or
   (d->>'dueDate')::date<(d->>'issueDate')::date or
   coalesce(jsonb_typeof(d->'lines'),'')<>'array' then raise exception 'Only unissued fictional previews without contacts or payments may be saved'; end if;
  if jsonb_array_length(d->'lines') not between 1 and 30 then raise exception 'Use 1-30 lines'; end if;
  -- Prevent any contact/payment/issuance fields outside the supported preview contract.
  if exists(select 1 from jsonb_object_keys(d) k where k not in
   ('kind','schemaVersion','id','status','invoiceNumber','issuerId','issuerLabel','recipient','customerEmail','sourceType','reference','notes','issueDate','dueDate','taxBasisPoints','lines','currency','subtotalCents','taxCents','totalCents','simulatedPaymentCents','verifiedPaidCents','realPaymentStatus','balanceExampleCents','realCustomerContacted','publicInvoiceUrl','publicPaymentUrl','actualInvoiceIssued','actualTaxVerified','source','approvalRequired','privacy','disclaimer')) then raise exception 'Unsupported invoice fields'; end if;
  for l in select value from jsonb_array_elements(d->'lines') loop
   if coalesce(jsonb_typeof(l),'')<>'object' or
    coalesce(l->>'quantity','')!~'^[0-9]+$' or coalesce(l->>'unitCents','')!~'^[0-9]+$' or
    coalesce(l->>'totalCents','')!~'^[0-9]+$' or
    (l->>'quantity')::numeric not between 1 and 10000 or
    (l->>'unitCents')::numeric not between 0 and 50000000 or
    coalesce(length(trim(l->>'label')),0) not between 2 and 160 or
    (l->>'quantity')::bigint*(l->>'unitCents')::bigint<>(l->>'totalCents')::bigint then raise exception 'Invalid line'; end if;
   subtotal:=subtotal+(l->>'totalCents')::bigint;
  end loop;
  if coalesce(d->>'taxBasisPoints','')!~'^[0-9]+$' then raise exception 'Invalid illustrative tax'; end if;
  tax:=(d->>'taxBasisPoints')::integer; total:=subtotal+round(subtotal*tax::numeric/10000);
  if tax not between 0 and 2500 or subtotal>200000000 or total>200000000 or
   (d->>'subtotalCents')::bigint is distinct from subtotal or
   (d->>'taxCents')::bigint is distinct from (total-subtotal) or
   (d->>'totalCents')::bigint is distinct from total or
   (d->>'balanceExampleCents')::bigint is distinct from total then raise exception 'Invalid totals'; end if;
  select * into inv from ep_sandbox_commerce.invoices where organization_id=p_org and source_preview_id=d->>'id';
  if found then
   if inv.snapshot<>d then raise exception 'Saved snapshots are immutable; create a new preview' using errcode='40001'; end if;
   return to_jsonb(inv);
  end if;
  insert into ep_sandbox_commerce.invoices(id,organization_id,source_preview_id,snapshot,created_by)
   values(inv_id,p_org,d->>'id',d,auth.uid()) returning * into inv;
  for l in select value from jsonb_array_elements(d->'lines') loop
   n:=n+1;
   insert into ep_sandbox_commerce.invoice_lines(id,organization_id,invoice_id,position,description,quantity,unit_cents)
    values(gen_random_uuid(),p_org,inv_id,n,l->>'label',(l->>'quantity')::integer,(l->>'unitCents')::bigint);
  end loop;
  result:=to_jsonb(inv); saved:=inv.id;
 elsif p_action='propose' then
  selected_line:=(p_data->>'line_id')::uuid; d:=p_data->'details'; expected:=(p_data->>'version')::integer;
  if not exists(select 1 from ep_sandbox_commerce.invoice_lines where id=selected_line and organization_id=p_org) then raise exception 'Invoice line unavailable'; end if;
  if d is null or jsonb_typeof(d)<>'object' or expected is null or
   coalesce(jsonb_typeof(d->'name'),'')<>'string' or coalesce(jsonb_typeof(d->'sku'),'')<>'string' or
   coalesce(jsonb_typeof(d->'description'),'')<>'string' or
   coalesce(length(trim(d->>'name')),0) not between 2 and 160 or
   trim(regexp_replace(lower(d->>'name'),'[^a-z0-9]+',' ','g'))='' or
   coalesce(length(d->>'sku'),49)>48 or coalesce(length(d->>'description'),1001)>1000 or
   coalesce(d->>'kind','') not in ('physical_merchandise','noninventory_service','rental_asset','time_slot','sponsorship','advertising','gift_card','membership','contribution_intent') or
   coalesce(jsonb_typeof(d->'track_inventory'),'')<>'boolean' or
   ((d->>'track_inventory')::boolean and d->>'kind'<>'physical_merchandise') or
   coalesce(d->>'unit_cents','')!~'^[0-9]+$' or (d->>'unit_cents')::numeric not between 0 and 50000000 or
   (select count(*) from jsonb_object_keys(d))<>6 then raise exception 'Complete valid product details before review'; end if;
  select * into rev from ep_sandbox_commerce.reviews where organization_id=p_org and reviews.line_id=selected_line;
  if found then
   if rev.status<>'pending' or rev.version<>expected then raise exception 'Review changed; reload before editing' using errcode='40001'; end if;
   update ep_sandbox_commerce.reviews set details=d,version=version+1,updated_at=clock_timestamp() where id=rev.id returning * into rev;
  else
   if expected<>0 then raise exception 'Review changed; reload' using errcode='40001'; end if;
   insert into ep_sandbox_commerce.reviews(organization_id,line_id,details,created_by) values(p_org,selected_line,d,auth.uid()) returning * into rev;
  end if;
  result:=to_jsonb(rev); saved:=rev.id;
 elsif p_action in ('approve','link','dismiss') then
  expected:=(p_data->>'version')::integer;
  select * into rev from ep_sandbox_commerce.reviews where organization_id=p_org and id=(p_data->>'id')::uuid for update;
  if not found or expected is null or rev.version<>expected or rev.status<>'pending' then raise exception 'Pending review changed; reload' using errcode='40001'; end if;
  d:=rev.details;
  if p_action='approve' then
   select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'sku',p.sku)) into matches from ep_sandbox_commerce.products p
    where p.organization_id=p_org and (p.name_key=trim(regexp_replace(lower(d->>'name'),'[^a-z0-9]+',' ','g'))
    or (p.sku_key<>'' and p.sku_key=upper(regexp_replace(d->>'sku','\s+','','g'))));
   if matches is not null then return jsonb_build_object('duplicate_candidates',matches,'review',to_jsonb(rev)); end if;
   insert into ep_sandbox_commerce.products(organization_id,name,sku,description,kind,track_inventory,unit_cents,created_by)
    values(p_org,trim(d->>'name'),d->>'sku',d->>'description',d->>'kind',(d->>'track_inventory')::boolean,(d->>'unit_cents')::bigint,auth.uid()) returning * into prod;
   target:=prod.id;
  elsif p_action='link' then
   select id into target from ep_sandbox_commerce.products where organization_id=p_org and id=(p_data->>'product_id')::uuid;
   if target is null then raise exception 'Same-organization product required'; end if;
  end if;
  update ep_sandbox_commerce.reviews set status=case p_action when 'approve' then 'approved' when 'link' then 'linked' else 'dismissed' end,
   product_id=target,reviewed_by=auth.uid(),version=version+1,updated_at=clock_timestamp() where id=rev.id returning * into rev;
  result:=to_jsonb(rev); saved:=rev.id;
 else raise exception 'Unsupported Sandbox operation';
 end if;
 insert into ep_sandbox_commerce.audit(organization_id,action,record_id,snapshot,actor_id) values(p_org,p_action,saved,result,auth.uid());
 return result;
end $$;
revoke all on function ep_sandbox_commerce.command(uuid,text,jsonb) from public,anon;
grant execute on function ep_sandbox_commerce.command(uuid,text,jsonb) to authenticated;
create function public.ep_sandbox_invoice_command(p_org uuid,p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select ep_sandbox_commerce.command(p_org,p_action,p_data) $$;
revoke all on function public.ep_sandbox_invoice_command(uuid,text,jsonb) from public,anon;
grant execute on function public.ep_sandbox_invoice_command(uuid,text,jsonb) to authenticated;
comment on schema ep_sandbox_commerce is 'Owner-only fictional invoice snapshots and shared commerce registry foundation. No issuance, stock movement, payments or communications. Not a Live schema.';
commit;
