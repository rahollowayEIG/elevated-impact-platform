create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text default 'Golf Outing',
  event_date date,
  location text,
  golfer_count int default 0,
  revenue_goal numeric(10,2) default 0,
  status text not null default 'pending_review',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sponsorship_products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text,
  product_type text not null default 'tier',
  price numeric(10,2) default 0,
  quantity_available int default 1,
  quantity_sold int default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  status text not null default 'lead',
  logo_status text not null default 'needed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sponsor_purchases (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsors(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  product_id uuid references sponsorship_products(id) on delete set null,
  product_name text,
  amount numeric(10,2) default 0,
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  sponsor_id uuid references sponsors(id) on delete set null,
  contribution_type text not null default 'raffle',
  description text not null,
  estimated_value numeric(10,2) default 0,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists volunteers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  preferred_role text,
  assigned_role text,
  availability text,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  request_type text not null,
  title text not null,
  base_quantity int default 0,
  additional_quantity int default 0,
  total_quantity int generated always as (coalesce(base_quantity, 0) + coalesce(additional_quantity, 0)) stored,
  details jsonb default '{}'::jsonb,
  status text not null default 'submitted',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  sponsor_id uuid references sponsors(id) on delete set null,
  upload_type text not null default 'logo',
  file_name text,
  file_url text,
  drive_file_id text,
  status text not null default 'uploaded',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_updated_at on events;
create trigger events_updated_at before update on events for each row execute function set_updated_at();

drop trigger if exists sponsorship_products_updated_at on sponsorship_products;
create trigger sponsorship_products_updated_at before update on sponsorship_products for each row execute function set_updated_at();

drop trigger if exists sponsors_updated_at on sponsors;
create trigger sponsors_updated_at before update on sponsors for each row execute function set_updated_at();

drop trigger if exists sponsor_purchases_updated_at on sponsor_purchases;
create trigger sponsor_purchases_updated_at before update on sponsor_purchases for each row execute function set_updated_at();

drop trigger if exists contributions_updated_at on contributions;
create trigger contributions_updated_at before update on contributions for each row execute function set_updated_at();

drop trigger if exists volunteers_updated_at on volunteers;
create trigger volunteers_updated_at before update on volunteers for each row execute function set_updated_at();

drop trigger if exists event_requests_updated_at on event_requests;
create trigger event_requests_updated_at before update on event_requests for each row execute function set_updated_at();

drop trigger if exists uploads_updated_at on uploads;
create trigger uploads_updated_at before update on uploads for each row execute function set_updated_at();

create index if not exists idx_events_status on events(status);
create index if not exists idx_events_event_date on events(event_date);
create index if not exists idx_sponsorship_products_event_id on sponsorship_products(event_id);
create index if not exists idx_sponsors_event_id on sponsors(event_id);
create index if not exists idx_sponsor_purchases_event_id on sponsor_purchases(event_id);
create index if not exists idx_contributions_event_id on contributions(event_id);
create index if not exists idx_volunteers_event_id on volunteers(event_id);
create index if not exists idx_event_requests_event_id on event_requests(event_id);
create index if not exists idx_uploads_event_id on uploads(event_id);

-- Temporary MVP public policies for initial testing.
-- For production/internal launch, switch to authenticated-only policies.
alter table events enable row level security;
alter table sponsorship_products enable row level security;
alter table sponsors enable row level security;
alter table sponsor_purchases enable row level security;
alter table contributions enable row level security;
alter table volunteers enable row level security;
alter table event_requests enable row level security;
alter table uploads enable row level security;

create policy if not exists "anon read events" on events for select to anon using (true);
create policy if not exists "anon write events" on events for all to anon using (true) with check (true);

create policy if not exists "anon read sponsorship_products" on sponsorship_products for select to anon using (true);
create policy if not exists "anon write sponsorship_products" on sponsorship_products for all to anon using (true) with check (true);

create policy if not exists "anon read sponsors" on sponsors for select to anon using (true);
create policy if not exists "anon write sponsors" on sponsors for all to anon using (true) with check (true);

create policy if not exists "anon read sponsor_purchases" on sponsor_purchases for select to anon using (true);
create policy if not exists "anon write sponsor_purchases" on sponsor_purchases for all to anon using (true) with check (true);

create policy if not exists "anon read contributions" on contributions for select to anon using (true);
create policy if not exists "anon write contributions" on contributions for all to anon using (true) with check (true);

create policy if not exists "anon read volunteers" on volunteers for select to anon using (true);
create policy if not exists "anon write volunteers" on volunteers for all to anon using (true) with check (true);

create policy if not exists "anon read event_requests" on event_requests for select to anon using (true);
create policy if not exists "anon write event_requests" on event_requests for all to anon using (true) with check (true);

create policy if not exists "anon read uploads" on uploads for select to anon using (true);
create policy if not exists "anon write uploads" on uploads for all to anon using (true) with check (true);

insert into events (id, name, event_type, event_date, location, golfer_count, revenue_goal, status)
values
  ('00000000-0000-0000-0000-000000000001', 'Charity Golf Outing', 'Golf Outing', '2026-06-18', 'Primary Golf Course', 120, 25000, 'pending_review')
on conflict (id) do nothing;

insert into sponsorship_products (event_id, name, product_type, price, quantity_available, quantity_sold)
values
  ('00000000-0000-0000-0000-000000000001', 'Title Sponsor', 'tier', 5000, 1, 0),
  ('00000000-0000-0000-0000-000000000001', 'Gold Sponsor', 'tier', 2500, 4, 2),
  ('00000000-0000-0000-0000-000000000001', 'Hole Sponsor', 'placement', 300, 18, 9),
  ('00000000-0000-0000-0000-000000000001', 'Event Day Digital Spot', 'media_add_on', 250, 12, 4);

insert into sponsors (event_id, business_name, contact_name, status, logo_status)
values
  ('00000000-0000-0000-0000-000000000001', 'Oak Ridge Dental', 'Amanda Lee', 'active', 'received'),
  ('00000000-0000-0000-0000-000000000001', 'Summit Auto Group', 'Chris Miller', 'pending', 'needed'),
  ('00000000-0000-0000-0000-000000000001', 'Lakeside Insurance', 'Mark Davis', 'active', 'received');

insert into sponsor_purchases (event_id, sponsor_id, product_name, amount, payment_status)
select event_id, id,
  case business_name
    when 'Oak Ridge Dental' then 'Gold Sponsor'
    when 'Summit Auto Group' then 'Hole Sponsor + Digital Spot'
    else 'Gold Sponsor'
  end,
  case business_name
    when 'Summit Auto Group' then 550
    else 2500
  end,
  case business_name
    when 'Summit Auto Group' then 'pending'
    else 'paid'
  end
from sponsors
where event_id = '00000000-0000-0000-0000-000000000001';

insert into volunteers (event_id, name, preferred_role, assigned_role, availability, status)
values
  ('00000000-0000-0000-0000-000000000001', 'Jamie Ross', 'Registration Table', 'Registration Table', 'Morning', 'confirmed'),
  ('00000000-0000-0000-0000-000000000001', 'Taylor Smith', 'Raffle Table', 'Raffle Table', 'Afternoon', 'new');

insert into event_requests (event_id, request_type, title, base_quantity, additional_quantity, status, notes)
values
  ('00000000-0000-0000-0000-000000000001', 'swag', 'Golfer gift package', 120, 12, 'submitted', 'Golf balls, tees, towel, swag bag. Budget around $25/golfer.'),
  ('00000000-0000-0000-0000-000000000001', 'catering', 'Lunch + drink tickets', 120, 20, 'reviewing', 'Include volunteers and staff. Add drink ticket estimate.'),
  ('00000000-0000-0000-0000-000000000001', 'signage', 'Hole sponsor signs', 18, 2, 'submitted', 'Need logo deadline reminders.');
