alter type public.stock_transaction_type add value if not exists 'sale';

alter table public.inventory_items
add column if not exists cost_price numeric(12,2) not null default 0,
add column if not exists selling_price numeric(12,2) not null default 0;

alter table public.inventory_items
drop constraint if exists inventory_items_cost_price_nonnegative,
add constraint inventory_items_cost_price_nonnegative check (cost_price >= 0),
drop constraint if exists inventory_items_selling_price_nonnegative,
add constraint inventory_items_selling_price_nonnegative check (selling_price >= 0);

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  patient_id uuid references public.patients(id) on delete set null,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash', 'gcash', 'card')),
  payment_reference text,
  payment_notes text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pos_sales(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  item_name text not null,
  item_sku text not null,
  item_unit text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pos_sales_cashier_created_at_idx on public.pos_sales (cashier_id, created_at desc);
create index if not exists pos_sales_patient_created_at_idx on public.pos_sales (patient_id, created_at desc);
create index if not exists pos_sale_items_sale_id_idx on public.pos_sale_items (sale_id);
create index if not exists pos_sale_items_inventory_item_id_idx on public.pos_sale_items (inventory_item_id);

create trigger set_updated_at_pos_sales before update on public.pos_sales for each row execute function public.set_updated_at();
create trigger set_updated_at_pos_sale_items before update on public.pos_sale_items for each row execute function public.set_updated_at();

alter table public.pos_sales enable row level security;
alter table public.pos_sale_items enable row level security;

drop policy if exists "pos sales cashier access" on public.pos_sales;
create policy "pos sales cashier access"
on public.pos_sales
for select
using (
  public.current_app_role() in ('owner_admin'::public.app_role, 'front_desk_cashier'::public.app_role)
);

drop policy if exists "pos sale items cashier access" on public.pos_sale_items;
create policy "pos sale items cashier access"
on public.pos_sale_items
for select
using (
  exists (
    select 1
    from public.pos_sales ps
    where ps.id = pos_sale_items.sale_id
      and public.current_app_role() in ('owner_admin'::public.app_role, 'front_desk_cashier'::public.app_role)
  )
);

create or replace function public.checkout_pos_sale(
  p_patient_id uuid default null,
  p_cashier_id uuid default null,
  p_payment_method text default 'cash',
  p_payment_reference text default null,
  p_payment_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.pos_sales%rowtype;
  v_item jsonb;
  v_inventory public.inventory_items%rowtype;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_sale_items jsonb := '[]'::jsonb;
  v_sale_number text := 'POS-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_checkout_cashier uuid;
  v_inserted_item public.pos_sale_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_checkout_cashier := coalesce(p_cashier_id, auth.uid());

  if v_checkout_cashier <> auth.uid() then
    raise exception 'cashier_id must match the current user';
  end if;

  if public.current_app_role() not in (
    'owner_admin'::public.app_role,
    'front_desk_cashier'::public.app_role
  ) then
    raise exception 'insufficient privileges to checkout a POS sale';
  end if;

  if p_payment_method not in ('cash', 'gcash', 'card') then
    raise exception 'invalid payment method';
  end if;

  if p_payment_method in ('gcash', 'card') and nullif(trim(coalesce(p_payment_reference, '')), '') is null then
    raise exception 'payment reference is required for non-cash payments';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one sale item is required';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    select *
    into v_inventory
    from public.inventory_items
    where id = (v_item ->> 'inventory_item_id')::uuid;

    if not found then
      raise exception 'inventory item not found';
    end if;

    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 0), 0);
    if v_quantity <= 0 then
      raise exception 'item quantity must be at least 1';
    end if;

    if v_inventory.stock_on_hand < v_quantity then
      raise exception 'insufficient stock for %', v_inventory.name;
    end if;

    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, v_inventory.selling_price, 0);
    if v_unit_price < 0 then
      raise exception 'unit price must be non-negative';
    end if;

    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  insert into public.pos_sales (
    sale_number,
    patient_id,
    cashier_id,
    payment_method,
    payment_reference,
    payment_notes,
    subtotal,
    total
  ) values (
    v_sale_number,
    p_patient_id,
    v_checkout_cashier,
    p_payment_method,
    nullif(trim(coalesce(p_payment_reference, '')), ''),
    nullif(trim(coalesce(p_payment_notes, '')), ''),
    v_subtotal,
    v_subtotal
  )
  returning * into v_sale;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    select *
    into v_inventory
    from public.inventory_items
    where id = (v_item ->> 'inventory_item_id')::uuid
    for update;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_inventory.stock_on_hand < v_quantity then
      raise exception 'insufficient stock for %', v_inventory.name;
    end if;

    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, v_inventory.selling_price, 0);
    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);

    update public.inventory_items
    set stock_on_hand = stock_on_hand - v_quantity
    where id = v_inventory.id;

    insert into public.pos_sale_items (
      sale_id,
      inventory_item_id,
      item_name,
      item_sku,
      item_unit,
      quantity,
      unit_price,
      line_total
    ) values (
      v_sale.id,
      v_inventory.id,
      v_inventory.name,
      v_inventory.sku,
      v_inventory.unit,
      v_quantity,
      v_unit_price,
      v_line_total
    )
    returning * into v_inserted_item;

    insert into public.stock_transactions (
      item_id,
      type,
      quantity,
      remarks
    ) values (
      v_inventory.id,
      'sale'::public.stock_transaction_type,
      v_quantity,
      'POS sale ' || v_sale.sale_number
    );

    v_sale_items := v_sale_items || jsonb_build_array(to_jsonb(v_inserted_item));
  end loop;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'items', v_sale_items
  );
end;
$$;

grant select on public.pos_sales to authenticated;
grant select on public.pos_sale_items to authenticated;
grant execute on function public.checkout_pos_sale(uuid, uuid, text, text, text, jsonb) to authenticated;

update public.access_roles
set
  permission_codes = (
    select array_agg(distinct code order by code)
    from unnest(permission_codes || array['pos.view', 'pos.manage']) as code
  ),
  updated_at = timezone('utc', now())
where system_key in ('owner_admin', 'front_desk_cashier');
