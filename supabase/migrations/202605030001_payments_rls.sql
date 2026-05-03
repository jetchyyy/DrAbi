-- Enable RLS and policies for payments table
-- Date: 2026-05-03

-- Enable RLS on payments table
alter table public.payments enable row level security;

-- Drop existing policies if they exist
drop policy if exists "payments staff access" on public.payments;
drop policy if exists "payments patient read" on public.payments;

-- Create policy for staff access (full access)
create policy "payments staff access"
  on public.payments
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- Create policy for patients to read their own payment records
create policy "payments patient read"
  on public.payments
  for select
  using (
    exists (
      select 1
      from public.invoices inv
      join public.patients p on p.id = inv.patient_id
      where inv.id = public.payments.invoice_id
        and p.user_id = auth.uid()
    )
    or public.is_staff()
  );