-- Add O2 saturation field to patient vitals
alter table public.patients
add column if not exists o2_sat text;
