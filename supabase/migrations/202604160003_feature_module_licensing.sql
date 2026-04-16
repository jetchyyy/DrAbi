alter table public.clinic_settings
add column if not exists enabled_modules jsonb not null default '{
  "dashboard": true,
  "patient_management": true,
  "booking_appointments": true,
  "billing": true,
  "pos": true,
  "inventory": true,
  "laboratory": true,
  "teleconsult": true
}'::jsonb;

update public.clinic_settings
set enabled_modules = coalesce(enabled_modules, '{}'::jsonb) || '{
  "dashboard": true,
  "patient_management": true,
  "booking_appointments": true,
  "billing": true,
  "pos": true,
  "inventory": true,
  "laboratory": true,
  "teleconsult": true
}'::jsonb
where enabled_modules is null
   or jsonb_typeof(enabled_modules) <> 'object';
