-- Enable RLS and policies for invoice_items
-- Date: 2026-05-02

alter table public.invoice_items enable row level security;

drop policy if exists "invoice items staff access" on public.invoice_items;
create policy "invoice items staff access"
  on public.invoice_items
  for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "invoice items patient read" on public.invoice_items;
create policy "invoice items patient read"
  on public.invoice_items
  for select
  using (
    exists (
      select 1
      from public.invoices inv
      join public.patients p on p.id = inv.patient_id
      where inv.id = public.invoice_items.invoice_id
        and p.user_id = auth.uid()
    )
    or public.is_staff()
  );
