create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'patient'::public.app_role
  );
$$;
