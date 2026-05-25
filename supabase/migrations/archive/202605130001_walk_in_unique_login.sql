alter table public.patients
  add column if not exists unique_login_id text,
  add column if not exists walk_in_account_claimed_at timestamptz;

create or replace function public.generate_walk_in_unique_login_id()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := concat(
      'ODC-WALK-',
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
    );

    exit when not exists (
      select 1
      from public.patients
      where unique_login_id = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.patients
set unique_login_id = public.generate_walk_in_unique_login_id()
where intake_source = 'staff_walk_in'
  and deleted_at is null
  and unique_login_id is null;

create unique index if not exists patients_unique_login_id_key
  on public.patients (unique_login_id)
  where unique_login_id is not null;

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
    when 'nurse_staff' then 'nurse_staff'::public.app_role
    when 'front_desk_cashier' then 'front_desk_cashier'::public.app_role
    when 'lab_staff' then 'lab_staff'::public.app_role
    when 'inventory_staff' then 'inventory_staff'::public.app_role
    else 'patient'::public.app_role
  end;
  full_name text := coalesce(metadata ->> 'full_name', metadata ->> 'name', split_part(coalesce(new.email, 'Patient'), '@', 1), 'Patient');
  first_name text := coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Patient');
  last_name text := nullif(btrim(substr(full_name, char_length(split_part(full_name, ' ', 1)) + 1)), '');
  walk_in_unique_id text := nullif(btrim(metadata ->> 'walk_in_unique_login_id'), '');
  linked_walk_in_count integer := 0;
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
    if walk_in_unique_id is not null then
      update public.patients
      set
        user_id = new.id,
        email = coalesce(new.email, email),
        mobile_number = coalesce(nullif(metadata ->> 'phone', ''), mobile_number),
        address = coalesce(nullif(metadata ->> 'address', ''), address),
        allergies = coalesce(nullif(metadata ->> 'allergies', ''), allergies),
        medical_history = coalesce(nullif(metadata ->> 'medical_history', ''), medical_history),
        emergency_contact_name = coalesce(nullif(metadata ->> 'emergency_contact_name', ''), emergency_contact_name),
        emergency_contact_phone = coalesce(nullif(metadata ->> 'emergency_contact_phone', ''), emergency_contact_phone),
        walk_in_account_claimed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where unique_login_id = walk_in_unique_id
        and intake_source = 'staff_walk_in'
        and user_id is null
        and deleted_at is null;

      get diagnostics linked_walk_in_count = row_count;
    end if;

    if linked_walk_in_count = 0 then
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
        emergency_contact_phone,
        unique_login_id
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
        coalesce(metadata ->> 'emergency_contact_phone', metadata ->> 'phone'),
        null
      )
      on conflict (user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.portal_get_walk_in_patient_by_unique_id(input_unique_id text)
returns table (
  patient_id uuid,
  unique_login_id text,
  first_name text,
  last_name text,
  birth_date date,
  mobile_number text,
  email text,
  address text,
  blood_type text,
  allergies text,
  medical_history text,
  emergency_contact_name text,
  emergency_contact_phone text,
  account_linked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_unique_id text := upper(btrim(coalesce(input_unique_id, '')));
begin
  if normalized_unique_id = '' then
    return;
  end if;

  return query
  select
    p.id,
    p.unique_login_id,
    p.first_name,
    p.last_name,
    p.birth_date,
    p.mobile_number,
    p.email,
    p.address,
    p.blood_type,
    p.allergies,
    p.medical_history,
    p.emergency_contact_name,
    p.emergency_contact_phone,
    (p.user_id is not null) as account_linked
  from public.patients p
  where p.deleted_at is null
    and p.intake_source = 'staff_walk_in'
    and p.unique_login_id is not null
    and upper(p.unique_login_id) = normalized_unique_id
  limit 1;
end;
$$;

grant execute on function public.portal_get_walk_in_patient_by_unique_id(text) to anon;
grant execute on function public.portal_get_walk_in_patient_by_unique_id(text) to authenticated;
