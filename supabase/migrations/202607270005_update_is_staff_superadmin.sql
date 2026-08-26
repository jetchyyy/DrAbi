-- Migration: Update public.is_staff() to include superadmins
-- Date: 2026-07-27

BEGIN;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role IN (
          'owner_admin'::public.app_role,
          'doctor'::public.app_role,
          'specialist'::public.app_role,
          'nurse_staff'::public.app_role,
          'front_desk_cashier'::public.app_role,
          'lab_staff'::public.app_role,
          'inventory_staff'::public.app_role
        )
        OR is_superadmin = TRUE
      )
  );
$$;

COMMIT;
