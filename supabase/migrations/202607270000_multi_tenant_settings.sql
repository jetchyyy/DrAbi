-- Migration: Add clinic_id and domain to clinic_settings for multi-tenant SAAS
-- Date: 2026-07-27

BEGIN;

-- 1. Add clinic_id and domain columns
ALTER TABLE public.clinic_settings 
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS domain text;

-- 2. Add unique constraints to prevent duplicates
ALTER TABLE public.clinic_settings 
  DROP CONSTRAINT IF EXISTS clinic_settings_clinic_id_key,
  DROP CONSTRAINT IF EXISTS clinic_settings_domain_key;

ALTER TABLE public.clinic_settings 
  ADD CONSTRAINT clinic_settings_clinic_id_key UNIQUE (clinic_id),
  ADD CONSTRAINT clinic_settings_domain_key UNIQUE (domain);

-- 3. Bootstrap link for the default clinic
DO $$
DECLARE
  v_clinic_id uuid;
  v_settings_id uuid;
BEGIN
  -- Find the first clinic
  SELECT id INTO v_clinic_id FROM public.clinics ORDER BY created_at LIMIT 1;
  -- Find the first clinic_settings
  SELECT id INTO v_settings_id FROM public.clinic_settings LIMIT 1;
  
  -- If both exist, link them
  IF v_clinic_id IS NOT NULL AND v_settings_id IS NOT NULL THEN
    UPDATE public.clinic_settings 
    SET clinic_id = v_clinic_id 
    WHERE id = v_settings_id;
  END IF;
END $$;

COMMIT;
