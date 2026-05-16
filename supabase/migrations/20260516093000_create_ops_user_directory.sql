create schema if not exists app_private;

create table if not exists public.ops_user_directory (
  uid uuid primary key,
  email text not null unique,
  display_name text not null default 'Workspace User',
  role text not null default 'operations' check (role in ('master', 'operations', 'community')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  office text not null default 'Egypt' check (office in ('Egypt', 'KSA', 'UAE', 'Kuwait')),
  department text not null default 'Operations',
  title text not null default 'Team Member',
  timezone text not null default 'Africa/Cairo',
  created_at timestamptz,
  last_sign_in_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ops_user_directory_email_idx on public.ops_user_directory (lower(email));
create index if not exists ops_user_directory_role_idx on public.ops_user_directory (role);
create index if not exists ops_user_directory_status_idx on public.ops_user_directory (status);
create index if not exists ops_user_directory_created_at_idx on public.ops_user_directory (created_at desc);

alter table public.ops_user_directory enable row level security;

drop policy if exists "Master users can read user directory" on public.ops_user_directory;
create policy "Master users can read user directory"
  on public.ops_user_directory
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master'
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'admin@trygc.com',
      'lamiaa@trygc.com',
      'adel@grand-community.com',
      'sabry@trygc.com',
      'a.ismail@trygc.com',
      'abdelfatah@trygc.com',
      'm.mahmoud@trygc.com'
    )
  );

grant select on public.ops_user_directory to authenticated;

create or replace function app_private.normalize_ops_role(value jsonb, email text)
returns text
language sql
stable
as $$
  select case
    when lower(coalesce(email, '')) in (
      'admin@trygc.com',
      'lamiaa@trygc.com',
      'adel@grand-community.com',
      'sabry@trygc.com',
      'a.ismail@trygc.com',
      'abdelfatah@trygc.com',
      'm.mahmoud@trygc.com'
    ) then 'master'
    when value #>> '{}' in ('master', 'operations', 'community') then value #>> '{}'
    else 'operations'
  end;
$$;

create or replace function app_private.normalize_ops_office(value jsonb, role text)
returns text
language sql
stable
as $$
  select case
    when value #>> '{}' in ('Egypt', 'KSA', 'UAE', 'Kuwait') then value #>> '{}'
    when role = 'community' then 'KSA'
    else 'Egypt'
  end;
$$;

create or replace function app_private.sync_ops_user_directory()
returns trigger
language plpgsql
security definer
set search_path = public, auth, app_private
as $$
declare
  next_role text;
  next_display_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.ops_user_directory where uid = old.id;
    return old;
  end if;

  next_role := app_private.normalize_ops_role(new.raw_app_meta_data -> 'role', new.email);
  next_display_name := trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Workspace User'
  ));

  insert into public.ops_user_directory (
    uid,
    email,
    display_name,
    role,
    status,
    office,
    department,
    title,
    timezone,
    created_at,
    last_sign_in_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(next_display_name, ''), 'Workspace User'),
    next_role,
    case when new.banned_until is null then 'active' else 'suspended' end,
    app_private.normalize_ops_office(new.raw_user_meta_data -> 'office', next_role),
    coalesce(nullif(new.raw_user_meta_data ->> 'department', ''), case when next_role = 'community' then 'Coordination' else 'Operations' end),
    coalesce(nullif(new.raw_user_meta_data ->> 'title', ''), case when next_role = 'master' then 'Master Admin' else 'Team Member' end),
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'Africa/Cairo'),
    new.created_at,
    new.last_sign_in_at,
    now()
  )
  on conflict (uid) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    role = excluded.role,
    status = excluded.status,
    office = excluded.office,
    department = excluded.department,
    title = excluded.title,
    timezone = excluded.timezone,
    created_at = excluded.created_at,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_ops_user_directory_on_auth_users on auth.users;
create trigger sync_ops_user_directory_on_auth_users
  after insert or update or delete on auth.users
  for each row execute function app_private.sync_ops_user_directory();

insert into public.ops_user_directory (
  uid,
  email,
  display_name,
  role,
  status,
  office,
  department,
  title,
  timezone,
  created_at,
  last_sign_in_at,
  updated_at
)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(coalesce(u.email, ''), '@', 1))), ''), 'Workspace User'),
  app_private.normalize_ops_role(u.raw_app_meta_data -> 'role', u.email),
  case when u.banned_until is null then 'active' else 'suspended' end,
  app_private.normalize_ops_office(u.raw_user_meta_data -> 'office', app_private.normalize_ops_role(u.raw_app_meta_data -> 'role', u.email)),
  coalesce(nullif(u.raw_user_meta_data ->> 'department', ''), case when app_private.normalize_ops_role(u.raw_app_meta_data -> 'role', u.email) = 'community' then 'Coordination' else 'Operations' end),
  coalesce(nullif(u.raw_user_meta_data ->> 'title', ''), case when app_private.normalize_ops_role(u.raw_app_meta_data -> 'role', u.email) = 'master' then 'Master Admin' else 'Team Member' end),
  coalesce(nullif(u.raw_user_meta_data ->> 'timezone', ''), 'Africa/Cairo'),
  u.created_at,
  u.last_sign_in_at,
  now()
from auth.users u
where u.email is not null
on conflict (uid) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  office = excluded.office,
  department = excluded.department,
  title = excluded.title,
  timezone = excluded.timezone,
  created_at = excluded.created_at,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();
