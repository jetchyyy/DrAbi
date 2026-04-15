-- Migration: Payment Status Sync Trigger
-- Purpose: Automatically synchronize invoice payment status changes to appointment confirmation
-- When an invoice payment_status changes to 'paid', update the linked appointment to 'confirmed'
-- This ensures appointments are confirmed immediately upon payment without waiting for QR scan validation

-- Create trigger function to handle invoice payment status changes
CREATE OR REPLACE FUNCTION public.sync_payment_to_appointment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if payment_status is changing AND new status is 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Only update appointment if appointment_id is not null
    IF NEW.appointment_id IS NOT NULL THEN
      -- Update appointment to 'confirmed' but only if it's currently in 'scheduled' state
      -- This prevents overwriting 'in_progress', 'completed', or other terminal states
      UPDATE public.appointments
      SET 
        status = 'confirmed',
        updated_at = timezone('utc'::text, now())
      WHERE 
        id = NEW.appointment_id 
        AND status = 'scheduled';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on invoices table
-- Fires AFTER UPDATE to ensure the row is fully updated before processing
DROP TRIGGER IF EXISTS tr_sync_payment_to_appointment_status ON public.invoices;
CREATE TRIGGER tr_sync_payment_to_appointment_status
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_payment_to_appointment_status();

-- Optional: Create an index on invoices.appointment_id to optimize foreign key lookups
-- (if not already indexed by the FK constraint)
CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON public.invoices(appointment_id);

-- Add comment explaining the trigger behavior
COMMENT ON FUNCTION public.sync_payment_to_appointment_status() IS
'Automatically updates linked appointment status to confirmed when invoice payment_status changes to paid.
Only updates appointments in scheduled state to avoid overwriting in-progress or completed appointments.
Triggered after each invoice update.';

COMMENT ON TRIGGER tr_sync_payment_to_appointment_status ON public.invoices IS
'Ensures immediate appointment confirmation upon payment without requiring QR code validation.
Supports the returning patient workflow where old paid invoices should not affect new pending appointments.';
