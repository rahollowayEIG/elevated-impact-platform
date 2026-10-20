-- Sandbox ONLY, isolated project publruuuyvpggogrrgwp.
-- Stage for security review and transactional dry-run before application.
-- Atomic save for original Step 2 Registration Details, one fictional Draft
-- event, one verified active practice tester and Pilot/Co-Pilot role.
-- This records TEST settings. It never publishes, sends, charges or emails.
CREATE FUNCTION sandbox_ops.save_practice_registration_details(
  p_event_id uuid,
  p_expected_updated_at timestamptz,
  p_registration jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  v_tester sandbox_ops.practice_testers%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_event public.golf_registration_events%ROWTYPE;
  v_master public.events%ROWTYPE;
  v_out public.golf_registration_events%ROWTYPE;
  v_offer public.event_offers%ROWTYPE;
  v_pay public.golf_event_payment_settings%ROWTYPE;
  v_session text;
  v_fields text[] := ARRAY[
    'base_price','team_size','allow_team_name','allow_partial_team',
    'team_payment_mode','allow_split_team_payments',
    'registration_item_name','registration_description','registration_charge_by',
    'payment_hold_days','allow_online','allow_clubhouse','convenience_fee_type',
    'convenience_fee_value','allow_card_guarantee','clubhouse_payment_payee',
    'clubhouse_payment_location_name','clubhouse_payment_address',
    'clubhouse_payment_instructions','availability_start','availability_end',
    'registration_deadline','registration_deadline_utc',
    'registration_contact_name','registration_contact_email',
    'registration_contact_phone','dob','gender','division',
    'membership','ghin','custom_fields'
  ];
  v_text_fields text[] := ARRAY[
    'team_payment_mode','registration_item_name','registration_description',
    'registration_charge_by','convenience_fee_type','clubhouse_payment_payee',
    'clubhouse_payment_location_name','clubhouse_payment_address',
    'clubhouse_payment_instructions','availability_start','availability_end',
    'registration_deadline','registration_contact_name',
    'registration_contact_email','registration_contact_phone',
    'dob','gender','division','membership','ghin'
  ];
  v_bool_fields text[] := ARRAY[
    'allow_team_name','allow_partial_team','allow_split_team_payments',
    'allow_online','allow_clubhouse','allow_card_guarantee'
  ];
  v_f text;
  v_price numeric;
  v_fee numeric;
  v_team_size integer;
  v_hold_days integer;
  v_structure text;
  v_start timestamp;
  v_end timestamp;
  v_deadline timestamp;
  v_master_deadline timestamptz;
  v_q jsonb;
  v_opt jsonb;
  v_answer_ids text[] := ARRAY[]::text[];
  v_settings jsonb;
  v_active_count integer;
  v_draft_count integer;
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
     OR (SELECT count(*) FROM sandbox_ops.practice_testers WHERE enabled) <> 1
     OR auth.uid() IS NULL
     OR EXISTS (SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE)
     OR EXISTS (SELECT 1 FROM public.organization_memberships WHERE role='eig_admin')
     OR EXISTS (SELECT 1 FROM public.profiles WHERE role='super_admin')
     OR EXISTS (SELECT 1 FROM public.golf_registration_events WHERE status='published')
  THEN RAISE EXCEPTION 'Isolated fictional Sandbox required' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_tester FROM sandbox_ops.practice_testers
  WHERE enabled AND tester_user_id=auth.uid();
  IF NOT FOUND OR v_tester.active_role NOT IN ('pilot','co_pilot') THEN
    RAISE EXCEPTION 'Active Pilot or Co-Pilot required for practice Registration Details'
      USING ERRCODE='42501';
  END IF;
  v_session:=auth.jwt()->>'session_id';
  IF v_session IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN auth.sessions s ON s.user_id=u.id AND s.id::text=v_session
    JOIN public.profiles p ON p.id=u.id
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until<=now())
      AND (s.not_after IS NULL OR s.not_after>now())
      AND p.role='user' AND p.account_status='active'
  ) THEN RAISE EXCEPTION 'Verified active Sandbox login required' USING ERRCODE='42501'; END IF;
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
  ) THEN RAISE EXCEPTION 'Active practice organization membership required'
    USING ERRCODE='42501'; END IF;

  SELECT * INTO v_event FROM public.golf_registration_events e
  WHERE e.id=p_event_id AND e.organization_id=v_org.id AND e.status='draft'
    AND e.field_settings->>'is_sandbox_fixture'='true'
    AND e.field_settings->>'event_details_status'='configured'
    AND e.google_calendar_sync_enabled IS FALSE
  FOR UPDATE;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.golf_registrations r WHERE r.event_id=p_event_id
  ) THEN RAISE EXCEPTION 'Only the configured empty Draft practice event can be edited'
    USING ERRCODE='42501'; END IF;
  IF p_expected_updated_at IS NULL
     OR v_event.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'The practice registration changed. Reload before saving.'
      USING ERRCODE='40001';
  END IF;
  SELECT * INTO v_master FROM public.events m
  WHERE m.id=v_event.master_event_id AND m.organization_id=v_org.id
    AND m.status='pending_review' AND m.is_published IS FALSE
    AND m.registration_status IN ('draft','closed')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The master event must remain unpublished and closed'
    USING ERRCODE='42501'; END IF;

  -- Every client key must be understood, required, typed and bounded.
  IF p_registration IS NULL OR jsonb_typeof(p_registration)<>'object'
    OR octet_length(p_registration::text)>18000
    OR (SELECT count(*) FROM jsonb_object_keys(p_registration))<>array_length(v_fields,1)
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_registration) j(k)
      WHERE NOT (j.k=ANY(v_fields))
    )
  THEN RAISE EXCEPTION 'Unknown or incomplete Registration Details fields'
    USING ERRCODE='22023'; END IF;

  FOREACH v_f IN ARRAY v_text_fields LOOP
    IF jsonb_typeof(p_registration->v_f) IS DISTINCT FROM 'string'
    THEN RAISE EXCEPTION 'Invalid Registration Details string: %',v_f USING ERRCODE='22023'; END IF;
  END LOOP;
  FOREACH v_f IN ARRAY v_bool_fields LOOP
    IF jsonb_typeof(p_registration->v_f) IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'Invalid Registration Details boolean: %',v_f USING ERRCODE='22023'; END IF;
  END LOOP;

  v_structure:=v_event.field_settings->>'registration_format';
  IF v_structure NOT IN ('team','individual')
    OR jsonb_typeof(p_registration->'team_size')<>'number'
    OR (p_registration->>'team_size') !~ '^[0-9]{1,2}$'
  THEN RAISE EXCEPTION 'Missing supported event structure/team size' USING ERRCODE='22023'; END IF;
  v_team_size:=(p_registration->>'team_size')::integer;
  IF (v_structure='team' AND v_team_size NOT BETWEEN 2 AND 12)
    OR (v_structure='individual' AND v_team_size<>1)
    OR v_team_size>coalesce((v_event.field_settings->>'max_golfers')::integer,2000)
  THEN RAISE EXCEPTION 'Team size exceeds event limits' USING ERRCODE='22023'; END IF;
  IF (p_registration->>'team_payment_mode') NOT IN ('captain_all','split_equal','each_player')
    OR (v_structure='individual' AND
      (p_registration->>'team_payment_mode'<>'captain_all'
        OR (p_registration->>'allow_split_team_payments')::boolean))
    OR ((p_registration->>'team_payment_mode')<>'captain_all'
      AND NOT (p_registration->>'allow_split_team_payments')::boolean)
    OR (p_registration->>'registration_charge_by') NOT IN ('player','team','order','flat')
    OR length(btrim(p_registration->>'registration_item_name')) NOT BETWEEN 1 AND 140
    OR length(p_registration->>'registration_description')>800
  THEN RAISE EXCEPTION 'Invalid team payment or registration item settings'
    USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_registration->'base_price')<>'number'
    OR (p_registration->>'base_price') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$'
  THEN RAISE EXCEPTION 'Base registration price must be a nonnegative two-decimal amount'
    USING ERRCODE='22023'; END IF;
  v_price:=(p_registration->>'base_price')::numeric;
  IF v_price>100000 THEN RAISE EXCEPTION 'Base registration price exceeds demo limit'
    USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_registration->'payment_hold_days')<>'number'
     OR (p_registration->>'payment_hold_days') !~ '^[0-9]{1,3}$'
  THEN RAISE EXCEPTION 'Invalid clubhouse payment hold' USING ERRCODE='22023'; END IF;
  v_hold_days:=(p_registration->>'payment_hold_days')::integer;
  IF v_hold_days NOT BETWEEN 1 AND 365 THEN RAISE EXCEPTION 'Payment hold must be 1-365 days'
    USING ERRCODE='22023'; END IF;
  IF (p_registration->>'convenience_fee_type') NOT IN ('none','percent','flat')
    OR jsonb_typeof(p_registration->'convenience_fee_value')<>'number'
    OR (p_registration->>'convenience_fee_value') !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$'
  THEN RAISE EXCEPTION 'Invalid convenience fee settings' USING ERRCODE='22023'; END IF;
  v_fee:=(p_registration->>'convenience_fee_value')::numeric;
  IF v_fee>10000 OR (p_registration->>'convenience_fee_type'='percent' AND v_fee>100)
  THEN RAISE EXCEPTION 'Convenience fee exceeds permitted limits' USING ERRCODE='22023'; END IF;

  IF length(p_registration->>'clubhouse_payment_payee')>160
    OR length(p_registration->>'clubhouse_payment_location_name')>160
    OR length(p_registration->>'clubhouse_payment_address')>350
    OR length(p_registration->>'clubhouse_payment_instructions')>1500
    OR length(p_registration->>'registration_contact_name')>160
    OR length(p_registration->>'registration_contact_email')>254
    OR length(p_registration->>'registration_contact_phone')>50
  THEN RAISE EXCEPTION 'A registration contact field is too long' USING ERRCODE='22023'; END IF;
  IF p_registration->>'registration_contact_email'<>''
    AND p_registration->>'registration_contact_email' !~
      '^[A-Za-z0-9_.+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  THEN RAISE EXCEPTION 'Invalid registration contact email' USING ERRCODE='22023'; END IF;

  FOR v_f IN SELECT unnest(ARRAY['dob','gender','division','membership','ghin']) LOOP
    IF (p_registration->>v_f) NOT IN ('required','optional','hidden')
    THEN RAISE EXCEPTION 'Invalid golfer information requirement: %',v_f USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (v_event.field_settings->>'divisions_enabled')<>'true'
    AND (p_registration->>'division')<>'hidden'
  THEN RAISE EXCEPTION 'Division requirement must follow Event Details'
    USING ERRCODE='22023'; END IF;
  IF (v_event.field_settings->>'event_access')='members_only'
    AND (p_registration->>'membership')<>'hidden'
  THEN RAISE EXCEPTION 'Membership field must match event audience' USING ERRCODE='22023'; END IF;

  -- Input datetime-local values are stored as local wall-clock strings to
  -- match existing original EIE UI semantics; ISO UTC is supplied separately
  -- for the linked master-event deadline (no hardcoded course timezone).
  FOR v_f IN SELECT unnest(ARRAY['availability_start','availability_end','registration_deadline']) LOOP
    IF p_registration->>v_f<>'' THEN
      IF (p_registration->>v_f) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]$'
      THEN RAISE EXCEPTION 'Use a valid local registration datetime for %',v_f
        USING ERRCODE='22023'; END IF;
      BEGIN
        PERFORM (p_registration->>v_f)::timestamp;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'Invalid calendar date for %',v_f USING ERRCODE='22023';
      END;
    END IF;
  END LOOP;
  v_start:=nullif(p_registration->>'availability_start','')::timestamp;
  v_end:=nullif(p_registration->>'availability_end','')::timestamp;
  v_deadline:=nullif(p_registration->>'registration_deadline','')::timestamp;
  IF (v_start IS NOT NULL AND v_end IS NOT NULL AND v_start>v_end)
    OR (v_end IS NOT NULL AND v_deadline IS NOT NULL AND v_end>v_deadline)
    OR (v_start IS NOT NULL AND v_deadline IS NOT NULL AND v_start>v_deadline)
  THEN RAISE EXCEPTION 'Registration window dates are out of order' USING ERRCODE='22023'; END IF;
  IF v_deadline IS NULL AND jsonb_typeof(p_registration->'registration_deadline_utc')<>'null'
  THEN RAISE EXCEPTION 'Master deadline must be empty when no deadline is selected'
    USING ERRCODE='22023'; END IF;
  IF v_deadline IS NOT NULL THEN
    IF jsonb_typeof(p_registration->'registration_deadline_utc')<>'string'
      OR (p_registration->>'registration_deadline_utc') !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$'
    THEN RAISE EXCEPTION 'UTC deadline is missing or invalid' USING ERRCODE='22023'; END IF;
    BEGIN
      v_master_deadline:=(p_registration->>'registration_deadline_utc')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid UTC master deadline' USING ERRCODE='22023';
    END;
    IF abs(extract(epoch FROM (v_master_deadline AT TIME ZONE 'UTC') - v_deadline))>86400
    THEN RAISE EXCEPTION 'UTC deadline does not correspond to selected local day'
      USING ERRCODE='22023'; END IF;
  END IF;

  IF jsonb_typeof(p_registration->'custom_fields')<>'array'
    OR jsonb_array_length(p_registration->'custom_fields')>30
  THEN RAISE EXCEPTION 'Custom registration fields must be an array of 30 or fewer'
    USING ERRCODE='22023'; END IF;
  FOR v_q IN SELECT value FROM jsonb_array_elements(p_registration->'custom_fields') LOOP
    IF jsonb_typeof(v_q)<>'object'
      OR (v_q-ARRAY['id','label','type','required','options']) <> '{}'::jsonb
      OR jsonb_typeof(v_q->'id')<>'string'
      OR jsonb_typeof(v_q->'label')<>'string'
      OR jsonb_typeof(v_q->'type')<>'string'
      OR jsonb_typeof(v_q->'required')<>'boolean'
      OR jsonb_typeof(v_q->'options')<>'array'
    THEN RAISE EXCEPTION 'Invalid custom field schema' USING ERRCODE='22023'; END IF;
    IF (v_q->>'id') !~ '^[A-Za-z0-9_]{1,60}$'
      OR length(btrim(v_q->>'label')) NOT BETWEEN 1 AND 150
      OR (v_q->>'type') NOT IN
        ('text','textarea','number','date','email','phone','select','checkbox')
      OR (v_q->>'id')=ANY(v_answer_ids)
      OR jsonb_array_length(v_q->'options')>20
      OR ((v_q->>'type')='select' AND jsonb_array_length(v_q->'options')=0)
      OR ((v_q->>'type')<>'select' AND jsonb_array_length(v_q->'options')<>0)
    THEN RAISE EXCEPTION 'Invalid custom field values' USING ERRCODE='22023'; END IF;
    FOR v_opt IN SELECT value FROM jsonb_array_elements(v_q->'options') LOOP
      IF jsonb_typeof(v_opt)<>'string' OR length(btrim(v_opt#>>'{}')) NOT BETWEEN 1 AND 80
      THEN RAISE EXCEPTION 'Invalid custom dropdown choice' USING ERRCODE='22023'; END IF;
    END LOOP;
    v_answer_ids:=array_append(v_answer_ids,v_q->>'id');
  END LOOP;

  -- No externally reachable registration/publish state changes. Only event,
  -- one base registration offer, payment config and master deadline update.
  v_settings:=v_event.field_settings || jsonb_build_object(
    'team_size',v_team_size,
    'allow_team_name',CASE WHEN v_structure='team'
      THEN (p_registration->>'allow_team_name')::boolean ELSE false END,
    'allow_partial_team',CASE WHEN v_structure='team'
      THEN (p_registration->>'allow_partial_team')::boolean ELSE false END,
    'team_payment_mode',CASE WHEN v_structure='team'
      THEN p_registration->>'team_payment_mode' ELSE 'captain_all' END,
    'allow_split_team_payments',CASE WHEN v_structure='team'
      THEN (p_registration->>'allow_split_team_payments')::boolean ELSE false END,
    'registration_available_from_at',nullif(p_registration->>'availability_start',''),
    'registration_available_through_at',nullif(p_registration->>'availability_end',''),
    'registration_deadline_at',nullif(p_registration->>'registration_deadline',''),
    'registration_deadline',CASE WHEN v_deadline IS NULL THEN NULL
      ELSE to_char(v_deadline,'YYYY-MM-DD') END,
    'registration_contact_name',btrim(p_registration->>'registration_contact_name'),
    'registration_contact_email',btrim(p_registration->>'registration_contact_email'),
    'registration_contact_phone',btrim(p_registration->>'registration_contact_phone'),
    'dob',p_registration->>'dob',
    'gender',p_registration->>'gender',
    'division',CASE WHEN (v_event.field_settings->>'divisions_enabled')='true'
      THEN p_registration->>'division' ELSE 'hidden' END,
    'membership',CASE WHEN (v_event.field_settings->>'event_access')='members_only'
      THEN 'hidden' ELSE p_registration->>'membership' END,
    'ghin',p_registration->>'ghin',
    'custom_fields',p_registration->'custom_fields',
    'base_registration_price',v_price,
    'participant_fields_status','configured'
  );
  UPDATE public.golf_registration_events e SET
    member_price=v_price,non_member_price=v_price,field_settings=v_settings
  WHERE e.id=v_event.id AND e.organization_id=v_org.id AND e.status='draft'
    AND e.updated_at=p_expected_updated_at
  RETURNING * INTO v_out;
  IF NOT FOUND THEN RAISE EXCEPTION 'Practice event changed while saving'
    USING ERRCODE='40001'; END IF;
  UPDATE public.events m SET registration_deadline=v_master_deadline
  WHERE m.id=v_master.id AND m.organization_id=v_org.id
    AND m.status='pending_review' AND m.is_published IS FALSE
    AND m.registration_status IN ('draft','closed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Master event is not safe for practice setup'
    USING ERRCODE='42501'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_offers o WHERE o.golf_event_id=v_event.id
    AND (o.organization_id<>v_org.id OR o.master_event_id<>v_master.id)
  ) THEN RAISE EXCEPTION 'Practice offers have inconsistent ownership' USING ERRCODE='42501'; END IF;
  SELECT count(*) FILTER (WHERE status='active'),
    count(*) FILTER (WHERE status='draft')
  INTO v_active_count,v_draft_count FROM public.event_offers
  WHERE golf_event_id=v_event.id AND offer_type='registration';
  IF v_active_count>1 OR v_draft_count>1 THEN
    RAISE EXCEPTION 'Unexpected multiple base registration offers' USING ERRCODE='22023';
  END IF;
  IF v_active_count=1 THEN
    SELECT * INTO v_offer FROM public.event_offers
    WHERE golf_event_id=v_event.id AND offer_type='registration' AND status='active'
    ORDER BY sort_order,id LIMIT 1 FOR UPDATE;
  ELSIF v_draft_count=1 THEN
    -- The initial fictional fixture has one Draft team offer; reuse it rather
    -- than creating duplicate active registration offers.
    SELECT * INTO v_offer FROM public.event_offers
    WHERE golf_event_id=v_event.id AND offer_type='registration' AND status='draft'
    ORDER BY sort_order,id LIMIT 1 FOR UPDATE;
  END IF;
  IF v_offer.id IS NOT NULL THEN
    UPDATE public.event_offers o SET
      name=btrim(p_registration->>'registration_item_name'),
      description=nullif(btrim(p_registration->>'registration_description'),''),
      price=v_price,
      charge_by=p_registration->>'registration_charge_by',
      is_required=true,is_default=true,status='active',
      availability_start=v_start::date,availability_end=v_end::date,
      metadata=coalesce(o.metadata,'{}'::jsonb) ||
        '{"base_registration":true,"taxable":false,"sandbox_fixture":true}'::jsonb
    WHERE o.id=v_offer.id AND o.golf_event_id=v_event.id AND o.organization_id=v_org.id
    RETURNING * INTO v_offer;
  ELSE
    INSERT INTO public.event_offers (
      organization_id,master_event_id,golf_event_id,source_app,source_module,
      offer_type,name,description,price,charge_by,is_required,is_default,
      availability_start,availability_end,coupon_eligible,visibility,status,
      sort_order,metadata
    ) VALUES (
      v_org.id,v_master.id,v_event.id,'eie','registration_setup','registration',
      btrim(p_registration->>'registration_item_name'),
      coalesce(nullif(btrim(p_registration->>'registration_description'),''),'Base event registration'),
      v_price,p_registration->>'registration_charge_by',true,true,
      v_start::date,v_end::date,true,'public','active',0,
      '{"base_registration":true,"taxable":false,"sandbox_fixture":true}'::jsonb
    ) RETURNING * INTO v_offer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.golf_event_payment_settings s
    WHERE s.event_id=v_event.id AND s.organization_id<>v_org.id
  ) THEN RAISE EXCEPTION 'Practice payment settings have inconsistent ownership'
    USING ERRCODE='42501'; END IF;
  INSERT INTO public.golf_event_payment_settings(
    organization_id,event_id,price_mode,team_payment_mode,
    allow_online,allow_clubhouse,allow_split_team_payments,
    convenience_fee_type,convenience_fee_value,clubhouse_hold_mode,
    clubhouse_hold_days,allow_card_guarantee,auto_charge_at_deadline,
    reminders_enabled,clubhouse_payment_payee,clubhouse_payment_location_name,
    clubhouse_payment_address,clubhouse_payment_instructions
  ) VALUES (
    v_org.id,v_event.id,
    CASE WHEN v_structure='team' THEN 'per_team' ELSE 'per_player' END,
    CASE WHEN v_structure='team' AND
       (p_registration->>'team_payment_mode')<>'captain_all'
      THEN 'split' ELSE 'captain_all' END,
    (p_registration->>'allow_online')::boolean,
    (p_registration->>'allow_clubhouse')::boolean,
    CASE WHEN v_structure='team'
      THEN (p_registration->>'allow_split_team_payments')::boolean ELSE false END,
    p_registration->>'convenience_fee_type',
    CASE WHEN p_registration->>'convenience_fee_type'='none' THEN 0 ELSE v_fee END,
    'days',v_hold_days,(p_registration->>'allow_card_guarantee')::boolean,
    false,false,
    nullif(btrim(p_registration->>'clubhouse_payment_payee'),''),
    nullif(btrim(p_registration->>'clubhouse_payment_location_name'),''),
    nullif(btrim(p_registration->>'clubhouse_payment_address'),''),
    nullif(btrim(p_registration->>'clubhouse_payment_instructions'),'')
  )
  ON CONFLICT(event_id) DO UPDATE SET
    price_mode=excluded.price_mode,team_payment_mode=excluded.team_payment_mode,
    allow_online=excluded.allow_online,allow_clubhouse=excluded.allow_clubhouse,
    allow_split_team_payments=excluded.allow_split_team_payments,
    convenience_fee_type=excluded.convenience_fee_type,
    convenience_fee_value=excluded.convenience_fee_value,
    clubhouse_hold_mode='days',clubhouse_hold_days=excluded.clubhouse_hold_days,
    allow_card_guarantee=excluded.allow_card_guarantee,
    auto_charge_at_deadline=false,reminders_enabled=false,
    clubhouse_payment_payee=excluded.clubhouse_payment_payee,
    clubhouse_payment_location_name=excluded.clubhouse_payment_location_name,
    clubhouse_payment_address=excluded.clubhouse_payment_address,
    clubhouse_payment_instructions=excluded.clubhouse_payment_instructions
  RETURNING * INTO v_pay;

  RETURN jsonb_build_object(
    'event',to_jsonb(v_out),
    'base_offer',to_jsonb(v_offer),
    'payment',to_jsonb(v_pay),
    'preview_only',true
  );
END;
$body$;

-- Privileged database routine is kept in non-exposed sandbox_ops.
REVOKE ALL ON FUNCTION sandbox_ops.save_practice_registration_details(uuid,timestamptz,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sandbox_ops.save_practice_registration_details(uuid,timestamptz,jsonb)
  TO authenticated;

-- Only a tightly audited public invoker facade is callable from the app.
CREATE FUNCTION public.sandbox_save_practice_registration_details(
  p_event_id uuid,p_expected_updated_at timestamptz,p_registration jsonb
) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $facade$
  SELECT sandbox_ops.save_practice_registration_details(
    p_event_id,p_expected_updated_at,p_registration
  );
$facade$;
REVOKE ALL ON FUNCTION public.sandbox_save_practice_registration_details(uuid,timestamptz,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_save_practice_registration_details(uuid,timestamptz,jsonb)
  TO authenticated;
