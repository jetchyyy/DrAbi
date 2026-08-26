-- Migration: Add missing company_id column to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
