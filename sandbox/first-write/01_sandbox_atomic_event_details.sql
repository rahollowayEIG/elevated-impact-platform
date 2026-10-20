-- SANDBOX ONLY. REVIEWED STAGING SQL; DO NOT APPLY OR ENABLE WITHOUT
-- ALL ROLE/ROLLBACK TESTS AND EXPLICIT APPROVAL OF THE FIRST WRITE PILOT.
-- Isolated project: publruuuyvpggogrrgwp (NOT LIVE).
--
-- The web client calls an invoker-only facade. The privileged operation lives
-- in an unexposed sandbox_ops schema and can update only one approved fictional
-- Draft event plus its same-organization, unpublished master in one transaction.
-- No table UPDATE/INSERT grants are given to authenticated.
CREATE FUNCTION sandbox_ops.save_practice_event_details(
  p_event_id uuid,
  p_expected_updated_at timestamptz,
  p_details jsonb
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  v_tester sandbox_ops.practice_testers%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_event public.golf_registration_events%ROWTYPE;
  v_master public.events%ROWTYPE;
  v_out public.golf_registration_events%ROWTYPE;
  v_master_out public.events%ROWTYPE;
  v_session text;
  v_allowed text[] := ARRAY[
    'name','course','dates','event_start_time','max_golfers','structure',
    'event_access','team_size','allow_team_name','allow_partial_team',
    'team_payment_mode','divisions_enabled','flights_enabled','division',
    'division_details','tournament_format','format_description','player_information'
  ];
  v_key text;
  v_d text;
  v_previous_date date;
  v_actual_date date;
  v_dates jsonb;
  v_max_golfers integer;
  v_team_size integer;
  v_div jsonb;
  v_divisions jsonb;
  v_settings jsonb;
  v_time time without time zone;
BEGIN
  -- Enforce the explicitly approved practice identity and active Auth session.
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
     OR (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
     OR auth.uid() IS NULL
     OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE)
     OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE role='eig_admin')
     OR EXISTS (SELECT 1 FROM public.profiles WHERE role='super_admin') THEN
    RAISE EXCEPTION 'Practice-only Sandbox validation failed' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_tester FROM sandbox_ops.practice_testers
  WHERE enabled AND tester_user_id=auth.uid();
  IF NOT FOUND OR v_tester.active_role NOT IN ('pilot','co_pilot') THEN
    RAISE EXCEPTION 'An active practice Pilot or Co-Pilot is required' USING ERRCODE='42501';
  END IF;
  v_session := auth.jwt()->>'session_id';
  IF v_session IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN auth.sessions s ON s.user_id=u.id AND s.id::text=v_session
    JOIN public.profiles p ON p.id=u.id
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until<=now())
      AND (s.not_after IS NULL OR s.not_after>now())
      AND p.role='user' AND p.account_status='active'
  ) THEN
    RAISE EXCEPTION 'Verified active Sandbox login required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_org FROM public.organizations
  WHERE id=v_tester.practice_organization_id AND is_test IS TRUE
    AND slug <> 'elevated-impact-group' AND status='active';
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id=v_org.id
      AND m.user_id=auth.uid() AND m.status='active'
      AND m.role=CASE WHEN v_tester.active_role='pilot'
        THEN 'organization_admin' ELSE 'organization_staff' END
      AND (m.access_starts_at IS NULL OR m.access_starts_at<=now())
      AND (m.access_ends_at IS NULL OR m.access_ends_at>now())
  ) THEN
    RAISE EXCEPTION 'Active practice organization membership is required' USING ERRCODE='42501';
  END IF;

  -- Exact fixture, no real registration, never published.
  SELECT * INTO v_event FROM public.golf_registration_events
  WHERE id=p_event_id AND organization_id=v_org.id
    AND status='draft' AND field_settings->>'is_sandbox_fixture'='true'
    AND google_calendar_sync_enabled IS FALSE
  FOR UPDATE;
  IF NOT FOUND
    OR EXISTS (SELECT 1 FROM public.golf_registrations WHERE event_id=p_event_id)
    OR (SELECT count(*) FROM public.golf_registration_events
        WHERE organization_id=v_org.id AND status='published') <> 0
  THEN
    RAISE EXCEPTION 'Only the empty, unpublished fictional practice event can be edited'
      USING ERRCODE='42501';
  END IF;
  IF p_expected_updated_at IS NULL
     OR v_event.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The practice event changed since it was opened. Reload before saving.'
      USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_master FROM public.events
  WHERE id=v_event.master_event_id AND organization_id=v_org.id
    AND status='pending_review' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching unpublished master event is required' USING ERRCODE='42501';
  END IF;

  -- Explicit allowlist plus length/type checks. Never accept status, org ID,
  -- created_by, access role, payment settings, provider settings or test flags.
  IF p_details IS NULL OR jsonb_typeof(p_details)<>'object'
     OR octet_length(p_details::text)>20000 THEN
    RAISE EXCEPTION 'Invalid Event Details payload' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_details) AS k(key)
    WHERE NOT (k.key=ANY(v_allowed))
  ) OR (SELECT count(*) FROM jsonb_object_keys(p_details)) <> array_length(v_allowed,1) THEN
    RAISE EXCEPTION 'Unexpected or missing Event Details fields' USING ERRCODE='22023';
  END IF;
  FOREACH v_key IN ARRAY ARRAY[
    'name','course','event_access','structure','team_payment_mode','division',
    'tournament_format','format_description','player_information'
  ] LOOP
    IF jsonb_typeof(p_details->v_key) IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid text field: %',v_key USING ERRCODE='22023';
    END IF;
  END LOOP;
  FOR v_key IN SELECT unnest(ARRAY[
    'allow_team_name','allow_partial_team','divisions_enabled','flights_enabled'
  ]) LOOP
    IF jsonb_typeof(p_details->v_key) IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Invalid boolean field: %',v_key USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF length(btrim(p_details->>'name')) NOT BETWEEN 1 AND 160
    OR length(p_details->>'course')>160
    OR length(p_details->>'tournament_format')>150
    OR length(p_details->>'format_description')>2500
    OR length(p_details->>'player_information')>4000
    OR (p_details->>'structure') NOT IN ('individual','team')
    OR (p_details->>'event_access') NOT IN ('public','members_only')
    OR (p_details->>'team_payment_mode') NOT IN ('captain_all','split_equal','each_player')
    OR (p_details->>'division') NOT IN ('required','optional','hidden') THEN
    RAISE EXCEPTION 'Invalid Event Details value' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_details->'team_size') IS DISTINCT FROM 'number'
    OR (p_details->>'team_size') !~ '^[0-9]{1,2}$'
    OR (p_details->>'team_size')::integer NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Invalid team size' USING ERRCODE='22023';
  END IF;
  v_team_size:=(p_details->>'team_size')::integer;
  IF (p_details->>'structure'='team' AND v_team_size<2)
    OR (p_details->>'structure'='individual' AND v_team_size<>1) THEN
    RAISE EXCEPTION 'Team size does not match event structure' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_details->'max_golfers') NOT IN ('null','number') THEN
    RAISE EXCEPTION 'Invalid maximum participant type' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_details->'max_golfers')='number' THEN
    IF (p_details->>'max_golfers') !~ '^[1-9][0-9]{0,3}$'
       OR (p_details->>'max_golfers')::integer>2000
       OR (p_details->>'max_golfers')::integer<v_team_size THEN
      RAISE EXCEPTION 'Invalid maximum participants' USING ERRCODE='22023';
    END IF;
    v_max_golfers:=(p_details->>'max_golfers')::integer;
  END IF;

  IF jsonb_typeof(p_details->'dates')<>'array'
     OR jsonb_array_length(p_details->'dates') NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'One or two valid event dates required' USING ERRCODE='22023';
  END IF;
  v_dates:=p_details->'dates';
  FOR v_d IN SELECT elem#>>'{}' FROM jsonb_array_elements(v_dates) t(elem) LOOP
    IF v_d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Use ISO-8601 event dates' USING ERRCODE='22023';
    END IF;
    BEGIN
      v_actual_date:=v_d::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid calendar date' USING ERRCODE='22023';
    END;
    IF v_actual_date NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
       OR (v_previous_date IS NOT NULL AND v_actual_date<=v_previous_date) THEN
      RAISE EXCEPTION 'Event dates must be distinct and in ascending order'
        USING ERRCODE='22023';
    END IF;
    v_previous_date:=v_actual_date;
  END LOOP;

  IF jsonb_typeof(p_details->'event_start_time') NOT IN ('null','string') THEN
    RAISE EXCEPTION 'Invalid start-time type' USING ERRCODE='22023';
  END IF;
  IF nullif(p_details->>'event_start_time','') IS NOT NULL THEN
    IF p_details->>'event_start_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'Invalid start time' USING ERRCODE='22023';
    END IF;
    v_time:=(p_details->>'event_start_time')::time;
  END IF;

  IF jsonb_typeof(p_details->'division_details')<>'array'
     OR jsonb_array_length(p_details->'division_details')>20
     OR (p_details->>'divisions_enabled')::boolean IS TRUE
       AND jsonb_array_length(p_details->'division_details')=0 THEN
    RAISE EXCEPTION 'Invalid division configuration' USING ERRCODE='22023';
  END IF;
  FOR v_div IN SELECT value FROM jsonb_array_elements(p_details->'division_details') LOOP
    IF jsonb_typeof(v_div)<>'object'
       OR (v_div - ARRAY['name','eligibility','description']) <> '{}'::jsonb
       OR jsonb_typeof(v_div->'name')<>'string'
       OR jsonb_typeof(v_div->'eligibility')<>'string'
       OR jsonb_typeof(v_div->'description')<>'string'
       OR length(btrim(v_div->>'name')) NOT BETWEEN 1 AND 80
       OR length(v_div->>'eligibility')>200
       OR length(v_div->>'description')>500 THEN
      RAISE EXCEPTION 'Invalid division detail' USING ERRCODE='22023';
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(value->>'name' ORDER BY ord),'[]'::jsonb)
   INTO v_divisions
   FROM jsonb_array_elements(p_details->'division_details') WITH ORDINALITY AS x(value,ord);
  IF jsonb_array_length(v_divisions) <>
     (SELECT count(DISTINCT lower(value)) FROM jsonb_array_elements_text(v_divisions) AS x(value)) THEN
    RAISE EXCEPTION 'Duplicate divisions are not allowed' USING ERRCODE='22023';
  END IF;

  v_settings:=v_event.field_settings || jsonb_build_object(
    'event_start_time',CASE WHEN v_time IS NULL THEN NULL ELSE to_char(v_time,'HH24:MI') END,
    'max_golfers',v_max_golfers,
    'registration_format',p_details->>'structure',
    'event_access',p_details->>'event_access',
    'team_size',v_team_size,
    'allow_team_name',CASE WHEN p_details->>'structure'='team' THEN (p_details->>'allow_team_name')::boolean ELSE false END,
    'allow_partial_team',CASE WHEN p_details->>'structure'='team' THEN (p_details->>'allow_partial_team')::boolean ELSE false END,
    'team_payment_mode',CASE WHEN p_details->>'structure'='team' THEN p_details->>'team_payment_mode' ELSE 'captain_all' END,
    'divisions_enabled',(p_details->>'divisions_enabled')::boolean,
    'flights_enabled',(p_details->>'flights_enabled')::boolean,
    'division',CASE WHEN (p_details->>'divisions_enabled')::boolean THEN p_details->>'division' ELSE 'hidden' END,
    'division_details',p_details->'division_details',
    'tournament_format',p_details->>'tournament_format',
    'format_description',p_details->>'format_description',
    'player_information',p_details->>'player_information',
    'event_details_status','configured'
  );

  UPDATE public.golf_registration_events e
  SET name=btrim(p_details->>'name'),course=nullif(btrim(p_details->>'course'),''),
      event_dates=v_dates,divisions=v_divisions,field_settings=v_settings,
      google_calendar_sync_enabled=false,google_calendar_sync_status='not_synced'
  WHERE e.id=v_event.id AND e.status='draft'
    AND e.organization_id=v_org.id
    AND e.updated_at=p_expected_updated_at
  RETURNING * INTO v_out;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event changed while saving' USING ERRCODE='40001';
  END IF;
  UPDATE public.events m
  SET name=btrim(p_details->>'name'),
      date=(v_dates->>0)::date,event_date=(v_dates->>0)::date,
      start_time=v_time,location=nullif(btrim(p_details->>'course'),''),
      max_golfers=v_max_golfers
  WHERE m.id=v_master.id AND m.organization_id=v_org.id
    AND m.status='pending_review'
  RETURNING * INTO v_master_out;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Master event changed while saving' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object(
    'event',to_jsonb(v_out),
    'master',jsonb_build_object('id',v_master_out.id,
      'max_golfers',v_master_out.max_golfers,
      'start_time',v_master_out.start_time),
    'preview_only',true
  );
END;
$body$;

-- Do not expose a privileged procedure directly through the Data API.
REVOKE ALL ON FUNCTION sandbox_ops.save_practice_event_details(uuid,timestamptz,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA sandbox_ops TO authenticated;
GRANT EXECUTE ON FUNCTION sandbox_ops.save_practice_event_details(uuid,timestamptz,jsonb)
  TO authenticated;

-- Public invoker facade delegates to the strictly-scoped private function.
CREATE FUNCTION public.sandbox_save_practice_event_details(
  p_event_id uuid,
  p_expected_updated_at timestamptz,
  p_details jsonb
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $facade$
  SELECT sandbox_ops.save_practice_event_details(
    p_event_id,p_expected_updated_at,p_details
  );
$facade$;
REVOKE ALL ON FUNCTION public.sandbox_save_practice_event_details(uuid,timestamptz,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_save_practice_event_details(uuid,timestamptz,jsonb)
  TO authenticated;
