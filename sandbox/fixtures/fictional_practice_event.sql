-- SANDBOX ONLY: one fictional practice organization and unpublished event.
-- Do not run against production. This fixture never includes live users, credentials, or payment data.
-- All email addresses use the reserved .example domain. No outbound delivery permitted.
DO $sandbox_fixture$
DECLARE
  v_org uuid;
  v_event uuid;
  v_golf_event uuid;
  v_contact uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'sandbox-practice-club') THEN
    RAISE EXCEPTION 'Sandbox practice fixture already exists';
  END IF;

  INSERT INTO public.organizations (name, slug, organization_type, is_test)
  VALUES ('ElevationPilot Fictional Demo Club','sandbox-practice-club','business',true)
  RETURNING id INTO v_org;

  INSERT INTO public.events (
    organization_id, name, slug, description, event_type, location, event_date,
    max_golfers, registration_status, is_published, status
  ) VALUES (
    v_org, 'Practice Scramble Showcase', 'sandbox-practice-scramble',
    'Fictional training event. Not accepting actual registrations.',
    'Golf Outing', 'Fictional Fairways Practice Course', DATE '2027-05-01',
    36, 'draft', false, 'pending_review'
  ) RETURNING id INTO v_event;

  INSERT INTO public.golf_event_setup (
    event_key, tournament_format, format_description, division_details, itinerary
  ) VALUES (
    'sandbox-practice-scramble', 'Four-Player Scramble',
    'Fictional four-player team scramble for testing.',
    '[{"name":"Open"},{"name":"Mixed"}]'::jsonb,
    '[]'::jsonb
  );

  INSERT INTO public.golf_registration_events (
    organization_id, master_event_id, event_key, name, course, event_dates,
    member_price, non_member_price, field_settings, status, public_slug
  ) VALUES (
    v_org, v_event, 'sandbox-practice-scramble', 'Practice Scramble Showcase',
    'Fictional Fairways Practice Course',
    '[{"date":"2027-05-01"}]'::jsonb,480,480,
    '{"is_sandbox_fixture":true,"team_size":4}'::jsonb,
    'draft','sandbox-practice-scramble'
  ) RETURNING id INTO v_golf_event;

  INSERT INTO public.registration_types (
    event_id, name, description, registration_kind, team_size, price, quantity_available
  ) VALUES (
    v_event, 'Fictional Four-Player Team','Sandbox test registration only',
    'team',4,480,9
  );

  INSERT INTO public.event_offers (
    organization_id, master_event_id, golf_event_id, name, description,
    offer_type, price, charge_by, status, visibility
  ) VALUES (
    v_org, v_event, v_golf_event,'Demo Team Package',
    'Sandbox-only team registration package', 'registration',480,
    'team','draft','internal'
  );

  INSERT INTO public.contacts (
    organization_id,first_name,last_name,email,contact_type,source
  ) VALUES (
    v_org,'Sample','Coordinator','coordinator@practice.example',
    'organizer','sandbox_fixture'
  ) RETURNING id INTO v_contact;

  INSERT INTO public.event_requests (
    organization_id,event_id,coordinator_contact_id,request_type,title,status,
    event_name,event_type,preferred_date,estimated_participants,
    contact_full_name,contact_email,requested_details
  ) VALUES (
    v_org,v_event,v_contact,'event_inquiry','Fictional Practice Event Inquiry','submitted',
    'Practice Scramble Showcase','Golf Outing',DATE '2027-05-01',36,
    'Sample Coordinator','coordinator@practice.example',
    '{"sandbox_demo":true}'::jsonb
  );
END
$sandbox_fixture$;
