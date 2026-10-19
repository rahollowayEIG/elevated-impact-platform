-- SANDBOX ONLY. Align initial hand-written columns with live precision; all affected tables empty.
ALTER TABLE public.event_offers ALTER COLUMN price TYPE numeric(12,2);
ALTER TABLE public.event_requests ALTER COLUMN deposit_amount TYPE numeric(12,2);
ALTER TABLE public.golf_registration_events ALTER COLUMN member_price TYPE numeric(10,2);
ALTER TABLE public.golf_registration_events ALTER COLUMN non_member_price TYPE numeric(10,2);
ALTER TABLE public.registration_types ALTER COLUMN price TYPE numeric(10,2);
