alter table public.consultations
  add column if not exists consultation_type text,
  add column if not exists consultation_date date,
  add column if not exists consultation_time time,
  add column if not exists provider_name text,
  add column if not exists clinical_summary text,
  add column if not exists diagnosis text,
  add column if not exists present_illness_history text,
  add column if not exists review_of_symptoms text,
  add column if not exists allergies text,
  add column if not exists vitals text,
  add column if not exists treatment_plan text,
  add column if not exists medications text,
  add column if not exists lab_results text,
  add column if not exists differential_diagnosis text;

alter table public.prescriptions
  add column if not exists prescription_name text,
  add column if not exists instruction text;

update public.prescriptions
set
  prescription_name = coalesce(prescription_name, medication),
  instruction = coalesce(instruction, instructions)
where prescription_name is null
   or instruction is null;

alter table public.prescriptions enable row level security;

drop policy if exists "prescriptions staff access" on public.prescriptions;
create policy "prescriptions staff access"
on public.prescriptions
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "prescriptions patient read" on public.prescriptions;
create policy "prescriptions patient read"
on public.prescriptions
for select
using (
  exists (
    select 1
    from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = consultation_id
      and p.user_id = auth.uid()
  )
);
