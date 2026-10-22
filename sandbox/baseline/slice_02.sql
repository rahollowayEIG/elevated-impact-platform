-- SANDBOX ONLY. Schema metadata only, no live records. NEVER deploy to production.
-- Remaining non-PK constraints, indexes, RLS policies and triggers require parity review.
CREATE TABLE public."golf_admin_users" (
  "user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "role" text NOT NULL DEFAULT 'super_admin'::text,
  PRIMARY KEY (user_id)
);
ALTER TABLE public."golf_admin_users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_admin_users" FROM anon, authenticated;
CREATE TABLE public."golf_event_payment_settings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "allow_online" boolean NOT NULL DEFAULT true,
  "allow_clubhouse" boolean NOT NULL DEFAULT true,
  "price_mode" text NOT NULL DEFAULT 'per_player'::text,
  "team_payment_mode" text NOT NULL DEFAULT 'captain_all'::text,
  "convenience_fee_type" text NOT NULL DEFAULT 'percent'::text,
  "convenience_fee_value" numeric(10,2) NOT NULL DEFAULT 3.00,
  "clubhouse_hold_mode" text NOT NULL DEFAULT 'days'::text,
  "clubhouse_hold_days" integer NOT NULL DEFAULT 3,
  "allow_card_guarantee" boolean NOT NULL DEFAULT true,
  "auto_charge_at_deadline" boolean NOT NULL DEFAULT true,
  "failed_charge_grace_hours" integer NOT NULL DEFAULT 24,
  "reminders_enabled" boolean NOT NULL DEFAULT true,
  "reminder_schedule" jsonb NOT NULL DEFAULT '["immediate", "24h_before_hold_expiry", "hold_expiry", "72h_before_deadline", "24h_before_deadline"]'::jsonb,
  "currency" text NOT NULL DEFAULT 'usd'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "allow_split_team_payments" boolean NOT NULL DEFAULT true,
  "clubhouse_payment_payee" text,
  "clubhouse_payment_location_name" text,
  "clubhouse_payment_address" text,
  "clubhouse_payment_instructions" text,
  "allow_cash" boolean NOT NULL DEFAULT false,
  "cash_payment_instructions" text,
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_event_payment_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_event_payment_settings" FROM anon, authenticated;
CREATE TABLE public."golf_registration_admin_actions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "registration_id" uuid NOT NULL,
  "organization_id" uuid,
  "event_id" uuid,
  "action" text NOT NULL,
  "reason" text,
  "previous_payment_status" text,
  "new_payment_status" text,
  "previous_registration_status" text,
  "new_registration_status" text,
  "acted_by" uuid NOT NULL,
  "acted_at" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_registration_admin_actions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_registration_admin_actions" FROM anon, authenticated;
CREATE TABLE public."golf_registration_teams" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "team_id" text NOT NULL,
  "entry_number" text,
  "team_name" text,
  "team_size" integer NOT NULL,
  "captain_registration_id" uuid,
  "captain_user_id" uuid,
  "payment_mode" text NOT NULL DEFAULT 'captain_all'::text,
  "allow_partial_team" boolean NOT NULL DEFAULT true,
  "status" text NOT NULL DEFAULT 'roster_incomplete'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_registration_teams" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_registration_teams" FROM anon, authenticated;
CREATE TABLE public."golf_registrations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid,
  "event_id" uuid,
  "event_key" text NOT NULL,
  "event_name" text,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "age" integer,
  "gender" text,
  "division" text,
  "membership_status" text NOT NULL,
  "price" numeric(10,2) NOT NULL DEFAULT 0,
  "email" text,
  "phone" text,
  "ghin_number" text,
  "payment_status" text NOT NULL DEFAULT 'pending'::text,
  "payment_reference" text,
  "google_sheet_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "date_of_birth" date,
  "custom_fields" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "convenience_fee" numeric(10,2) NOT NULL DEFAULT 0,
  "amount_paid" numeric(10,2),
  "paid_at" timestamptz,
  "refunded_at" timestamptz,
  "user_id" uuid DEFAULT auth.uid(),
  "admin_note" text,
  "admin_updated_at" timestamptz,
  "admin_updated_by" uuid,
  "registration_status" text NOT NULL DEFAULT 'active'::text,
  "registration_source" text NOT NULL DEFAULT 'public'::text,
  "entry_number" text,
  "team_id" text,
  "payment_method" text,
  "payment_due_at" timestamptz,
  "spot_hold_expires_at" timestamptz,
  "spot_hold_status" text NOT NULL DEFAULT 'none'::text,
  "stripe_customer_id" text,
  "stripe_payment_method_id" text,
  "card_guarantee_at" timestamptz,
  "deadline_charge_status" text NOT NULL DEFAULT 'not_applicable'::text,
  "deadline_charge_attempted_at" timestamptz,
  "released_at" timestamptz,
  "release_reason" text,
  "passenger_id" uuid,
  "passenger_claim_status" text NOT NULL DEFAULT 'unclaimed'::text,
  "passenger_invited_at" timestamptz,
  "passenger_claimed_at" timestamptz,
  "registration_confirmation_sent_at" timestamptz,
  "payment_confirmation_sent_at" timestamptz,
  "clubhouse_payment_confirmation_sent_at" timestamptz,
  "cash_payment_confirmation_sent_at" timestamptz,
  "payment_covered_by_registration_id" uuid,
  "payment_for_team_id" text,
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_registrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_registrations" FROM anon, authenticated;
CREATE TABLE public."golf_roster_info_requests" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "source_row" integer NOT NULL,
  "recipient_email" text NOT NULL,
  "participant_first_name" text,
  "participant_last_name" text,
  "requested_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "field_headers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "token_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "expires_at" timestamptz NOT NULL,
  "requested_by" uuid,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "resend_message_id" text,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_roster_info_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_roster_info_requests" FROM anon, authenticated;
CREATE TABLE public."golf_team_invitations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "slot_number" integer NOT NULL,
  "first_name" text,
  "last_name" text,
  "email" text NOT NULL,
  "token_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "registration_id" uuid,
  "expires_at" timestamptz NOT NULL,
  "sent_at" timestamptz,
  "completed_at" timestamptz,
  "resend_message_id" text,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_team_invitations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_team_invitations" FROM anon, authenticated;
CREATE TABLE public."golf_team_payment_shares" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "slot_number" integer NOT NULL,
  "registration_id" uuid,
  "invitation_id" uuid,
  "payer_email" text,
  "payer_role" text NOT NULL,
  "amount_due" numeric(10,2) NOT NULL DEFAULT 0,
  "amount_paid" numeric(10,2) NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "paid_at" timestamptz,
  "refunded_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."golf_team_payment_shares" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golf_team_payment_shares" FROM anon, authenticated;
CREATE TABLE public."golfers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "team_registration_id" uuid,
  "first_name" text,
  "last_name" text,
  "email" text,
  "phone" text,
  "handicap" numeric(5,2),
  "shirt_size" text,
  "dietary_notes" text,
  "rental_clubs_needed" boolean NOT NULL DEFAULT false,
  "is_team_captain" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'registered'::text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ghin_number" text,
  "handicap_index" numeric(5,2),
  "gender" text,
  "date_of_birth" date,
  "tee" text,
  "passenger_id" uuid,
  PRIMARY KEY (id)
);
ALTER TABLE public."golfers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."golfers" FROM anon, authenticated;
CREATE TABLE public."google_oauth_tokens" (
  "id" bigint NOT NULL,
  "provider" text NOT NULL DEFAULT 'google'::text,
  "access_token" text,
  "refresh_token" text,
  "token_type" text,
  "scope" text,
  "expires_in" integer,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public."google_oauth_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."google_oauth_tokens" FROM anon, authenticated;
