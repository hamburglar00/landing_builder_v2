-- Limpia prefijos mojibake en observaciones heredadas de encoding roto.
update public.conversions
set observaciones = replace(observaciones, 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ', '')
where observaciones like '%ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ %';

update public.conversions
set observaciones = replace(observaciones, 'Â·', '·')
where observaciones like '%Â·%';
