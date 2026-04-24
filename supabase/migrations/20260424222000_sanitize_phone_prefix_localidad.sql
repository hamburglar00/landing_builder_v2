-- Limpieza de localidad proveniente de prefijos telefonicos.
-- Objetivo: remover sufijos entre parentesis, ej. "SAN MARTIN (PROV. MENDOZA)" -> "SAN MARTIN".

-- 1) Fuente de prefijos (para nuevos enrich futuros)
update public.ar_phone_area_codes
set localidad = btrim(regexp_replace(coalesce(localidad, ''), '\\s*\\([^)]*\\)', '', 'g'))
where coalesce(localidad, '') ~ '\\([^)]*\\)';

-- 2) Datos historicos ya persistidos en conversiones via fallback phone_prefix
update public.conversions
set
  ct = case
    when coalesce(ct, '') = '' then ct
    else btrim(regexp_replace(ct, '\\s*\\([^)]*\\)', '', 'g'))
  end,
  geo_city = case
    when coalesce(geo_city, '') = '' then geo_city
    else btrim(regexp_replace(geo_city, '\\s*\\([^)]*\\)', '', 'g'))
  end
where lower(coalesce(geo_source, '')) = 'phone_prefix'
  and (
    coalesce(ct, '') ~ '\\([^)]*\\)'
    or coalesce(geo_city, '') ~ '\\([^)]*\\)'
  );