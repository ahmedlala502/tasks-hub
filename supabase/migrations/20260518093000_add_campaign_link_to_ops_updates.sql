alter table public.ops_updates
  add column if not exists campaign_id text,
  add column if not exists campaign_name text;

create index if not exists ops_updates_campaign_id_idx
  on public.ops_updates (campaign_id);

create index if not exists ops_updates_campaign_name_idx
  on public.ops_updates (campaign_name);
