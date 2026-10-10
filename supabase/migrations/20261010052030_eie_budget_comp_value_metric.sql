-- Non-revenue comp value for Event Budget. Reuses the current permissioned source function.
-- This does not modify payment, registration, revenue or budget values.
CREATE OR REPLACE FUNCTION eig_private.event_budget_sources(target_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare reg_committed numeric; reg_received numeric; reg_count integer; paid_without_amount integer; source_plan jsonb; sponsor_target numeric; sponsor_paid numeric; plan_version integer; comp_value numeric; comp_spots integer; comp_fees integer;
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
 -- Read-only value of complimentary entries, distinct from cash received.
 -- A paid/Comp team fee is held on the captain's priced registration.
 -- Covered $0 teammates count as spots, but must not add to face value.
 select coalesce(sum(greatest(coalesce(price,0),0)),0),count(*),
        count(*) filter (where coalesce(price,0)>0)
   into comp_value,comp_spots,comp_fees
   from public.golf_registrations
   where event_id=target_event_id and payment_status='comp'
     and registration_status='active'
     and coalesce(spot_hold_status,'') not in ('released','expired')
     and refunded_at is null;
 select data->'sponsors',version into source_plan,plan_version from public.event_builder_assets where event_id=target_event_id;
 select coalesce(sum(greatest(coalesce((s->>'quantity')::numeric,0),0)*greatest(coalesce((s->>'unit_price')::numeric,0),0)),0),
 coalesce(sum(case when s->>'paid'='true' then greatest(coalesce((s->>'quantity')::numeric,0),0)*greatest(coalesce((s->>'unit_price')::numeric,0),0) else 0 end),0)
 into sponsor_target,sponsor_paid from jsonb_array_elements(case when jsonb_typeof(source_plan->'sales')='array' then source_plan->'sales' else '[]'::jsonb end) s;
 return jsonb_build_object('refreshed_at',now(),'registration_count',reg_count,'status_only_paid_count',paid_without_amount,'sponsor_plan_version',plan_version,
  'comps',jsonb_build_object('value_cents',round(comp_value*100),'spot_count',comp_spots,'fee_count',comp_fees),
  'income',jsonb_build_array(
   jsonb_build_object('id','00000000-0000-0000-0000-000000000001','source_key','registration','name','EIE registrations','category','Registration','vendor','EIE roster','notes','Event registration amounts; convenience fees excluded. Full refunds and comps excluded. Paid status used when no amount is recorded.', 'target_cents',0,'committed_cents',round(reg_committed*100),'received_cents',round(reg_received*100)),
   jsonb_build_object('id','00000000-0000-0000-0000-000000000002','source_key','sponsors','name','Sponsor Builder sales','category','Sponsorship','vendor','Saved event packet','notes','Saved sales are targets until marked paid. Legacy sponsor tables are not added again.', 'target_cents',round(sponsor_target*100),'committed_cents',round(sponsor_paid*100),'received_cents',round(sponsor_paid*100))));
end $function$;
