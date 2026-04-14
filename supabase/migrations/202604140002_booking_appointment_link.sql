alter table public.bookings
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

create index if not exists idx_bookings_appointment_id
  on public.bookings(appointment_id);