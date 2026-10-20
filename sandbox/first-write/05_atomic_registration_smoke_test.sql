-- ONLY run against isolated Supabase Sandbox publruuuyvpggogrrgwp.
-- Regression for the atomic Registration Details RPC. Entire test rolls back.
BEGIN;
DO $setup$
DECLARE uid uuid; sid uuid;
BEGIN
 IF (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled)<>1
 OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE)
 OR (SELECT count(*) FROM public.golf_registrations)<>0
 THEN RAISE EXCEPTION 'Unexpected Sandbox fixtures'; END IF;
 SELECT t.tester_user_id,s.id INTO uid,sid
 FROM sandbox_ops.practice_testers t JOIN auth.sessions s ON s.user_id=t.tester_user_id
 WHERE t.enabled AND (s.not_after IS NULL OR s.not_after>now())
 ORDER BY s.created_at DESC LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'No approved active session'; END IF;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object(
  'sub',uid::text,'role','authenticated','session_id',sid::text)::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $smoke$
DECLARE
 evt uuid; prev timestamptz; payload jsonb; result jsonb; now_saved timestamptz;
 blocked boolean; current_role text; offers_before int; default_name text;
 reg_settings jsonb; v_price numeric;
BEGIN
 SELECT e.id,e.updated_at INTO evt,prev
 FROM public.golf_registration_events e
 WHERE e.field_settings->>'is_sandbox_fixture'='true' AND e.status='draft';
 IF evt IS NULL THEN RAISE EXCEPTION 'Practice event not found'; END IF;
 SELECT count(*) INTO offers_before FROM public.event_offers WHERE golf_event_id=evt;
 payload:=jsonb_build_object(
  'base_price',480,'team_size',4,'allow_team_name',true,'allow_partial_team',true,
  'team_payment_mode','captain_all','allow_split_team_payments',true,
  'registration_item_name','Practice Scramble Registration',
  'registration_description','Fictional $480 team registration test',
  'registration_charge_by','team',
  'payment_hold_days',4,'allow_online',true,'allow_clubhouse',true,
  'convenience_fee_type','percent','convenience_fee_value',3,
  'allow_card_guarantee',true,
  'clubhouse_payment_payee','Fictional Practice Club',
  'clubhouse_payment_location_name','Fictional Clubhouse',
  'clubhouse_payment_address','',
  'clubhouse_payment_instructions','Pay in four days in this demo only',
  'availability_start','','availability_end','',
  'registration_deadline','','registration_deadline_utc',null,
  'registration_contact_name','','registration_contact_email','',
  'registration_contact_phone','','dob','optional','gender','required',
  'division','optional','membership','optional','ghin','hidden',
  'custom_fields',jsonb_build_array(jsonb_build_object(
    'id','shirt_size','label','Shirt size','type','select','required',true,
    'options',jsonb_build_array('S','M','L','XL')
  ))
 );
 -- Pilot writes all three linked records atomically, retaining Draft.
 PERFORM public.sandbox_switch_practice_role('pilot');
 result:=public.sandbox_save_practice_registration_details(evt,prev,payload);
 IF result->'event'->>'status'<>'draft'
 OR result->'event'->'field_settings'->>'participant_fields_status'<>'configured'
 OR result->'event'->'field_settings'->>'is_sandbox_fixture'<>'true'
 OR result->'event'->'field_settings'->>'team_size'<>'4'
 OR result->'event'->'field_settings'->>'gender'<>'required'
 OR (result->'event'->>'member_price')::numeric<>480
 OR result->'base_offer'->>'status'<>'active'
 OR result->'base_offer'->>'charge_by'<>'team'
 OR result->'payment'->>'auto_charge_at_deadline'<>'false'
 OR result->'payment'->>'reminders_enabled'<>'false'
 OR result->'payment'->>'clubhouse_hold_days'<>'4'
 THEN RAISE EXCEPTION 'Practice registration save did not consistently configure data: %', result; END IF;
 IF (SELECT count(*) FROM public.event_offers WHERE golf_event_id=evt)<>offers_before
 OR (SELECT count(*) FROM public.event_offers WHERE golf_event_id=evt AND offer_type='registration' AND status='active')<>1
 OR (SELECT count(*) FROM public.golf_event_payment_settings WHERE event_id=evt)<>1
 THEN RAISE EXCEPTION 'Expected one reused base offer and one payment settings row'; END IF;
 now_saved:=(result->'event'->>'updated_at')::timestamptz;

 -- Re-saving same timestamp must not silently overwrite the new one.
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_registration_details(evt,prev,payload);
 EXCEPTION WHEN SQLSTATE '40001' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale registration overwrite unexpectedly succeeded'; END IF;
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_registration_details(evt,now_saved,payload||'{"status":"published"}'::jsonb);
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Published injection unexpectedly succeeded'; END IF;
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_registration_details(evt,now_saved,jsonb_set(payload,'{base_price}','-5'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Negative registration price unexpectedly saved'; END IF;
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_registration_details(evt,now_saved,jsonb_set(payload,'{team_size}','99'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Oversized team unexpectedly saved'; END IF;
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_registration_details(evt,now_saved,jsonb_set(payload,'{registration_deadline}','"2027-02-31T09:00"'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid registration calendar date accepted'; END IF;
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_registration_details('00000000-0000-0000-0000-000000000000'::uuid,now_saved,payload);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unrelated event unexpectedly editable'; END IF;
 -- One valid local deadline and matching UTC for master.
 payload:=jsonb_set(payload,'{registration_deadline}','"2027-04-20T16:00"'::jsonb);
 payload:=jsonb_set(payload,'{registration_deadline_utc}','"2027-04-20T20:00:00.000Z"'::jsonb);
 PERFORM public.sandbox_switch_practice_role('co_pilot');
 result:=public.sandbox_save_practice_registration_details(evt,now_saved,payload);
 IF result->'event'->'field_settings'->>'registration_deadline'<>'2027-04-20'
 OR (SELECT registration_deadline FROM public.events WHERE id=(SELECT master_event_id FROM public.golf_registration_events WHERE id=evt))
 IS DISTINCT FROM '2027-04-20T20:00:00Z'::timestamptz
 THEN RAISE EXCEPTION 'Co-Pilot deadline was not saved to both event records'; END IF;
 now_saved:=(result->'event'->>'updated_at')::timestamptz;
 -- ATC/Passenger and anonymous must never modify the practice settings.
 FOR current_role IN SELECT unnest(ARRAY['atc','passenger']) LOOP
   PERFORM public.sandbox_switch_practice_role(current_role);
   blocked:=false;
   BEGIN PERFORM public.sandbox_save_practice_registration_details(evt,now_saved,payload);
   EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Forbidden role % could save Registration Details',current_role; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.sandbox_save_practice_registration_details(uuid,timestamptz,jsonb)','EXECUTE')
 OR has_table_privilege('authenticated','public.golf_registration_events','UPDATE')
 OR has_table_privilege('authenticated','public.event_offers','INSERT')
 OR has_table_privilege('authenticated','public.golf_event_payment_settings','INSERT')
 THEN RAISE EXCEPTION 'Anonymous access or broad writes unexpectedly permitted'; END IF;
END $smoke$;
ROLLBACK;
SELECT
 (SELECT active_role FROM sandbox_ops.practice_testers WHERE enabled LIMIT 1) AS original_role,
 (SELECT status FROM public.golf_registration_events WHERE field_settings->>'is_sandbox_fixture'='true') AS original_event_status,
 (SELECT field_settings->>'participant_fields_status' FROM public.golf_registration_events WHERE field_settings->>'is_sandbox_fixture'='true') AS registration_status_after_rollback,
 (SELECT count(*) FROM public.event_offers WHERE offer_type='registration' AND status='active') AS active_offers_after_rollback,
 (SELECT count(*) FROM public.golf_event_payment_settings) AS payment_settings_after_rollback,
 (SELECT count(*) FROM public.golf_registrations) AS registrations_after_rollback,
 (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')) AS direct_write_grants;
