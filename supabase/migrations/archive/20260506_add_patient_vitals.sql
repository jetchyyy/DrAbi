-- Add vital signs columns to patients table
alter table public.patients
add column if not exists temperature text,
add column if not exists blood_pressure text,
add column if not exists heart_rate text,
add column if not exists respiratory_rate text,
add column if not exists weight text,
add column if not exists height text,
add column if not exists vitals_recorded_at timestamptz;
