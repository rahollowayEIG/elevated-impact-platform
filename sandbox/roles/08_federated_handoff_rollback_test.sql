-- SANDBOX-ONLY / ROLLBACK-ONLY integration test.
-- Requires migrations 06 and 07 in the same transaction or already installed.
-- NEVER run against Live ref aszixzrdayrivungodwq.
-- Seeds no real email, writes no lasting Auth users, and sends no notifications.
BEGIN;
DO $sandbox_guard$
BEGIN
  IF to_regclass('sandbox_ops.federated_login_bindings') IS NULL
     OR to_regclass('sandbox_ops.federated_login_handoffs') IS NULL
     OR NOT EXISTS(SELECT 1 FROM public.organizations
                   WHERE slug='sandbox-practice-club' AND is_test IS TRUE)
     OR EXISTS(SELECT 1 FROM public.organizations
               WHERE is_test IS DISTINCT FROM TRUE)
  THEN
    RAISE EXCEPTION 'This is not the isolated Sandbox with SSO test schema';
  END IF;
END
$sandbox_guard$;

DO $setup$
DECLARE
  v_sandbox_id uuid := gen_random_uuid();
  v_live_sub uuid := gen_random_uuid();
  v_org uuid;
BEGIN
  SELECT id INTO STRICT v_org FROM public.organizations
    WHERE slug='sandbox-practice-club' AND is_test IS TRUE;
  PERFORM set_config('sandbox.sso.sandbox_id',v_sandbox_id::text,true);
  PERFORM set_config('sandbox.sso.live_sub',v_live_sub::text,true);
  INSERT INTO auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at)
    VALUES(v_sandbox_id,'authenticated','authenticated',
           'fixture-sso-login@example.invalid',now(),now(),now());
  INSERT INTO sandbox_ops.practice_testers
    (tester_user_id,practice_organization_id,allowed_roles,active_role,enabled)
    VALUES(v_sandbox_id,v_org,ARRAY['passenger','pilot']::text[],'passenger',true);
  INSERT INTO sandbox_ops.federated_login_bindings
    (live_issuer,live_subject,sandbox_user_id,enabled)
    VALUES('https://aszixzrdayrivungodwq.supabase.co/auth/v1',
           v_live_sub,v_sandbox_id,true);
END
$setup$;

DO $check$
DECLARE
  v_live_sub uuid := current_setting('sandbox.sso.live_sub')::uuid;
  v_sandbox_id uuid := current_setting('sandbox.sso.sandbox_id')::uuid;
  v_issuer text := 'https://aszixzrdayrivungodwq.supabase.co/auth/v1';
  v_email text := 'fixture-sso-login@example.invalid';
  v_result jsonb;
BEGIN
  v_result := public.sandbox_resolve_federated_identity(v_issuer,v_live_sub,v_email);
  IF v_result->>'authorized' <> 'true'
     OR v_result->>'sandbox_user_id' <> v_sandbox_id::text THEN
    RAISE EXCEPTION 'Approved identity should map to the independent Sandbox user';
  END IF;

  v_result := public.sandbox_resolve_federated_identity('https://wrong.invalid',v_live_sub,v_email);
  IF v_result->>'authorized' <> 'false' THEN
    RAISE EXCEPTION 'Wrong Live issuer was approved';
  END IF;
  v_result := public.sandbox_resolve_federated_identity(v_issuer,gen_random_uuid(),v_email);
  IF v_result->>'authorized' <> 'false' THEN
    RAISE EXCEPTION 'Unknown Live subject was approved';
  END IF;
  v_result := public.sandbox_resolve_federated_identity(v_issuer,v_live_sub,'other@example.invalid');
  IF v_result->>'authorized' <> 'false' THEN
    RAISE EXCEPTION 'Wrong verified email was approved';
  END IF;

  v_result := public.sandbox_issue_federated_handoff(v_issuer,v_live_sub,v_email,repeat('1',64));
  IF v_result->>'created' <> 'true' THEN
    RAISE EXCEPTION 'Approved handoff was not issued';
  END IF;
  v_result := public.sandbox_issue_federated_handoff(v_issuer,v_live_sub,v_email,repeat('1',64));
  IF v_result->>'created' <> 'false' THEN
    RAISE EXCEPTION 'Duplicate handoff was issued';
  END IF;
  v_result := public.sandbox_consume_federated_handoff(repeat('1',64));
  IF v_result->>'authorized' <> 'true'
     OR v_result->>'sandbox_user_id' <> v_sandbox_id::text THEN
    RAISE EXCEPTION 'First one-time handoff should authorize the expected Sandbox identity';
  END IF;
  v_result := public.sandbox_consume_federated_handoff(repeat('1',64));
  IF v_result->>'authorized' <> 'false' THEN
    RAISE EXCEPTION 'Consumed handoff replay was authorized';
  END IF;

  UPDATE sandbox_ops.federated_login_bindings SET enabled=false
    WHERE live_issuer=v_issuer AND live_subject=v_live_sub;
  v_result := public.sandbox_issue_federated_handoff(v_issuer,v_live_sub,v_email,repeat('2',64));
  IF v_result->>'created' <> 'false' THEN
    RAISE EXCEPTION 'Revoked identity was issued a new handoff';
  END IF;
  UPDATE sandbox_ops.federated_login_bindings SET enabled=true
    WHERE live_issuer=v_issuer AND live_subject=v_live_sub;
  v_result := public.sandbox_issue_federated_handoff(v_issuer,v_live_sub,v_email,repeat('3',64));
  IF v_result->>'created' <> 'true' THEN
    RAISE EXCEPTION 'Enabled identity could not stage a handoff';
  END IF;
  UPDATE sandbox_ops.practice_testers SET enabled=false
    WHERE tester_user_id=v_sandbox_id;
  v_result := public.sandbox_consume_federated_handoff(repeat('3',64));
  IF v_result->>'authorized' <> 'false' THEN
    RAISE EXCEPTION 'Revoked practice user was allowed to consume handoff';
  END IF;
END
$check$;

-- Functions must never be executable by an ordinary signed-in browser client.
SET LOCAL ROLE authenticated;
DO $deny_client$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.sandbox_consume_federated_handoff(repeat('9',64));
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Browser authenticated role can call protected handoff RPC';
  END IF;
END
$deny_client$;
RESET ROLE;

ROLLBACK;
-- After rollback, no synthetic account, binding, or handoff persists.
SELECT (SELECT count(*) FROM auth.users) AS persisted_auth_users,
       (SELECT count(*) FROM sandbox_ops.practice_testers) AS persisted_testers;
