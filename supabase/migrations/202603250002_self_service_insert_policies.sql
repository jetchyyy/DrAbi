create policy "profiles self insert"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "patients self insert"
on public.patients
for insert
with check (user_id = auth.uid());
