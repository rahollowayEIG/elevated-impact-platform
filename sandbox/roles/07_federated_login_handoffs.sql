-- OPERATOR-ONLY SANDBOX SQL; depends on 06_federated_identity_bindings.sql.
-- Target ONLY ElevationPilot-Sandbox, ref publruuuyvpggogrrgwp.
-- Never run on Live. No auth users, passwords, permissions, or live data copied.
-- This is NOT part of the production migration directory.
BEGIN;

DO $sandbox_only$
BEGIN
  IF to_regclass('sandbox_ops.federated_login_bindings') IS NULL
     OR to_regclass('sandbox_ops.practice_testers') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.organizations
                    WHERE slug = 'sandbox-practice-club' AND is_test IS TRUE)
     OR EXISTS (SELECT 1 FROM public.organizations
                WHERE is_test IS DISTINCT FROM TRUE)
  THEN
    RAISE EXCEPTION 'Handoff installation refused outside an isolated, fictional Sandbox';
  END IF;
END
$sandbox_only$;

CREATE TABLE IF NOT EXISTS sandbox_ops.federated_login_handoffs (
  handoff_hash text PRIMARY KEY CHECK (handoff_hash ~ '^[a-f0-9]{64}$'),
  live_issuer text NOT NULL,
  live_subject uuid NOT NULL,
  sandbox_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 seconds'),
  consumed_at timestamptz,
  CONSTRAINT handoff_known_live_identity FOREIGN KEY (live_issuer, live_subject)
    REFERENCES sandbox_ops.federated_login_bindings(live_issuer, live_subject)
    ON DELETE CASCADE,
  CONSTRAINT handoff_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS federated_handoffs_expiry_idx
  ON sandbox_ops.federated_login_handoffs(expires_at);

ALTER TABLE sandbox_ops.federated_login_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sandbox_ops.federated_login_handoffs FROM PUBLIC, anon, authenticated;

-- Server-only operation, after Live OIDC signature/audience/nonce verification.
-- The server supplies a SHA-256 digest of a random bearer nonce, not the nonce.
CREATE OR REPLACE FUNCTION public.sandbox_issue_federated_handoff(
  p_live_issuer text,
  p_live_subject uuid,
  p_verified_email text,
  p_handoff_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_binding jsonb;
  v_user_id uuid;
  v_inserted integer;
BEGIN
  IF p_handoff_hash IS NULL OR p_handoff_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN jsonb_build_object('created', false);
  END IF;
  SELECT public.sandbox_resolve_federated_identity(
    p_live_issuer, p_live_subject, p_verified_email
  ) INTO v_binding;
  IF v_binding->>'authorized' IS DISTINCT FROM 'true'
  THEN
    RETURN jsonb_build_object('created', false);
  END IF;
  v_user_id := (v_binding->>'sandbox_user_id')::uuid;

  -- Bound to the mapped and approved user, not a submitted browser email.
  INSERT INTO sandbox_ops.federated_login_handoffs(
    handoff_hash, live_issuer, live_subject, sandbox_user_id
  ) VALUES (
    p_handoff_hash, p_live_issuer, p_live_subject, v_user_id
  ) ON CONFLICT (handoff_hash) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('created', v_inserted = 1);
END
$function$;

REVOKE ALL ON FUNCTION public.sandbox_issue_federated_handoff(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_issue_federated_handoff(text, uuid, text, text)
  TO service_role;

-- Atomic single-use claim. Repeated browser posts or simultaneous requests
-- cannot mint a second session with the same nonce.
CREATE OR REPLACE FUNCTION public.sandbox_consume_federated_handoff(
  p_handoff_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_handoff record;
  v_binding jsonb;
  v_email text;
BEGIN
  IF p_handoff_hash IS NULL OR p_handoff_hash !~ '^[a-f0-9]{64}$'
  THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  UPDATE sandbox_ops.federated_login_handoffs h
     SET consumed_at = clock_timestamp()
   WHERE h.handoff_hash = p_handoff_hash
     AND h.consumed_at IS NULL
     AND h.expires_at > clock_timestamp()
  RETURNING h.live_issuer, h.live_subject, h.sandbox_user_id
       INTO v_handoff;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  SELECT lower(u.email) INTO v_email
    FROM auth.users u
   WHERE u.id = v_handoff.sandbox_user_id
     AND u.email_confirmed_at IS NOT NULL
     AND u.deleted_at IS NULL;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  SELECT public.sandbox_resolve_federated_identity(
    v_handoff.live_issuer, v_handoff.live_subject, v_email
  ) INTO v_binding;

  IF v_binding->>'authorized' IS DISTINCT FROM 'true'
     OR v_binding->>'sandbox_user_id'
        IS DISTINCT FROM v_handoff.sandbox_user_id::text
  THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  RETURN jsonb_build_object('authorized', true,
    'sandbox_user_id', v_handoff.sandbox_user_id,
    'email', v_email);
END
$function$;

REVOKE ALL ON FUNCTION public.sandbox_consume_federated_handoff(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_consume_federated_handoff(text)
  TO service_role;

COMMIT;
