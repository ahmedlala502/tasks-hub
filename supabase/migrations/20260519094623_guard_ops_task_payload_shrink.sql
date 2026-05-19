create or replace function public.guard_ops_tasks_payload_shrink()
returns trigger
language plpgsql
as $$
declare
  old_count integer;
  new_count integer;
begin
  if new.record_type = 'tasks'
    and jsonb_typeof(old.payload) = 'array'
    and jsonb_typeof(new.payload) = 'array'
  then
    old_count := jsonb_array_length(old.payload);
    new_count := jsonb_array_length(new.payload);

    if old_count > new_count + 5 then
      with incoming as (
        select task, ordinality
        from jsonb_array_elements(new.payload) with ordinality as item(task, ordinality)
      ),
      preserved as (
        select task, 100000 + ordinality as ordinality
        from jsonb_array_elements(old.payload) with ordinality as item(task, ordinality)
        where not exists (
          select 1
          from incoming
          where incoming.task->>'id' = item.task->>'id'
        )
      ),
      merged as (
        select task, ordinality from incoming
        union all
        select task, ordinality from preserved
      )
      select jsonb_agg(task order by ordinality)
      into new.payload
      from merged;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_ops_tasks_payload_shrink_trigger on public.ops_workspace_records;

create trigger guard_ops_tasks_payload_shrink_trigger
before update of payload on public.ops_workspace_records
for each row
when (old.record_type = 'tasks' and new.record_type = 'tasks')
execute function public.guard_ops_tasks_payload_shrink();
