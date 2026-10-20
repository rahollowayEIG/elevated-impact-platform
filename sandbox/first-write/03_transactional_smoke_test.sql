-- Run ONLY against the isolated Supabase Sandbox project publruuuyvpggogrrgwp.
-- The routine must already be installed. This file NEVER commits a write.
BEGIN;

DO $isolation$
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
   OR (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
   OR (SELECT count(*) FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE) <> 0
   OR (SELECT count(*) FROM public.golf_registrations) <> 0
   OR (SELECT count(*) FROM public.golf_registration_events WHERE field_settings->>'is_sandbox_fixture'='true' AND status='draft') <> 1
  THEN RAISE EXCEPTION 'First-save smoke test requires isolated fictional Sandbox'; END IF;
END $isolation$;

DO $identity$
DECLARE uid uuid; sid uuid;
BEGIN
  SELECT t.tester_user_id,s.id INTO uid,sid
  FROM sandbox_ops.practice_testers t JOIN auth.sessions s ON s.user_id=t.tester_user_id
  WHERE t.enabled AND (s.not_after IS NULL OR s.not_after>now())
  ORDER BY s.created_at DESC LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'Approved tester active session not found'; END IF;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object(
    'sub',uid::text,'role','authenticated','session_id',sid::text)::text,true);
END $identity$;

SET LOCAL ROLE authenticated;

DO $smoke$
DECLARE
 e uuid; prior timestamptz; payload jsonb; result jsonb; saved timestamptz;
 role_name text; blocked boolean; master_name text;
BEGIN
 SELECT id,updated_at INTO e,prior FROM public.golf_registration_events
 WHERE status='draft' AND field_settings->>'is_sandbox_fixture'='true';
 IF e IS NULL THEN RAISE EXCEPTION 'Practice event not found'; END IF;
 payload:=jsonb_build_object(
  'name','Isolated First Save SQL Test','course','Fictional Testing Course',
  'dates',jsonb_build_array('2027-05-01'),'event_start_time','09:15',
  'max_golfers',36,'structure','team','event_access','public',
  'team_size',4,'allow_team_name',true,'allow_partial_team',true,
  'team_payment_mode','captain_all','divisions_enabled',true,'flights_enabled',false,
  'division','optional','division_details',jsonb_build_array(
    jsonb_build_object('name','Open','eligibility','','description',''),
    jsonb_build_object('name','Mixed','eligibility','','description','')),
  'tournament_format','Scramble','format_description','Non-persistent test',
  'player_information','');

 -- Pilot: valid atomic first save
 PERFORM public.sandbox_switch_practice_role('pilot');
 result:=public.sandbox_save_practice_event_details(e,prior,payload);
 saved:=(result->'event'->>'updated_at')::timestamptz;
 SELECT m.name INTO master_name FROM public.events m JOIN public.golf_registration_events ge ON ge.master_event_id=m.id WHERE ge.id=e;
 IF result->'event'->>'name'<>'Isolated First Save SQL Test'
    OR result->'event'->>'status'<>'draft'
    OR result->'event'->'field_settings'->>'is_sandbox_fixture'<>'true'
    OR master_name<>'Isolated First Save SQL Test'
 THEN RAISE EXCEPTION 'Pilot atomic event/master test failed'; END IF;

 -- Stale saved version
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_event_details(e,prior,payload);
 EXCEPTION WHEN SQLSTATE '40001' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale optimistic concurrency accepted'; END IF;

 -- Unknown/publishing fields
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_event_details(e,saved,payload||'{"status":"published"}'::jsonb);
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Malicious status field was accepted'; END IF;

 -- Invalid calendar date
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_event_details(e,saved,jsonb_set(payload,'{dates}','["2027-02-31"]'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid date was accepted'; END IF;

 -- Invalid team size
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_event_details(e,saved,jsonb_set(payload,'{team_size}','99'::jsonb));
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Oversized team was accepted'; END IF;

 -- Wrong event ID
 blocked:=false;
 BEGIN PERFORM public.sandbox_save_practice_event_details('00000000-0000-0000-0000-000000000000'::uuid,saved,payload);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unknown event accepted'; END IF;

 -- Authorized Co-Pilot save
 PERFORM public.sandbox_switch_practice_role('co_pilot');
 result:=public.sandbox_save_practice_event_details(e,saved,payload||'{"name":"Co-Pilot Fictional Test"}'::jsonb);
 IF result->'event'->>'name'<>'Co-Pilot Fictional Test' THEN RAISE EXCEPTION 'Co-Pilot denied'; END IF;
 saved:=(result->'event'->>'updated_at')::timestamptz;

 -- ATC and Passenger MUST fail (and no side effects)
 FOR role_name IN SELECT unnest(ARRAY['atc','passenger']) LOOP
   PERFORM public.sandbox_switch_practice_role(role_name);
   blocked:=false;
   BEGIN PERFORM public.sandbox_save_practice_event_details(e,saved,payload);
   EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Forbidden role % could save',role_name; END IF;
 END LOOP;

 IF has_function_privilege('anon','public.sandbox_save_practice_event_details(uuid,timestamptz,jsonb)','EXECUTE')
 OR has_table_privilege('authenticated','public.golf_registration_events','UPDATE')
 OR has_table_privilege('authenticated','public.events','UPDATE') THEN
   RAISE EXCEPTION 'Unexpected anonymous RPC or broad authenticated table write grant';
 END IF;
END $smoke$;

ROLLBACK;

-- This final SELECT must report the original fixture, Pilot role, zero
-- registrations, zero table write grants and zero published events.
SELECT
 (SELECT name FROM public.golf_registration_events WHERE field_settings->>'is_sandbox_fixture'='true') AS original_event_preserved,
 (SELECT active_role FROM sandbox_ops.practice_testers WHERE enabled LIMIT 1) AS original_role_preserved,
 (SELECT count(*) FROM public.golf_registrations) AS registrations,
 (SELECT count(*) FROM public.golf_registration_events WHERE status='published') AS published_events,
 (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')) AS authenticated_write_grants;
