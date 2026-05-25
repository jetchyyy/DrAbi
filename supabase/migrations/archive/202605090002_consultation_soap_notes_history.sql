-- Keep a full history of consultation SOAP/vitals snapshots whenever a consultation is
-- created or updated, so previous notes are never lost even if the consultation row changes.

create table if not exists public.consultation_soap_notes_history (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  appointment_id uuid null,
  patient_id uuid not null,
  doctor_id uuid not null,
  change_type text not null check (change_type in ('insert', 'update')),
  changed_at timestamptz not null default timezone('utc', now()),
  old_snapshot jsonb null,
  new_snapshot jsonb not null
);

create index if not exists idx_consultation_soap_notes_history_consultation_id
  on public.consultation_soap_notes_history (consultation_id, changed_at desc);

alter table public.consultation_soap_notes_history enable row level security;

revoke all on table public.consultation_soap_notes_history from anon, authenticated;

drop policy if exists "consultation_soap_history_no_client_access" on public.consultation_soap_notes_history;

create policy "consultation_soap_history_no_client_access"
on public.consultation_soap_notes_history
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.log_consultation_soap_notes_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_snapshot jsonb;
  v_new_snapshot jsonb;
begin
  v_new_snapshot := jsonb_build_object(
    'consultation_type', new.consultation_type,
    'consultation_date', new.consultation_date,
    'consultation_time', new.consultation_time,
    'provider_name', new.provider_name,
    'present_illness_history', new.present_illness_history,
    'review_of_symptoms', new.review_of_symptoms,
    'allergies', new.allergies,
    'vitals', new.vitals,
    'medications', new.medications,
    'lab_results', new.lab_results,
    'diagnosis', new.diagnosis,
    'differential_diagnosis', new.differential_diagnosis,
    'subjective', new.subjective,
    'objective', new.objective,
    'assessment', new.assessment,
    'plan', new.plan,
    'clinical_summary', new.clinical_summary,
    'treatment_plan', new.treatment_plan,
    'outcome', new.outcome
  );

  if tg_op = 'UPDATE' then
    if not (
      old.consultation_type is distinct from new.consultation_type or
      old.consultation_date is distinct from new.consultation_date or
      old.consultation_time is distinct from new.consultation_time or
      old.provider_name is distinct from new.provider_name or
      old.present_illness_history is distinct from new.present_illness_history or
      old.review_of_symptoms is distinct from new.review_of_symptoms or
      old.allergies is distinct from new.allergies or
      old.vitals is distinct from new.vitals or
      old.medications is distinct from new.medications or
      old.lab_results is distinct from new.lab_results or
      old.diagnosis is distinct from new.diagnosis or
      old.differential_diagnosis is distinct from new.differential_diagnosis or
      old.subjective is distinct from new.subjective or
      old.objective is distinct from new.objective or
      old.assessment is distinct from new.assessment or
      old.plan is distinct from new.plan or
      old.clinical_summary is distinct from new.clinical_summary or
      old.treatment_plan is distinct from new.treatment_plan or
      old.outcome is distinct from new.outcome
    ) then
      return new;
    end if;

    v_old_snapshot := jsonb_build_object(
      'consultation_type', old.consultation_type,
      'consultation_date', old.consultation_date,
      'consultation_time', old.consultation_time,
      'provider_name', old.provider_name,
      'present_illness_history', old.present_illness_history,
      'review_of_symptoms', old.review_of_symptoms,
      'allergies', old.allergies,
      'vitals', old.vitals,
      'medications', old.medications,
      'lab_results', old.lab_results,
      'diagnosis', old.diagnosis,
      'differential_diagnosis', old.differential_diagnosis,
      'subjective', old.subjective,
      'objective', old.objective,
      'assessment', old.assessment,
      'plan', old.plan,
      'clinical_summary', old.clinical_summary,
      'treatment_plan', old.treatment_plan,
      'outcome', old.outcome
    );
  else
    v_old_snapshot := null;
  end if;

  insert into public.consultation_soap_notes_history (
    consultation_id,
    appointment_id,
    patient_id,
    doctor_id,
    change_type,
    old_snapshot,
    new_snapshot
  )
  values (
    new.id,
    new.appointment_id,
    new.patient_id,
    new.doctor_id,
    lower(tg_op),
    v_old_snapshot,
    v_new_snapshot
  );

  return new;
end;
$$;

drop trigger if exists trg_consultation_soap_notes_history on public.consultations;

create trigger trg_consultation_soap_notes_history
after insert or update on public.consultations
for each row
execute function public.log_consultation_soap_notes_history();
