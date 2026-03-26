-- Allow admins to create singleton notification_bot_config row if missing.

drop policy if exists "Admins can insert bot config" on public.notification_bot_config;
create policy "Admins can insert bot config"
  on public.notification_bot_config for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

