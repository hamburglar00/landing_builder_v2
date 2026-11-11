# Reducción de viajes para obtener el número

Estado al 11/11: **migración aplicada en Builder y Edge Function `landing-phone` v28 activa**. Leo aclaró que Docker puede usarse para pruebas; los contenedores, imágenes y volúmenes preexistentes permanecen intactos. La mejora de latencia todavía no está medida con tráfico comparable.

## Evidencia

En el corte 10/11 17:03–23:25 UTC, 30 de 98 intentos T2/T5 tenían el número pendiente al clic. Los 30 pedidos se iniciaron antes del CTA y terminaron con `phone_outcome=ready`; no hubo un segundo pedido provocado por el clic. La mediana del pedido completo en los pendientes fue 2536 ms (T2) y 2159 ms (T5), de los cuales `phone_total` del servidor midió 1751,5 y 1883,5 ms. [Consulta y límites](../validation/entry-compare-20261110.md).

`landing-phone` realiza en orden:

1. Buscar dueño y `publish_target` en `landings`, o dueño en `profiles` para Chatrace.
2. Consultar `is_client_access_blocked(owner)`.
3. Si corresponde, probar la caché compatible del Constructor.
4. Si no se usó caché, llamar a `get_phone_for_landing(name, create_reservation)` o al selector de Chatrace.

La función productiva `get_phone_for_landing(text, boolean)` no llama al comprobador de plan. Ejecutarla en paralelo con el paso 2 podría seleccionar o reservar para una cuenta bloqueada: queda descartado. El selector y sus modos `weighted_random`, `fair` y `weighted_quota` deben permanecer intactos. El orden y la caché son comunes a T1–T6 de Clásico y Constructor, aunque hoy sólo Clásico tenga clientes activos.

`pg_stat_statements` acumulado desde el 02/11 muestra aproximadamente 1,11 ms de ejecución media de consultas que coinciden con el patrón de búsqueda del dueño, 7,70 ms del comprobador de plan y 114,88 ms del selector. Las fases vistas desde Edge en los intentos pendientes rondan cientos de milisegundos cada una. Son fuentes, cohortes y ventanas distintas: esto **sugiere** costo importante de transporte/llamadas separadas, pero no cuantifica el ahorro de una versión nueva. Los advisories generales de índices no identifican una corrección específica para esta ruta.

## Cambio candidato

Crear una RPC aditiva `public.landing_phone_preflight(name, source)` invocable **sólo por `service_role`**, con `SECURITY INVOKER` y `search_path` fijado. Dentro de una llamada, repetir exactamente la búsqueda del dueño y la comprobación `is_client_access_blocked` existentes, en ese orden. Devolver estado cerrado (`ok`, `not_found`, `blocked`) y el dueño necesario sólo para el contador de Chatrace; `publish_target` puede quedar en la respuesta interna para la decisión de caché. No devolver estos datos al navegador.

La Edge Function llamaría a esa RPC y mantendría los pasos 3–4 como hoy. Se eliminaría una llamada Edge→DB en Clásico, Constructor y Chatrace, sin duplicar ni adelantar la selección. Constructor conserva la comprobación de `needsFreshAssignment` y la caché de 90 segundos; `warmup` conserva `create_reservation=false` y la exclusión de demanda. El endpoint público, estados HTTP, respuesta, `Cache-Control: no-store`, `request_id` técnico y efectos posteriores permanecen iguales. `get_phone_for_landing` y las funciones financieras no se modifican.

La Edge Function emite la nueva fase combinada `phone-preflight` en `Server-Timing` y en su log estructurado, sin etiquetarla como `phone-owner` o `phone-plan`. El collector del navegador conserva `phone_total`, `phone_select`, `phone_cache` y `destination_request`; su lista cerrada omite la fase nueva. El `request_id` permite relacionar esos eventos con el log Edge. Esto evita una migración de telemetría fuera del alcance, pero cambia el detalle disponible dentro de `entry_funnel_events`: no comparar los subtiempos viejos `owner/plan` con los nuevos. El criterio de rendimiento será clic→salida y porcentaje listo al clic por plantilla, primer intento, landing y versión, con `source=unknown` separado de tráfico probado.

## Verificación previa a una entrega

- Probar la RPC en una base aislada con una landing activa, bloqueada e inexistente; Chatrace y `warmup`; Constructor con caché compatible, vencida y no compatible; los tres modos de selección, reintentos y concurrencia de reservas. Comparar respuestas, reservas, contadores y demanda con el flujo anterior.
- Confirmar `REVOKE EXECUTE` a `PUBLIC`, `anon` y `authenticated`, `GRANT` sólo a `service_role`, y que la función no sea `SECURITY DEFINER`. Revisar advisories después de la migración.
- Probar la Edge Function con respuestas ficticias: ningún selector tras bloqueo/error, una selección cuando falta caché, respuesta idéntica cuando la caché es válida y sin duplicación de solicitud. Verificar `Server-Timing`, `request_id`, CORS y `no-store`.
- Publicar sólo tras la prueba de SQL y la regresión T1–T6 de ambos motores. Medir de nuevo el mismo recorrido; no prometer 100 % listo al clic cuando alguien toca antes de que responda una consulta remota.

La migración aditiva `20261111002218_landing_phone_preflight.sql` quedó registrada en Builder como versión `20261111002218`, y la Edge Function `landing-phone` v28 quedó activa después. `node scripts/test-landing-phone-preflight.mjs` levantó un PostgreSQL 17 Alpine descartable, sin red ni volumen, aplicó la migración dos veces y verificó estados `ok`/`blocked`/`not_found`, Clásico, Constructor, Chatrace, `warmup`, plan vencido, `SECURITY INVOKER`, `search_path` y permisos (sólo `service_role`). El propio contenedor de prueba se retiró al terminar. No se tocó la función de selección ni se usó la base productiva para seleccionar o reservar números. La orquestación Edge aprobó 13 pruebas locales; TypeScript y `deno check` aprobaron; el navegador aprobó T1–T6 en ambos motores y la prueba de CORS/preflight en Chromium y WebKit. En producción se verificaron permisos y respuesta `not_found` a una landing ficticia sin selección ni reserva; `Server-Timing` incluyó `phone-preflight` y `phone-total`, y CORS respondió a OPTIONS. La mejora de latencia sigue **sin medir en producción**.

Orden de publicación ejecutado: migración, comprobación de privilegios y respuesta sin reserva, y después Edge. Si la función Edge falla, restaurar su versión anterior; la migración es aditiva y puede permanecer. Medir `phone_total`, `destination_request`, porcentaje listo al clic y errores con los mismos denominadores antes de afirmar beneficio.
