CREATE OR REPLACE FUNCTION public.eie_staff_team_roster_update(p_event_id uuid, p_action text, p_registration_id uuid, p_other_registration_id uuid DEFAULT NULL::uuid, p_fields jsonb DEFAULT '{}'::jsonb, p_actor_user_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_event public.golf_registration_events%rowtype;
 a public.golf_registrations%rowtype;
 b public.golf_registrations%rowtype;
 ta public.golf_registration_teams%rowtype;
 tb public.golf_registration_teams%rowtype;
 a_was_tba boolean;
 b_was_tba boolean;
 email_next text;
 before_a jsonb;
 before_b jsonb;
 now_at timestamptz := now();
 new_status text;
begin
 if current_user <> 'service_role' then raise exception 'Service authorization is required'; end if;
 if p_actor_user_id is null then raise exception 'Staff actor is required'; end if;
 if p_action not in ('fill_tba','edit_player','swap','move_to_tba','transfer_captain') then
   raise exception 'Unsupported team action'; end if;
 select * into v_event from public.golf_registration_events where id=p_event_id for update;
 if not found or v_event.field_settings->>'registration_format' <> 'team' then
   raise exception 'Team event not found'; end if;
 select * into a from public.golf_registrations
 where id=p_registration_id and event_id=p_event_id and registration_status='active' for update;
 if not found then raise exception 'Active golfer not found'; end if;
 select * into ta from public.golf_registration_teams
 where event_id=p_event_id and team_id=a.team_id for update;
 if not found then raise exception 'Team not found'; end if;
 a_was_tba := coalesce(a.custom_fields->>'reserved_tba','false')='true' or upper(btrim(a.first_name))='TBA';
 before_a := jsonb_build_object('registration_id',a.id,'first_name',a.first_name,'last_name',a.last_name,
  'email',a.email,'user_id',a.user_id,'entry_number',a.entry_number,'team_id',a.team_id);
 if p_action in ('swap','move_to_tba','transfer_captain') then
   if p_other_registration_id is null or p_other_registration_id=p_registration_id then
     raise exception 'Choose a different golfer'; end if;
   select * into b from public.golf_registrations
   where id=p_other_registration_id and event_id=p_event_id and registration_status='active' for update;
   if not found then raise exception 'Second active golfer not found'; end if;
   select * into tb from public.golf_registration_teams
   where event_id=p_event_id and team_id=b.team_id for update;
   if not found then raise exception 'Second team not found'; end if;
   b_was_tba := coalesce(b.custom_fields->>'reserved_tba','false')='true' or upper(btrim(b.first_name))='TBA';
   before_b := jsonb_build_object('registration_id',b.id,'first_name',b.first_name,'last_name',b.last_name,
     'email',b.email,'user_id',b.user_id,'entry_number',b.entry_number,'team_id',b.team_id);
 end if;

 if p_action in ('fill_tba','edit_player') then
   if p_action='fill_tba' and (not a_was_tba or nullif(btrim(coalesce(a.email,'')),'') is not null) then
     raise exception 'Select a reserved TBA slot'; end if;
   if p_action='edit_player' and a_was_tba then raise exception 'Use Fill TBA Spot instead'; end if;
   if p_action='fill_tba' and (nullif(btrim(p_fields->>'first_name'),'') is null
        or nullif(btrim(p_fields->>'last_name'),'') is null
        or nullif(btrim(p_fields->>'email'),'') is null) then
     raise exception 'Name and email are required to fill a spot'; end if;
   email_next := lower(btrim(coalesce(p_fields->>'email',a.email,'')));
   if email_next !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
     raise exception 'Enter a valid email address'; end if;
   if p_action='edit_player' and a.user_id is not null and
      lower(coalesce(a.email,'')) is distinct from email_next then
     raise exception 'Claimed account email must be changed through Account Management'; end if;
   if exists (select 1 from public.golf_registrations r
      where r.event_id=p_event_id and r.team_id=a.team_id and r.id<>a.id
      and r.registration_status='active' and lower(coalesce(r.email,''))=email_next) then
      raise exception 'This email is already on that team'; end if;
   update public.golf_registrations r set
      first_name=coalesce(nullif(btrim(p_fields->>'first_name'),''),a.first_name),
      last_name=coalesce(nullif(btrim(p_fields->>'last_name'),''),a.last_name),
      email=email_next,
      phone=case when p_fields ? 'phone' then nullif(btrim(p_fields->>'phone'),'') else a.phone end,
      ghin_number=case when p_fields ? 'ghin_number' then nullif(btrim(p_fields->>'ghin_number'),'') else a.ghin_number end,
      division=case when p_fields ? 'division' then nullif(btrim(p_fields->>'division'),'') else a.division end,
      custom_fields=case when p_action='fill_tba' then coalesce(a.custom_fields,'{}'::jsonb)-'reserved_tba' else a.custom_fields end,
      passenger_claim_status=case when p_action='fill_tba' then 'unclaimed' else a.passenger_claim_status end,
      payment_status=case when p_action='fill_tba' and ta.payment_mode='captain_all' and r.price=0
        and exists(select 1 from public.golf_registrations cr where cr.id=ta.captain_registration_id and cr.payment_status='paid')
        then 'paid' else r.payment_status end,
      google_sheet_synced_at=null,
      admin_note=left(coalesce(p_reason,'Roster updated by event staff'),1500),
      admin_updated_at=now_at,admin_updated_by=p_actor_user_id
   where r.id=a.id;
   if p_action='fill_tba' or lower(coalesce(a.email,'')) is distinct from email_next then
     update public.golf_team_invitations set status='superseded',updated_at=now_at
     where registration_id=a.id and status in ('pending','send_failed');
   end if;
 elsif p_action='transfer_captain' then
   if ta.id<>tb.id then raise exception 'Captain must be on the same team'; end if;
   if a.id<>ta.captain_registration_id then raise exception 'Select the current captain first'; end if;
   if b_was_tba or b.user_id is null or b.passenger_claim_status<>'claimed' then
     raise exception 'The new captain must have a claimed Passenger account'; end if;
   update public.golf_registration_teams set
     captain_registration_id=b.id,captain_user_id=b.user_id,updated_at=now_at
   where id=ta.id;
 elsif p_action in ('swap','move_to_tba') then
   if ta.id=tb.id then raise exception 'Choose golfers on different teams'; end if;
   if p_action='swap' and (a_was_tba or b_was_tba) then
     raise exception 'Use Move Into TBA for an open spot'; end if;
   if p_action='move_to_tba' and (a_was_tba or not b_was_tba) then
     raise exception 'Choose a real golfer and a destination TBA slot'; end if;
   if a.id=ta.captain_registration_id and (b.user_id is null or b.passenger_claim_status<>'claimed') then
     raise exception 'Incoming captain must have a claimed Passenger account. Transfer captain first or select a claimed golfer'; end if;
   if b.id=tb.captain_registration_id and (a.user_id is null or a.passenger_claim_status<>'claimed') then
     raise exception 'Incoming captain must have a claimed Passenger account'; end if;
   -- Registration IDs, team numbers, fee records and Stripe history stay anchored to each TEAM SLOT.
   -- Only golfer identity moves. This means the row's team_id and entry_number remain correct.
   update public.golf_registrations set
     first_name=b.first_name,last_name=b.last_name,email=b.email,phone=b.phone,
     ghin_number=b.ghin_number,division=b.division,gender=b.gender,age=b.age,
     date_of_birth=b.date_of_birth,membership_status=b.membership_status,
     custom_fields=b.custom_fields,user_id=b.user_id,passenger_id=b.passenger_id,
     passenger_claim_status=b.passenger_claim_status,passenger_invited_at=b.passenger_invited_at,
     passenger_claimed_at=b.passenger_claimed_at,google_sheet_synced_at=null,
     admin_note=left(coalesce(p_reason,'Staff moved golfer to another team'),1500),
     admin_updated_at=now_at,admin_updated_by=p_actor_user_id
   where id=a.id;
   update public.golf_registrations set
     first_name=a.first_name,last_name=a.last_name,email=a.email,phone=a.phone,
     ghin_number=a.ghin_number,division=a.division,gender=a.gender,age=a.age,
     date_of_birth=a.date_of_birth,membership_status=a.membership_status,
     custom_fields=a.custom_fields,user_id=a.user_id,passenger_id=a.passenger_id,
     passenger_claim_status=a.passenger_claim_status,passenger_invited_at=a.passenger_invited_at,
     passenger_claimed_at=a.passenger_claimed_at,google_sheet_synced_at=null,
     admin_note=left(coalesce(p_reason,'Staff moved golfer to another team'),1500),
     admin_updated_at=now_at,admin_updated_by=p_actor_user_id
   where id=b.id;
   if a.id=ta.captain_registration_id then
     update public.golf_registration_teams set captain_user_id=b.user_id,updated_at=now_at where id=ta.id;
   end if;
   if b.id=tb.captain_registration_id then
     update public.golf_registration_teams set captain_user_id=a.user_id,updated_at=now_at where id=tb.id;
   end if;
   update public.golf_team_invitations set status='superseded',updated_at=now_at
     where registration_id in (a.id,b.id) and status in ('pending','send_failed');
 end if;

 if p_action in ('fill_tba','swap','move_to_tba') then
   update public.golf_registration_teams t set
     status=case when
       (select count(*) from public.golf_registrations r where r.event_id=t.event_id and r.team_id=t.team_id and r.registration_status='active')>=t.team_size
       and not exists(select 1 from public.golf_registrations r where r.event_id=t.event_id and r.team_id=t.team_id and r.registration_status='active' and (r.custom_fields->>'reserved_tba'='true' or upper(btrim(r.first_name))='TBA'))
       then 'roster_complete' else 'roster_incomplete' end,
     updated_at=now_at
   where t.id=ta.id or (p_action in ('swap','move_to_tba') and t.id=tb.id);
 end if;

 insert into public.golf_registration_admin_actions(registration_id,organization_id,event_id,action,reason,
     previous_payment_status,new_payment_status,previous_registration_status,new_registration_status,acted_by,metadata)
 values(a.id,a.organization_id,p_event_id,'staff_'||p_action,p_reason,
     a.payment_status,a.payment_status,a.registration_status,a.registration_status,p_actor_user_id,
     jsonb_build_object('before',before_a,'other_before',before_b,'fee_records_unchanged',true));
 if p_action in ('swap','move_to_tba') then
   insert into public.golf_registration_admin_actions(registration_id,organization_id,event_id,action,reason,
       previous_payment_status,new_payment_status,previous_registration_status,new_registration_status,acted_by,metadata)
   values(b.id,b.organization_id,p_event_id,'staff_'||p_action,p_reason,
       b.payment_status,b.payment_status,b.registration_status,b.registration_status,p_actor_user_id,
       jsonb_build_object('before',before_b,'other_before',before_a,'fee_records_unchanged',true));
 end if;
 return jsonb_build_object('success',true,'action',p_action,'from_entry_number',ta.entry_number,
   'to_entry_number',case when p_action in ('swap','move_to_tba') then tb.entry_number else null end,
   'affected_registration_ids',case when p_action in ('swap','move_to_tba') then jsonb_build_array(a.id,b.id) else jsonb_build_array(a.id) end);
end
$function$

revoke all on function public.eie_staff_team_roster_update(uuid,text,uuid,uuid,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.eie_staff_team_roster_update(uuid,text,uuid,uuid,jsonb,uuid,text) to service_role;
