-- Migration: Create companies table
-- Date: 2026-06-03

BEGIN;

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  payment_terms TEXT NOT NULL DEFAULT 'Net 30',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policies (Manageable by authenticated staff)
CREATE POLICY "companies staff access" ON public.companies 
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_companies BEFORE UPDATE ON public.companies 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
