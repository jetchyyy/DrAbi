-- Add discount and tax columns to invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2) DEFAULT 0;

-- Add reference columns to invoice items to track linked consultations, inventory usage, and lab services
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS reference_id text,
  ADD COLUMN IF NOT EXISTS reference_type text;

-- Enable RLS and add policies for stock_transactions
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock transactions staff access" ON public.stock_transactions;
CREATE POLICY "stock transactions staff access"
  ON public.stock_transactions
  FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
