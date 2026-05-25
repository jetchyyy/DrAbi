alter table public.doctor_availability enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'doctor_availability_unique_slot'
  ) then
    alter table public.doctor_availability
      add constraint doctor_availability_unique_slot
      unique (doctor_id, day_of_week, start_time);
  end if;
end
$$;

drop policy if exists "doctor availability public read" on public.doctor_availability;
create policy "doctor availability public read"
on public.doctor_availability
for select
using (true);

drop policy if exists "doctor availability doctor manage own" on public.doctor_availability;
create policy "doctor availability doctor manage own"
on public.doctor_availability
for all
using (
  public.current_app_role() = 'owner_admin'
  or exists (
    select 1
    from public.doctors d
    where d.id = doctor_id
      and d.profile_id = auth.uid()
  )
)
with check (
  public.current_app_role() = 'owner_admin'
  or exists (
    select 1
    from public.doctors d
    where d.id = doctor_id
      and d.profile_id = auth.uid()
  )
);

insert into public.doctors (profile_id)
select p.id
from public.profiles p
where p.role = 'doctor'
  and not exists (
    select 1
    from public.doctors d
    where d.profile_id = p.id
  );

create or replace function public.ensure_doctor_row_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'doctor' then
    insert into public.doctors (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_doctor_bootstrap on public.profiles;

create trigger on_profile_doctor_bootstrap
after insert or update of role on public.profiles
for each row execute function public.ensure_doctor_row_for_profile();
