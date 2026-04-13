create or replace function public.complete_consultation_and_appointment(
  p_appointment_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_consultation_type text,
  p_consultation_date date,
  p_consultation_time time,
  p_provider_name text,
  p_clinical_summary text,
  p_diagnosis text,
  p_present_illness_history text,
  p_review_of_symptoms text,
  p_allergies text,
  p_vitals text,
  p_treatment_plan text,
  p_medications text,
  p_lab_results text,
  p_differential_diagnosis text,
  p_subjective text,
  p_objective text,
  p_assessment text,
  p_plan text,
  p_outcome text,
  p_completed_by uuid,
  p_amount numeric default 0
)
returns table (consultation_id uuid, appointment_id uuid, transaction_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consultation_id uuid;
  v_transaction_id uuid;
begin
  if p_appointment_id is null then
    raise exception 'Appointment is required.';
  end if;

  insert into public.consultations (
    appointment_id,
    patient_id,
    doctor_id,
    consultation_type,
    consultation_date,
    consultation_time,
    provider_name,
    clinical_summary,
    diagnosis,
    present_illness_history,
    review_of_symptoms,
    allergies,
    vitals,
    treatment_plan,
    medications,
    lab_results,
    differential_diagnosis,
    subjective,
    objective,
    assessment,
    plan,
    outcome
  )
  values (
    p_appointment_id,
    p_patient_id,
    p_doctor_id,
    p_consultation_type,
    p_consultation_date,
    p_consultation_time,
    p_provider_name,
    p_clinical_summary,
    p_diagnosis,
    p_present_illness_history,
    p_review_of_symptoms,
    p_allergies,
    p_vitals,
    p_treatment_plan,
    p_medications,
    p_lab_results,
    p_differential_diagnosis,
    coalesce(p_subjective, ''),
    coalesce(p_objective, ''),
    coalesce(p_assessment, ''),
    coalesce(p_plan, ''),
    coalesce(p_outcome, '')
  )
  on conflict on constraint consultations_appointment_id_key do update
  set consultation_type = excluded.consultation_type,
      consultation_date = excluded.consultation_date,
      consultation_time = excluded.consultation_time,
      provider_name = excluded.provider_name,
      clinical_summary = excluded.clinical_summary,
      diagnosis = excluded.diagnosis,
      present_illness_history = excluded.present_illness_history,
      review_of_symptoms = excluded.review_of_symptoms,
      allergies = excluded.allergies,
      vitals = excluded.vitals,
      treatment_plan = excluded.treatment_plan,
      medications = excluded.medications,
      lab_results = excluded.lab_results,
      differential_diagnosis = excluded.differential_diagnosis,
      subjective = excluded.subjective,
      objective = excluded.objective,
      assessment = excluded.assessment,
      plan = excluded.plan,
      outcome = excluded.outcome,
      updated_at = timezone('utc', now())
  returning id into v_consultation_id;

  update public.appointments
  set status = 'completed',
      consultation_id = v_consultation_id,
      completed_by = p_completed_by,
      completed_at = timezone('utc', now())
  where id = p_appointment_id;

  insert into public.medical_services_transactions (
    consultation_id,
    appointment_id,
    patient_id,
    provider_id,
    consultation_type,
    amount,
    actor
  )
  values (
    v_consultation_id,
    p_appointment_id,
    p_patient_id,
    p_doctor_id,
    coalesce(p_consultation_type, ''),
    coalesce(p_amount, 0),
    p_completed_by
  )
  on conflict on constraint medical_services_transactions_consultation_id_key do update
  set amount = excluded.amount,
      consultation_type = excluded.consultation_type,
      actor = excluded.actor,
      updated_at = timezone('utc', now())
  returning id into v_transaction_id;

  insert into public.patient_medical_history_entries (
    patient_id,
    consultation_id,
    appointment_id,
    provider_id,
    history_text,
    findings_text,
    diagnoses_text,
    treatment_summary_text,
    soap_notes_text,
    supplementary_docs_text,
    actor
  )
  values (
    p_patient_id,
    v_consultation_id,
    p_appointment_id,
    p_doctor_id,
    coalesce(p_present_illness_history, ''),
    concat_ws(E'\n', nullif(p_vitals, ''), nullif(p_medications, ''), nullif(p_lab_results, '')),
    concat_ws(E'\n', nullif(p_diagnosis, ''), nullif(p_differential_diagnosis, '')),
    coalesce(p_clinical_summary, ''),
    concat_ws(E'\n', nullif(p_subjective, ''), nullif(p_objective, ''), nullif(p_assessment, ''), nullif(p_plan, '')),
    coalesce(p_review_of_symptoms, ''),
    p_completed_by
  );

  return query select v_consultation_id, p_appointment_id, v_transaction_id;
end;
$$;