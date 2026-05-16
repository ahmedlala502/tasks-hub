create table if not exists public.ops_workspace_records (
  record_key text primary key,
  record_type text not null check (record_type in ('campaigns', 'influencers', 'blockers', 'tasks', 'handovers')),
  payload jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ops_workspace_records_type_idx on public.ops_workspace_records (record_type);
create index if not exists ops_workspace_records_updated_at_idx on public.ops_workspace_records (updated_at desc);
create index if not exists ops_activity_logs_user_id_idx on public.ops_activity_logs (user_id);
create index if not exists ops_activity_logs_user_email_idx on public.ops_activity_logs (lower(user_email));
create index if not exists ops_activity_logs_created_at_idx on public.ops_activity_logs (created_at desc);

alter table public.ops_workspace_records enable row level security;
alter table public.ops_activity_logs enable row level security;

drop policy if exists "Authenticated users can read workspace records" on public.ops_workspace_records;
drop policy if exists "Authenticated users can write workspace records" on public.ops_workspace_records;
drop policy if exists "Authenticated users can read activity logs" on public.ops_activity_logs;
drop policy if exists "Authenticated users can create activity logs" on public.ops_activity_logs;

create policy "Authenticated users can read workspace records"
  on public.ops_workspace_records
  for select
  to authenticated
  using (true);

create policy "Authenticated users can write workspace records"
  on public.ops_workspace_records
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read activity logs"
  on public.ops_activity_logs
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create activity logs"
  on public.ops_activity_logs
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

grant select, insert, update, delete on public.ops_workspace_records to authenticated;
grant select, insert on public.ops_activity_logs to authenticated;
