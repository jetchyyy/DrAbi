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
-- PART 12: RLS POLICIES
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
-- PART 13: BUSINESS LOGIC FUNCTIONS
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
-- PART 14: PAYMENT & BILLING TRIGGERS
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
-- PART 15: BOOTSTRAP DATA & INITIALIZATION
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
-- PART 16: STORAGE SETUP (Lab Request Attachments)
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
-- PART 17: GRANTS & PERMISSIONS
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
-- END OF MIGRATION
-- ============================================================================
-- This comprehensive migration file combines all Odyssey Clinic database 
-- tables, functions, triggers, RLS policies, and bootstrap data into a 
-- single migration for fresh database setups.
-- ============================================================================
