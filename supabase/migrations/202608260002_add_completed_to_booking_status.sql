-- Migration: Add 'completed' to booking_status enum
-- Fixes trigger sync_appointment_completion_to_booking_cleanup which sets booking status to 'completed'

ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'completed';
