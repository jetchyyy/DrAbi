-- Add visit_type to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS visit_type text NOT NULL DEFAULT 'in_person';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_visit_type_check'
    ) THEN
        ALTER TABLE public.bookings
        ADD CONSTRAINT bookings_visit_type_check
        CHECK (visit_type IN ('in_person', 'teleconsultation'));
    END IF;
END $$;
