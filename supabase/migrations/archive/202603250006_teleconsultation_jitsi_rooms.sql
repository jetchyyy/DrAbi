alter table public.appointments
add column if not exists teleconsultation_provider text,
add column if not exists teleconsultation_room_name text;

update public.appointments
set teleconsultation_provider = coalesce(teleconsultation_provider, 'jitsi'),
    teleconsultation_platform = coalesce(teleconsultation_platform, 'Jitsi Meet'),
    teleconsultation_room_name = coalesce(teleconsultation_room_name, replace(gen_random_uuid()::text, '-', ''))
where visit_type = 'teleconsultation';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_teleconsultation_provider_check'
  ) then
    alter table public.appointments
    add constraint appointments_teleconsultation_provider_check
    check (teleconsultation_provider in ('jitsi') or teleconsultation_provider is null);
  end if;
end $$;

create unique index if not exists appointments_teleconsultation_room_name_key
on public.appointments (teleconsultation_room_name)
where teleconsultation_room_name is not null;
