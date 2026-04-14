alter table public.patients
  add column if not exists last_clinic_visit_at timestamptz;