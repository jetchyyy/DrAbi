insert into public.roles (code, name)
values
  ('owner_admin', 'Owner / Admin'),
  ('doctor', 'Doctor'),
  ('nurse_staff', 'Nurse / Staff'),
  ('front_desk_cashier', 'Front Desk / Cashier'),
  ('lab_staff', 'Lab Staff'),
  ('inventory_staff', 'Inventory Staff'),
  ('patient', 'Patient')
on conflict (code) do nothing;

insert into public.permissions (code, name)
values
  ('dashboard.view', 'View dashboard'),
  ('patients.view', 'View patients'),
  ('patients.manage', 'Manage patients'),
  ('appointments.view', 'View appointments'),
  ('appointments.manage', 'Manage appointments'),
  ('consultations.manage', 'Manage consultations'),
  ('billing.view', 'View billing'),
  ('billing.manage', 'Manage billing'),
  ('inventory.view', 'View inventory'),
  ('inventory.manage', 'Manage inventory'),
  ('laboratory.view', 'View laboratory'),
  ('laboratory.manage', 'Manage laboratory'),
  ('settings.view', 'View settings'),
  ('settings.manage', 'Manage settings'),
  ('booking.view', 'View booking'),
  ('booking.manage', 'Manage booking'),
  ('users.manage', 'Manage users')
on conflict (code) do nothing;

insert into public.clinic_settings (
  clinic_name,
  legal_name,
  short_code,
  address,
  contact_number,
  email,
  website,
  primary_color,
  accent_color,
  booking_lead_days,
  booking_cancellation_hours,
  appointment_slot_minutes,
  operating_hours
)
values (
  'Odyssey Family Clinic',
  'Odyssey Family Clinic OPC',
  'ODYSSEY',
  '125 Rizal Avenue, Makati City, Metro Manila',
  '+63 917 555 0134',
  'hello@odysseyclinic.test',
  'https://odysseyclinic.test',
  '#155eef',
  '#0f766e',
  30,
  12,
  30,
  '[
    {"day":"Monday","open":"08:00","close":"18:00","enabled":true},
    {"day":"Tuesday","open":"08:00","close":"18:00","enabled":true},
    {"day":"Wednesday","open":"08:00","close":"18:00","enabled":true},
    {"day":"Thursday","open":"08:00","close":"18:00","enabled":true},
    {"day":"Friday","open":"08:00","close":"18:00","enabled":true},
    {"day":"Saturday","open":"08:00","close":"13:00","enabled":true},
    {"day":"Sunday","open":"00:00","close":"00:00","enabled":false}
  ]'::jsonb
)
on conflict (short_code) do nothing;

insert into public.specialties (id, name, description)
values
  ('11111111-1111-1111-1111-111111111111', 'Family Medicine', 'Continuity care and primary consultations'),
  ('22222222-2222-2222-2222-222222222222', 'Pediatrics', 'Child wellness and acute pediatric concerns'),
  ('33333333-3333-3333-3333-333333333333', 'Internal Medicine', 'Adult medical assessments and chronic care')
on conflict (id) do nothing;

insert into public.services (id, name, description, price, duration_minutes, specialty_id, is_bookable)
values
  ('44444444-4444-4444-4444-444444444444', 'General Consultation', 'In-clinic consult with physician', 800, 30, '11111111-1111-1111-1111-111111111111', true),
  ('55555555-5555-5555-5555-555555555555', 'Follow-up Consultation', 'Review of prior consult or labs', 650, 20, '33333333-3333-3333-3333-333333333333', true),
  ('66666666-6666-6666-6666-666666666666', 'Pediatric Checkup', 'Child consultation and wellness review', 900, 30, '22222222-2222-2222-2222-222222222222', true)
on conflict (id) do nothing;

insert into public.suppliers (id, name, contact_person, phone, email)
values
  ('77777777-7777-7777-7777-777777777777', 'Medline Pharma', 'Kara Lim', '+63 917 500 1000', 'kara@medline.test'),
  ('88888888-8888-8888-8888-888888888888', 'LabSource Diagnostics', 'Rico Ong', '+63 917 500 1001', 'rico@labsource.test')
on conflict (id) do nothing;

insert into public.inventory_categories (id, name)
values
  ('99999999-9999-9999-9999-999999999999', 'Medicines'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Medical Supplies')
on conflict (id) do nothing;

insert into public.inventory_items (id, category_id, supplier_id, name, sku, unit, stock_on_hand, reorder_level)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'Paracetamol 500mg', 'MED-001', 'box', 18, 20),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', 'Vacutainer Tube', 'SUP-101', 'pack', 42, 25)
on conflict (id) do nothing;

insert into public.lab_services (id, name, description, price)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Complete Blood Count', 'CBC panel', 1050),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Urinalysis', 'Routine urinalysis', 650)
on conflict (id) do nothing;

