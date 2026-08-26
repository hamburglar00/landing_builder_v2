do $$
begin
  alter publication supabase_realtime add table public.whatsapp_cloud_api_webhook_events;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.whatsapp_cloud_api_outbound_messages;
exception
  when duplicate_object then null;
end $$;
