alter table public.doctors
  add column if not exists license_expiry date,
  add column if not exists bir_number text,
  add column if not exists prc_id_path text;
