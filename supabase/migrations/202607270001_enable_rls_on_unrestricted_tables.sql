-- Migration: Enable RLS on all remaining unrestricted tables for security
-- Date: 2026-07-27

BEGIN;

-- 1. appointment_additional_doctors
ALTER TABLE public.appointment_additional_doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_appointment_doctors" ON public.appointment_additional_doctors;
CREATE POLICY "staff_manage_appointment_doctors" ON public.appointment_additional_doctors 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 2. audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read_audit_logs" ON public.audit_logs;
CREATE POLICY "staff_read_audit_logs" ON public.audit_logs 
  FOR SELECT USING (public.is_staff());
DROP POLICY IF EXISTS "system_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "system_insert_audit_logs" ON public.audit_logs 
  FOR INSERT WITH CHECK (true); -- Allows system triggers to write audit entries

-- 3. company_billing_summary
ALTER TABLE public.company_billing_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_billing_summary" ON public.company_billing_summary;
CREATE POLICY "staff_manage_billing_summary" ON public.company_billing_summary 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 4. company_billing_detailed
ALTER TABLE public.company_billing_detailed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_billing_detailed" ON public.company_billing_detailed;
CREATE POLICY "staff_manage_billing_detailed" ON public.company_billing_detailed 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 5. company_billing_payment_history
ALTER TABLE public.company_billing_payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_billing_history" ON public.company_billing_payment_history;
CREATE POLICY "staff_manage_billing_history" ON public.company_billing_payment_history 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 6. file_uploads
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_file_uploads" ON public.file_uploads;
CREATE POLICY "staff_manage_file_uploads" ON public.file_uploads 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 7. inventory_categories
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_inventory_categories" ON public.inventory_categories;
CREATE POLICY "staff_manage_inventory_categories" ON public.inventory_categories 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 8. lab_services
ALTER TABLE public.lab_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_lab_services" ON public.lab_services;
CREATE POLICY "staff_manage_lab_services" ON public.lab_services 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 9. lab_test_panel_services
ALTER TABLE public.lab_test_panel_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_panel_services" ON public.lab_test_panel_services;
CREATE POLICY "staff_manage_panel_services" ON public.lab_test_panel_services 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 10. patient_vitals_history
ALTER TABLE public.patient_vitals_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_vitals_history" ON public.patient_vitals_history;
CREATE POLICY "staff_manage_vitals_history" ON public.patient_vitals_history 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 11. staff_members
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_read_members" ON public.staff_members;
CREATE POLICY "staff_read_members" ON public.staff_members 
  FOR SELECT USING (public.is_staff());
DROP POLICY IF EXISTS "admin_manage_members" ON public.staff_members;
CREATE POLICY "admin_manage_members" ON public.staff_members 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 12. suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_manage_suppliers" ON public.suppliers;
CREATE POLICY "staff_manage_suppliers" ON public.suppliers 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMIT;
