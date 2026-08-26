-- Drop existing profiles select policy
drop policy if exists "profiles self read" on public.profiles;

-- Recreate policy to allow self read, staff read, and public read of doctor/specialist profiles
create policy "profiles self read"
on public.profiles
for select
using (
  auth.uid() = id
  or public.is_staff()
  or role in ('doctor'::public.app_role, 'specialist'::public.app_role)
);
