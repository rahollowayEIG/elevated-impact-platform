-- SANDBOX ONLY: three reviewed pure immutable validators; no production data, tokens, or network calls.
CREATE SCHEMA IF NOT EXISTS eig_private;
REVOKE ALL ON SCHEMA eig_private FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION eig_private.valid_budget_amount(v jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_typeof(v)='number' and v::text ~ '^[0-9]+$' and (v::text)::numeric<=100000000000,false)
$function$;

CREATE OR REPLACE FUNCTION eig_private.valid_design_product_definition(d jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION eig_private.valid_event_budget(b jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
end $function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA eig_private FROM PUBLIC, anon, authenticated;
ALTER TABLE public."eic_design_products" ADD CONSTRAINT "eic_design_products_definition_check" CHECK (eig_private.valid_design_product_definition(definition));
ALTER TABLE public."eie_event_budgets" ADD CONSTRAINT "eie_event_budgets_data_check" CHECK (eig_private.valid_event_budget(data));
