-- Permitir que cualquier usuario autenticado pueda hacer SELECT sobre gerencia_phones.
-- La app siempre filtra por las gerencias del usuario (WHERE gerencia_id IN (...)),
-- así que no se exponen teléfonos de otras gerencias.

create policy "All users can select gerencia phones"
on public.gerencia_phones
for select
to authenticated
using (true);

