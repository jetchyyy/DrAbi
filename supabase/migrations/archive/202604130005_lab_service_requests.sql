create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null,
  add column if not exists department text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists is_active boolean not null default true;

create table if not exists public.medical_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  department text not null,
  category text not null,
  name text not null,
  description text,
  service_fee numeric(12,2) not null default 0,
  estimated_duration_minutes integer,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  department text not null default 'Laboratory',
  service_id uuid not null references public.medical_services(id) on delete restrict,
  service_category text not null,
  transaction_type text not null default 'service_request',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  sample_status text not null default 'pending' check (sample_status in ('pending', 'collected', 'processing', 'analyzed', 'cancelled')),
  result_status text not null default 'pending' check (result_status in ('pending', 'partial', 'completed', 'cancelled')),
  patient_notes text,
  result_data text,
  result_notes text,
  urgent_flag boolean not null default false,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_requests_completed_state_check
    check (
      status <> 'completed'
      or (result_status = 'completed' and completed_by is not null and completed_at is not null)
    )
);

create table if not exists public.service_request_media (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  file_path text not null,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists clinics_name_idx on public.clinics (name);
create index if not exists medical_services_clinic_id_idx on public.medical_services (clinic_id, is_active);
create index if not exists medical_services_department_idx on public.medical_services (department, category);
create index if not exists service_requests_clinic_status_created_at_idx on public.service_requests (clinic_id, status, created_at desc);
create index if not exists service_requests_patient_created_at_idx on public.service_requests (patient_id, created_at desc);
create index if not exists service_requests_requested_by_created_at_idx on public.service_requests (requested_by, created_at desc);
create index if not exists service_requests_department_status_idx on public.service_requests (department, status);
create index if not exists service_requests_urgent_status_idx on public.service_requests (urgent_flag, status);
create index if not exists service_requests_sample_result_idx on public.service_requests (sample_status, result_status);
create index if not exists service_request_media_request_id_idx on public.service_request_media (service_request_id, created_at desc);

create or replace function public.current_profile_clinic_id()
returns uuid
language sql
stable
as $$
  select clinic_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.has_clinic_access(target_clinic_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.current_app_role() = 'owner_admin'::public.app_role
    or (
      target_clinic_id is not null
      and target_clinic_id = public.current_profile_clinic_id()
    );
$$;

create or replace function public.is_lab_staff()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'lab_staff'::public.app_role;
$$;

create or replace function public.create_lab_service_request(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_requested_by uuid,
  p_service_id uuid,
  p_service_category text,
  p_patient_notes text default null,
  p_urgent_flag boolean default false,
  p_transaction_type text default 'service_request'
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.medical_services%rowtype;
  v_request public.service_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_requested_by <> auth.uid() then
    raise exception 'requested_by must match the current user';
  end if;

  if public.current_app_role() not in ('doctor'::public.app_role, 'owner_admin'::public.app_role) then
    raise exception 'insufficient privileges to create a lab request';
  end if;

  if not public.has_clinic_access(p_clinic_id) then
    raise exception 'clinic access denied';
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

  insert into public.service_requests (
    clinic_id,
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
    p_clinic_id,
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

create trigger set_updated_at_clinics before update on public.clinics for each row execute function public.set_updated_at();
create trigger set_updated_at_medical_services before update on public.medical_services for each row execute function public.set_updated_at();
create trigger set_updated_at_service_requests before update on public.service_requests for each row execute function public.set_updated_at();

alter table public.clinics enable row level security;
alter table public.medical_services enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_media enable row level security;

drop policy if exists "clinics staff access" on public.clinics;
create policy "clinics staff access"
on public.clinics
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "medical services staff access" on public.medical_services;
create policy "medical services staff access"
on public.medical_services
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "service requests doctor create" on public.service_requests;
create policy "service requests doctor create"
on public.service_requests
for insert
with check (
  auth.uid() = requested_by
  and public.current_app_role() in ('doctor'::public.app_role, 'owner_admin'::public.app_role)
  and public.has_clinic_access(clinic_id)
);

drop policy if exists "service requests clinic read" on public.service_requests;
create policy "service requests clinic read"
on public.service_requests
for select
using (
  public.current_app_role() = 'owner_admin'::public.app_role
  or (
    public.current_app_role() = 'lab_staff'::public.app_role
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

drop policy if exists "service requests lab update" on public.service_requests;
create policy "service requests lab update"
on public.service_requests
for update
using (
  public.current_app_role() = 'owner_admin'::public.app_role
  or (
    public.current_app_role() = 'lab_staff'::public.app_role
    and public.has_clinic_access(clinic_id)
  )
)
with check (
  public.current_app_role() = 'owner_admin'::public.app_role
  or (
    public.current_app_role() = 'lab_staff'::public.app_role
    and public.has_clinic_access(clinic_id)
  )
);

drop policy if exists "service request media access" on public.service_request_media;
create policy "service request media access"
on public.service_request_media
for all
using (
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
)
with check (
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

grant select on public.clinics to authenticated;
grant select on public.medical_services to authenticated;
grant select, insert, update on public.service_requests to authenticated;
grant select, insert, update, delete on public.service_request_media to authenticated;