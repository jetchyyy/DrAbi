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

drop policy if exists "service requests doctor create" on public.service_requests;
create policy "service requests staff create"
on public.service_requests
for insert
with check (
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

drop policy if exists "service requests clinic read" on public.service_requests;
create policy "service requests clinic read"
on public.service_requests
for select
using (
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
