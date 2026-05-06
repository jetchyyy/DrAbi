-- Updates the existing clinic_settings row with the correct CPR Med details.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
UPDATE clinic_settings
SET
  clinic_name                 = 'CPR Med',
  legal_name                  = 'CPR Med Clinic',
  short_code                  = 'CPRMED',
  address                     = 'CPR Medical Clinic & Laboratory Bulacao, Cebu City',
  contact_number              = '+639623093577',
  email                       = 'cprmedicalclinic@gmail.com',
  website                     = 'https://cprmedph.com',
  primary_color               = '#7dd453',
  accent_color                = '#34b2f9',
  booking_lead_days           = 30,
  booking_cancellation_hours  = 12,
  appointment_slot_minutes    = 30,
  operating_hours             = '[
    {"day":"Monday","open":"10:00","close":"22:00","enabled":true},
    {"day":"Tuesday","open":"10:00","close":"22:00","enabled":true},
    {"day":"Wednesday","open":"10:00","close":"22:00","enabled":true},
    {"day":"Thursday","open":"10:00","close":"22:00","enabled":true},
    {"day":"Friday","open":"10:00","close":"22:00","enabled":true},
    {"day":"Saturday","open":"10:00","close":"22:00","enabled":true},
    {"day":"Sunday","open":"00:00","close":"00:00","enabled":false}
  ]'::jsonb,
  updated_at                  = now()
WHERE id = (SELECT id FROM clinic_settings LIMIT 1);
