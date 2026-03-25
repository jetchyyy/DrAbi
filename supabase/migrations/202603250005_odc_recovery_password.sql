alter table public.clinic_settings
add column if not exists odc_recovery_password_hash text;
