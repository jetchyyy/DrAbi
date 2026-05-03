-- ============================================================================
-- ODYSSEY CLINIC SYSTEM - COMPLETE FRESH DATABASE SETUP
-- ============================================================================
-- This migration file consolidates the entire Odyssey Clinic database schema
-- for fresh Supabase projects. Run this single migration instead of running
-- all individual migrations sequentially.
-- 
-- Date: 2026-04-25
-- Version: 1.0
-- ============================================================================

-- Enable extensions
create extension if not exists pgcrypto;

-- ============================================================================
-- PART 1: ENUMS AND TYPES
-- ============================================================================

create type public.app_role as enum (
  'owner_admin',
  'doctor',
  'specialist',
  'nurse_staff',
  'front_desk_cashier',
  'lab_staff',
  'inventory_staff',
  'patient'
);

create type public.appointment_status as enum (
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

create type public.booking_status as enum (
  'pending',
  'confirmed',
  'rescheduled',
  'cancelled'
);

create type public.payment_status as enum (
  'unpaid',
  'partial',
  'paid',
  'void'
);

create type public.stock_transaction_type as enum (
  'stock_in',
  'stock_out',
  'adjustment',
  'sale'
);

create type public.lab_order_status as enum (
  'requested',
  'collected',
  'processing',
  'ready',
  'released'
);

-- ============================================================================
-- PART 2: BASIC HELPER FUNCTION
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================================
-- PART 3: CORE TABLES
-- ============================================================================

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

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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
  system_enabled boolean not null default true,
  system_message text not null default 'Contact your System Administrator to continue using the System',
  odc_recovery_password_hash text,
  enabled_modules jsonb not null default '{
    "dashboard": true,
    "patient_management": true,
    "booking_appointments": true,
    "billing": true,
    "pos": true,
    "inventory": true,
    "laboratory": true,
    "teleconsult": true
  }'::jsonb,
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
  clinic_id uuid references public.clinics(id) on delete set null,
  department text,
  first_name text,
  last_name text,
  is_active boolean not null default true,
  security_pin_hash text,
  pin_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  system_key text unique,
  name text not null,
  description text not null default '',
  permission_codes text[] not null default '{}'::text[],
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint access_roles_permissions_nonempty check (cardinality(permission_codes) > 0)
);

create table if not exists public.profile_access_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  access_role_id uuid not null references public.access_roles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id)
);

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
  delivery_mode text not null default 'in_person',
  service_type text not null default 'medical_service',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint services_delivery_mode_check
    check (delivery_mode in ('in_person', 'teleconsultation', 'hybrid')),
  constraint services_service_type_check
    check (service_type in ('medical_service', 'consultation', 'follow_up'))
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  license_number text,
  specialty_id uuid references public.specialties(id),
  license_expiry date,
  bir_number text,
  prc_id_path text,
  consultation_fee numeric(12,2) not null default 0,
  follow_up_fee numeric(12,2) not null default 0,
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
  qr_code text not null,
  intake_source text not null default 'online_registration',
  visit_status text not null default 'registered_no_visit',
  last_clinic_visit_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint patients_intake_source_check
    check (intake_source in ('online_registration', 'staff_walk_in')),
  constraint patients_visit_status_check
    check (visit_status in ('registered_no_visit', 'visited_clinic'))
);

create unique index if not exists patients_qr_code_key on public.patients (qr_code);

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint doctor_availability_unique_slot
    unique (doctor_id, day_of_week, start_time)
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
  fee_type text not null default 'consultation',
  fee_amount numeric(12,2) not null default 0,
  receipt_code text,
  payment_status text not null default 'pending_cashier',
  appointment_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint bookings_fee_type_check
    check (fee_type in ('consultation', 'follow_up')),
  constraint bookings_payment_status_check
    check (payment_status in ('pending_cashier', 'paid')),
  constraint bookings_receipt_code_key unique (receipt_code)
);

create index if not exists idx_bookings_appointment_id on public.bookings(appointment_id);

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
  visit_type text not null default 'in_person',
  teleconsultation_platform text,
  teleconsultation_url text,
  teleconsultation_access_instructions text,
  teleconsultation_provider text,
  teleconsultation_room_name text,
  consultation_id uuid,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  related_referral_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint appointments_visit_type_check
    check (visit_type in ('in_person', 'teleconsultation')),
  constraint appointments_teleconsultation_provider_check
    check (teleconsultation_provider in ('jitsi') or teleconsultation_provider is null)
);

-- Add foreign key constraint from bookings to appointments (after appointments table exists)
alter table public.bookings
add constraint bookings_appointment_id_fkey
foreign key (appointment_id) references public.appointments(id) on delete set null;

create table if not exists public.consultation_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  doctor_id uuid not null references public.doctors(id),
  subjective text not null default '',
  objective text not null default '',
  assessment text not null default '',
  plan text not null default '',
  outcome text not null default '',
  consultation_type text,
  consultation_date date,
  consultation_time time,
  provider_name text,
  clinical_summary text,
  diagnosis text,
  present_illness_history text,
  review_of_symptoms text,
  allergies text,
  vitals text,
  treatment_plan text,
  medications text,
  lab_results text,
  differential_diagnosis text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Add indexes for appointments and consultations (after tables are created)
create index if not exists idx_consultations_appointment_id on public.consultations(appointment_id);
create index if not exists idx_appointments_consultation_id on public.appointments (consultation_id);
create index if not exists idx_appointments_completed_at on public.appointments (completed_at desc);
create index if not exists idx_appointments_related_referral_id on public.appointments (related_referral_id);
create index if not exists idx_appointments_booking_id on public.appointments(booking_id);
create unique index if not exists appointments_teleconsultation_room_name_key
  on public.appointments (teleconsultation_room_name)
  where teleconsultation_room_name is not null;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  medication text not null,
  dosage text not null,
  instructions text not null,
  prescription_name text,
  instruction text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

create table if not exists public.medical_certificates (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  certificate_purpose text not null default '',
  diagnosis text not null default '',
  recommendation text not null default '',
  rest_from date,
  rest_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists medical_certificates_patient_id_idx
  on public.medical_certificates (patient_id, created_at desc);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  referring_doctor_id uuid not null references public.doctors(id),
  target_doctor_id uuid references public.doctors(id),
  target_specialty_id uuid references public.specialties(id),
  reason text not null default '',
  clinical_summary text not null default '',
  referral_notes text not null default '',
  status text not null default 'sent',
  specialist_findings text not null default '',
  specialist_recommendations text not null default '',
  referred_at timestamptz not null default timezone('utc', now()),
  specialist_visited_at timestamptz,
  completed_at timestamptz,
  source_appointment_id uuid references public.appointments(id) on delete set null,
  source_consultation_id uuid references public.consultations(id) on delete set null,
  referring_generalist_id uuid references public.doctors(id) on delete set null,
  assigned_specialist_id uuid references public.doctors(id) on delete set null,
  appointment_date date,
  appointment_time time,
  generalist_notes text not null default '',
  practice_location jsonb not null default '{}'::jsonb,
  specialist_schedule_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint referrals_status_check
    check (status in (
      'draft', 'sent', 'pending', 'accepted', 'confirmed',
      'completed', 'declined', 'cancelled'
    ))
);

create index if not exists referrals_referring_generalist_status_idx
  on public.referrals (referring_generalist_id, status);
create index if not exists referrals_assigned_specialist_status_idx
  on public.referrals (assigned_specialist_id, status);

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

-- ============================================================================
-- PART 4: INVOICING & BILLING TABLES
-- ============================================================================

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  invoice_number text not null unique,
  payment_status public.payment_status not null default 'unpaid',
  service_request_id uuid,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists idx_invoices_appointment_id on public.invoices(appointment_id);

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

-- ============================================================================
-- PART 5: INVENTORY & SUPPLIES TABLES
-- ============================================================================

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
  qr_code text not null,
  cost_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint inventory_items_cost_price_nonnegative check (cost_price >= 0),
  constraint inventory_items_selling_price_nonnegative check (selling_price >= 0)
);

create unique index if not exists inventory_items_qr_code_key on public.inventory_items (qr_code);

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  type public.stock_transaction_type not null,
  quantity integer not null,
  remarks text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_usage_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  notes text not null default '',
  scanned_code text not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ============================================================================
-- PART 6: LABORATORY & SERVICES TABLES
-- ============================================================================

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
  appointment_id uuid references public.appointments(id) on delete set null,
  payment_status text not null default 'pending_cashier',
  receipt_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_requests_completed_state_check
    check (
      status <> 'completed'
      or (result_status = 'completed' and completed_by is not null and completed_at is not null)
    ),
  constraint service_requests_payment_status_check
    check (payment_status in ('pending_cashier', 'paid'))
);

create unique index if not exists service_requests_receipt_code_key on public.service_requests (receipt_code);
create index if not exists service_requests_clinic_status_created_at_idx on public.service_requests (clinic_id, status, created_at desc);
create index if not exists service_requests_patient_created_at_idx on public.service_requests (patient_id, created_at desc);
create index if not exists service_requests_requested_by_created_at_idx on public.service_requests (requested_by, created_at desc);
create index if not exists service_requests_department_status_idx on public.service_requests (department, status);
create index if not exists service_requests_urgent_status_idx on public.service_requests (urgent_flag, status);
create index if not exists service_requests_sample_result_idx on public.service_requests (sample_status, result_status);
create index if not exists service_requests_appointment_created_at_idx on public.service_requests (appointment_id, created_at desc);
create index if not exists service_requests_payment_status_idx on public.service_requests (payment_status);

create table if not exists public.service_request_media (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  file_path text not null,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists service_request_media_request_id_idx
  on public.service_request_media (service_request_id, created_at desc);

-- ============================================================================
-- PART 7: POS & SALES TABLES
-- ============================================================================

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  patient_id uuid references public.patients(id) on delete set null,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash', 'gcash', 'card')),
  payment_reference text,
  payment_notes text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  item_name text not null,
  item_sku text not null,
  item_unit text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pos_sales_cashier_created_at_idx on public.pos_sales (cashier_id, created_at desc);
create index if not exists pos_sales_patient_created_at_idx on public.pos_sales (patient_id, created_at desc);
create index if not exists pos_sale_items_sale_id_idx on public.pos_sale_items (sale_id);
create index if not exists pos_sale_items_inventory_item_id_idx on public.pos_sale_items (inventory_item_id);

-- ============================================================================
-- PART 8.5: RECREATE HELPER FUNCTIONS (After tables are created)
-- ============================================================================

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'patient'::public.app_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_app_role() <> 'patient'::public.app_role;
$$;

create or replace function public.current_profile_clinic_id()
returns uuid
language sql
stable
as $$
  select clinic_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_lab_staff()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'lab_staff'::public.app_role;
$$;

create or replace function public.has_clinic_access(target_clinic_id uuid)
returns boolean
language sql
stable
as $$
  with current_profile as (
    select clinic_id
    from public.profiles
    where id = auth.uid()
  ), clinic_count as (
    select count(*)::integer as count
    from public.clinics
  ), first_clinic as (
    select id
    from public.clinics
    order by created_at asc
    limit 1
  )
  select
    public.current_app_role() = 'owner_admin'::public.app_role
    or (
      target_clinic_id is not null
      and (
        target_clinic_id = (select clinic_id from current_profile)
        or (
          (select clinic_id from current_profile) is null
          and (select count from clinic_count) = 1
          and target_clinic_id = (select id from first_clinic)
        )
      )
    );
$$;

-- ============================================================================
-- PART 9: AUDIT & FILE MANAGEMENT TABLES
-- ============================================================================

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

-- ============================================================================
-- PART 10: TRIGGERS
-- ============================================================================

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
create trigger set_updated_at_referrals before update on public.referrals for each row execute function public.set_updated_at();
create trigger set_updated_at_consultation_types before update on public.consultation_types for each row execute function public.set_updated_at();
create trigger set_updated_at_patient_medical_history_entries before update on public.patient_medical_history_entries for each row execute function public.set_updated_at();
create trigger set_updated_at_medical_services_transactions before update on public.medical_services_transactions for each row execute function public.set_updated_at();
create trigger set_updated_at_specialist_schedules before update on public.specialist_schedules for each row execute function public.set_updated_at();
create trigger set_updated_at_specialist_appointments before update on public.specialist_appointments for each row execute function public.set_updated_at();
create trigger set_updated_at_chat_threads before update on public.chat_threads for each row execute function public.set_updated_at();
create trigger set_updated_at_messages before update on public.messages for each row execute function public.set_updated_at();
create trigger set_updated_at_thread_unread before update on public.thread_unread for each row execute function public.set_updated_at();
create trigger set_updated_at_medical_certificates before update on public.medical_certificates for each row execute function public.set_updated_at();
create trigger set_updated_at_inventory_usage_logs before update on public.inventory_usage_logs for each row execute function public.set_updated_at();
create trigger set_updated_at_access_roles before update on public.access_roles for each row execute function public.set_updated_at();
create trigger set_updated_at_profile_access_roles before update on public.profile_access_roles for each row execute function public.set_updated_at();
create trigger set_updated_at_clinics before update on public.clinics for each row execute function public.set_updated_at();
create trigger set_updated_at_medical_services before update on public.medical_services for each row execute function public.set_updated_at();
create trigger set_updated_at_service_requests before update on public.service_requests for each row execute function public.set_updated_at();
create trigger set_updated_at_pos_sales before update on public.pos_sales for each row execute function public.set_updated_at();
create trigger set_updated_at_pos_sale_items before update on public.pos_sale_items for each row execute function public.set_updated_at();

-- ============================================================================
-- PART 11: RLS (ROW LEVEL SECURITY) - ENABLE
-- ============================================================================

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
alter table public.prescriptions enable row level security;
alter table public.referrals enable row level security;
alter table public.doctor_availability enable row level security;
alter table public.consultation_types enable row level security;
alter table public.patient_medical_history_entries enable row level security;
alter table public.medical_services_transactions enable row level security;
alter table public.specialist_schedules enable row level security;
alter table public.specialist_appointments enable row level security;
alter table public.chat_threads enable row level security;
alter table public.messages enable row level security;
alter table public.thread_unread enable row level security;
alter table public.medical_certificates enable row level security;
alter table public.inventory_usage_logs enable row level security;
alter table public.access_roles enable row level security;
alter table public.profile_access_roles enable row level security;
alter table public.clinics enable row level security;
alter table public.medical_services enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_media enable row level security;
alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;

-- ============================================================================
-- END OF SCHEMA MIGRATION
-- ============================================================================
-- This file contains only the database schema (tables, enums, indexes, triggers).
-- Run the functions_policies_bootstrap.sql file next to add policies and functions.
-- ============================================================================
-- ============================================================================
-- This comprehensive migration file combines all Odyssey Clinic database 
-- tables, functions, triggers, RLS policies, and bootstrap data into a 
-- single migration for fresh database setups.
-- ============================================================================
