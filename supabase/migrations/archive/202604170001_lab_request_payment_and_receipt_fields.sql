alter table public.service_requests
  add column if not exists payment_status text not null default 'pending_cashier',
  add column if not exists receipt_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_requests_payment_status_check'
  ) then
    alter table public.service_requests
      add constraint service_requests_payment_status_check
      check (payment_status in ('pending_cashier', 'paid'));
  end if;
end
$$;

update public.service_requests
set receipt_code = coalesce(
  receipt_code,
  'ODC-LAB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
)
where receipt_code is null;

alter table public.service_requests
  alter column receipt_code set default ('ODC-LAB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

create unique index if not exists service_requests_receipt_code_key on public.service_requests (receipt_code);
create index if not exists service_requests_payment_status_idx on public.service_requests (payment_status);

create or replace function public.sync_invoice_payment_to_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' and (old.payment_status is null or old.payment_status <> 'paid') then
    if new.service_request_id is not null then
      update public.service_requests
      set
        payment_status = 'paid',
        receipt_code = coalesce(receipt_code, new.invoice_number),
        updated_at = timezone('utc', now())
      where id = new.service_request_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_sync_invoice_payment_to_service_request on public.invoices;
create trigger tr_sync_invoice_payment_to_service_request
after update on public.invoices
for each row
execute function public.sync_invoice_payment_to_service_request();
