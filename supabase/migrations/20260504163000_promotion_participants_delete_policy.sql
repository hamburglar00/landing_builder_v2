drop policy if exists "Users can delete own promotion participants" on public.promotion_participants;
create policy "Users can delete own promotion participants"
  on public.promotion_participants for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can delete all promotion participants" on public.promotion_participants;
create policy "Admins can delete all promotion participants"
  on public.promotion_participants for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
