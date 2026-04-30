-- ============================================================================
-- ODYSSEY CLINIC SYSTEM - FUNCTIONS, POLICIES & BOOTSTRAP DATA
-- ============================================================================
-- Part 2 of the fresh database setup. Run this AFTER the schema migration.
-- This includes all RLS policies, business logic functions, triggers, and
-- bootstrap data.
--
-- Date: 2026-04-25
-- Version: 1.0
-- ============================================================================

-- ============================================================================
-- PART 1: RLS POLICIES
-- ============================================================================

-- Clinic Settings
create policy "clinic settings readable" on public.clinic_settings for select using (true);
create policy "clinic settings staff manage" on public.clinic_settings for all using (public.is_staff()) with check (public.is_staff());

-- Profiles
create policy "profiles self read" on public.profiles for select using (auth.uid() = id or public.is_staff());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id or public.current_app_role() = 'owner_admin') with check (auth.uid() = id or public.current_app_role() = 'owner_admin');
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);

-- Specialties
create policy "catalog public read specialties" on public.specialties for select using (deleted_at is null);
create policy "catalog staff manage specialties" on public.specialties for all using (public.is_staff()) with check (public.is_staff());

-- Services
create policy "catalog public read services" on public.services for select using (deleted_at is null);
create policy "catalog staff manage services" on public.services for all using (public.is_staff()) with check (public.is_staff());

-- Doctor Availability
create policy "doctor availability public read" on public.doctor_availability for select using (true);
create policy "doctor availability doctor manage own" on public.doctor_availability for all
  using (
    public.current_app_role() = 'owner_admin'
    or exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.profile_id = auth.uid()
    )
  )
  with check (
    public.current_app_role() = 'owner_admin'
    or exists (
      select 1
      from public.doctors d
      where d.id = doctor_id
        and d.profile_id = auth.uid()
    )
  );

-- Patients
create policy "patients staff access" on public.patients for all using (public.is_staff()) with check (public.is_staff());
create policy "patients self read" on public.patients for select using (user_id = auth.uid());
create policy "patients self update" on public.patients for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "patients self insert" on public.patients for insert with check (user_id = auth.uid());

-- Bookings
create policy "bookings patient access" on public.bookings for select using (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff()
);
create policy "bookings patient insert" on public.bookings for insert with check (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff()
);
create policy "bookings patient update" on public.bookings for update using (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff()
) with check (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff()
);

-- Appointments
create policy "appointments staff access" on public.appointments for all using (public.is_staff()) with check (public.is_staff());
create policy "appointments patient read" on public.appointments for select using (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid())
);

-- Consultations
create policy "consultations staff access" on public.consultations for all using (public.is_staff()) with check (public.is_staff());
create policy "consultations patient read" on public.consultations for select using (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid())
);

-- Prescriptions
create policy "prescriptions staff access" on public.prescriptions for all using (public.is_staff()) with check (public.is_staff());
create policy "prescriptions patient read" on public.prescriptions for select using (
  exists (
    select 1
    from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = consultation_id
      and p.user_id = auth.uid()
  )
);

-- Invoices
create policy "invoices staff access" on public.invoices for all using (public.is_staff()) with check (public.is_staff());
create policy "invoices patient read" on public.invoices for select using (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid())
);

-- Inventory Items
create policy "inventory staff access" on public.inventory_items for all using (public.is_staff()) with check (public.is_staff());

-- Lab Orders
create policy "lab orders staff access" on public.lab_orders for all using (public.is_staff()) with check (public.is_staff());
create policy "lab orders patient read" on public.lab_orders for select using (
  exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid())
);

-- Lab Results
create policy "lab results staff access" on public.lab_results for all using (public.is_staff()) with check (public.is_staff());
create policy "lab results patient read" on public.lab_results for select using (
  exists (
    select 1
    from public.lab_orders lo
    join public.patients p on p.id = lo.patient_id
    where lo.id = lab_order_id
      and p.user_id = auth.uid()
  )
);

-- Referrals
create policy "referrals staff access" on public.referrals for all using (public.is_staff()) with check (public.is_staff());
create policy "referrals patient read" on public.referrals for select using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.user_id = auth.uid()
  )
);

-- Consultation Types
create policy "consultation types staff access" on public.consultation_types for all using (public.is_staff()) with check (public.is_staff());

-- Patient Medical History
create policy "patient medical history staff access" on public.patient_medical_history_entries for all using (public.is_staff()) with check (public.is_staff());
create policy "patient medical history patient read" on public.patient_medical_history_entries for select using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.user_id = auth.uid()
  )
);

-- Medical Services Transactions
create policy "medical services transactions staff access" on public.medical_services_transactions for all using (public.is_staff()) with check (public.is_staff());

-- Access Roles
create policy "access_roles select owner_or_assigned" on public.access_roles for select using (
  public.current_app_role() = 'owner_admin'
  or exists (
    select 1
    from public.profile_access_roles par
    where par.access_role_id = access_roles.id
      and par.profile_id = auth.uid()
  )
);
create policy "access_roles manage owner_admin" on public.access_roles for all using (public.current_app_role() = 'owner_admin') with check (public.current_app_role() = 'owner_admin');

-- Profile Access Roles
create policy "profile_access_roles select owner_or_self" on public.profile_access_roles for select using (
  public.current_app_role() = 'owner_admin'
  or profile_id = auth.uid()
);
create policy "profile_access_roles manage owner_admin" on public.profile_access_roles for all using (public.current_app_role() = 'owner_admin') with check (public.current_app_role() = 'owner_admin');

-- Clinics
create policy "clinics staff access" on public.clinics for all using (public.is_staff()) with check (public.is_staff());

-- Medical Services
create policy "medical services staff access" on public.medical_services for all using (public.is_staff()) with check (public.is_staff());

-- Service Requests
create policy "service requests staff create" on public.service_requests for insert with check (
  auth.uid() = requested_by
  and public.current_app_role() in (
    'doctor'::public.app_role,
    'owner_admin'::public.app_role,
    'front_desk_cashier'::public.app_role,
    'nurse_staff'::public.app_role,
    'lab_staff'::public.app_role
  )
  and public.has_clinic_access(clinic_id)
);
create policy "service requests clinic read" on public.service_requests for select using (
  public.current_app_role() = 'owner_admin'::public.app_role
  or (
    public.current_app_role() in (
      'lab_staff'::public.app_role,
      'front_desk_cashier'::public.app_role,
      'nurse_staff'::public.app_role
    )
    and public.has_clinic_access(clinic_id)
  )
  or (
    public.current_app_role() = 'doctor'::public.app_role
    and (
      requested_by = auth.uid()
      or public.has_clinic_access(clinic_id)
    )
  )
  or (
    auth.uid() = patient_id
    and result_status = 'completed'
  )
);
create policy "service requests lab update" on public.service_requests for update using (
  public.current_app_role() = 'owner_admin'::public.app_role
  or (
    public.current_app_role() = 'lab_staff'::public.app_role
    and public.has_clinic_access(clinic_id)
  )
) with check (
  public.current_app_role() = 'owner_admin'::public.app_role
  or (
    public.current_app_role() = 'lab_staff'::public.app_role
    and public.has_clinic_access(clinic_id)
  )
);

-- Service Request Media
create policy "service request media access" on public.service_request_media for all using (
  exists (
    select 1
    from public.service_requests sr
    where sr.id = service_request_id
      and (
        public.current_app_role() = 'owner_admin'::public.app_role
        or (
          public.current_app_role() = 'lab_staff'::public.app_role
          and public.has_clinic_access(sr.clinic_id)
        )
        or (
          public.current_app_role() = 'doctor'::public.app_role
          and (sr.requested_by = auth.uid() or public.has_clinic_access(sr.clinic_id))
        )
        or (auth.uid() = sr.patient_id and sr.result_status = 'completed')
      )
  )
) with check (
  auth.uid() = uploaded_by
  and exists (
    select 1
    from public.service_requests sr
    where sr.id = service_request_id
      and (
        public.current_app_role() = 'owner_admin'::public.app_role
        or (
          public.current_app_role() = 'lab_staff'::public.app_role
          and public.has_clinic_access(sr.clinic_id)
        )
        or (
          public.current_app_role() = 'doctor'::public.app_role
          and (sr.requested_by = auth.uid() or public.has_clinic_access(sr.clinic_id))
        )
      )
  )
);

-- POS Sales
create policy "pos sales cashier access" on public.pos_sales for select using (
  public.current_app_role() in ('owner_admin'::public.app_role, 'front_desk_cashier'::public.app_role)
);

-- POS Sale Items
create policy "pos sale items cashier access" on public.pos_sale_items for select using (
  exists (
    select 1
    from public.pos_sales ps
    where ps.id = pos_sale_items.sale_id
      and public.current_app_role() in ('owner_admin'::public.app_role, 'front_desk_cashier'::public.app_role)
  )
);

-- Medical Certificates
alter table public.medical_certificates enable row level security;

-- Specialist Schedules
alter table public.specialist_schedules enable row level security;

-- Specialist Appointments
alter table public.specialist_appointments enable row level security;

-- Chat Threads
alter table public.chat_threads enable row level security;

-- Messages
alter table public.messages enable row level security;

-- Thread Unread
alter table public.thread_unread enable row level security;

-- ============================================================================
-- PART 2: BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- Auth User Creation Handler
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_role public.app_role := case coalesce(metadata ->> 'role', '')
    when 'owner_admin' then 'owner_admin'::public.app_role
    when 'doctor' then 'doctor'::public.app_role
    when 'specialist' then 'specialist'::public.app_role
    when 'nurse_staff' then 'nurse_staff'::public.app_role
    when 'front_desk_cashier' then 'front_desk_cashier'::public.app_role
    when 'lab_staff' then 'lab_staff'::public.app_role
    when 'inventory_staff' then 'inventory_staff'::public.app_role
    else 'patient'::public.app_role
  end;
  full_name text := coalesce(metadata ->> 'full_name', metadata ->> 'name', split_part(coalesce(new.email, 'Patient'), '@', 1), 'Patient');
  first_name text := coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Patient');
  last_name text := nullif(btrim(substr(full_name, char_length(split_part(full_name, ' ', 1)) + 1)), '');
begin
  insert into public.profiles (id, email, full_name, role, phone, title)
  values (
    new.id,
    coalesce(new.email, ''),
    full_name,
    resolved_role,
    metadata ->> 'phone',
    metadata ->> 'title'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    phone = excluded.phone,
    title = excluded.title;

  if resolved_role = 'patient'::public.app_role then
    insert into public.patients (
      user_id,
      qr_code,
      intake_source,
      visit_status,
      first_name,
      last_name,
      sex,
      birth_date,
      mobile_number,
      email,
      address,
      blood_type,
      allergies,
      medical_history,
      emergency_contact_name,
      emergency_contact_phone
    )
    values (
      new.id,
      concat('ODC-PAT-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
      'online_registration',
      'registered_no_visit',
      first_name,
      coalesce(last_name, 'Patient'),
      coalesce(metadata ->> 'sex', 'other'),
      coalesce(metadata ->> 'birth_date', timezone('utc', now())::date::text)::date,
      metadata ->> 'phone',
      new.email,
      metadata ->> 'address',
      metadata ->> 'blood_type',
      coalesce(metadata ->> 'allergies', ''),
      coalesce(metadata ->> 'medical_history', ''),
      coalesce(metadata ->> 'emergency_contact_name', full_name),
      coalesce(metadata ->> 'emergency_contact_phone', metadata ->> 'phone')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Ensure Doctor Row for Profile
create or replace function public.ensure_doctor_row_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('doctor'::public.app_role, 'specialist'::public.app_role) then
    insert into public.doctors (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_doctor_bootstrap on public.profiles;
create trigger on_profile_doctor_bootstrap
after insert or update of role on public.profiles
for each row execute function public.ensure_doctor_row_for_profile();

-- Ensure Direct Thread
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

-- Complete Consultation and Appointment
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

-- Ensure Appointment Direct Thread
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

-- Enforce Referral Front Desk Flow
create or replace function public.enforce_referral_frontdesk_flow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('accepted', 'completed') then
      raise exception 'Referral must be confirmed by front desk before specialist acceptance/completion.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status in ('accepted', 'completed')
      and old.status not in ('confirmed', 'accepted', 'completed') then
      raise exception 'Referral must be confirmed by front desk before specialist acceptance/completion.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_referral_frontdesk_flow_trigger on public.referrals;
create trigger enforce_referral_frontdesk_flow_trigger
before insert or update of status on public.referrals
for each row execute function public.enforce_referral_frontdesk_flow();

-- Create Referral with Slot Lock
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

-- List Blocked Booking Slots
create or replace function public.list_blocked_booking_slots(
  booking_date date,
  booking_doctor_id uuid default null,
  booking_service_id uuid default null
)
returns table (blocked_time time)
language sql
security definer
set search_path = public
stable
as $$
  with booked_slots as (
    select b.preferred_time as blocked_time
    from public.bookings b
    where b.preferred_date = booking_date
      and b.status <> 'cancelled'
      and (
        (booking_doctor_id is not null and b.doctor_id = booking_doctor_id)
        or (
          booking_doctor_id is null
          and booking_service_id is not null
          and b.service_id = booking_service_id
          and b.doctor_id is null
        )
      )
    union
    select (a.scheduled_at at time zone 'utc')::time as blocked_time
    from public.appointments a
    where a.scheduled_at::date = booking_date
      and a.status <> 'cancelled'
      and (
        (booking_doctor_id is not null and a.doctor_id = booking_doctor_id)
        or (
          booking_doctor_id is null
          and booking_service_id is not null
          and a.service_id = booking_service_id
          and a.doctor_id is null
        )
      )
  )
  select distinct booked_slots.blocked_time
  from booked_slots
  order by booked_slots.blocked_time;
$$;

grant execute on function public.list_blocked_booking_slots(date, uuid, uuid) to anon, authenticated, service_role;

-- Lab Service Request Functions
create or replace function public.create_lab_service_request(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_requested_by uuid,
  p_service_id uuid,
  p_service_category text,
  p_patient_notes text default null,
  p_urgent_flag boolean default false,
  p_transaction_type text default 'service_request',
  p_appointment_id uuid default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.medical_services%rowtype;
  v_request public.service_requests%rowtype;
  v_clinic_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_requested_by <> auth.uid() then
    raise exception 'requested_by must match the current user';
  end if;

  if public.current_app_role() not in (
    'doctor'::public.app_role,
    'owner_admin'::public.app_role,
    'front_desk_cashier'::public.app_role,
    'nurse_staff'::public.app_role,
    'lab_staff'::public.app_role
  ) then
    raise exception 'insufficient privileges to create a lab request';
  end if;

  select *
  into v_service
  from public.medical_services
  where id = p_service_id;

  if not found then
    raise exception 'medical service not found';
  end if;

  if not v_service.is_active then
    raise exception 'medical service is inactive';
  end if;

  if v_service.department <> 'Laboratory' then
    raise exception 'medical service is not laboratory scoped';
  end if;

  v_clinic_id := p_clinic_id;

  if v_clinic_id is null then
    v_clinic_id := v_service.clinic_id;
  end if;

  if v_clinic_id is null then
    select id
    into v_clinic_id
    from public.clinics
    order by created_at asc
    limit 1;
  end if;

  if v_clinic_id is null then
    insert into public.clinics (name)
    values ('Main Clinic')
    returning id into v_clinic_id;
  end if;

  if not public.has_clinic_access(v_clinic_id) then
    raise exception 'clinic access denied';
  end if;

  insert into public.service_requests (
    clinic_id,
    appointment_id,
    patient_id,
    requested_by,
    department,
    service_id,
    service_category,
    transaction_type,
    status,
    sample_status,
    result_status,
    patient_notes,
    urgent_flag
  ) values (
    v_clinic_id,
    p_appointment_id,
    p_patient_id,
    p_requested_by,
    'Laboratory',
    p_service_id,
    p_service_category,
    coalesce(p_transaction_type, 'service_request'),
    'pending',
    'pending',
    'pending',
    nullif(trim(coalesce(p_patient_notes, '')), ''),
    coalesce(p_urgent_flag, false)
  )
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.start_lab_processing(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_lab_staff() and public.current_app_role() <> 'owner_admin'::public.app_role then
    raise exception 'insufficient privileges to update lab requests';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if not found then
    raise exception 'service request not found';
  end if;

  if not public.has_clinic_access(v_request.clinic_id) then
    raise exception 'clinic access denied';
  end if;

  if v_request.status in ('completed', 'cancelled') then
    raise exception 'service request is already terminal';
  end if;

  update public.service_requests
  set
    status = 'in_progress',
    sample_status = case
      when sample_status = 'pending' then 'collected'
      else sample_status
    end,
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.complete_lab_service_request(
  p_request_id uuid,
  p_result_data text default null,
  p_result_notes text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_lab_staff() and public.current_app_role() <> 'owner_admin'::public.app_role then
    raise exception 'insufficient privileges to complete lab requests';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if not found then
    raise exception 'service request not found';
  end if;

  if not public.has_clinic_access(v_request.clinic_id) then
    raise exception 'clinic access denied';
  end if;

  if v_request.status = 'cancelled' then
    raise exception 'service request is cancelled';
  end if;

  update public.service_requests
  set
    status = 'completed',
    sample_status = 'analyzed',
    result_status = 'completed',
    result_data = nullif(trim(coalesce(p_result_data, '')), ''),
    result_notes = nullif(trim(coalesce(p_result_notes, '')), ''),
    completed_by = auth.uid(),
    completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.cancel_lab_service_request(
  p_request_id uuid,
  p_reason text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not public.is_lab_staff() and public.current_app_role() <> 'owner_admin'::public.app_role then
    raise exception 'insufficient privileges to cancel lab requests';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if not found then
    raise exception 'service request not found';
  end if;

  if not public.has_clinic_access(v_request.clinic_id) then
    raise exception 'clinic access denied';
  end if;

  if v_request.status = 'completed' then
    raise exception 'completed service requests cannot be cancelled';
  end if;

  update public.service_requests
  set
    status = 'cancelled',
    sample_status = 'cancelled',
    result_status = 'cancelled',
    result_notes = case
      when v_reason is null then result_notes
      when result_notes is null or result_notes = '' then v_reason
      else result_notes || E'\n' || v_reason
    end,
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.confirm_lab_request_by_frontdesk(
  p_request_id uuid
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_role := public.current_app_role();

  if v_role not in ('front_desk_cashier'::public.app_role, 'owner_admin'::public.app_role, 'lab_staff'::public.app_role) then
    raise exception 'insufficient privileges to confirm lab requests';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if not found then
    raise exception 'service request not found';
  end if;

  if not public.has_clinic_access(v_request.clinic_id) then
    raise exception 'clinic access denied';
  end if;

  if v_request.status in ('completed', 'cancelled') then
    raise exception 'service request is already terminal';
  end if;

  update public.service_requests
  set
    status = 'in_progress',
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.confirm_lab_request_by_frontdesk(uuid) to authenticated;

create or replace function public.mark_lab_request_paid_by_cashier(
  p_request_id uuid,
  p_receipt_code text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_role public.app_role;
  v_receipt_code text := nullif(trim(coalesce(p_receipt_code, '')), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_role := public.current_app_role();

  if v_role not in (
    'front_desk_cashier'::public.app_role,
    'owner_admin'::public.app_role,
    'lab_staff'::public.app_role
  ) then
    raise exception 'insufficient privileges to mark lab requests as paid';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if not found then
    raise exception 'service request not found';
  end if;

  if not public.has_clinic_access(v_request.clinic_id) then
    raise exception 'clinic access denied';
  end if;

  if v_request.status = 'cancelled' then
    raise exception 'cancelled service requests cannot be marked as paid';
  end if;

  update public.service_requests
  set
    payment_status = 'paid',
    receipt_code = coalesce(v_receipt_code, receipt_code),
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.mark_lab_request_paid_by_cashier(uuid, text) to authenticated;

-- POS Checkout Function
create or replace function public.checkout_pos_sale(
  p_patient_id uuid default null,
  p_cashier_id uuid default null,
  p_payment_method text default 'cash',
  p_payment_reference text default null,
  p_payment_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.pos_sales%rowtype;
  v_item jsonb;
  v_inventory public.inventory_items%rowtype;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_sale_items jsonb := '[]'::jsonb;
  v_sale_number text := 'POS-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_checkout_cashier uuid;
  v_inserted_item public.pos_sale_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_checkout_cashier := coalesce(p_cashier_id, auth.uid());

  if v_checkout_cashier <> auth.uid() then
    raise exception 'cashier_id must match the current user';
  end if;

  if public.current_app_role() not in (
    'owner_admin'::public.app_role,
    'front_desk_cashier'::public.app_role
  ) then
    raise exception 'insufficient privileges to checkout a POS sale';
  end if;

  if p_payment_method not in ('cash', 'gcash', 'card') then
    raise exception 'invalid payment method';
  end if;

  if p_payment_method in ('gcash', 'card') and nullif(trim(coalesce(p_payment_reference, '')), '') is null then
    raise exception 'payment reference is required for non-cash payments';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one sale item is required';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    select *
    into v_inventory
    from public.inventory_items
    where id = (v_item ->> 'inventory_item_id')::uuid;

    if not found then
      raise exception 'inventory item not found';
    end if;

    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 0), 0);
    if v_quantity <= 0 then
      raise exception 'item quantity must be at least 1';
    end if;

    if v_inventory.stock_on_hand < v_quantity then
      raise exception 'insufficient stock for %', v_inventory.name;
    end if;

    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, v_inventory.selling_price, 0);
    if v_unit_price < 0 then
      raise exception 'unit price must be non-negative';
    end if;

    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  insert into public.pos_sales (
    sale_number,
    patient_id,
    cashier_id,
    payment_method,
    payment_reference,
    payment_notes,
    subtotal,
    total
  ) values (
    v_sale_number,
    p_patient_id,
    v_checkout_cashier,
    p_payment_method,
    nullif(trim(coalesce(p_payment_reference, '')), ''),
    nullif(trim(coalesce(p_payment_notes, '')), ''),
    v_subtotal,
    v_subtotal
  )
  returning * into v_sale;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    select *
    into v_inventory
    from public.inventory_items
    where id = (v_item ->> 'inventory_item_id')::uuid
    for update;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_inventory.stock_on_hand < v_quantity then
      raise exception 'insufficient stock for %', v_inventory.name;
    end if;

    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, v_inventory.selling_price, 0);
    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);

    update public.inventory_items
    set stock_on_hand = stock_on_hand - v_quantity
    where id = v_inventory.id;

    insert into public.pos_sale_items (
      sale_id,
      inventory_item_id,
      item_name,
      item_sku,
      item_unit,
      quantity,
      unit_price,
      line_total
    ) values (
      v_sale.id,
      v_inventory.id,
      v_inventory.name,
      v_inventory.sku,
      v_inventory.unit,
      v_quantity,
      v_unit_price,
      v_line_total
    )
    returning * into v_inserted_item;

    insert into public.stock_transactions (
      item_id,
      type,
      quantity,
      remarks
    ) values (
      v_inventory.id,
      'sale'::public.stock_transaction_type,
      v_quantity,
      'POS sale ' || v_sale.sale_number
    );

    v_sale_items := v_sale_items || jsonb_build_array(to_jsonb(v_inserted_item));
  end loop;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'items', v_sale_items
  );
end;
$$;

grant select on public.pos_sales to authenticated;
grant select on public.pos_sale_items to authenticated;
grant execute on function public.checkout_pos_sale(uuid, uuid, text, text, text, jsonb) to authenticated;

-- ============================================================================
-- PART 3: PAYMENT & BILLING TRIGGERS
-- ============================================================================

-- Sync Payment to Appointment Status
CREATE OR REPLACE FUNCTION public.sync_payment_to_appointment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    IF NEW.appointment_id IS NOT NULL THEN
      UPDATE public.appointments
      SET 
        status = 'confirmed',
        updated_at = timezone('utc'::text, now())
      WHERE 
        id = NEW.appointment_id 
        AND status = 'scheduled';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_payment_to_appointment_status ON public.invoices;
CREATE TRIGGER tr_sync_payment_to_appointment_status
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_to_appointment_status();

-- Sync Payment to Booking Status
CREATE OR REPLACE FUNCTION public.sync_payment_to_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    IF NEW.appointment_id IS NOT NULL THEN
      UPDATE public.bookings
      SET 
        status = 'confirmed',
        updated_at = timezone('utc'::text, now())
      WHERE 
        appointment_id = NEW.appointment_id
        AND status = 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_payment_to_booking_status ON public.invoices;
CREATE TRIGGER tr_sync_payment_to_booking_status
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_to_booking_status();

-- Sync Consultation Completion to Appointment
CREATE OR REPLACE FUNCTION public.sync_consultation_completion_to_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.appointment_id IS NOT NULL 
    AND (OLD.clinical_summary IS NULL OR OLD.clinical_summary = '')
    AND NEW.clinical_summary IS NOT NULL 
    AND NEW.clinical_summary != '' THEN
    
    UPDATE public.appointments
    SET 
      status = 'completed',
      consultation_id = NEW.id,
      updated_at = timezone('utc'::text, now())
    WHERE 
      id = NEW.appointment_id
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_consultation_to_appointment_status ON public.consultations;
CREATE TRIGGER tr_sync_consultation_to_appointment_status
AFTER INSERT OR UPDATE ON public.consultations
FOR EACH ROW
EXECUTE FUNCTION public.sync_consultation_completion_to_appointment();

-- Sync Appointment Completion to Booking Cleanup
CREATE OR REPLACE FUNCTION public.sync_appointment_completion_to_booking_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.booking_id IS NOT NULL THEN
      UPDATE public.bookings
      SET 
        status = 'completed',
        updated_at = timezone('utc'::text, now())
      WHERE 
        id = NEW.booking_id
        AND status != 'completed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_appointment_completion_to_booking_cleanup ON public.appointments;
CREATE TRIGGER tr_sync_appointment_completion_to_booking_cleanup
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_completion_to_booking_cleanup();

-- Sync Invoice Payment to Service Request
CREATE OR REPLACE FUNCTION public.sync_invoice_payment_to_service_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'paid') THEN
    IF NEW.service_request_id IS NOT NULL THEN
      UPDATE public.service_requests
      SET
        payment_status = 'paid',
        receipt_code = COALESCE(receipt_code, NEW.invoice_number),
        updated_at = timezone('utc', now())
      WHERE id = NEW.service_request_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_sync_invoice_payment_to_service_request ON public.invoices;
CREATE TRIGGER tr_sync_invoice_payment_to_service_request
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_payment_to_service_request();

-- ============================================================================
-- PART 4: BOOTSTRAP DATA & INITIALIZATION
-- ============================================================================

-- Bootstrap Default Clinic
do $$
declare
  v_default_clinic_id uuid;
  v_clinic_count integer;
begin
  select count(*)::integer into v_clinic_count from public.clinics;

  if v_clinic_count = 0 then
    insert into public.clinics (name)
    values ('Main Clinic')
    returning id into v_default_clinic_id;

    v_clinic_count := 1;
  else
    select id
    into v_default_clinic_id
    from public.clinics
    order by created_at asc
    limit 1;
  end if;

  if v_clinic_count = 1 and v_default_clinic_id is not null then
    update public.profiles
    set
      clinic_id = v_default_clinic_id,
      updated_at = timezone('utc', now())
    where clinic_id is null
      and deleted_at is null
      and role in (
        'owner_admin'::public.app_role,
        'doctor'::public.app_role,
        'nurse_staff'::public.app_role,
        'front_desk_cashier'::public.app_role,
        'lab_staff'::public.app_role,
        'inventory_staff'::public.app_role
      );

    update public.medical_services
    set
      clinic_id = v_default_clinic_id,
      updated_at = timezone('utc', now())
    where clinic_id is null;
  end if;
end $$;

-- Bootstrap Access Roles
insert into public.access_roles (system_key, name, description, permission_codes, is_system)
values
  (
    'owner_admin',
    'Owner / Admin',
    'Full system access for the clinic owner or administrator.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'consultations.manage',
      'billing.view',
      'billing.manage',
      'inventory.view',
      'inventory.manage',
      'laboratory.view',
      'laboratory.manage',
      'settings.view',
      'settings.manage',
      'booking.view',
      'booking.manage',
      'users.manage',
      'pos.view',
      'pos.manage'
    ],
    true
  ),
  (
    'doctor',
    'Doctor',
    'Clinical access for providers handling consultations and patient review.',
    array[
      'dashboard.view',
      'patients.view',
      'appointments.view',
      'consultations.manage',
      'laboratory.view',
      'booking.view'
    ],
    true
  ),
  (
    'specialist',
    'Specialist',
    'External specialist access for referrals, patient chart review, SOAP documentation, and schedule management.',
    array[
      'patients.view',
      'appointments.view',
      'consultations.manage',
      'booking.view'
    ],
    true
  ),
  (
    'nurse_staff',
    'Nurse / Staff',
    'Care-team access for patient intake, appointments, and consultation support.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'consultations.manage',
      'laboratory.view'
    ],
    true
  ),
  (
    'front_desk_cashier',
    'Front Desk / Cashier',
    'Reception and payment access for scheduling, billing, and bookings.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'billing.view',
      'billing.manage',
      'booking.view',
      'booking.manage',
      'pos.view',
      'pos.manage'
    ],
    true
  ),
  (
    'lab_staff',
    'Lab Staff',
    'Laboratory operations access for sample processing and result handling.',
    array[
      'dashboard.view',
      'patients.view',
      'laboratory.view',
      'laboratory.manage'
    ],
    true
  ),
  (
    'inventory_staff',
    'Inventory Staff',
    'Stock and supply access for inventory monitoring and updates.',
    array[
      'dashboard.view',
      'inventory.view',
      'inventory.manage'
    ],
    true
  )
on conflict (system_key) do update
set
  name = excluded.name,
  description = excluded.description,
  permission_codes = excluded.permission_codes,
  is_system = excluded.is_system,
  updated_at = timezone('utc', now());

-- Bootstrap Consultation Types
insert into public.consultation_types (code, name, description)
values
  ('initial', 'Initial Consultation', 'First time clinical encounter.'),
  ('follow_up', 'Follow-up Consultation', 'Follow-up encounter after prior consultation.'),
  ('teleconsult', 'Teleconsultation', 'Consultation delivered through teleconsultation platform.')
on conflict (code) do nothing;

-- Bootstrap Doctors from Staff Profiles
insert into public.doctors (profile_id)
select p.id
from public.profiles p
where p.role in ('doctor'::public.app_role, 'specialist'::public.app_role)
  and not exists (
    select 1
    from public.doctors d
    where d.profile_id = p.id
  );

-- Bootstrap Patient QR Codes
update public.patients
set qr_code = 'ODC-PAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where qr_code is null or btrim(qr_code) = '';

-- Bootstrap Inventory Item QR Codes
update public.inventory_items
set qr_code = 'ODC-INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where qr_code is null or btrim(qr_code) = '';

-- Bootstrap Booking Receipt Codes
update public.bookings
set receipt_code = coalesce(
  receipt_code,
  'ODC-BKG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
)
where receipt_code is null;

-- Bootstrap Service Request Receipt Codes
update public.service_requests
set receipt_code = coalesce(
  receipt_code,
  'ODC-LAB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
)
where receipt_code is null;

-- Link Staff Profiles to Access Roles
insert into public.profile_access_roles (profile_id, access_role_id)
select
  p.id,
  ar.id
from public.profiles p
join public.access_roles ar
  on ar.system_key = p.role::text
where p.role <> 'patient'::public.app_role
on conflict (profile_id) do nothing;

-- Exclude Staff from Patient Registry
update public.patients p
set
  deleted_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
from public.profiles pr
where p.user_id = pr.id
  and pr.role <> 'patient'::public.app_role
  and p.deleted_at is null;

-- ============================================================================
-- PART 5: STORAGE SETUP (Lab Request Attachments)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('lab-request-attachments', 'lab-request-attachments', true)
on conflict (id) do update
set public = excluded.public,
    name = excluded.name;

drop policy if exists "lab request attachments authenticated read" on storage.objects;
create policy "lab request attachments authenticated read"
on storage.objects
for select
using (bucket_id = 'lab-request-attachments');

drop policy if exists "lab request attachments authenticated write" on storage.objects;
create policy "lab request attachments authenticated write"
on storage.objects
for insert
with check (
  bucket_id = 'lab-request-attachments'
  and auth.role() = 'authenticated'
);

-- ============================================================================
-- PART 6: GRANTS & PERMISSIONS
-- ============================================================================

grant select on public.providers to authenticated;
grant select on public.clinics to authenticated;
grant select on public.medical_services to authenticated;
grant select, insert, update on public.service_requests to authenticated;
grant select, insert, update, delete on public.service_request_media to authenticated;
grant execute on function public.create_lab_service_request(uuid, uuid, uuid, uuid, text, text, boolean, text, uuid) to authenticated;
grant execute on function public.start_lab_processing(uuid) to authenticated;
grant execute on function public.complete_lab_service_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_lab_service_request(uuid, text) to authenticated;

-- ============================================================================
-- END OF MIGRATION - PART 2
-- ============================================================================
-- All functions, policies, and bootstrap data have been successfully created.
-- Your Odyssey Clinic system is now fully operational!
-- ============================================================================
