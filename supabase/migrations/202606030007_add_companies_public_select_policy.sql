-- =============================================================================
-- Migration: Allow public/anonymous select on public.companies
-- Date: 2026-06-03
-- =============================================================================

-- Enable public read access to the companies table so unregistered patients
-- can select their company during registration.
CREATE POLICY "Allow public read access to companies"
  ON public.companies
  FOR SELECT
  TO public
  USING (true);
