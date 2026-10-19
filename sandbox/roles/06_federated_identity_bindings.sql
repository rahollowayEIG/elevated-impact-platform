-- OPTIONAL SANDBOX-ONLY SECURITY MIGRATION. REVIEW BEFORE APPLYING.
-- Target: ElevationPilot-Sandbox (Supabase ref publruuuyvpggogrrgwp).
-- NEVER run on Elevated-Impact-Platform Live (aszixzrdayrivungodwq).
-- Does not insert a user, password, Live token, mapping or practice membership.
--
-- Explicit enrollment workflow, separate operator action:
-- 1. Independently verify the user's existing Live issuer+sub identity.
-- 2. Provision an independent, confirmed Sandbox Auth technical user via Auth Admin.
-- 3. Approve that Sandbox Auth UUID in sandbox_ops.practice_testers.
-- 4. Independently approve the issuer+subject -> Sandbox UUID binding; enabled defaults FALSE.
--
-- No human-managed second password. No trusted-email-only account discovery.
BEGIN;

DO $sandbox_only$
BEGIN
  IF to_regclass('sandbox_ops.practice_testers') IS NULL
     OR NOT EXISTS (
        SELECT 1 FROM public.organizations
        WHERE slug = 'sandbox-practice-club' AND is_test IS TRUE
     )
     OR EXISTS (
        SELECT 1 FROM public.organizations WHERE is_test IS DISTINCT FROM TRUE
     )
     OR EXISTS (
        SELECT 1 FROM public.organization_memberships WHERE role = 'eig_admin'
     ) THEN
    RAISE EXCEPTION 'Federated login migration refused outside the isolated, fictional Sandbox';
  END IF;
END
$sandbox_only$;

CREATE TABLE IF NOT EXISTS sandbox_ops.federated_login_bindings (
  live_issuer text NOT NULL CHECK (
    live_issuer = 'https://aszixzrdayrivungodwq.supabase.co/auth/v1'
  ),
  live_subject uuid NOT NULL,
  sandbox_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (live_issuer, live_subject),
  CONSTRAINT federated_login_one_binding_per_sandbox_user UNIQUE (sandbox_user_id)
);

ALTER TABLE sandbox_ops.federated_login_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sandbox_ops.federated_login_bindings FROM PUBLIC, anon, authenticated;

-- Deliberately callable ONLY with a server-held service role credential.
-- The verification, client scopes and JWT signature checks happen in the
-- Sandbox callback BEFORE invoking this resolver. Never expose that key.
CREATE OR REPLACE FUNCTION public.sandbox_resolve_federated_identity(
  p_live_issuer text,
  p_live_subject uuid,
  p_verified_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sandbox_id uuid;
  v_email text;
BEGIN
  IF p_live_issuer IS DISTINCT FROM 'https://aszixzrdayrivungodwq.supabase.co/auth/v1'
     OR p_live_subject IS NULL
     OR p_verified_email IS NULL
     OR length(p_verified_email) > 254
     OR p_verified_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  SELECT u.id, lower(u.email) INTO v_sandbox_id, v_email
    FROM sandbox_ops.federated_login_bindings b
    JOIN auth.users u ON u.id = b.sandbox_user_id
    JOIN sandbox_ops.practice_testers t ON t.tester_user_id = u.id
    JOIN public.organizations o ON o.id = t.practice_organization_id
   WHERE b.live_issuer = p_live_issuer
     AND b.live_subject = p_live_subject
     AND b.enabled
     AND t.enabled
     AND lower(u.email) = lower(p_verified_email)
     AND u.email_confirmed_at IS NOT NULL
     AND u.deleted_at IS NULL
     AND o.slug = 'sandbox-practice-club'
     AND o.is_test IS TRUE
     AND o.status = 'active'
     AND t.active_role = ANY (t.allowed_roles)
     AND t.allowed_roles <@ ARRAY['pilot', 'co_pilot', 'atc', 'passenger']::text[]
     AND cardinality(t.allowed_roles) > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_memberships m
        WHERE m.user_id = u.id AND m.role = 'eig_admin'
     );

  IF v_sandbox_id IS NULL THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  -- Never return any password, Live identity token or role elevation.
  RETURN jsonb_build_object(
    'authorized', true,
    'sandbox_user_id', v_sandbox_id,
    'email', v_email
  );
END
$function$;

REVOKE ALL ON FUNCTION public.sandbox_resolve_federated_identity(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_resolve_federated_identity(text, uuid, text)
  TO service_role;

COMMIT;
