alter table public.services
add column if not exists delivery_mode text not null default 'in_person';

alter table public.appointments
add column if not exists visit_type text not null default 'in_person',
add column if not exists teleconsultation_platform text,
add column if not exists teleconsultation_url text,
add column if not exists teleconsultation_access_instructions text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_delivery_mode_check'
  ) then
    alter table public.services
    add constraint services_delivery_mode_check
    check (delivery_mode in ('in_person', 'teleconsultation', 'hybrid'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'appointments_visit_type_check'
  ) then
    alter table public.appointments
    add constraint appointments_visit_type_check
    check (visit_type in ('in_person', 'teleconsultation'));
  end if;
end $$;
