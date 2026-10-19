-- SANDBOX ONLY. Schema-only baseline; no data. Do not run on live.
-- FKs, unique/check constraints, indexes and RLS policies pending.
CREATE TABLE public."squawk_message_reviews" (
  "message_id" uuid NOT NULL,
  "reviewed_by" uuid NOT NULL DEFAULT auth.uid(),
  "reviewer_role" text NOT NULL,
  "reviewed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id)
);
ALTER TABLE public."squawk_message_reviews" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_message_reviews" FROM anon, authenticated;
CREATE TABLE public."squawk_messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL,
  "created_by" uuid NOT NULL DEFAULT auth.uid(),
  "message_kind" text NOT NULL DEFAULT 'message'::text,
  "visibility" text NOT NULL DEFAULT 'role_restricted'::text,
  "required_roles" text[] NOT NULL DEFAULT '{}'::text[],
  "safe_label" text NOT NULL DEFAULT 'Squawk Box message'::text,
  "requires_review" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'draft'::text,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "reviewed_at" timestamptz,
  "reviewed_by" uuid,
  "audience_key" text,
  "channels" text[] NOT NULL DEFAULT ARRAY['in_app'::text],
  "template_id" uuid,
  "scheduled_for" timestamptz,
  "reply_to_message_id" uuid,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_messages" FROM anon, authenticated;
CREATE TABLE public."squawk_recipient_preferences" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "user_id" uuid,
  "contact_id" uuid,
  "registration_id" uuid,
  "email_status" text NOT NULL DEFAULT 'unknown'::text,
  "sms_status" text NOT NULL DEFAULT 'unknown'::text,
  "sms_consent_source" text,
  "sms_consented_at" timestamptz,
  "sms_opted_out_at" timestamptz,
  "email_opted_out_at" timestamptz,
  "do_not_contact" boolean NOT NULL DEFAULT false,
  "notes" text,
  "updated_by" uuid DEFAULT auth.uid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_recipient_preferences" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_recipient_preferences" FROM anon, authenticated;
CREATE TABLE public."squawk_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid,
  "created_by" uuid DEFAULT auth.uid(),
  "name" text NOT NULL,
  "description" text,
  "message_kind" text NOT NULL DEFAULT 'message'::text,
  "channel_options" text[] NOT NULL DEFAULT ARRAY['in_app'::text, 'email'::text],
  "subject_template" text,
  "body_template" text NOT NULL,
  "in_app_template" text,
  "email_template" text,
  "sms_template" text,
  "merge_fields" text[] NOT NULL DEFAULT '{}'::text[],
  "audience_key" text,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_templates" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_templates" FROM anon, authenticated;
CREATE TABLE public."squawk_thread_participants" (
  "thread_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
ALTER TABLE public."squawk_thread_participants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_thread_participants" FROM anon, authenticated;
CREATE TABLE public."squawk_threads" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id" uuid,
  "context_type" text NOT NULL,
  "context_label" text NOT NULL,
  "created_by" uuid NOT NULL DEFAULT auth.uid(),
  "status" text NOT NULL DEFAULT 'open'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "direct_key" text,
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_threads" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_threads" FROM anon, authenticated;
CREATE TABLE public."team_registrations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "registration_type_id" uuid,
  "team_name" text,
  "captain_name" text NOT NULL,
  "captain_email" text,
  "captain_phone" text,
  "registered_golfer_count" integer NOT NULL DEFAULT 0,
  "roster_status" text NOT NULL DEFAULT 'incomplete'::text,
  "registration_source" text NOT NULL DEFAULT 'direct'::text,
  "payment_status" text NOT NULL DEFAULT 'pending'::text,
  "amount_charged" numeric(10,2) NOT NULL DEFAULT 0,
  "sponsor_purchase_id" uuid,
  "comp_reason" text,
  "comp_approved_by" text,
  "comp_approved_at" timestamptz,
  "access_token" uuid NOT NULL DEFAULT gen_random_uuid(),
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."team_registrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."team_registrations" FROM anon, authenticated;
CREATE TABLE public."volunteers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid,
  "name" text,
  "preferred_role" text,
  "assigned_role" text,
  "availability" text,
  "status" text,
  "created_at" timestamp DEFAULT now(),
  "email" text,
  "phone" text,
  "notes" text,
  PRIMARY KEY (id)
);
ALTER TABLE public."volunteers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."volunteers" FROM anon, authenticated;
