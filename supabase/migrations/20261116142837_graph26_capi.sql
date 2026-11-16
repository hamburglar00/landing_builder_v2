-- Only the conventional Pixel/CAPI configuration moves to Graph v26.
-- WhatsApp Cloud messaging has its own version and remains independently pinned.
alter table public.conversions_config alter column meta_api_version set default 'v26.0';
alter table public.conversions_pixel_configs alter column meta_api_version set default 'v26.0';

update public.conversions_config set meta_api_version = 'v26.0'
where meta_api_version is null or btrim(meta_api_version) in ('', 'v25.0');
update public.conversions_pixel_configs set meta_api_version = 'v26.0'
where meta_api_version is null or btrim(meta_api_version) in ('', 'v25.0');
