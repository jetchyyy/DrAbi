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

update public.patients p
set
  deleted_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
from public.profiles pr
where p.user_id = pr.id
  and pr.role <> 'patient'::public.app_role
  and p.deleted_at is null;
