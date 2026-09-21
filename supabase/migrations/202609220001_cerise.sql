begin;

create table public.cerise_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  last_operation uuid not null,
  updated_at timestamptz not null default now()
);

create table public.cerise_meals (
  user_id uuid not null references public.cerise_journals(user_id) on delete cascade,
  day date not null check (day between date '1970-01-01' and date '9999-12-31'),
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner')),
  calories numeric check (calories between 0 and 1000000 and calories = round(calories, 2)),
  protein numeric check (protein between 0 and 1000000 and protein = round(protein, 2)),
  primary key (user_id, day, meal),
  check (calories is not null or protein is not null)
);

create table public.cerise_targets (
  user_id uuid not null references public.cerise_journals(user_id) on delete cascade,
  effective_from date not null check (effective_from between date '1970-01-01' and date '9999-12-31'),
  calories numeric not null check (calories > 0 and calories <= 1000000 and calories = round(calories, 2)),
  protein numeric not null check (protein > 0 and protein <= 1000000 and protein = round(protein, 2)),
  primary key (user_id, effective_from)
);

alter table public.cerise_journals enable row level security;
alter table public.cerise_meals enable row level security;
alter table public.cerise_targets enable row level security;
revoke all on public.cerise_journals, public.cerise_meals, public.cerise_targets from anon, authenticated;
grant select on public.cerise_journals, public.cerise_meals, public.cerise_targets to authenticated;
create policy own_journal on public.cerise_journals for select to authenticated using ((select auth.uid()) = user_id);
create policy own_meals on public.cerise_meals for select to authenticated using ((select auth.uid()) = user_id);
create policy own_targets on public.cerise_targets for select to authenticated using ((select auth.uid()) = user_id);

create function public.cerise_read_journal()
returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (
    select jsonb_build_object(
      'revision', coalesce((select revision from public.cerise_journals where user_id = auth.uid()), 0),
      'state', jsonb_build_object(
        'version', 1,
        'days', coalesce((select jsonb_object_agg(day::text, meals) from (
          select day, jsonb_object_agg(meal, jsonb_build_object('calories', calories, 'protein', protein)) as meals
          from public.cerise_meals where user_id = auth.uid() group by day
        ) as days), '{}'::jsonb),
        'targets', coalesce((select jsonb_agg(jsonb_build_object('from', effective_from::text, 'calories', calories, 'protein', protein) order by effective_from)
          from public.cerise_targets where user_id = auth.uid()),
          '[{"from":"1970-01-01","calories":1500,"protein":115}]'::jsonb)
      )
    )
  );
end;
$$;

create function public.cerise_save_journal(expected_revision bigint, operation_id uuid, journal jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_revision bigint;
  previous_operation uuid;
  day_record record;
  meal_record record;
  target jsonb;
  metric text;
  amount jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if operation_id is null or expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid revision or operation' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select revision, last_operation into current_revision, previous_operation from public.cerise_journals where user_id = owner_id;
  if previous_operation = operation_id then return public.cerise_read_journal(); end if;
  if coalesce(current_revision, 0) <> expected_revision then raise exception 'Journal changed on another device' using errcode = '40001'; end if;
  if journal is null or jsonb_typeof(journal) <> 'object' or journal->'version' is distinct from '1'::jsonb
    or jsonb_typeof(journal->'days') is distinct from 'object' or jsonb_typeof(journal->'targets') is distinct from 'array'
    or octet_length(journal::text) > 5242880 then
    raise exception 'Invalid journal' using errcode = '22023';
  end if;
  if jsonb_array_length(journal->'targets') = 0 then raise exception 'Missing targets' using errcode = '22023'; end if;
  for day_record in select * from jsonb_each(journal->'days') loop
    if day_record.key !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(day_record.value) <> 'object' then
      raise exception 'Invalid day' using errcode = '22023';
    end if;
    if day_record.key::date < date '1970-01-01' then raise exception 'Invalid day' using errcode = '22023'; end if;
    for meal_record in select * from jsonb_each(day_record.value) loop
      if meal_record.key not in ('breakfast', 'lunch', 'snack', 'dinner') or jsonb_typeof(meal_record.value) <> 'object' then
        raise exception 'Invalid meal' using errcode = '22023';
      end if;
      foreach metric in array array['calories', 'protein'] loop
        amount := meal_record.value->metric;
        if amount is null or jsonb_typeof(amount) not in ('number', 'null') then raise exception 'Invalid amount' using errcode = '22023'; end if;
      end loop;
    end loop;
  end loop;
  for target in select * from jsonb_array_elements(journal->'targets') loop
    if jsonb_typeof(target) <> 'object' or jsonb_typeof(target->'from') is distinct from 'string'
      or (target->>'from') !~ '^\d{4}-\d{2}-\d{2}$'
      or jsonb_typeof(target->'calories') is distinct from 'number' or jsonb_typeof(target->'protein') is distinct from 'number' then
      raise exception 'Invalid target' using errcode = '22023';
    end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(journal->'targets') as target_row(value) where target_row.value->>'from' = '1970-01-01') then
    raise exception 'Missing base target' using errcode = '22023';
  end if;
  insert into public.cerise_journals(user_id, revision, last_operation)
  values(owner_id, 1, operation_id)
  on conflict(user_id) do update set revision = cerise_journals.revision + 1, last_operation = excluded.last_operation, updated_at = now();
  delete from public.cerise_meals where user_id = owner_id;
  delete from public.cerise_targets where user_id = owner_id;
  insert into public.cerise_meals(user_id, day, meal, calories, protein)
  select owner_id, days.key::date, meals.key, (meals.value->>'calories')::numeric, (meals.value->>'protein')::numeric
  from jsonb_each(journal->'days') as days cross join lateral jsonb_each(days.value) as meals
  where meals.value->>'calories' is not null or meals.value->>'protein' is not null;
  insert into public.cerise_targets(user_id, effective_from, calories, protein)
  select owner_id, (target_row.value->>'from')::date, (target_row.value->>'calories')::numeric, (target_row.value->>'protein')::numeric
  from jsonb_array_elements(journal->'targets') as target_row(value);
  return public.cerise_read_journal();
end;
$$;

revoke all on function public.cerise_read_journal() from public, anon;
revoke all on function public.cerise_save_journal(bigint, uuid, jsonb) from public, anon;
grant execute on function public.cerise_read_journal() to authenticated;
grant execute on function public.cerise_save_journal(bigint, uuid, jsonb) to authenticated;

commit;