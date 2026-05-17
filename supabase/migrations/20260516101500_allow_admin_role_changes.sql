create or replace function app_private.normalize_ops_role(value jsonb, email text)
returns text
language sql
stable
as $$
  select case
    when value #>> '{}' in ('master', 'operations', 'community') then value #>> '{}'
    when lower(coalesce(email, '')) in (
      'admin@trygc.com',
      'lamiaa@trygc.com',
      'adel@grand-community.com',
      'sabry@trygc.com',
      'a.ismail@trygc.com',
      'abdelfatah@trygc.com',
      'm.mahmoud@trygc.com'
    ) then 'master'
    else 'operations'
  end;
$$;

update public.ops_user_directory directory
set
  role = app_private.normalize_ops_role(users.raw_app_meta_data -> 'role', users.email),
  office = app_private.normalize_ops_office(
    users.raw_user_meta_data -> 'office',
    app_private.normalize_ops_role(users.raw_app_meta_data -> 'role', users.email)
  ),
  department = coalesce(
    nullif(users.raw_user_meta_data ->> 'department', ''),
    case when app_private.normalize_ops_role(users.raw_app_meta_data -> 'role', users.email) = 'community' then 'Coordination' else 'Operations' end
  ),
  title = coalesce(
    nullif(users.raw_user_meta_data ->> 'title', ''),
    case when app_private.normalize_ops_role(users.raw_app_meta_data -> 'role', users.email) = 'master' then 'Master Admin' else 'Team Member' end
  ),
  updated_at = now()
from auth.users users
where directory.uid = users.id;

create or replace function public.update_ops_user_account(
  p_id uuid,
  p_name text default null,
  p_role text default null,
  p_status text default null,
  p_office text default null,
  p_department text default null,
  p_title text default null
)
returns public.ops_user_directory
language plpgsql
security definer
set search_path = public, auth, app_private
as $$
declare
  caller_email text;
  caller_role text;
  existing_user auth.users%rowtype;
  next_role text;
  next_name text;
  next_office text;
  next_department text;
  next_title text;
  updated_row public.ops_user_directory%rowtype;
begin
  select email, raw_app_meta_data ->> 'role'
  into caller_email, caller_role
  from auth.users
  where id = auth.uid();

  if caller_role <> 'master'
    and lower(coalesce(caller_email, '')) not in (
      'admin@trygc.com',
      'lamiaa@trygc.com',
      'adel@grand-community.com',
      'sabry@trygc.com',
      'a.ismail@trygc.com',
      'abdelfatah@trygc.com',
      'm.mahmoud@trygc.com'
    ) then
    raise exception 'Only master users can manage workspace accounts.';
  end if;

  select *
  into existing_user
  from auth.users
  where id = p_id;

  if not found then
    raise exception 'User not found.';
  end if;

  next_role := coalesce(nullif(p_role, ''), app_private.normalize_ops_role(existing_user.raw_app_meta_data -> 'role', existing_user.email));
  if next_role not in ('master', 'operations', 'community') then
    raise exception 'Invalid role.';
  end if;

  next_name := coalesce(
    nullif(trim(p_name), ''),
    nullif(trim(existing_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(existing_user.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(existing_user.email, ''), '@', 1),
    'Workspace User'
  );

  next_office := coalesce(nullif(p_office, ''), app_private.normalize_ops_office(existing_user.raw_user_meta_data -> 'office', next_role));
  if next_office not in ('Egypt', 'KSA', 'UAE', 'Kuwait') then
    raise exception 'Invalid office.';
  end if;

  next_department := coalesce(
    nullif(p_department, ''),
    nullif(existing_user.raw_user_meta_data ->> 'department', ''),
    case when next_role = 'community' then 'Coordination' else 'Operations' end
  );
  next_title := coalesce(
    nullif(p_title, ''),
    nullif(existing_user.raw_user_meta_data ->> 'title', ''),
    case when next_role = 'master' then 'Master Admin' else 'Team Member' end
  );

  update auth.users
  set
    raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(next_role), true),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'display_name', next_name,
        'full_name', next_name,
        'office', next_office,
        'department', next_department,
        'title', next_title,
        'timezone', coalesce(nullif(raw_user_meta_data ->> 'timezone', ''), 'Africa/Cairo')
      ),
    banned_until = case
      when p_status = 'suspended' then now() + interval '100 years'
      when p_status = 'active' then null
      else banned_until
    end,
    updated_at = now()
  where id = p_id;

  select *
  into updated_row
  from public.ops_user_directory
  where uid = p_id;

  return updated_row;
end;
$$;

grant execute on function public.update_ops_user_account(uuid, text, text, text, text, text, text) to authenticated;
