-- ============================================================================
-- ODYSSEY CLINIC LIS (Laboratory Information System) SCHEMA
-- ============================================================================
-- Adds structured test parameters, result entries, accession tracking,
-- validation workflow, audit trail, and reagent/inventory linking.
-- Date: 2026-05-25
-- ============================================================================

-- ============================================================================
-- 1. LAB TEST PARAMETERS — defines measurable parameters per lab service
-- ============================================================================

create table if not exists public.lab_test_parameters (
  id uuid primary key default gen_random_uuid(),
  medical_service_id uuid not null references public.medical_services(id) on delete cascade,
  parameter_name text not null,
  unit text not null default '',
  data_type text not null default 'numeric' check (data_type in ('numeric', 'text', 'select')),
  sort_order integer not null default 0,
  reference_range_male_low numeric(12,4),
  reference_range_male_high numeric(12,4),
  reference_range_female_low numeric(12,4),
  reference_range_female_high numeric(12,4),
  reference_range_child_low numeric(12,4),
  reference_range_child_high numeric(12,4),
  reference_range_general_low numeric(12,4),
  reference_range_general_high numeric(12,4),
  select_options jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lab_test_parameters_service_idx
  on public.lab_test_parameters (medical_service_id, sort_order);

-- ============================================================================
-- 2. LAB TEST PANELS — groups multiple services into panels (e.g., CBC)
-- ============================================================================

create table if not exists public.lab_test_panels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  medical_service_ids uuid[] not null default '{}'::uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ============================================================================
-- 3. LAB RESULT ENTRIES — structured individual result values per request
-- ============================================================================

create table if not exists public.lab_result_entries (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  parameter_id uuid not null references public.lab_test_parameters(id) on delete cascade,
  value_numeric numeric(14,4),
  value_text text,
  abnormal_flag text not null default 'normal' check (abnormal_flag in ('low', 'normal', 'high', 'critical')),
  entered_by uuid not null references public.profiles(id) on delete set null,
  entered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lab_result_entries_request_idx
  on public.lab_result_entries (service_request_id);

create index if not exists lab_result_entries_parameter_idx
  on public.lab_result_entries (parameter_id);

-- ============================================================================
-- 4. LAB ACCESSION LOG — specimen tracking and accession numbering
-- ============================================================================

create sequence if not exists public.lab_accession_seq start with 1 increment by 1;

create table if not exists public.lab_accession_log (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null unique references public.service_requests(id) on delete cascade,
  accession_number text not null unique,
  specimen_type text not null default '',
  specimen_collected_at timestamptz,
  specimen_received_at timestamptz,
  specimen_condition text not null default 'adequate',
  collected_by uuid references public.profiles(id) on delete set null,
  accessioned_by uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lab_accession_log_accession_number_idx
  on public.lab_accession_log (accession_number);

-- Function to auto-generate accession numbers: LAB-YYYY-NNNNN
create or replace function public.generate_lab_accession_number()
returns text
language plpgsql
as $$
declare
  v_seq integer;
  v_year text;
begin
  v_seq := nextval('public.lab_accession_seq');
  v_year := to_char(now(), 'YYYY');
  return 'LAB-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

-- ============================================================================
-- 5. LAB AUDIT LOG — complete action trail
-- ============================================================================

create table if not exists public.lab_audit_log (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  action text not null,
  old_value text,
  new_value text,
  performed_by uuid not null references public.profiles(id) on delete set null,
  performed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists lab_audit_log_request_idx
  on public.lab_audit_log (service_request_id, performed_at desc);

-- ============================================================================
-- 6. LAB REAGENT LINKS — links lab tests to inventory items
-- ============================================================================

create table if not exists public.lab_reagent_links (
  id uuid primary key default gen_random_uuid(),
  medical_service_id uuid not null references public.medical_services(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_per_test numeric(10,2) not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (medical_service_id, inventory_item_id)
);

create index if not exists lab_reagent_links_service_idx
  on public.lab_reagent_links (medical_service_id);

-- ============================================================================
-- 7. ALTER service_requests — add LIS-specific columns
-- ============================================================================

alter table public.service_requests
  add column if not exists accession_number text,
  add column if not exists released_by uuid references public.profiles(id) on delete set null,
  add column if not exists released_at timestamptz,
  add column if not exists tat_minutes integer;

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

create trigger set_updated_at_lab_test_parameters
  before update on public.lab_test_parameters
  for each row execute function public.set_updated_at();

create trigger set_updated_at_lab_test_panels
  before update on public.lab_test_panels
  for each row execute function public.set_updated_at();

create trigger set_updated_at_lab_result_entries
  before update on public.lab_result_entries
  for each row execute function public.set_updated_at();

create trigger set_updated_at_lab_accession_log
  before update on public.lab_accession_log
  for each row execute function public.set_updated_at();

create trigger set_updated_at_lab_reagent_links
  before update on public.lab_reagent_links
  for each row execute function public.set_updated_at();

-- Auto-compute TAT when a service request is completed
create or replace function public.compute_lab_tat()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.tat_minutes := extract(epoch from (new.completed_at - new.created_at)) / 60;
  end if;
  return new;
end;
$$;

create trigger compute_lab_tat_on_complete
  before update on public.service_requests
  for each row execute function public.compute_lab_tat();

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

alter table public.lab_test_parameters enable row level security;
alter table public.lab_test_panels enable row level security;
alter table public.lab_result_entries enable row level security;
alter table public.lab_accession_log enable row level security;
alter table public.lab_audit_log enable row level security;
alter table public.lab_reagent_links enable row level security;

-- lab_test_parameters: staff can read, admin/lab_staff can manage
drop policy if exists "lab_test_parameters_read" on public.lab_test_parameters;
create policy "lab_test_parameters_read"
  on public.lab_test_parameters for select
  using (public.is_staff());

drop policy if exists "lab_test_parameters_manage" on public.lab_test_parameters;
create policy "lab_test_parameters_manage"
  on public.lab_test_parameters for all
  using (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  )
  with check (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

-- lab_test_panels: staff can read, admin can manage
drop policy if exists "lab_test_panels_read" on public.lab_test_panels;
create policy "lab_test_panels_read"
  on public.lab_test_panels for select
  using (public.is_staff());

drop policy if exists "lab_test_panels_manage" on public.lab_test_panels;
create policy "lab_test_panels_manage"
  on public.lab_test_panels for all
  using (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  )
  with check (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

-- lab_result_entries: same access as service_requests
drop policy if exists "lab_result_entries_read" on public.lab_result_entries;
create policy "lab_result_entries_read"
  on public.lab_result_entries for select
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and (
          public.current_app_role() = 'owner_admin'::public.app_role
          or (public.current_app_role() = 'lab_staff'::public.app_role and public.has_clinic_access(sr.clinic_id))
          or (public.current_app_role() = 'doctor'::public.app_role and (sr.requested_by = auth.uid() or public.has_clinic_access(sr.clinic_id)))
          or (auth.uid() = sr.patient_id and sr.result_status = 'completed')
        )
    )
  );

drop policy if exists "lab_result_entries_manage" on public.lab_result_entries;
create policy "lab_result_entries_manage"
  on public.lab_result_entries for all
  using (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  )
  with check (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

-- lab_accession_log: same access as service_requests
drop policy if exists "lab_accession_log_read" on public.lab_accession_log;
create policy "lab_accession_log_read"
  on public.lab_accession_log for select
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_request_id
        and (
          public.current_app_role() = 'owner_admin'::public.app_role
          or (public.current_app_role() = 'lab_staff'::public.app_role and public.has_clinic_access(sr.clinic_id))
          or (public.current_app_role() = 'doctor'::public.app_role and (sr.requested_by = auth.uid() or public.has_clinic_access(sr.clinic_id)))
        )
    )
  );

drop policy if exists "lab_accession_log_manage" on public.lab_accession_log;
create policy "lab_accession_log_manage"
  on public.lab_accession_log for all
  using (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  )
  with check (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

-- lab_audit_log: admin and lab_staff can read, system inserts
drop policy if exists "lab_audit_log_read" on public.lab_audit_log;
create policy "lab_audit_log_read"
  on public.lab_audit_log for select
  using (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

drop policy if exists "lab_audit_log_insert" on public.lab_audit_log;
create policy "lab_audit_log_insert"
  on public.lab_audit_log for insert
  with check (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

-- lab_reagent_links: staff can read, admin can manage
drop policy if exists "lab_reagent_links_read" on public.lab_reagent_links;
create policy "lab_reagent_links_read"
  on public.lab_reagent_links for select
  using (public.is_staff());

drop policy if exists "lab_reagent_links_manage" on public.lab_reagent_links;
create policy "lab_reagent_links_manage"
  on public.lab_reagent_links for all
  using (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  )
  with check (
    public.current_app_role() in ('owner_admin'::public.app_role, 'lab_staff'::public.app_role)
  );

-- ============================================================================
-- 10. GRANTS
-- ============================================================================

grant select, insert, update, delete on public.lab_test_parameters to authenticated;
grant select, insert, update, delete on public.lab_test_panels to authenticated;
grant select, insert, update, delete on public.lab_result_entries to authenticated;
grant select, insert, update, delete on public.lab_accession_log to authenticated;
grant select, insert on public.lab_audit_log to authenticated;
grant select, insert, update, delete on public.lab_reagent_links to authenticated;
grant usage, select on sequence public.lab_accession_seq to authenticated;
