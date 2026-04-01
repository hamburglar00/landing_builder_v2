-- Permitir eliminar conversiones propias desde la UI (seguimiento / gestión manual).

drop policy if exists "Users can delete own conversions" on public.conversions;
create policy "Users can delete own conversions"
  on public.conversions for delete
  using (user_id = auth.uid());

drop policy if exists "Admins can delete all conversions" on public.conversions;
create policy "Admins can delete all conversions"
  on public.conversions for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
