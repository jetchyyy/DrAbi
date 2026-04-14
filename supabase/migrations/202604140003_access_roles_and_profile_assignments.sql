create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  system_key text unique,
  name text not null,
  description text not null default '',
  permission_codes text[] not null default '{}'::text[],
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint access_roles_permissions_nonempty check (cardinality(permission_codes) > 0)
);

create table if not exists public.profile_access_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  access_role_id uuid not null references public.access_roles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id)
);

create trigger set_updated_at_access_roles
before update on public.access_roles
for each row execute function public.set_updated_at();

create trigger set_updated_at_profile_access_roles
before update on public.profile_access_roles
for each row execute function public.set_updated_at();

alter table public.access_roles enable row level security;
alter table public.profile_access_roles enable row level security;

create policy "access_roles select owner_or_assigned"
on public.access_roles
for select
using (
  public.current_app_role() = 'owner_admin'
  or exists (
    select 1
    from public.profile_access_roles par
    where par.access_role_id = access_roles.id
      and par.profile_id = auth.uid()
  )
);

create policy "access_roles manage owner_admin"
on public.access_roles
for all
using (public.current_app_role() = 'owner_admin')
with check (public.current_app_role() = 'owner_admin');

create policy "profile_access_roles select owner_or_self"
on public.profile_access_roles
for select
using (
  public.current_app_role() = 'owner_admin'
  or profile_id = auth.uid()
);

create policy "profile_access_roles manage owner_admin"
on public.profile_access_roles
for all
using (public.current_app_role() = 'owner_admin')
with check (public.current_app_role() = 'owner_admin');

insert into public.access_roles (system_key, name, description, permission_codes, is_system)
values
  (
    'owner_admin',
    'Owner / Admin',
    'Full system access for the clinic owner or administrator.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'consultations.manage',
      'billing.view',
      'billing.manage',
      'inventory.view',
      'inventory.manage',
      'laboratory.view',
      'laboratory.manage',
      'settings.view',
      'settings.manage',
      'booking.view',
      'booking.manage',
      'users.manage'
    ],
    true
  ),
  (
    'doctor',
    'Doctor',
    'Clinical access for providers handling consultations and patient review.',
    array[
      'dashboard.view',
      'patients.view',
      'appointments.view',
      'consultations.manage',
      'laboratory.view',
      'booking.view'
    ],
    true
  ),
  (
    'nurse_staff',
    'Nurse / Staff',
    'Care-team access for patient intake, appointments, and consultation support.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'consultations.manage',
      'laboratory.view'
    ],
    true
  ),
  (
    'front_desk_cashier',
    'Front Desk / Cashier',
    'Reception and payment access for scheduling, billing, and bookings.',
    array[
      'dashboard.view',
      'patients.view',
      'patients.manage',
      'appointments.view',
      'appointments.manage',
      'billing.view',
      'billing.manage',
      'booking.view',
      'booking.manage'
    ],
    true
  ),
  (
    'lab_staff',
    'Lab Staff',
    'Laboratory operations access for sample processing and result handling.',
    array[
      'dashboard.view',
      'patients.view',
      'laboratory.view',
      'laboratory.manage'
    ],
    true
  ),
  (
    'inventory_staff',
    'Inventory Staff',
    'Stock and supply access for inventory monitoring and updates.',
    array[
      'dashboard.view',
      'inventory.view',
      'inventory.manage'
    ],
    true
  )
on conflict (system_key) do update
set
  name = excluded.name,
  description = excluded.description,
  permission_codes = excluded.permission_codes,
  is_system = excluded.is_system,
  updated_at = timezone('utc', now());

insert into public.profile_access_roles (profile_id, access_role_id)
select
  p.id,
  ar.id
from public.profiles p
join public.access_roles ar
  on ar.system_key = p.role::text
where p.role <> 'patient'::public.app_role
on conflict (profile_id) do nothing;
