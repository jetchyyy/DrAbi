alter table public.profiles
  add column if not exists security_pin_hash text,
  add column if not exists pin_updated_at timestamptz;
