-- EIC design-product specifications. Separate from platform app entitlements and event sponsor inventory.
-- No prices, checkout, payment or order mutations are introduced by this catalog.
create function eig_private.can_manage_design_catalog() returns boolean
language sql stable security definer set search_path='' as $$
  select eig_private.active_builder_session() and exists(
    select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.role='eig_admin' and m.status='active'
      and o.slug='elevated-impact-group' and o.status='active'
      and (m.access_starts_at is null or m.access_starts_at<=now())
      and (m.access_ends_at is null or m.access_ends_at>now())
  )
$$;
revoke all on function eig_private.can_manage_design_catalog() from public,anon;
grant execute on function eig_private.can_manage_design_catalog() to authenticated;

create function eig_private.valid_design_product_definition(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare w numeric; h numeric; inset numeric; qr numeric; t jsonb;
begin
  if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>800000
    or coalesce(jsonb_typeof(d->'canvas_width'),'')<>'number'
    or coalesce(jsonb_typeof(d->'canvas_height'),'')<>'number'
    or coalesce(jsonb_typeof(d->'safe_inset'),'')<>'number'
    or coalesce(jsonb_typeof(d->'qr_size'),'')<>'number' then return false; end if;
  w:=(d->>'canvas_width')::numeric; h:=(d->>'canvas_height')::numeric;
  inset:=(d->>'safe_inset')::numeric; qr:=(d->>'qr_size')::numeric;
  if w<>trunc(w) or h<>trunc(h) or w not between 300 and 2400 or h not between 300 and 3000
    or inset<>trunc(inset) or inset not between 0 and floor(least(w,h)/3)
    or qr<>trunc(qr) or qr not between 80 and least(w,h-40)-inset*2
    or coalesce(d->>'theme','') not in ('classic','fairway','celebration')
    or coalesce(d->>'qr_corner','') not in ('top-left','top-right','bottom-left','bottom-right')
    or coalesce(jsonb_typeof(d->'finished_size'),'')<>'string' or length(d->>'finished_size')>160
    or coalesce(jsonb_typeof(d->'print_area'),'')<>'string' or length(d->>'print_area')>160
    or coalesce(jsonb_typeof(d->'notes'),'')<>'string' or length(d->>'notes')>1500
    or coalesce(jsonb_typeof(d->'image'),'')<>'string' or length(d->>'image')>350000
    or ((d->>'image')<>'' and (d->>'image')!~'^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$') then return false; end if;
  t:=d->'template';
  if t is not null and t<>'null'::jsonb then
    if jsonb_typeof(t)<>'object' or coalesce(t->>'version','')<>'1'
      or coalesce(jsonb_typeof(t->'width'),'')<>'number' or coalesce(jsonb_typeof(t->'height'),'')<>'number'
      or (t->>'width')::numeric<>w or (t->>'height')::numeric<>h
      or coalesce(jsonb_typeof(t->'boxes'),'')<>'array' then return false; end if;
    if jsonb_array_length(t->'boxes')>40 or coalesce(t->'link'->>'url','')<>''
      or coalesce(t->'link'->>'showQr','false')<>'false' or coalesce(t->'link'->>'showLink','false')<>'false' then return false; end if;
  end if;
  return true;
exception when others then return false;
end $$;
revoke all on function eig_private.valid_design_product_definition(jsonb) from public,anon,authenticated;

create table public.eic_design_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 160),
  category text not null check(category in ('signage','marketing','swag','apparel','gifts','books','displays','other')),
  material text not null check(material in ('flyer','invitation','sign','banner','swag','book','display')),
  description text not null default '' check(length(description)<=1000),
  status text not null default 'draft' check(status in ('draft','active','archived')),
  definition jsonb not null check(eig_private.valid_design_product_definition(definition)),
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict
);
create index eic_design_products_browse_idx on public.eic_design_products(status,category,name,id);
create index eic_design_products_created_by_idx on public.eic_design_products(created_by);
create index eic_design_products_updated_by_idx on public.eic_design_products(updated_by);
create table public.eic_design_product_versions (
  product_id uuid not null references public.eic_design_products(id) on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  actor_user_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(product_id,version)
);
create index eic_design_product_versions_actor_idx on public.eic_design_product_versions(actor_user_id);
alter table public.eic_design_products enable row level security;
alter table public.eic_design_product_versions enable row level security;
revoke all on public.eic_design_products,public.eic_design_product_versions from public,anon,authenticated;
grant select(id,name,category,material,description,status,definition,version,created_at,updated_at) on public.eic_design_products to authenticated;
grant select on public.eic_design_product_versions to authenticated;
grant select on public.eic_design_products,public.eic_design_product_versions to service_role;
create policy eic_design_catalog_read on public.eic_design_products for select to authenticated
  using((select eig_private.active_builder_session()) and (status='active' or (select eig_private.can_manage_design_catalog())));
create policy eic_design_catalog_audit_read on public.eic_design_product_versions for select to authenticated
  using((select eig_private.can_manage_design_catalog()));

create function public.design_product_catalog_access() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('can_read',eig_private.active_builder_session(),'can_manage',eig_private.can_manage_design_catalog())
$$;
revoke all on function public.design_product_catalog_access() from public,anon;
grant execute on function public.design_product_catalog_access() to authenticated;

-- Narrow definer mutation: rechecks fresh session and EIG membership, validates specs,
-- locks the row, rejects stale versions, and appends an immutable actor-attributed revision.
create function eig_private.save_design_product(p_id uuid,p_expected integer,p_name text,p_category text,p_material text,p_status text,p_description text,p_definition jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.eic_design_products;
begin
  if not eig_private.can_manage_design_catalog() then raise exception 'Active EIG catalog management access is required' using errcode='42501'; end if;
  if p_id is null or p_expected is null or p_expected<0 or p_name is null or length(trim(p_name)) not between 1 and 160
    or p_category is null or p_category not in ('signage','marketing','swag','apparel','gifts','books','displays','other')
    or p_material is null or p_material not in ('flyer','invitation','sign','banner','swag','book','display')
    or p_status is null or p_status not in ('draft','active','archived') or p_description is null or length(p_description)>1000
    or not eig_private.valid_design_product_definition(p_definition) then raise exception 'Invalid product specifications' using errcode='22023'; end if;
  select * into r from public.eic_design_products where id=p_id for update;
  if found then
    if r.version<>p_expected then raise exception 'Someone saved a newer product version. Your changes are still here; reopen the product before saving.' using errcode='40001'; end if;
    update public.eic_design_products set name=trim(p_name),category=p_category,material=p_material,status=p_status,description=p_description,
      definition=p_definition,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into r;
  else
    if p_expected<>0 then raise exception 'Reopen the product before saving' using errcode='40001'; end if;
    insert into public.eic_design_products(id,name,category,material,status,description,definition,created_by,updated_by)
      values(p_id,trim(p_name),p_category,p_material,p_status,p_description,p_definition,auth.uid(),auth.uid()) returning * into r;
  end if;
  insert into public.eic_design_product_versions(product_id,version,snapshot,actor_user_id) values(r.id,r.version,to_jsonb(r),auth.uid());
  return to_jsonb(r);
end $$;
revoke all on function eig_private.save_design_product(uuid,integer,text,text,text,text,text,jsonb) from public,anon;
grant execute on function eig_private.save_design_product(uuid,integer,text,text,text,text,text,jsonb) to authenticated;
create function public.save_design_product(p_product_id uuid,p_expected_version integer,p_name text,p_category text,p_material text,p_status text,p_description text,p_definition jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select eig_private.save_design_product(p_product_id,p_expected_version,p_name,p_category,p_material,p_status,p_description,p_definition)
$$;
revoke all on function public.save_design_product(uuid,integer,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.save_design_product(uuid,integer,text,text,text,text,text,jsonb) to authenticated;

-- Editable artwork starters use existing editor geometry. Supplier physical dimensions are left blank.
insert into public.eic_design_products(name,category,material,status,description,definition)
select name,category,material,'active','Customize the artwork; add your supplier’s finished size and imprint specifications.',
  jsonb_build_object('canvas_width',w,'canvas_height',h,'finished_size','','print_area','','safe_inset',24,
    'theme','classic','qr_size',180,'qr_corner','bottom-right','image','','notes','','template',null)
from (values ('Tee sign','signage','sign',1200,900),('Banner','signage','banner',1800,600),
  ('Flyer','marketing','flyer',850,1100),('Swag artwork','swag','swag',900,900)) seed(name,category,material,w,h);
insert into public.eic_design_product_versions(product_id,version,snapshot)
  select id,version,to_jsonb(p) from public.eic_design_products p;
comment on table public.eic_design_products is 'EIC-owned shared design-product catalog. Active verified platform accounts can use active entries; active EIG admins manage specifications. No checkout or prices.';
notify pgrst, 'reload schema';
