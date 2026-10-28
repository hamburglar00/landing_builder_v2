# Stickers del chat — 28/10/2026

Selector compartido para cliente y asesor: Recientes, Mis stickers y Añadir sticker. Se pueden subir imágenes, guardar stickers recibidos, enviarlos nuevamente y quitar favoritos. Se conserva la colección por identidad al cambiar de navegador. El símbolo tiene la esquina doblada; los mensajes muestran la imagen sin fondo de burbuja, con horario y tildes.

## Implementación

- `internal-chat/src/components/chat-stickers.tsx`: proveedor único por identidad y controles compartidos por el cliente y las vistas móvil/escritorio del inbox. Carga la colección al abrir; evita cargas simultáneas. El compositor conserva sus emojis, adjuntos, envío, tamaño y tema. Los listeners de la vista oculta del inbox no cierran el selector de la vista visible.
- `/api/chat/stickers`: el token firmado identifica al jugador y su conversación, sin depender de cookies de terceros. Para el asesor, usa la sesión interna y verifica con RLS la conversación elegida. Los propietarios y URLs no se reciben del navegador. Reutiliza la verificación de contexto de `/api/gateway/chat` mediante un helper común, conservando sus comprobaciones.
- `prepare-chat-sticker.ts`: Sharp `0.35.3`, la misma versión ya instalada, ahora dependencia explícita. Verifica firma/formato real, tamaño, píxeles y cuadros; prepara WebP 512 × 512, conserva transparencia, animación y tiempos, y retira metadatos. Límite de entrada 4 MB y salida 1 MB; SVG/documentos no se procesan. Hash de contenido y archivos inmutables compartidos evitan copias duplicadas.
- Tablas `chat_sticker_assets` y `chat_sticker_library` con RLS y acceso exclusivo de servidor. El bucket público `chat-stickers` entrega solamente WebP; las escrituras son de servidor. Los metadatos de las colecciones y sus propietarios no son públicos. Eliminar un favorito no borra imágenes de mensajes ni sus recientes.
- RPC `send_chat_sticker`, exclusivo de servicio: inserta el mensaje y actualiza recientes/actividad en una transacción. Un UUID repetido para el mismo intento devuelve el mensaje persistido; otro participante, conversación o sticker no puede reutilizarlo. Los reintentos no duplican mensajes ni actividad.
- Los stickers conservan notificaciones y la elegibilidad normal de LEAD. Se excluyen del envío de archivos a API2, inferencia de intención de carga y OCR de comprobantes. Se verificó que las imágenes comunes conservan sus caminos existentes. No cambia API2.

## Pruebas

- 3 pruebas reales de conversión: WebP y transparencia, hash estable/EXIF eliminado, GIF animado con sus cuadros/tiempos, rechazo de entradas inválidas y SVG.
- 5 pruebas del handler de stickers: identidad del token, ausencia de fallback a cookies tras un token inválido, origen de escrituras, aislamiento entre colecciones/conversaciones, propietario/URL derivados del servidor y autorización RLS del asesor.
- 2 pruebas de integración: un sticker después de pedir una carga no activa API2 ni OCR, mientras un archivo común conserva esa intención. El aviso push identifica al sticker.
- PostgreSQL 17 desechable: migración real, permisos anon/authenticated/service_role, colección por propietario, unicidad, cinco envíos concurrentes con un solo mensaje/actividad, conflictos de intento, conversación ajena, otra persona y URL arbitraria; quitar favoritos conserva recientes e historial.
- Regresiones: 4 handlers de reacciones/citas, 11 pruebas de formato/enlaces, 45 de identidad, cuentas, credenciales y saldo de retiro. TypeScript y ESLint correctos.
- `node scripts/check-chat-interactions.mjs --stickers`: componentes completos de cliente y asesor en Chromium/WebKit, tres temas y dos anchos. Carga de archivo, guardado de recibido, envío de ambos lados, error después de persistir y reintento con el mismo ID, colección independiente, recientes tras recargar y acceso desde otro contexto de navegador; conserva las comprobaciones de reacciones/citas/tamaño. [Resultados](chat-stickers-browser-20261028.json).
- 4 escenarios de hidratación/horarios y sincronización de SDK/movimiento conservados. Los gestos son simulados; no certifican un iPhone físico. Las pruebas de HTTP usan datos aislados y el SQL usa Postgres desechable. No se crean jugadores, mensajes, conversiones ni operaciones financieras reales en producción.

## Base de datos y publicación

Aplicada y verificada en Atrio: `20261028201150_chat_stickers.sql`. Se confirmaron tablas/RLS, permisos, bucket y RPC. Una consulta de PostgREST con cero filas verificó que el servidor ve las tablas nuevas y su relación. La auditoría de seguridad conserva exactamente los avisos previos, sin hallazgos nuevos.

Publicado Atrio `fe5a658ddfece3880374d70de0b80fed2fa5c5f5`, rama `fix/atrio-inbox-validation`, en `dpl_HprcHdJ8qNXfZX7hjquHv52Anp1y`. Anterior para rollback: `dpl_JAKyjAkeMzjwbgTaXZ8iH4LghU1y`. Build de Vercel y promoción correctos, SHA y despliegue activo verificados.

El embed público sirve el nuevo chunk `26-5xkmiq4cl2.js` y los estilos de stickers. La ruta pública `/api/chat/stickers` responde 401 sin sesión, verificando también que el módulo servidor con Sharp carga correctamente. Los cuatro proyectos conservan el origen compartido `https://www.atrio.website`; sus scripts públicos coinciden con las versiones anteriores, incluido el dominio servido por el Worker de Ganamos+. Esta mejora de Atrio no requiere desplegar nuevamente esos padres.

[Evidencia pública y configuración comprobada](chat-stickers-public-20261028.json). Builder solo recibió pruebas/documentación (`9915f75` y cierre de publicación); no se despliega su aplicación. Todos los cambios quedaron pusheados y los árboles de trabajo limpios. La comprobación pública fue de lectura; no envió stickers ni creó conversaciones reales.
