-- Migration: Add missing company_id column to patients table
-- Date: 2026-07-27

BEGIN;

ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

COMMIT;
