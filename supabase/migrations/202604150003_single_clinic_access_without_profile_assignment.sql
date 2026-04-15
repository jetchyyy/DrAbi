create or replace function public.has_clinic_access(target_clinic_id uuid)
returns boolean
language sql
stable
as $$
  with current_profile as (
    select clinic_id
    from public.profiles
    where id = auth.uid()
  ), clinic_count as (
    select count(*)::integer as count
    from public.clinics
  ), first_clinic as (
    select id
    from public.clinics
    order by created_at asc
    limit 1
  )
  select
    public.current_app_role() = 'owner_admin'::public.app_role
    or (
      target_clinic_id is not null
      and (
        target_clinic_id = (select clinic_id from current_profile)
        or (
          (select clinic_id from current_profile) is null
          and (select count from clinic_count) = 1
          and target_clinic_id = (select id from first_clinic)
        )
      )
    );
$$;