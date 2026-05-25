-- Migration: Promo Codes Management & Tracking
-- Created: 2026-05-22

-- 1. Create promo_codes table
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  max_uses integer not null default 10 check (max_uses >= 1),
  used_count integer not null default 0 check (used_count >= 0),
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed', 'free')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  applicable_service_id uuid references public.services(id) on delete set null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

-- 2. Add columns to bookings
alter table public.bookings 
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column if not exists discount_amount numeric(12,2) not null default 0;

-- 3. Enable RLS on promo_codes
alter table public.promo_codes enable row level security;

-- 4. Create RLS Policies
create policy "promo_codes staff access" 
  on public.promo_codes 
  for all 
  using (public.is_staff()) 
  with check (public.is_staff());

create policy "promo_codes select public" 
  on public.promo_codes 
  for select 
  using (active = true and deleted_at is null);

-- 5. Trigger for updated_at
create trigger set_updated_at_promo_codes 
  before update on public.promo_codes 
  for each row 
  execute function public.set_updated_at();

-- 6. Trigger function to validate and update used_count on bookings insert or update
create or replace function public.handle_booking_promo_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_uses integer;
  v_used_count integer;
  v_active boolean;
  v_expires_at timestamptz;
  v_applicable_service_id uuid;
begin
  -- INSERT case
  if TG_OP = 'INSERT' then
    if new.promo_code_id is not null then
      select max_uses, used_count, active, expires_at, applicable_service_id
      into v_max_uses, v_used_count, v_active, v_expires_at, v_applicable_service_id
      from public.promo_codes
      where id = new.promo_code_id for update;

      if not found then
        raise exception 'Promo code not found';
      end if;

      if not v_active or (v_expires_at is not null and v_expires_at < now()) then
        raise exception 'Promo code is inactive or expired';
      end if;

      if v_used_count >= v_max_uses then
        raise exception 'Promo code usage limit has been reached';
      end if;

      if v_applicable_service_id is not null and v_applicable_service_id <> new.service_id then
        raise exception 'Promo code is not applicable to the selected service';
      end if;

      update public.promo_codes
      set used_count = used_count + 1,
          updated_at = timezone('utc', now())
      where id = new.promo_code_id;
    end if;

  -- UPDATE case
  elsif TG_OP = 'UPDATE' then
    -- Case A: Promo code changed
    if coalesce(old.promo_code_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(new.promo_code_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      -- Decrement old promo code count if old booking was not cancelled
      if old.promo_code_id is not null and old.status <> 'cancelled' then
        update public.promo_codes
        set used_count = greatest(0, used_count - 1),
            updated_at = timezone('utc', now())
        where id = old.promo_code_id;
      end if;

      -- Increment new promo code count if new booking is not cancelled
      if new.promo_code_id is not null and new.status <> 'cancelled' then
        select max_uses, used_count, active, expires_at, applicable_service_id
        into v_max_uses, v_used_count, v_active, v_expires_at, v_applicable_service_id
        from public.promo_codes
        where id = new.promo_code_id for update;

        if not found then
          raise exception 'Promo code not found';
        end if;

        if not v_active or (v_expires_at is not null and v_expires_at < now()) then
          raise exception 'Promo code is inactive or expired';
        end if;

        if v_used_count >= v_max_uses then
          raise exception 'Promo code usage limit has been reached';
        end if;

        if v_applicable_service_id is not null and v_applicable_service_id <> new.service_id then
          raise exception 'Promo code is not applicable to the selected service';
        end if;

        update public.promo_codes
        set used_count = used_count + 1,
            updated_at = timezone('utc', now())
        where id = new.promo_code_id;
      end if;

    -- Case B: Promo code remained the same but status changed
    elsif new.promo_code_id is not null then
      if old.status <> 'cancelled' and new.status = 'cancelled' then
        -- Booking cancelled, decrement count
        update public.promo_codes
        set used_count = greatest(0, used_count - 1),
            updated_at = timezone('utc', now())
        where id = new.promo_code_id;
      elsif old.status = 'cancelled' and new.status <> 'cancelled' then
        -- Booking uncancelled, check and increment count
        select max_uses, used_count, active, expires_at, applicable_service_id
        into v_max_uses, v_used_count, v_active, v_expires_at, v_applicable_service_id
        from public.promo_codes
        where id = new.promo_code_id for update;

        if v_used_count >= v_max_uses then
          raise exception 'Promo code usage limit has been reached';
        end if;

        if v_applicable_service_id is not null and v_applicable_service_id <> new.service_id then
          raise exception 'Promo code is not applicable to the selected service';
        end if;

        update public.promo_codes
        set used_count = used_count + 1,
            updated_at = timezone('utc', now())
        where id = new.promo_code_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- 7. Bind trigger to bookings table
create trigger booking_promo_code_trigger
  before insert or update on public.bookings
  for each row 
  execute function public.handle_booking_promo_code();
