-- =============================================================================
-- Migration: Add Row Level Security policies for doctors table
-- =============================================================================

alter table public.doctors enable row level security;

drop policy if exists "doctors public read" on public.doctors;
drop policy if exists "doctors insert own" on public.doctors;
drop policy if exists "doctors update own" on public.doctors;

-- Allow all authenticated users (including patients) to see the doctors directory
create policy "doctors public read"
on public.doctors
for select
using (true);

-- Allow users to insert their own doctor row (used by ensureDoctorForUser)
create policy "doctors insert own"
on public.doctors
for insert
with check (profile_id = auth.uid());

-- Allow doctors to update their own row, and admins to update any
create policy "doctors update own"
on public.doctors
for update
using (
  profile_id = auth.uid() or
  public.current_app_role() = 'owner_admin'
);
