alter table public.inventory_items
add column if not exists qr_code text;

update public.inventory_items
set qr_code = 'ODC-INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where qr_code is null or btrim(qr_code) = '';

alter table public.inventory_items
alter column qr_code set default ('ODC-INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

alter table public.inventory_items
alter column qr_code set not null;

create unique index if not exists inventory_items_qr_code_key on public.inventory_items (qr_code);

create table if not exists public.inventory_usage_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  notes text not null default '',
  scanned_code text not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_updated_at_inventory_usage_logs
before update on public.inventory_usage_logs
for each row execute function public.set_updated_at();

alter table public.inventory_usage_logs enable row level security;

create policy "inventory usage staff access"
on public.inventory_usage_logs
for all
using (public.is_staff())
with check (public.is_staff());
