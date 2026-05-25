-- =============================================================================
-- Migration: Schema integrity & normalization fixes
-- Date: 2026-05-25
-- =============================================================================
-- Sections:
--   1. Fix service_requests.patient_id FK (profiles → patients)
--   2. Add missing FK on appointments.consultation_id
--   3. Junction table: appointment_additional_doctors
--   4. Junction table: lab_test_panel_services
--   5. Drop dead tables: roles, role_permissions, permissions, lab_orders, lab_results
--   6. Merge referral duplicate columns
--   7. Add denormalized patient_id to hmo_claims
--   8. Create patient_vitals_history table
--   9. Link services ↔ medical_services
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Fix service_requests.patient_id → patients(id)
-- =============================================================================
-- The FK incorrectly referenced profiles(id). Walk-in patients who have no
-- profile account cannot have service requests against this constraint.
-- We remap the stored profile IDs to their matching patient.id values first.

-- Remap: profile ID → patient.id (for patients who registered online)
UPDATE public.service_requests sr
SET patient_id = p.id
FROM public.patients p
WHERE p.user_id = sr.patient_id;

-- Remove any rows that couldn't be remapped (patient_id is NOT NULL, so we
-- can't leave invalid values in place). In production this should affect 0 rows
-- since all service_requests are created via resolvePatientProfileId().
DELETE FROM public.service_requests
WHERE NOT EXISTS (
  SELECT 1 FROM public.patients p WHERE p.id = service_requests.patient_id
);

-- Re-add the FK pointing to patients (drop first to make this re-runnable)
ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_patient_id_fkey;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- NOTE (app follow-up): resolvePatientProfileId() in lab-request-service.ts
-- can be simplified — it no longer needs to convert patient.id → profile.id
-- before inserting. Pass patient.id directly.

-- =============================================================================
-- 2. Add missing FK on appointments.consultation_id
-- =============================================================================
-- The column existed as a bare UUID with no constraint, allowing stale pointers.

-- Null out any orphaned values before adding the constraint
UPDATE public.appointments
SET consultation_id = NULL
WHERE consultation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.consultations c WHERE c.id = appointments.consultation_id
  );

-- Drop first so re-running this migration doesn't fail on duplicate constraint
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_consultation_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_consultation_id_fkey
  FOREIGN KEY (consultation_id) REFERENCES public.consultations(id);

-- =============================================================================
-- 3. Junction table: appointment_additional_doctors
-- =============================================================================
-- Replaces appointments.additional_doctor_ids uuid[] which has no referential
-- integrity. The array column is kept until app code is updated.

CREATE TABLE IF NOT EXISTS public.appointment_additional_doctors (
  appointment_id uuid NOT NULL,
  doctor_id      uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT appointment_additional_doctors_pkey
    PRIMARY KEY (appointment_id, doctor_id),
  CONSTRAINT appt_add_doctors_appointment_fkey
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE,
  CONSTRAINT appt_add_doctors_doctor_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE
);

-- Seed from existing array data.
-- JOIN to doctors filters out any stale IDs that no longer exist —
-- those would have caused a FK violation with a plain unnest approach.
INSERT INTO public.appointment_additional_doctors (appointment_id, doctor_id)
SELECT a.id, d.id
FROM   public.appointments a
JOIN   LATERAL unnest(a.additional_doctor_ids) AS uid ON true
JOIN   public.doctors d ON d.id = uid
WHERE  a.additional_doctor_ids IS NOT NULL
  AND  cardinality(a.additional_doctor_ids) > 0
ON CONFLICT DO NOTHING;

-- NOTE (app follow-up): Update appointments-page.tsx to query this junction
-- table instead of the array. Then run:
--   ALTER TABLE public.appointments DROP COLUMN additional_doctor_ids;

-- =============================================================================
-- 4. Junction table: lab_test_panel_services
-- =============================================================================
-- Replaces lab_test_panels.medical_service_ids uuid[] which has no referential
-- integrity. The array column is kept until app code is updated.

CREATE TABLE IF NOT EXISTS public.lab_test_panel_services (
  panel_id           uuid    NOT NULL,
  medical_service_id uuid    NOT NULL,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT lab_test_panel_services_pkey
    PRIMARY KEY (panel_id, medical_service_id),
  CONSTRAINT lab_panel_services_panel_fkey
    FOREIGN KEY (panel_id) REFERENCES public.lab_test_panels(id) ON DELETE CASCADE,
  CONSTRAINT lab_panel_services_service_fkey
    FOREIGN KEY (medical_service_id) REFERENCES public.medical_services(id) ON DELETE CASCADE
);

-- Seed from existing array data.
-- JOIN to medical_services filters out any stale IDs.
INSERT INTO public.lab_test_panel_services (panel_id, medical_service_id)
SELECT p.id, ms.id
FROM   public.lab_test_panels p
JOIN   LATERAL unnest(p.medical_service_ids) AS uid ON true
JOIN   public.medical_services ms ON ms.id = uid
WHERE  p.medical_service_ids IS NOT NULL
  AND  cardinality(p.medical_service_ids) > 0
ON CONFLICT DO NOTHING;

-- NOTE (app follow-up): Update lis-service.ts to query this junction table
-- instead of the array. Then run:
--   ALTER TABLE public.lab_test_panels DROP COLUMN medical_service_ids;

-- =============================================================================
-- 5. Drop dead tables
-- =============================================================================

-- role_permissions depends on both roles and permissions — drop it first.
DROP TABLE IF EXISTS public.role_permissions;
-- roles and permissions have no remaining dependents.
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.permissions;

-- lab_results depends on lab_orders — drop it first.
DROP TABLE IF EXISTS public.lab_results;
DROP TABLE IF EXISTS public.lab_orders;

-- NOTE: lab_services is intentionally kept — catalog-tab.tsx still queries it.
-- TODO: migrate lab_services entries into medical_services, update
-- catalog-tab.tsx, then run: DROP TABLE public.lab_services;

-- =============================================================================
-- 6. Merge referral duplicate columns
-- =============================================================================
-- referring_doctor_id ≈ referring_generalist_id  (same field, renamed over time)
-- target_doctor_id    ≈ assigned_specialist_id    (same field, renamed over time)
--
-- The create_referral_with_slot_lock RPC writes to referring_generalist_id and
-- assigned_specialist_id. Older rows only have referring_doctor_id and
-- target_doctor_id. We consolidate into the original columns (which are what
-- mapReferralRowToDomain reads) and drop the aliases.

-- Bring referring_generalist_id values into referring_doctor_id where they differ
UPDATE public.referrals
SET referring_doctor_id = referring_generalist_id
WHERE referring_generalist_id IS NOT NULL
  AND referring_generalist_id IS DISTINCT FROM referring_doctor_id;

-- Bring assigned_specialist_id values into target_doctor_id where they differ
UPDATE public.referrals
SET target_doctor_id = assigned_specialist_id
WHERE assigned_specialist_id IS NOT NULL
  AND assigned_specialist_id IS DISTINCT FROM target_doctor_id;

-- Drop the alias columns and their FK constraints
ALTER TABLE public.referrals
  DROP CONSTRAINT IF EXISTS referrals_referring_generalist_id_fkey,
  DROP COLUMN IF EXISTS referring_generalist_id;

ALTER TABLE public.referrals
  DROP CONSTRAINT IF EXISTS referrals_assigned_specialist_id_fkey,
  DROP COLUMN IF EXISTS assigned_specialist_id;

-- NOTE (app follow-up — required or queries will error on the dropped columns):
--   referral-service.ts listByTargetDoctor():
--     Change: .or(`target_doctor_id.eq.${doctorId},assigned_specialist_id.eq.${doctorId}`)
--     To:     .eq('target_doctor_id', doctorId)
--
--   chat-service.ts:
--     Change: row.referring_generalist_id ?? row.referring_doctor_id  →  row.referring_doctor_id
--     Change: row.assigned_specialist_id ?? row.target_doctor_id      →  row.target_doctor_id
--
--   create_referral_with_slot_lock RPC: update to write referring_doctor_id
--   and target_doctor_id directly instead of the now-dropped aliases.
--
-- NOTE: appointment_id and source_appointment_id are NOT duplicates:
--   appointment_id        = the booked specialist appointment (post-referral)
--   source_appointment_id = the originating generalist appointment (pre-referral)

-- =============================================================================
-- 7. Add denormalized patient_id to hmo_claims
-- =============================================================================
-- Currently you must join hmo_claims → hmo_authorizations to find the patient.
-- Adding patient_id directly makes the common billing/HMO queries simpler.

ALTER TABLE public.hmo_claims
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id);

-- Populate from the authorization join
UPDATE public.hmo_claims hc
SET patient_id = ha.patient_id
FROM public.hmo_authorizations ha
WHERE hc.authorization_id = ha.id
  AND hc.patient_id IS NULL;

CREATE INDEX IF NOT EXISTS hmo_claims_patient_id_idx
  ON public.hmo_claims (patient_id);

-- =============================================================================
-- 8. patient_vitals_history table
-- =============================================================================
-- The patients table only stores the latest vitals snapshot, overwriting on
-- every recording. This table preserves the full history per patient.

CREATE TABLE IF NOT EXISTS public.patient_vitals_history (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  patient_id       uuid        NOT NULL REFERENCES public.patients(id),
  appointment_id   uuid        REFERENCES public.appointments(id),
  consultation_id  uuid        REFERENCES public.consultations(id),
  recorded_by      uuid        REFERENCES public.profiles(id),
  temperature      text,
  blood_pressure   text,
  heart_rate       text,
  respiratory_rate text,
  o2_sat           text,
  weight           text,
  height           text,
  recorded_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT patient_vitals_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS patient_vitals_history_patient_idx
  ON public.patient_vitals_history (patient_id, recorded_at DESC);

-- Seed from existing patient vitals snapshots so no history is lost
INSERT INTO public.patient_vitals_history (
  patient_id,
  temperature, blood_pressure, heart_rate,
  respiratory_rate, o2_sat, weight, height,
  recorded_at
)
SELECT
  id,
  temperature, blood_pressure, heart_rate,
  respiratory_rate, o2_sat, weight, height,
  COALESCE(vitals_recorded_at, updated_at)
FROM public.patients
WHERE vitals_recorded_at IS NOT NULL
   OR temperature      IS NOT NULL
   OR blood_pressure   IS NOT NULL
   OR heart_rate       IS NOT NULL
   OR o2_sat           IS NOT NULL
   OR weight           IS NOT NULL
   OR height           IS NOT NULL;

-- NOTE (app follow-up): When recording vitals, INSERT a row here in addition
-- to updating patients. The patients table keeps the latest snapshot for quick
-- reads; this table holds the full history.

-- =============================================================================
-- 9. Link services ↔ medical_services
-- =============================================================================
-- services         = patient-facing bookable catalog (appointments, bookings)
-- medical_services = internal clinical/LIS catalog (test parameters, reagents)
-- A nullable FK lets a bookable service point to its clinical definition
-- without requiring every service to have one.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS medical_service_id uuid
  REFERENCES public.medical_services(id);

-- NOTE (app follow-up): Wire this in the settings service catalog UI so
-- admins can link a bookable service to its medical_services counterpart.
-- This eliminates the need to maintain duplicate names across both tables.

COMMIT;
