create extension if not exists pgcrypto;

create type public.app_role as enum ('owner_admin','doctor','nurse_staff','front_desk_cashier','lab_staff','inventory_staff','patient');
create type public.appointment_status as enum ('scheduled','confirmed','in_progress','completed','cancelled','no_show');
create type public.booking_status as enum ('pending','confirmed','rescheduled','cancelled');
create type public.payment_status as enum ('unpaid','partial','paid','void');
create type public.stock_transaction_type as enum ('stock_in','stock_out','adjustment');
create type public.lab_order_status as enum ('requested','collected','processing','ready','released');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code public.app_role not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(role_id, permission_id)
);

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  legal_name text not null,
  short_code text not null unique,
  address text not null,
  contact_number text not null,
  email text not null,
  website text not null,
  logo_url text,
  primary_color text not null default '#155eef',
  accent_color text not null default '#0f766e',
  booking_lead_days integer not null default 30,
  booking_cancellation_hours integer not null default 12,
  appointment_slot_minutes integer not null default 30,
  operating_hours jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'patient',
  email text not null unique,
  full_name text not null,
  phone text,
  title text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'patient'::public.app_role);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_app_role() <> 'patient'::public.app_role;
$$;
create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  duration_minutes integer not null default 30,
  specialty_id uuid references public.specialties(id),
  is_bookable boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  license_number text,
  specialty_id uuid references public.specialties(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  department text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  sex text not null,
  birth_date date not null,
  mobile_number text,
  email text,
  address text,
  blood_type text,
  allergies text not null default '',
  medical_history text not null default '',
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  service_id uuid not null references public.services(id),
  doctor_id uuid references public.doctors(id),
  preferred_date date not null,
  preferred_time time not null,
  status public.booking_status not null default 'pending',
  intake_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  doctor_id uuid references public.doctors(id),
  specialty_id uuid references public.specialties(id),
  service_id uuid references public.services(id),
  booking_id uuid references public.bookings(id),
  scheduled_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  source text not null default 'internal',
  reason text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  doctor_id uuid not null references public.doctors(id),
  subjective text not null default '',
  objective text not null default '',
  assessment text not null default '',
  plan text not null default '',
  outcome text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  medication text not null,
  dosage text not null,
  instructions text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  invoice_number text not null unique,
  payment_status public.payment_status not null default 'unpaid',
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  category text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null,
  reference_number text,
  received_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inventory_categories(id),
  supplier_id uuid references public.suppliers(id),
  name text not null,
  sku text not null unique,
  unit text not null,
  stock_on_hand integer not null default 0,
  reorder_level integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  type public.stock_transaction_type not null,
  quantity integer not null,
  remarks text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lab_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  lab_service_id uuid not null references public.lab_services(id),
  requested_by uuid references public.doctors(id),
  status public.lab_order_status not null default 'requested',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  lab_order_id uuid not null unique references public.lab_orders(id) on delete cascade,
  result_summary text not null default '',
  released_at timestamptz,
  attachment_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.file_uploads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_name text not null,
  category text not null,
  storage_bucket text not null default 'patient-files',
  storage_path text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_updated_at_roles before update on public.roles for each row execute function public.set_updated_at();
create trigger set_updated_at_permissions before update on public.permissions for each row execute function public.set_updated_at();
create trigger set_updated_at_role_permissions before update on public.role_permissions for each row execute function public.set_updated_at();
create trigger set_updated_at_clinic_settings before update on public.clinic_settings for each row execute function public.set_updated_at();
create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_specialties before update on public.specialties for each row execute function public.set_updated_at();
create trigger set_updated_at_services before update on public.services for each row execute function public.set_updated_at();
create trigger set_updated_at_doctors before update on public.doctors for each row execute function public.set_updated_at();
create trigger set_updated_at_staff_members before update on public.staff_members for each row execute function public.set_updated_at();
create trigger set_updated_at_patients before update on public.patients for each row execute function public.set_updated_at();
create trigger set_updated_at_doctor_availability before update on public.doctor_availability for each row execute function public.set_updated_at();
create trigger set_updated_at_bookings before update on public.bookings for each row execute function public.set_updated_at();
create trigger set_updated_at_appointments before update on public.appointments for each row execute function public.set_updated_at();
create trigger set_updated_at_consultations before update on public.consultations for each row execute function public.set_updated_at();
create trigger set_updated_at_prescriptions before update on public.prescriptions for each row execute function public.set_updated_at();
create trigger set_updated_at_invoices before update on public.invoices for each row execute function public.set_updated_at();
create trigger set_updated_at_invoice_items before update on public.invoice_items for each row execute function public.set_updated_at();
create trigger set_updated_at_payments before update on public.payments for each row execute function public.set_updated_at();
create trigger set_updated_at_suppliers before update on public.suppliers for each row execute function public.set_updated_at();
create trigger set_updated_at_inventory_categories before update on public.inventory_categories for each row execute function public.set_updated_at();
create trigger set_updated_at_inventory_items before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger set_updated_at_stock_transactions before update on public.stock_transactions for each row execute function public.set_updated_at();
create trigger set_updated_at_lab_services before update on public.lab_services for each row execute function public.set_updated_at();
create trigger set_updated_at_lab_orders before update on public.lab_orders for each row execute function public.set_updated_at();
create trigger set_updated_at_lab_results before update on public.lab_results for each row execute function public.set_updated_at();
create trigger set_updated_at_file_uploads before update on public.file_uploads for each row execute function public.set_updated_at();
create trigger set_updated_at_audit_logs before update on public.audit_logs for each row execute function public.set_updated_at();

alter table public.clinic_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.specialties enable row level security;
alter table public.services enable row level security;
alter table public.patients enable row level security;
alter table public.bookings enable row level security;
alter table public.appointments enable row level security;
alter table public.consultations enable row level security;
alter table public.invoices enable row level security;
alter table public.inventory_items enable row level security;
alter table public.lab_orders enable row level security;
alter table public.lab_results enable row level security;

create policy "clinic settings readable" on public.clinic_settings for select using (true);
create policy "clinic settings staff manage" on public.clinic_settings for all using (public.is_staff()) with check (public.is_staff());
create policy "profiles self read" on public.profiles for select using (auth.uid() = id or public.is_staff());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id or public.current_app_role() = 'owner_admin') with check (auth.uid() = id or public.current_app_role() = 'owner_admin');
create policy "catalog public read specialties" on public.specialties for select using (deleted_at is null);
create policy "catalog staff manage specialties" on public.specialties for all using (public.is_staff()) with check (public.is_staff());
create policy "catalog public read services" on public.services for select using (deleted_at is null);
create policy "catalog staff manage services" on public.services for all using (public.is_staff()) with check (public.is_staff());
create policy "patients staff access" on public.patients for all using (public.is_staff()) with check (public.is_staff());
create policy "patients self read" on public.patients for select using (user_id = auth.uid());
create policy "patients self update" on public.patients for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bookings patient access" on public.bookings for select using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff());
create policy "bookings patient insert" on public.bookings for insert with check (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff());
create policy "bookings patient update" on public.bookings for update using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff()) with check (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()) or public.is_staff());
create policy "appointments staff access" on public.appointments for all using (public.is_staff()) with check (public.is_staff());
create policy "appointments patient read" on public.appointments for select using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));
create policy "consultations staff access" on public.consultations for all using (public.is_staff()) with check (public.is_staff());
create policy "consultations patient read" on public.consultations for select using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));
create policy "invoices staff access" on public.invoices for all using (public.is_staff()) with check (public.is_staff());
create policy "invoices patient read" on public.invoices for select using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));
create policy "inventory staff access" on public.inventory_items for all using (public.is_staff()) with check (public.is_staff());
create policy "lab orders staff access" on public.lab_orders for all using (public.is_staff()) with check (public.is_staff());
create policy "lab orders patient read" on public.lab_orders for select using (exists (select 1 from public.patients p where p.id = patient_id and p.user_id = auth.uid()));
create policy "lab results staff access" on public.lab_results for all using (public.is_staff()) with check (public.is_staff());
create policy "lab results patient read" on public.lab_results for select using (exists (select 1 from public.lab_orders lo join public.patients p on p.id = lo.patient_id where lo.id = lab_order_id and p.user_id = auth.uid()));


