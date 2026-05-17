create table if not exists public.ops_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text not null,
  tone text not null default 'orange' check (tone in ('orange', 'red', 'purple', 'green')),
  surface_notification boolean not null default true,
  surface_ticker boolean not null default false,
  active boolean not null default true,
  pinned boolean not null default false,
  ticker_direction text not null default 'left' check (ticker_direction in ('left', 'right')),
  ticker_speed_seconds integer not null default 70 check (ticker_speed_seconds between 20 and 240),
  owner text not null default 'Workspace',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ops_updates enable row level security;

drop policy if exists "Authenticated users can read ops updates" on public.ops_updates;
drop policy if exists "Authenticated users can create ops updates" on public.ops_updates;
drop policy if exists "Authenticated users can update ops updates" on public.ops_updates;
drop policy if exists "Authenticated users can delete ops updates" on public.ops_updates;

create policy "Authenticated users can read ops updates"
  on public.ops_updates
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create ops updates"
  on public.ops_updates
  for insert
  to authenticated
  with check (auth.uid() = created_by or created_by is null);

create policy "Authenticated users can update ops updates"
  on public.ops_updates
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete ops updates"
  on public.ops_updates
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.ops_updates to authenticated;
grant select on public.ops_updates to anon;
