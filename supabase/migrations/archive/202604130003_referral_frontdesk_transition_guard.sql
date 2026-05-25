create or replace function public.enforce_referral_frontdesk_flow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('accepted', 'completed') then
      raise exception 'Referral must be confirmed by front desk before specialist acceptance/completion.';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status in ('accepted', 'completed')
      and old.status not in ('confirmed', 'accepted', 'completed') then
      raise exception 'Referral must be confirmed by front desk before specialist acceptance/completion.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_referral_frontdesk_flow_trigger on public.referrals;
create trigger enforce_referral_frontdesk_flow_trigger
before insert or update of status on public.referrals
for each row execute function public.enforce_referral_frontdesk_flow();