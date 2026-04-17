create or replace function public.mark_lab_request_paid_by_cashier(
  p_request_id uuid,
  p_receipt_code text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_role public.app_role;
  v_receipt_code text := nullif(trim(coalesce(p_receipt_code, '')), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_role := public.current_app_role();

  if v_role not in (
    'front_desk_cashier'::public.app_role,
    'owner_admin'::public.app_role,
    'lab_staff'::public.app_role
  ) then
    raise exception 'insufficient privileges to mark lab requests as paid';
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

  if v_request.status = 'cancelled' then
    raise exception 'cancelled service requests cannot be marked as paid';
  end if;

  update public.service_requests
  set
    payment_status = 'paid',
    receipt_code = coalesce(v_receipt_code, receipt_code),
    updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.mark_lab_request_paid_by_cashier(uuid, text) to authenticated;
