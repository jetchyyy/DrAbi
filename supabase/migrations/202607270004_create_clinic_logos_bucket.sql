-- Migration: Create clinic-logos storage bucket
-- Date: 2026-07-27

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 1. Read access for everyone (so public portal can show the logos)
DROP POLICY IF EXISTS "clinic_logos_public_read" ON storage.objects;
CREATE POLICY "clinic_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-logos');

-- 2. Write, update, delete access for authenticated users (staff)
DROP POLICY IF EXISTS "clinic_logos_staff_insert" ON storage.objects;
CREATE POLICY "clinic_logos_staff_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clinic-logos');

DROP POLICY IF EXISTS "clinic_logos_staff_update" ON storage.objects;
CREATE POLICY "clinic_logos_staff_update" ON storage.objects
  FOR UPDATE TO authenticated WITH CHECK (bucket_id = 'clinic-logos');

DROP POLICY IF EXISTS "clinic_logos_staff_delete" ON storage.objects;
CREATE POLICY "clinic_logos_staff_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'clinic-logos');

COMMIT;
