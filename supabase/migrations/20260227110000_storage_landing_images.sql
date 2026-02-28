-- Políticas de Storage para el bucket "landing-images".
-- Crear el bucket desde el Dashboard de Supabase: Storage → New bucket → id "landing-images", Public = true.
-- Opcional: file size limit 5MB, allowed MIME types image/avif.
--
-- Políticas: cada usuario sube solo a su carpeta (path = {user_id}/...).
-- Lectura: bucket público, no hace falta policy de SELECT para descarga.

create policy "Users can upload to own folder in landing-images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'landing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own files in landing-images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'landing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'landing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own files in landing-images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'landing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
