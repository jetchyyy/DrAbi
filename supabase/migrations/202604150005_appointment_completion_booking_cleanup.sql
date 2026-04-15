-- Migration: Appointment Completion Cleanup Trigger
-- Purpose: Automatically cancel bookings when their linked appointment is completed
-- This prevents completed bookings from blocking new bookings in the patient portal

-- Create trigger function to cancel booking when linked appointment is completed
CREATE OR REPLACE FUNCTION public.sync_appointment_completion_to_booking_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- When appointment status changes to 'completed', mark the linked booking as cancelled
  -- This prevents the booking from blocking new bookings in the portal
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.booking_id IS NOT NULL THEN
      UPDATE public.bookings
      SET 
        status = 'cancelled',
        updated_at = timezone('utc'::text, now())
      WHERE 
        id = NEW.booking_id
        AND status != 'cancelled';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on appointments table
-- Fires AFTER UPDATE to sync appointment completion to booking cleanup
DROP TRIGGER IF EXISTS tr_sync_appointment_completion_to_booking_cleanup ON public.appointments;
CREATE TRIGGER tr_sync_appointment_completion_to_booking_cleanup
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_completion_to_booking_cleanup();

-- Optimize lookups on booking_id for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_booking_id ON public.appointments(booking_id);

-- Documentation
COMMENT ON FUNCTION public.sync_appointment_completion_to_booking_cleanup() IS
'Automatically cancels the linked booking when appointment is marked completed.
This prevents completed bookings from blocking new bookings in the patient portal.
Triggered after appointment status updates to completed.';

COMMENT ON TRIGGER tr_sync_appointment_completion_to_booking_cleanup ON public.appointments IS
'Cleans up completed appointments by marking associated bookings as cancelled.
Ensures that once a consultation is complete, patients can book new appointments without blocking messages.';
