-- =============================================================================
-- Migration: Add company_id column to patients table
-- Date: 2026-06-03
-- Reason: Migration 006 updated the trigger to write company_id but the column
--         itself was never added to public.patients. This caused the trigger to
--         fail silently (or the column to not persist) during patient signup,
--         resulting in company_id always being NULL.
-- =============================================================================

-- 1. Add company_id column to patients (if it doesn't already exist)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- 2. Create index for faster company lookups on patients
CREATE INDEX IF NOT EXISTS patients_company_id_idx
  ON public.patients (company_id)
  WHERE company_id IS NOT NULL;

-- 3. Re-confirm the trigger function is correct (idempotent re-apply of migration 006)
--    This ensures it was properly installed with the company_id logic.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_role public.app_role := CASE coalesce(metadata ->> 'role', '')
    WHEN 'owner_admin'         THEN 'owner_admin'::public.app_role
    WHEN 'doctor'              THEN 'doctor'::public.app_role
    WHEN 'nurse_staff'         THEN 'nurse_staff'::public.app_role
    WHEN 'front_desk_cashier'  THEN 'front_desk_cashier'::public.app_role
    WHEN 'lab_staff'           THEN 'lab_staff'::public.app_role
    WHEN 'inventory_staff'     THEN 'inventory_staff'::public.app_role
    ELSE                            'patient'::public.app_role
  END;
  full_name text := coalesce(
    metadata ->> 'full_name',
    metadata ->> 'name',
    split_part(coalesce(new.email, 'Patient'), '@', 1),
    'Patient'
  );
  first_name text := coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Patient');
  last_name  text := nullif(btrim(substr(full_name, char_length(split_part(full_name, ' ', 1)) + 1)), '');
  walk_in_unique_id    text    := nullif(btrim(metadata ->> 'walk_in_unique_login_id'), '');
  linked_walk_in_count integer := 0;
BEGIN
  -- Upsert profile row
  INSERT INTO public.profiles (id, email, full_name, role, phone, title)
  VALUES (
    new.id,
    coalesce(new.email, ''),
    full_name,
    resolved_role,
    metadata ->> 'phone',
    metadata ->> 'title'
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = excluded.email,
    full_name = excluded.full_name,
    role      = excluded.role,
    phone     = excluded.phone,
    title     = excluded.title;

  -- Patient path
  IF resolved_role = 'patient'::public.app_role THEN

    -- Walk-in claim: link existing walk-in patient to this auth user
    IF walk_in_unique_id IS NOT NULL THEN
      UPDATE public.patients
      SET
        user_id                  = new.id,
        email                    = coalesce(new.email, email),
        mobile_number            = coalesce(nullif(metadata ->> 'phone', ''), mobile_number),
        address                  = coalesce(nullif(metadata ->> 'address', ''), address),
        allergies                = coalesce(nullif(metadata ->> 'allergies', ''), allergies),
        medical_history          = coalesce(nullif(metadata ->> 'medical_history', ''), medical_history),
        emergency_contact_name   = coalesce(nullif(metadata ->> 'emergency_contact_name', ''), emergency_contact_name),
        emergency_contact_phone  = coalesce(nullif(metadata ->> 'emergency_contact_phone', ''), emergency_contact_phone),
        company_id               = coalesce(nullif(metadata ->> 'company_id', '')::uuid, company_id),
        walk_in_account_claimed_at = timezone('utc', now()),
        updated_at               = timezone('utc', now())
      WHERE unique_login_id = walk_in_unique_id
        AND intake_source   = 'staff_walk_in'
        AND user_id         IS NULL
        AND deleted_at      IS NULL;

      GET DIAGNOSTICS linked_walk_in_count = ROW_COUNT;
    END IF;

    -- New online registration: insert fresh patient row
    IF linked_walk_in_count = 0 THEN
      INSERT INTO public.patients (
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
        unique_login_id,
        company_id
      )
      VALUES (
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
        NULL,
        nullif(metadata ->> 'company_id', '')::uuid
      )
      ON CONFLICT (user_id) DO UPDATE SET
        company_id = EXCLUDED.company_id
        WHERE public.patients.company_id IS NULL
          AND EXCLUDED.company_id IS NOT NULL;
    END IF;

  END IF;

  RETURN new;
END;
$$;
