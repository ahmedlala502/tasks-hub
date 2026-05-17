create table if not exists public.ops_campaigns (
  id text primary key,
  name text not null,
  country text not null default '',
  city text not null default '',
  status text not null default 'Active'
    check (status in ('Active', 'Blocked', 'Closed', 'On Hold')),
  stage integer not null default 1,
  current_owner text not null default '',
  record_health text not null default 'Healthy'
    check (record_health in ('Healthy', 'At Risk', 'Critical')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_campaigns_status_idx on public.ops_campaigns (status);
create index if not exists ops_campaigns_stage_idx on public.ops_campaigns (stage);
create index if not exists ops_campaigns_updated_at_idx on public.ops_campaigns (updated_at desc);

alter table public.ops_campaigns enable row level security;

drop policy if exists "Authenticated users can read campaigns" on public.ops_campaigns;
create policy "Authenticated users can read campaigns"
  on public.ops_campaigns
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert campaigns" on public.ops_campaigns;
create policy "Authenticated users can insert campaigns"
  on public.ops_campaigns
  for insert
  to authenticated
  with check (created_by = auth.uid() or created_by is null);

drop policy if exists "Authenticated users can update campaigns" on public.ops_campaigns;
create policy "Authenticated users can update campaigns"
  on public.ops_campaigns
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete campaigns" on public.ops_campaigns;
create policy "Authenticated users can delete campaigns"
  on public.ops_campaigns
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.ops_campaigns to authenticated;
