alter table public.patients
add column if not exists qr_code text;

update public.patients
set qr_code = 'ODC-PAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where qr_code is null or btrim(qr_code) = '';

alter table public.patients
alter column qr_code set default ('ODC-PAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

alter table public.patients
alter column qr_code set not null;

create unique index if not exists patients_qr_code_key on public.patients (qr_code);

