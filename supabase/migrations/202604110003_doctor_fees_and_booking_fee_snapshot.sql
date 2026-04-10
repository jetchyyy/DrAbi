alter table public.doctors
  add column if not exists consultation_fee numeric(12,2) not null default 0,
  add column if not exists follow_up_fee numeric(12,2) not null default 0;

alter table public.bookings
  add column if not exists fee_type text not null default 'consultation',
  add column if not exists fee_amount numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_fee_type_check'
  ) then
    alter table public.bookings
      add constraint bookings_fee_type_check
      check (fee_type in ('consultation', 'follow_up'));
  end if;
end
$$;
