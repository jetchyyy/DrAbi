alter table public.appointments
  add column if not exists consultation_id uuid references public.consultations(id) on delete set null,
  add column if not exists completed_by uuid references public.profiles(id),
  add column if not exists completed_at timestamptz;

create index if not exists appointments_consultation_id_idx on public.appointments (consultation_id);
create index if not exists appointments_completed_at_idx on public.appointments (completed_at desc);

create table if not exists public.consultation_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.consultation_types (code, name, description)
values
  ('initial', 'Initial Consultation', 'First time clinical encounter.'),
  ('follow_up', 'Follow-up Consultation', 'Follow-up encounter after prior consultation.'),
  ('teleconsult', 'Teleconsultation', 'Consultation delivered through teleconsultation platform.')
on conflict (code) do nothing;

create table if not exists public.patient_medical_history_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  provider_id uuid references public.doctors(id) on delete set null,
  history_text text not null default '',
  findings_text text not null default '',
  diagnoses_text text not null default '',
  treatment_summary_text text not null default '',
  soap_notes_text text not null default '',
  supplementary_docs_text text not null default '',
  actor uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists patient_medical_history_entries_patient_id_idx
on public.patient_medical_history_entries (patient_id, created_at desc);

create table if not exists public.medical_services_transactions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid unique references public.consultations(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  provider_id uuid references public.doctors(id) on delete set null,
  consultation_type text not null,
  amount numeric(12,2) not null default 0,
  actor uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists medical_services_transactions_patient_id_idx
on public.medical_services_transactions (patient_id, created_at desc);

create index if not exists medical_services_transactions_provider_id_idx
on public.medical_services_transactions (provider_id, created_at desc);

create or replace view public.providers as
select
  d.id,
  d.profile_id,
  p.full_name,
  p.email,
  d.specialty_id,
  d.consultation_fee,
  d.follow_up_fee,
  d.created_at,
  d.updated_at
from public.doctors d
join public.profiles p on p.id = d.profile_id
where d.deleted_at is null;

create trigger set_updated_at_consultation_types before update on public.consultation_types for each row execute function public.set_updated_at();
create trigger set_updated_at_patient_medical_history_entries before update on public.patient_medical_history_entries for each row execute function public.set_updated_at();
create trigger set_updated_at_medical_services_transactions before update on public.medical_services_transactions for each row execute function public.set_updated_at();

alter table public.consultation_types enable row level security;
alter table public.patient_medical_history_entries enable row level security;
alter table public.medical_services_transactions enable row level security;

drop policy if exists "consultation types staff access" on public.consultation_types;
create policy "consultation types staff access"
on public.consultation_types
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "patient medical history staff access" on public.patient_medical_history_entries;
create policy "patient medical history staff access"
on public.patient_medical_history_entries
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "patient medical history patient read" on public.patient_medical_history_entries;
create policy "patient medical history patient read"
on public.patient_medical_history_entries
for select
using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "medical services transactions staff access" on public.medical_services_transactions;
create policy "medical services transactions staff access"
on public.medical_services_transactions
for all
using (public.is_staff())
with check (public.is_staff());

grant select on public.providers to authenticated;
