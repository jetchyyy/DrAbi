create table if not exists public.medical_certificates (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  certificate_purpose text not null default '',
  diagnosis text not null default '',
  recommendation text not null default '',
  rest_from date,
  rest_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists medical_certificates_patient_id_idx
on public.medical_certificates (patient_id, created_at desc);

create trigger set_updated_at_medical_certificates
before update on public.medical_certificates
for each row execute function public.set_updated_at();