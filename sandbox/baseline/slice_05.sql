-- SANDBOX ONLY. Reviewed structural metadata. No production records. Do not run on live.
-- Non-PK constraints, indexes, RLS policies, triggers and functions pending.
CREATE TABLE public."social_campaigns" (
  "id" uuid NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "organization_id" uuid,
  "event_id" uuid,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "data" jsonb NOT NULL,
  "version" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid NOT NULL,
  "reviewed_at" timestamptz,
  "reviewed_by" uuid,
  PRIMARY KEY (id)
);
ALTER TABLE public."social_campaigns" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."social_campaigns" FROM anon, authenticated;
CREATE TABLE public."sponsor_purchases" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "sponsor_id" uuid,
  "event_id" uuid,
  "product_id" uuid,
  "product_name" text,
  "amount" numeric DEFAULT 0,
  "payment_status" text DEFAULT 'pending'::text,
  "fulfillment_status" text DEFAULT 'pending'::text,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "included_team_count" integer NOT NULL DEFAULT 0,
  "golfers_per_team" integer NOT NULL DEFAULT 4,
  PRIMARY KEY (id)
);
ALTER TABLE public."sponsor_purchases" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."sponsor_purchases" FROM anon, authenticated;
CREATE TABLE public."sponsors" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid,
  "name" text,
  "package" text,
  "amount" numeric,
  "status" text,
  "created_at" timestamp DEFAULT now(),
  "business_name" text,
  "contact_name" text,
  "email" text,
  "phone" text,
  "logo_status" text DEFAULT 'needed'::text,
  "notes" text,
  PRIMARY KEY (id)
);
ALTER TABLE public."sponsors" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."sponsors" FROM anon, authenticated;
CREATE TABLE public."sponsorship_products" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "product_type" text DEFAULT 'tier'::text,
  "price" numeric DEFAULT 0,
  "quantity_available" integer DEFAULT 1,
  "quantity_sold" integer DEFAULT 0,
  "status" text DEFAULT 'active'::text,
  "created_at" timestamptz DEFAULT now(),
  "included_team_count" integer NOT NULL DEFAULT 0,
  "golfers_per_team" integer NOT NULL DEFAULT 4,
  PRIMARY KEY (id)
);
ALTER TABLE public."sponsorship_products" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."sponsorship_products" FROM anon, authenticated;
CREATE TABLE public."squawk_audit_log" (
  "id" bigint NOT NULL,
  "organization_id" uuid NOT NULL,
  "event_id" uuid,
  "thread_id" uuid,
  "message_id" uuid,
  "actor_user_id" uuid,
  "action" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_audit_log" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_audit_log" FROM anon, authenticated;
CREATE TABLE public."squawk_channel_connections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "channel" text NOT NULL,
  "provider" text NOT NULL,
  "connection_status" text NOT NULL DEFAULT 'not_connected'::text,
  "compliance_status" text NOT NULL DEFAULT 'not_started'::text,
  "sender_label" text,
  "sender_masked" text,
  "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_verified_at" timestamptz,
  "configured_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_channel_connections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_channel_connections" FROM anon, authenticated;
CREATE TABLE public."squawk_delivery_events" (
  "id" bigint NOT NULL,
  "recipient_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "provider" text,
  "provider_event_id" text,
  "event_type" text NOT NULL,
  "event_at" timestamptz NOT NULL DEFAULT now(),
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_delivery_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_delivery_events" FROM anon, authenticated;
CREATE TABLE public."squawk_message_content" (
  "message_id" uuid NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "in_app_body" text,
  "email_body" text,
  "sms_body" text,
  PRIMARY KEY (message_id)
);
ALTER TABLE public."squawk_message_content" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_message_content" FROM anon, authenticated;
CREATE TABLE public."squawk_message_receipts" (
  "message_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz,
  "reviewed_at" timestamptz,
  PRIMARY KEY (message_id, user_id)
);
ALTER TABLE public."squawk_message_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_message_receipts" FROM anon, authenticated;
CREATE TABLE public."squawk_message_recipients" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL,
  "user_id" uuid,
  "contact_id" uuid,
  "registration_id" uuid,
  "recipient_type" text NOT NULL,
  "channel" text NOT NULL,
  "destination_masked" text,
  "delivery_status" text NOT NULL DEFAULT 'pending'::text,
  "provider_message_id" text,
  "delivered_at" timestamptz,
  "failed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "queued_at" timestamptz,
  "sent_at" timestamptz,
  "last_status_at" timestamptz,
  "provider" text,
  "error_code" text,
  "error_message" text,
  "attempt_count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
);
ALTER TABLE public."squawk_message_recipients" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."squawk_message_recipients" FROM anon, authenticated;
