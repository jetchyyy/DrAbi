alter table public.services
  add column if not exists service_type text not null default 'medical_service';

alter table public.bookings
  add column if not exists receipt_code text,
  add column if not exists payment_status text not null default 'pending_cashier';

update public.bookings
set receipt_code = coalesce(
  receipt_code,
  'ODC-BKG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
)
where receipt_code is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_service_type_check'
  ) then
    alter table public.services
      add constraint services_service_type_check
      check (service_type in ('medical_service', 'consultation', 'follow_up'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_payment_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_payment_status_check
      check (payment_status in ('pending_cashier', 'paid'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_receipt_code_key'
  ) then
    alter table public.bookings
      add constraint bookings_receipt_code_key unique (receipt_code);
  end if;
end
$$;

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
