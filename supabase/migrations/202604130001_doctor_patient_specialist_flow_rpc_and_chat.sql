alter table public.appointments
  add column if not exists related_referral_id uuid references public.referrals(id) on delete set null;

create index if not exists appointments_related_referral_id_idx on public.appointments (related_referral_id);

alter table public.referrals
  add column if not exists source_appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists source_consultation_id uuid references public.consultations(id) on delete set null,
  add column if not exists referring_generalist_id uuid references public.doctors(id) on delete set null,
  add column if not exists assigned_specialist_id uuid references public.doctors(id) on delete set null,
  add column if not exists appointment_date date,
  add column if not exists appointment_time time,
  add column if not exists generalist_notes text not null default '',
  add column if not exists practice_location jsonb not null default '{}'::jsonb,
  add column if not exists specialist_schedule_id uuid;

update public.referrals
set source_appointment_id = coalesce(source_appointment_id, appointment_id),
    referring_generalist_id = coalesce(referring_generalist_id, referring_doctor_id),
    assigned_specialist_id = coalesce(assigned_specialist_id, target_doctor_id)
where source_appointment_id is null
   or referring_generalist_id is null
   or assigned_specialist_id is null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'referrals_status_check'
      and conrelid = 'public.referrals'::regclass
  ) then
    alter table public.referrals drop constraint referrals_status_check;
  end if;

  alter table public.referrals
    add constraint referrals_status_check
    check (
      status in (
        'draft',
        'sent',
        'pending',
        'accepted',
        'confirmed',
        'completed',
        'declined',
        'cancelled'
      )
    );
end
$$;

create index if not exists referrals_referring_generalist_status_idx on public.referrals (referring_generalist_id, status);
create index if not exists referrals_assigned_specialist_status_idx on public.referrals (assigned_specialist_id, status);

create table if not exists public.specialist_schedules (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.doctors(id) on delete cascade,
  recurrence jsonb not null default '{}'::jsonb,
  slot_template jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  valid_from date,
  practice_location jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.specialist_appointments (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.doctors(id) on delete cascade,
  schedule_id uuid references public.specialist_schedules(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  is_booked boolean not null default true,
  status text not null default 'confirmed',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (specialist_id, schedule_id, slot_date, slot_time)
);

create index if not exists specialist_appointments_referral_id_idx on public.specialist_appointments (referral_id);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  thread_key text not null unique,
  type text not null default 'direct',
  linked_appointment_id uuid references public.appointments(id) on delete set null,
  linked_referral_id uuid references public.referrals(id) on delete set null,
  last_message_text text,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (participant_a <> participant_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.thread_unread (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unread_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (thread_id, user_id)
);

create index if not exists messages_thread_id_sent_at_idx on public.messages (thread_id, sent_at desc);
create index if not exists chat_threads_thread_key_idx on public.chat_threads (thread_key);

create trigger set_updated_at_specialist_schedules before update on public.specialist_schedules for each row execute function public.set_updated_at();
create trigger set_updated_at_specialist_appointments before update on public.specialist_appointments for each row execute function public.set_updated_at();
create trigger set_updated_at_chat_threads before update on public.chat_threads for each row execute function public.set_updated_at();
create trigger set_updated_at_messages before update on public.messages for each row execute function public.set_updated_at();
create trigger set_updated_at_thread_unread before update on public.thread_unread for each row execute function public.set_updated_at();

create or replace function public.ensure_direct_thread(
  participant_1 uuid,
  participant_2 uuid,
  linked_referral_id uuid default null,
  linked_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left uuid;
  v_right uuid;
  v_thread_key text;
  v_thread_id uuid;
begin
  if participant_1 is null or participant_2 is null or participant_1 = participant_2 then
    raise exception 'Invalid participants for direct thread.';
  end if;

  if participant_1::text < participant_2::text then
    v_left := participant_1;
    v_right := participant_2;
  else
    v_left := participant_2;
    v_right := participant_1;
  end if;

  v_thread_key := v_left::text || '_' || v_right::text;

  insert into public.chat_threads (
    participant_a,
    participant_b,
    thread_key,
    linked_referral_id,
    linked_appointment_id
  )
  values (
    v_left,
    v_right,
    v_thread_key,
    linked_referral_id,
    linked_appointment_id
  )
  on conflict (thread_key) do update
  set linked_referral_id = coalesce(excluded.linked_referral_id, public.chat_threads.linked_referral_id),
      linked_appointment_id = coalesce(excluded.linked_appointment_id, public.chat_threads.linked_appointment_id),
      updated_at = timezone('utc', now())
  returning id into v_thread_id;

  return v_thread_id;
end;
$$;

create or replace function public.create_referral_with_slot_lock(
  p_patient_id uuid,
  p_referring_generalist_id uuid,
  p_assigned_specialist_id uuid,
  p_source_appointment_id uuid default null,
  p_source_consultation_id uuid default null,
  p_slot_date date default null,
  p_slot_time time default null,
  p_reason text default '',
  p_generalist_notes text default '',
  p_practice_location jsonb default '{}'::jsonb,
  p_specialist_schedule_id uuid default null,
  p_actor uuid default null
)
returns table (referral_id uuid, specialist_appointment_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_id uuid;
  v_slot_id uuid;
begin
  if p_patient_id is null then
    raise exception 'Patient is required.';
  end if;

  if p_referring_generalist_id is null or p_assigned_specialist_id is null then
    raise exception 'Both referring and assigned specialist doctors are required.';
  end if;

  insert into public.referrals (
    patient_id,
    appointment_id,
    source_appointment_id,
    source_consultation_id,
    referring_doctor_id,
    target_doctor_id,
    referring_generalist_id,
    assigned_specialist_id,
    appointment_date,
    appointment_time,
    reason,
    referral_notes,
    generalist_notes,
    clinical_summary,
    status,
    practice_location,
    specialist_schedule_id,
    referred_at
  )
  values (
    p_patient_id,
    p_source_appointment_id,
    p_source_appointment_id,
    p_source_consultation_id,
    p_referring_generalist_id,
    p_assigned_specialist_id,
    p_referring_generalist_id,
    p_assigned_specialist_id,
    p_slot_date,
    p_slot_time,
    coalesce(p_reason, ''),
    coalesce(p_generalist_notes, ''),
    coalesce(p_generalist_notes, ''),
    '',
    'pending',
    coalesce(p_practice_location, '{}'::jsonb),
    p_specialist_schedule_id,
    timezone('utc', now())
  )
  returning id into v_referral_id;

  if p_slot_date is not null and p_slot_time is not null then
    insert into public.specialist_appointments (
      specialist_id,
      schedule_id,
      referral_id,
      patient_id,
      slot_date,
      slot_time,
      is_booked,
      status
    )
    values (
      p_assigned_specialist_id,
      p_specialist_schedule_id,
      v_referral_id,
      p_patient_id,
      p_slot_date,
      p_slot_time,
      true,
      'confirmed'
    )
    on conflict (specialist_id, schedule_id, slot_date, slot_time) do nothing
    returning id into v_slot_id;

    if v_slot_id is null then
      raise exception 'Selected specialist slot is no longer available.';
    end if;
  end if;

  if p_source_appointment_id is not null then
    update public.appointments
    set related_referral_id = v_referral_id
    where id = p_source_appointment_id;
  end if;

  return query select v_referral_id, v_slot_id;
end;
$$;

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
  on conflict (appointment_id) do update
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
  on conflict (consultation_id) do update
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

create or replace function public.ensure_appointment_direct_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_profile uuid;
  v_patient_profile uuid;
begin
  if new.status not in ('confirmed', 'completed') then
    return new;
  end if;

  select d.profile_id
  into v_doctor_profile
  from public.doctors d
  where d.id = new.doctor_id;

  select p.user_id
  into v_patient_profile
  from public.patients p
  where p.id = new.patient_id;

  if v_doctor_profile is not null and v_patient_profile is not null then
    perform public.ensure_direct_thread(v_doctor_profile, v_patient_profile, null, new.id);
  end if;

  return new;
end;
$$;

create or replace function public.ensure_referral_direct_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generalist_doctor_id uuid;
  v_specialist_doctor_id uuid;
  v_generalist_profile uuid;
  v_specialist_profile uuid;
begin
  if new.status not in ('accepted', 'confirmed', 'completed') then
    return new;
  end if;

  v_generalist_doctor_id := coalesce(new.referring_generalist_id, new.referring_doctor_id);
  v_specialist_doctor_id := coalesce(new.assigned_specialist_id, new.target_doctor_id);

  select d.profile_id
  into v_generalist_profile
  from public.doctors d
  where d.id = v_generalist_doctor_id;

  select d.profile_id
  into v_specialist_profile
  from public.doctors d
  where d.id = v_specialist_doctor_id;

  if v_generalist_profile is not null and v_specialist_profile is not null then
    perform public.ensure_direct_thread(v_generalist_profile, v_specialist_profile, new.id, null);
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_direct_thread_trigger on public.appointments;
create trigger appointments_direct_thread_trigger
after insert or update of status on public.appointments
for each row execute function public.ensure_appointment_direct_thread();

drop trigger if exists referrals_direct_thread_trigger on public.referrals;
create trigger referrals_direct_thread_trigger
after insert or update of status on public.referrals
for each row execute function public.ensure_referral_direct_thread();

alter table public.specialist_schedules enable row level security;
alter table public.specialist_appointments enable row level security;
alter table public.chat_threads enable row level security;
alter table public.messages enable row level security;
alter table public.thread_unread enable row level security;

drop policy if exists "specialist schedules read for staff" on public.specialist_schedules;
create policy "specialist schedules read for staff"
on public.specialist_schedules
for select
using (public.is_staff());

drop policy if exists "specialist schedules specialist manage own" on public.specialist_schedules;
create policy "specialist schedules specialist manage own"
on public.specialist_schedules
for all
using (
  public.current_app_role() = 'owner_admin'
  or exists (
    select 1
    from public.doctors d
    where d.id = specialist_id
      and d.profile_id = auth.uid()
  )
)
with check (
  public.current_app_role() = 'owner_admin'
  or exists (
    select 1
    from public.doctors d
    where d.id = specialist_id
      and d.profile_id = auth.uid()
  )
);

drop policy if exists "specialist appointments staff access" on public.specialist_appointments;
create policy "specialist appointments staff access"
on public.specialist_appointments
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "chat threads participant access" on public.chat_threads;
create policy "chat threads participant access"
on public.chat_threads
for all
using (participant_a = auth.uid() or participant_b = auth.uid())
with check (participant_a = auth.uid() or participant_b = auth.uid());

drop policy if exists "messages participant access" on public.messages;
create policy "messages participant access"
on public.messages
for all
using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = thread_id
      and (t.participant_a = auth.uid() or t.participant_b = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.chat_threads t
    where t.id = thread_id
      and (t.participant_a = auth.uid() or t.participant_b = auth.uid())
  )
);

drop policy if exists "thread unread participant access" on public.thread_unread;
create policy "thread unread participant access"
on public.thread_unread
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant execute on function public.ensure_direct_thread(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.create_referral_with_slot_lock(uuid, uuid, uuid, uuid, uuid, date, time, text, text, jsonb, uuid, uuid) to authenticated, service_role;
grant execute on function public.complete_consultation_and_appointment(uuid, uuid, uuid, text, date, time, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric) to authenticated, service_role;
