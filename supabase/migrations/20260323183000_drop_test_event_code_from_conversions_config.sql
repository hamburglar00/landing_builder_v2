-- Remove deprecated global Test Event Code from persistent conversions config.
alter table if exists public.conversions_config
  drop column if exists test_event_code;
