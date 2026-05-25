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

  -- Bootstrap only for single-clinic deployments to avoid cross-clinic leakage.
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