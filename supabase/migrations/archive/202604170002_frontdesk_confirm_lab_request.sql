create or replace function public.confirm_lab_request_by_frontdesk(
  p_request_id uuid
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_role := public.current_app_role();

  if v_role not in ('front_desk_cashier'::public.app_role, 'owner_admin'::public.app_role, 'lab_staff'::public.app_role) then
    raise exception 'insufficient privileges to confirm lab requests';
  end if;

  select *
  into v_request
  from public.service_requests
  where id = p_request_id;

  if not found then
    raise exception 'service request not found';
  end if;

  if not public.has_clinic_access(v_request.clinic_id) then
    raise exception 'clinic access denied';
  end if;

  if v_request.status in ('completed', 'cancelled') then
    raise exception 'service request is already terminal';
  end if;

  update public.service_requests
  set
    status = 'in_progress',
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.confirm_lab_request_by_frontdesk(uuid) to authenticated;
