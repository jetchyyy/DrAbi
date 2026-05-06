create table if not exists public.lab_request_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  target_laboratory text not null default '',
  requested_tests text not null default '',
  clinical_notes text not null default '',
  document_html text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lab_request_documents_patient_id_idx
  on public.lab_request_documents (patient_id, created_at desc);

create trigger set_updated_at_lab_request_documents
before update on public.lab_request_documents
for each row execute function public.set_updated_at();

alter table public.lab_request_documents enable row level security;

create policy "lab request documents staff access"
on public.lab_request_documents
for all
using (public.is_staff())
with check (public.is_staff());

create policy "lab request documents patient read"
on public.lab_request_documents
for select
using (
  exists (
    select 1
    from public.patients p
    where p.id = patient_id
      and p.user_id = auth.uid()
  )
);
