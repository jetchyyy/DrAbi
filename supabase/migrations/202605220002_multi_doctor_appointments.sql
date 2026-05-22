-- Make patient_id nullable on appointments table
ALTER TABLE public.appointments ALTER COLUMN patient_id DROP NOT NULL;

-- Add additional_doctor_ids column to appointments table
ALTER TABLE public.appointments ADD COLUMN additional_doctor_ids uuid[] DEFAULT '{}';
