-- =============================================================================
-- HMO Management Module — Database Migration
-- Creates tables, indexes, RLS policies, and storage buckets
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. hmo_providers — HMO company directory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hmo_providers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text,
  contact_person text,
  contact_email  text,
  contact_number text,
  address     text,
  submission_cycle text DEFAULT 'monthly',
  payment_terms_days integer DEFAULT 30,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hmo_providers_status ON hmo_providers(status);
CREATE INDEX IF NOT EXISTS idx_hmo_providers_code ON hmo_providers(code);

-- ---------------------------------------------------------------------------
-- 2. patient_hmo_accounts — Links patients to HMO memberships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_hmo_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  hmo_provider_id  uuid NOT NULL REFERENCES hmo_providers(id) ON DELETE CASCADE,
  card_number      text,
  member_type      text DEFAULT 'principal',
  principal_name   text,
  expiration_date  date,
  coverage_limit   numeric(12,2) DEFAULT 0,
  remaining_balance numeric(12,2) DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_hmo_accounts_patient ON patient_hmo_accounts(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_hmo_accounts_provider ON patient_hmo_accounts(hmo_provider_id);
CREATE INDEX IF NOT EXISTS idx_patient_hmo_accounts_active ON patient_hmo_accounts(is_active);

-- ---------------------------------------------------------------------------
-- 3. hmo_authorizations — LOA / authorization tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hmo_authorizations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id     uuid REFERENCES appointments(id) ON DELETE SET NULL,
  hmo_provider_id    uuid NOT NULL REFERENCES hmo_providers(id) ON DELETE CASCADE,
  authorization_code text,
  coverage_amount    numeric(12,2) DEFAULT 0,
  approval_status    text NOT NULL DEFAULT 'pending',
  approved_by        text,
  approval_date      timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hmo_authorizations_patient ON hmo_authorizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_hmo_authorizations_provider ON hmo_authorizations(hmo_provider_id);
CREATE INDEX IF NOT EXISTS idx_hmo_authorizations_status ON hmo_authorizations(approval_status);
CREATE INDEX IF NOT EXISTS idx_hmo_authorizations_appointment ON hmo_authorizations(appointment_id);

-- ---------------------------------------------------------------------------
-- 4. hmo_claims — Claim lifecycle management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hmo_claims (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id uuid REFERENCES hmo_authorizations(id) ON DELETE SET NULL,
  invoice_number   text,
  total_amount     numeric(12,2) DEFAULT 0,
  covered_amount   numeric(12,2) DEFAULT 0,
  patient_excess   numeric(12,2) DEFAULT 0,
  claim_status     text NOT NULL DEFAULT 'draft',
  submission_date  timestamptz,
  payment_due_date timestamptz,
  paid_date        timestamptz,
  remarks          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hmo_claims_authorization ON hmo_claims(authorization_id);
CREATE INDEX IF NOT EXISTS idx_hmo_claims_status ON hmo_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_hmo_claims_submission_date ON hmo_claims(submission_date);

-- ---------------------------------------------------------------------------
-- 5. hmo_claim_items — Individual services billed per claim
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hmo_claim_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NOT NULL REFERENCES hmo_claims(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  doctor_id    uuid,
  quantity     integer NOT NULL DEFAULT 1,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  remarks      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hmo_claim_items_claim ON hmo_claim_items(claim_id);

-- ---------------------------------------------------------------------------
-- 6. hmo_payments — Payment receipts from HMOs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hmo_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          uuid NOT NULL REFERENCES hmo_claims(id) ON DELETE CASCADE,
  payment_reference text,
  amount_paid       numeric(12,2) NOT NULL DEFAULT 0,
  payment_date      timestamptz NOT NULL DEFAULT now(),
  payment_method    text DEFAULT 'bank_transfer',
  remarks           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hmo_payments_claim ON hmo_payments(claim_id);

-- ---------------------------------------------------------------------------
-- RLS — Enable on all HMO tables
-- ---------------------------------------------------------------------------
ALTER TABLE hmo_providers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_hmo_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmo_authorizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmo_claims           ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmo_claim_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmo_payments         ENABLE ROW LEVEL SECURITY;

-- Policies: SELECT for authenticated users (all staff can read)
CREATE POLICY "hmo_providers_select" ON hmo_providers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hmo_providers_insert" ON hmo_providers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hmo_providers_update" ON hmo_providers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hmo_providers_delete" ON hmo_providers
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "patient_hmo_accounts_select" ON patient_hmo_accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "patient_hmo_accounts_insert" ON patient_hmo_accounts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "patient_hmo_accounts_update" ON patient_hmo_accounts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "patient_hmo_accounts_delete" ON patient_hmo_accounts
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "hmo_authorizations_select" ON hmo_authorizations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hmo_authorizations_insert" ON hmo_authorizations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hmo_authorizations_update" ON hmo_authorizations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hmo_authorizations_delete" ON hmo_authorizations
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "hmo_claims_select" ON hmo_claims
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hmo_claims_insert" ON hmo_claims
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hmo_claims_update" ON hmo_claims
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hmo_claims_delete" ON hmo_claims
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "hmo_claim_items_select" ON hmo_claim_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hmo_claim_items_insert" ON hmo_claim_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hmo_claim_items_update" ON hmo_claim_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hmo_claim_items_delete" ON hmo_claim_items
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "hmo_payments_select" ON hmo_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hmo_payments_insert" ON hmo_payments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hmo_payments_update" ON hmo_payments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hmo_payments_delete" ON hmo_payments
  FOR DELETE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('hmo-documents', 'hmo-documents', false),
  ('hmo-claims', 'hmo-claims', false),
  ('hmo-authorizations', 'hmo-authorizations', false),
  ('soa-pdfs', 'soa-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated uploads/reads
CREATE POLICY "hmo_storage_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('hmo-documents', 'hmo-claims', 'hmo-authorizations', 'soa-pdfs'));

CREATE POLICY "hmo_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('hmo-documents', 'hmo-claims', 'hmo-authorizations', 'soa-pdfs'));
