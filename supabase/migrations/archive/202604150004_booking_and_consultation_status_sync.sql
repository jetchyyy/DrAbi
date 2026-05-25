-- Migration: Booking Status and Consultation Trigger Sync
-- Purpose: 
--   1. Automatically update booking status to 'confirmed' when invoice payment becomes 'paid'
--   2. Automatically update appointment status to 'completed' when linked consultation is finalized

-- ========================================
-- PART 1: Booking Status Update on Payment
-- ========================================

-- Create trigger function to sync invoice payment to booking confirmation
CREATE OR REPLACE FUNCTION public.sync_payment_to_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if payment_status is changing AND new status is 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Get the booking linked to the appointment
    IF NEW.appointment_id IS NOT NULL THEN
      UPDATE public.bookings
      SET 
        status = 'confirmed',
        updated_at = timezone('utc'::text, now())
      WHERE 
        appointment_id = NEW.appointment_id
        AND status = 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on invoices table
-- Fires AFTER UPDATE to sync from payment to booking
DROP TRIGGER IF EXISTS tr_sync_payment_to_booking_status ON public.invoices;
CREATE TRIGGER tr_sync_payment_to_booking_status
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_to_booking_status();

-- ========================================
-- PART 2: Appointment Status Update on Consultation Completion
-- ========================================

-- Create trigger function to update appointment status when consultation is marked complete
CREATE OR REPLACE FUNCTION public.sync_consultation_completion_to_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if clinical_summary is being set (indicating consultation completion)
  -- and appointment_id exists
  IF NEW.appointment_id IS NOT NULL 
    AND (OLD.clinical_summary IS NULL OR OLD.clinical_summary = '')
    AND NEW.clinical_summary IS NOT NULL 
    AND NEW.clinical_summary != '' THEN
    
    -- Update the linked appointment to 'completed' if it's not already completed
    UPDATE public.appointments
    SET 
      status = 'completed',
      consultation_id = NEW.id,
      updated_at = timezone('utc'::text, now())
    WHERE 
      id = NEW.appointment_id
      AND status != 'completed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on consultations table
-- Fires AFTER INSERT or UPDATE to sync consultation completion to appointment
DROP TRIGGER IF EXISTS tr_sync_consultation_to_appointment_status ON public.consultations;
CREATE TRIGGER tr_sync_consultation_to_appointment_status
AFTER INSERT OR UPDATE ON public.consultations
FOR EACH ROW
EXECUTE FUNCTION public.sync_consultation_completion_to_appointment();

-- ========================================
-- PART 3: Booking Completion Cleanup on Appointment Completion
-- ========================================

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

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Optimize lookups on appointment_id for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON public.invoices(appointment_id);

-- Optimize lookups on appointment_id for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_appointment_id ON public.bookings(appointment_id);

-- Optimize lookups on appointment_id for consultations
CREATE INDEX IF NOT EXISTS idx_consultations_appointment_id ON public.consultations(appointment_id);

-- Optimize lookups on booking_id for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_booking_id ON public.appointments(booking_id);

-- ========================================
-- DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION public.sync_payment_to_booking_status() IS
'Automatically updates linked booking status to confirmed when invoice payment_status changes to paid.
Only updates bookings in pending state to avoid overwriting other states.
Triggered after each invoice update.';

COMMENT ON TRIGGER tr_sync_payment_to_booking_status ON public.invoices IS
'Ensures immediate booking confirmation upon payment.
Links invoice payment to booking status through the appointment relationship.';

COMMENT ON FUNCTION public.sync_consultation_completion_to_appointment() IS
'Automatically updates linked appointment status to completed when a consultation is saved with clinical_summary.
Indicates that the doctor has finished the consultation phase of the patient.
Triggered after consultation insert or update.';

COMMENT ON TRIGGER tr_sync_consultation_to_appointment_status ON public.consultations IS
'Ensures appointment is marked completed when doctor finishes consultation.
Supports the clinical workflow where appointment completion is tied to consultation completion.';

COMMENT ON FUNCTION public.sync_appointment_completion_to_booking_cleanup() IS
'Automatically cancels the linked booking when appointment is marked completed.
This prevents completed bookings from blocking new bookings in the patient portal.
Triggered after appointment status updates to completed.';

COMMENT ON TRIGGER tr_sync_appointment_completion_to_booking_cleanup ON public.appointments IS
'Cleans up completed appointments by marking associated bookings as cancelled.
Ensures that once a consultation is complete, patients can book new appointments without blocking messages.';
