-- SANDBOX PROJECT ONLY: fictitious persona definitions, not authentication credentials.
-- This does not create Auth users, passwords, invitations, or send email.
CREATE TABLE sandbox_ops.demo_personas (
  persona_key text primary key
    CHECK (persona_key IN ('eig_admin','pilot','co_pilot','atc','passenger')),
  display_name text NOT NULL,
  email text NOT NULL UNIQUE
    CHECK (email ~ '^[a-z0-9._+-]+@sandbox[.]invalid$'),
  role_label text NOT NULL,
  role_scope text NOT NULL
    CHECK (role_scope IN ('platform','organization','event','self')),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sandbox_ops.demo_personas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sandbox_ops.demo_personas FROM PUBLIC, anon, authenticated;
INSERT INTO public.organizations (name,slug,organization_type,is_test,status)
SELECT 'EIG Sandbox Headquarters','elevated-impact-group','business',true,'active'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug='elevated-impact-group');
INSERT INTO sandbox_ops.demo_personas (persona_key,display_name,email,role_label,role_scope) VALUES
('eig_admin','Alex Demo','alex@sandbox.invalid','EIG Platform Administrator','platform'),
('pilot','Jordan Demo','jordan@sandbox.invalid','Pilot / Organization Administrator','organization'),
('co_pilot','Taylor Demo','taylor@sandbox.invalid','Co-Pilot / Organization Staff','organization'),
('atc','Morgan Demo','morgan@sandbox.invalid','ATC / Event Coordinator','event'),
('passenger','Casey Demo','casey@sandbox.invalid','Passenger / Participant','self');
COMMENT ON TABLE sandbox_ops.demo_personas IS 'Fictional role definitions only. auth_user_id remains NULL until provisioned through Supabase Auth Admin API; no login bypass.';
