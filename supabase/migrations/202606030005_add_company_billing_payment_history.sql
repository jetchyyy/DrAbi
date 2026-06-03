-- =============================================================================
-- Migration: Add company billing summary, detailed, and payment history tables
-- Date: 2026-06-03
-- =============================================================================

BEGIN;

-- 1. Create company_billing_summary table if not exists
CREATE TABLE IF NOT EXISTS public.company_billing_summary (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_code TEXT NOT NULL,
  total_consultations INTEGER NOT NULL DEFAULT 0,
  total_billed NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  updated_by TEXT NOT NULL DEFAULT 'System',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create company_billing_detailed table if not exists
CREATE TABLE IF NOT EXISTS public.company_billing_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  patient TEXT NOT NULL,
  consultation_date TIMESTAMPTZ NOT NULL,
  doctor_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  receipt_code TEXT,
  invoice_no TEXT,
  consultation_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  billing_status TEXT NOT NULL DEFAULT 'unpaid',
  updated_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create company_billing_payment_history table if not exists
CREATE TABLE IF NOT EXISTS public.company_billing_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_code TEXT NOT NULL,
  total_consultations INTEGER NOT NULL DEFAULT 0,
  total_billed NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  discount_applied NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  paid_by TEXT NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Link company_billing_detailed to company_billing_payment_history
ALTER TABLE public.company_billing_detailed
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.company_billing_payment_history(id) ON DELETE SET NULL;

-- 5. Create index for faster lookup of payments in detailed logs
CREATE INDEX IF NOT EXISTS company_billing_detailed_payment_id_idx
  ON public.company_billing_detailed(payment_id);

COMMIT;
