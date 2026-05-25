alter table public.patients
add column if not exists intake_source text not null default 'online_registration',
add column if not exists visit_status text not null default 'registered_no_visit';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_intake_source_check'
  ) then
    alter table public.patients
    add constraint patients_intake_source_check
    check (intake_source in ('online_registration', 'staff_walk_in'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'patients_visit_status_check'
  ) then
    alter table public.patients
    add constraint patients_visit_status_check
    check (visit_status in ('registered_no_visit', 'visited_clinic'));
  end if;
end $$;

update public.patients
set
  intake_source = case
    when user_id is null then 'staff_walk_in'
    else 'online_registration'
  end,
  visit_status = 'visited_clinic';
