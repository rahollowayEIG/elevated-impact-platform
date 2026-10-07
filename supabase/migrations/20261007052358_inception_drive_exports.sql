-- Shared folder identity and export audit. Only the authenticated Edge Function's
-- service client accesses these tables; clients cannot set destinations or actors.
create table public.platform_google_drive_folders (
  folder_key text primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  google_folder_id text not null unique,
  parent_folder_id text not null,
  label text not null,
  created_at timestamptz not null default now()
);
create index platform_google_drive_folders_organization_idx
  on public.platform_google_drive_folders(organization_id);
alter table public.platform_google_drive_folders enable row level security;
revoke all on public.platform_google_drive_folders from public, anon, authenticated;
grant select, insert, update on public.platform_google_drive_folders to service_role;

create table public.inception_drive_exports (
  request_id uuid primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  filename text not null check (length(filename) between 1 and 200),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','application/zip')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  google_file_id text not null unique,
  google_folder_id text,
  status text not null default 'pending' check (status in ('pending','uploaded')),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  check ((status = 'uploaded') = (uploaded_at is not null))
);
create index inception_drive_exports_actor_idx on public.inception_drive_exports(actor_user_id, created_at desc);
create index inception_drive_exports_organization_idx on public.inception_drive_exports(organization_id);
alter table public.inception_drive_exports enable row level security;
revoke all on public.inception_drive_exports from public, anon, authenticated;
grant select, insert, update on public.inception_drive_exports to service_role;
comment on table public.inception_drive_exports is 'EIG shared Drive exports, attributed to the permanent platform account; uncertain uploads reuse the same Google file ID.';
