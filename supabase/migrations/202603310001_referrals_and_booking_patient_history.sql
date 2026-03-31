create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  referring_doctor_id uuid not null references public.doctors(id),
  target_doctor_id uuid references public.doctors(id),
  target_specialty_id uuid references public.specialties(id),
  reason text not null default '',
  clinical_summary text not null default '',
  referral_notes text not null default '',
  status text not null default 'sent' check (status in ('draft', 'sent', 'accepted', 'completed', 'cancelled')),
  specialist_findings text not null default '',
  specialist_recommendations text not null default '',
  referred_at timestamptz not null default timezone('utc', now()),
  specialist_visited_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create trigger set_updated_at_referrals before update on public.referrals for each row execute function public.set_updated_at();

alter table public.referrals enable row level security;

create policy "referrals staff access" on public.referrals for all using (public.is_staff()) with check (public.is_staff());
create policy "referrals patient read" on public.referrals for select using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.user_id = auth.uid()
  )
);
