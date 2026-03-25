alter table if exists public.conversion_logs
  add column if not exists payload_meta text,
  add column if not exists response_meta text;

