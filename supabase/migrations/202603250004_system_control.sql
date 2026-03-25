alter table public.clinic_settings
add column if not exists system_enabled boolean not null default true,
add column if not exists system_message text not null default 'Contact your System Administrator to continue using the System';
