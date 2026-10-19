-- SANDBOX ONLY. Reviewed structural metadata. No production records. Do not run on live.
-- Non-PK constraints, indexes, RLS policies, triggers and functions pending.
CREATE TABLE public."passenger_payment_methods" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "passenger_id" uuid NOT NULL,
  "stripe_payment_method_id" text NOT NULL,
  "payment_type" text NOT NULL DEFAULT 'card'::text,
  "brand" text,
  "last4" text,
  "exp_month" integer,
  "exp_year" integer,
  "display_label" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."passenger_payment_methods" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passenger_payment_methods" FROM anon, authenticated;
CREATE TABLE public."passenger_profiles" (
  "passenger_id" uuid NOT NULL,
  "address_line_1" text,
  "address_line_2" text,
  "city" text,
  "state_region" text,
  "postal_code" text,
  "country_code" text NOT NULL DEFAULT 'US'::text,
  "home_course" text,
  "handedness" text,
  "player_status" text,
  "favorite_brands" text[] NOT NULL DEFAULT '{}'::text[],
  "apparel_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "equipment" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "social_links" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "life_events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "privacy_settings" jsonb NOT NULL DEFAULT jsonb_build_object('address', 'private', 'phone', 'private', 'date_of_birth', 'private', 'golf', 'connections', 'equipment', 'connections', 'social', 'connections', 'life_events', 'private'),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (passenger_id)
);
ALTER TABLE public."passenger_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passenger_profiles" FROM anon, authenticated;
CREATE TABLE public."passengers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id" uuid,
  "first_name" text,
  "last_name" text,
  "preferred_name" text,
  "date_of_birth" date,
  "gender" text,
  "ghin_number" text,
  "status" text NOT NULL DEFAULT 'unclaimed'::text,
  "merged_into_passenger_id" uuid,
  "claimed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."passengers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."passengers" FROM anon, authenticated;
CREATE TABLE public."platform_account_audit" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "target_user_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "action" text NOT NULL,
  "outcome" text NOT NULL DEFAULT 'completed'::text,
  "reason" text,
  "before_state" jsonb,
  "after_state" jsonb,
  "request_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (id)
);
ALTER TABLE public."platform_account_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."platform_account_audit" FROM anon, authenticated;
CREATE TABLE public."platform_google_drive_folders" (
  "folder_key" text NOT NULL,
  "organization_id" uuid,
  "google_folder_id" text NOT NULL,
  "parent_folder_id" text NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_key)
);
ALTER TABLE public."platform_google_drive_folders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."platform_google_drive_folders" FROM anon, authenticated;
CREATE TABLE public."platform_invitations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "invitee_name" text,
  "organization_id" uuid NOT NULL,
  "event_id" uuid,
  "role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "invited_by" uuid NOT NULL,
  "invited_user_id" uuid,
  "recipient_was_existing" boolean NOT NULL DEFAULT false,
  "expires_at" timestamptz NOT NULL DEFAULT (now() + '14 days'::interval),
  "sent_at" timestamptz,
  "accepted_at" timestamptz,
  "revoked_at" timestamptz,
  "resend_message_id" text,
  "last_error" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "access_starts_at" timestamptz,
  "access_ends_at" timestamptz,
  PRIMARY KEY (id)
);
ALTER TABLE public."platform_invitations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."platform_invitations" FROM anon, authenticated;
CREATE TABLE public."products" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "product_key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "status" text NOT NULL DEFAULT 'active'::text,
  "organization_level" boolean NOT NULL DEFAULT true,
  "event_add_on" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."products" FROM anon, authenticated;
CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "first_name" text,
  "last_name" text,
  "display_name" text,
  "phone" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "username" text,
  "role" text NOT NULL DEFAULT 'user'::text,
  "account_status" text NOT NULL DEFAULT 'active'::text,
  PRIMARY KEY (id)
);
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."profiles" FROM anon, authenticated;
CREATE TABLE public."registration_field_values" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "field_id" uuid NOT NULL,
  "team_registration_id" uuid,
  "golfer_id" uuid,
  "value_text" text,
  "value_number" numeric,
  "value_boolean" boolean,
  "value_date" date,
  "value_json" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."registration_field_values" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."registration_field_values" FROM anon, authenticated;
CREATE TABLE public."social_campaign_versions" (
  "campaign_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "data" jsonb NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, version)
);
ALTER TABLE public."social_campaign_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."social_campaign_versions" FROM anon, authenticated;
