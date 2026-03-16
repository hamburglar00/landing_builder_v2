-- Allow users to update their own conversions (e.g. manual email entry)
create policy "Users can update own conversions"
  on public.conversions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Allow admins to update any conversion
create policy "Admins can update all conversions"
  on public.conversions for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
