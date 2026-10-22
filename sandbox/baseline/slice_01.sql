-- SANDBOX ONLY. Generated from approved schema metadata; zero rows. NEVER deploy on production.
-- Secondary indexes, non-PK constraints, full RLS policies and triggers pending review.
CREATE TABLE public."auth_email_code_requests" (
  "email_hash" text NOT NULL,
  "last_sent_at" timestamptz NOT NULL DEFAULT now(),
  "window_started_at" timestamptz NOT NULL DEFAULT now(),
  "send_count" integer NOT NULL DEFAULT 1,
  "code_hash" text,
  "expires_at" timestamptz,
  "verified_at" timestamptz,
  "purpose" text NOT NULL DEFAULT 'signup'::text,
  "attempts" integer NOT NULL DEFAULT 0,
  PRIMARY KEY (email_hash)
);
ALTER TABLE public."auth_email_code_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."auth_email_code_requests" FROM anon, authenticated;
CREATE TABLE public."billing_accounts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "billing_email" text,
  "stripe_customer_id" text,
  "invoice_terms" text NOT NULL DEFAULT 'due_on_receipt'::text,
  "auto_apply_credits" boolean NOT NULL DEFAULT true,
  "status" text NOT NULL DEFAULT 'active'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."billing_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."billing_accounts" FROM anon, authenticated;
CREATE TABLE public."contributions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid,
  "sponsor_id" uuid,
  "contribution_type" text DEFAULT 'raffle'::text,
  "description" text,
  "estimated_value" numeric DEFAULT 0,
  "status" text DEFAULT 'pending'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."contributions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."contributions" FROM anon, authenticated;
CREATE TABLE public."eic_design_product_versions" (
  "product_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "actor_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, version)
);
ALTER TABLE public."eic_design_product_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."eic_design_product_versions" FROM anon, authenticated;
CREATE TABLE public."eic_design_products" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" text NOT NULL,
  "material" text NOT NULL,
  "description" text NOT NULL DEFAULT ''::text,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "definition" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "sort_name" text,
  "sort_category" text,
  "sort_material" text,
  "sort_status" text,
  PRIMARY KEY (id)
);
ALTER TABLE public."eic_design_products" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."eic_design_products" FROM anon, authenticated;
CREATE TABLE public."eie_event_budget_versions" (
  "event_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "data" jsonb NOT NULL,
  "source_snapshot" jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, version)
);
ALTER TABLE public."eie_event_budget_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."eie_event_budget_versions" FROM anon, authenticated;
CREATE TABLE public."eie_event_budgets" (
  "event_id" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL,
  "updated_by" uuid NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id)
);
ALTER TABLE public."eie_event_budgets" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."eie_event_budgets" FROM anon, authenticated;
CREATE TABLE public."eig_credit_ledger" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "entry_type" text NOT NULL,
  "source_type" text,
  "source_id" text,
  "description" text NOT NULL,
  "status" text NOT NULL DEFAULT 'posted'::text,
  "expires_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."eig_credit_ledger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."eig_credit_ledger" FROM anon, authenticated;
CREATE TABLE public."event_contact_roles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "role" text NOT NULL,
  "related_registration_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."event_contact_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_contact_roles" FROM anon, authenticated;
CREATE TABLE public."event_product_entitlements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'active'::text,
  "starts_at" timestamptz NOT NULL DEFAULT now(),
  "ends_at" timestamptz,
  "purchased_at" timestamptz,
  "enabled_by" uuid,
  "notes" text,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."event_product_entitlements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."event_product_entitlements" FROM anon, authenticated;
