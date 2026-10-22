-- SANDBOX ONLY. Schema metadata only, no live records. NEVER deploy to production.
-- Remaining non-PK constraints, indexes, RLS policies and triggers require parity review.
CREATE TABLE public."inception_drive_exports" (
  "request_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "sha256" text NOT NULL,
  "google_file_id" text NOT NULL,
  "google_folder_id" text,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "uploaded_at" timestamptz,
  PRIMARY KEY (request_id)
);
ALTER TABLE public."inception_drive_exports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."inception_drive_exports" FROM anon, authenticated;
CREATE TABLE public."inception_project_versions" (
  "project_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "data" jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);
ALTER TABLE public."inception_project_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."inception_project_versions" FROM anon, authenticated;
CREATE TABLE public."inception_projects" (
  "id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "organization_id" uuid,
  "event_id" uuid,
  "master_event_id" uuid,
  "name" text NOT NULL,
  "material" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid NOT NULL,
  "approved_at" timestamptz,
  "approved_by" uuid,
  PRIMARY KEY (id)
);
ALTER TABLE public."inception_projects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."inception_projects" FROM anon, authenticated;
CREATE TABLE public."organization_memberships" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active'::text,
  "invited_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "access_starts_at" timestamptz,
  "access_ends_at" timestamptz,
  PRIMARY KEY (id)
);
ALTER TABLE public."organization_memberships" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."organization_memberships" FROM anon, authenticated;
CREATE TABLE public."organization_product_entitlements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
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
ALTER TABLE public."organization_product_entitlements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."organization_product_entitlements" FROM anon, authenticated;
CREATE TABLE public."organization_profiles" (
  "organization_id" uuid NOT NULL,
  "primary_contact_name" text,
  "primary_contact_email" text,
  "legal_name" text,
  "website_url" text,
  "phone" text,
  "timezone" text,
  "setup_sections" jsonb NOT NULL DEFAULT '{"users": "incomplete", "venues": "incomplete", "calendar": "incomplete", "contacts": "incomplete", "agreement": "incomplete", "ecommerce": "incomplete", "locations": "incomplete", "company_info": "incomplete", "business_info": "incomplete", "billing_payments": "incomplete"}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id)
);
ALTER TABLE public."organization_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."organization_profiles" FROM anon, authenticated;
CREATE TABLE public."passenger_billing_profiles" (
  "passenger_id" uuid NOT NULL,
  "stripe_customer_id" text,
  "default_payment_method_record_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (passenger_id)
);
ALTER TABLE public."passenger_billing_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passenger_billing_profiles" FROM anon, authenticated;
CREATE TABLE public."passenger_contacts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "passenger_id" uuid NOT NULL,
  "contact_type" text NOT NULL,
  "contact_value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "label" text,
  "is_primary" boolean NOT NULL DEFAULT false,
  "is_verified" boolean NOT NULL DEFAULT false,
  "verified_at" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "source" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."passenger_contacts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passenger_contacts" FROM anon, authenticated;
CREATE TABLE public."passenger_event_results" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid,
  "event_id" uuid NOT NULL,
  "passenger_id" uuid NOT NULL,
  "registration_id" uuid,
  "result_type" text NOT NULL DEFAULT 'individual'::text,
  "division" text,
  "flight" text,
  "gross_score" numeric,
  "net_score" numeric,
  "finish_position" integer,
  "result_label" text,
  "source" text NOT NULL DEFAULT 'manual'::text,
  "source_reference" text,
  "result_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."passenger_event_results" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passenger_event_results" FROM anon, authenticated;
CREATE TABLE public."passenger_name_aliases" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "passenger_id" uuid NOT NULL,
  "first_name" text,
  "last_name" text,
  "normalized_name" text NOT NULL,
  "alias_type" text NOT NULL DEFAULT 'registration_name'::text,
  "is_current" boolean NOT NULL DEFAULT false,
  "source" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."passenger_name_aliases" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passenger_name_aliases" FROM anon, authenticated;
