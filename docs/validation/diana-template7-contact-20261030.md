# Revisión de Contact en Diana — 30/10/2026

## Entrada del anuncio y disparador

El usuario utiliza una publicación existente con enlace `/gast` y el parámetro de URL `landing=diana`. La selección del middleware publicado funciona: un GET a `https://landing.panelbotadmin.com/gast?landing=diana` devolvió exactamente el mismo HTML que `/diana`; `/gast` sin el parámetro continúa siendo Template 5 para WhatsApp. Diana es Template 7 para Ganamos NET/Atrio, píxel 880464554785896 y envío de Contact de navegador habilitado.

El runtime dispara Contact al enviar un nombre válido y resolver un asesor/destino válido, antes de solicitar la creación de la cuenta. No lo dispara al visitar ni necesita que el jugador envíe un mensaje. Usa el mismo event_id para Pixel y servidor; la deduplicación del navegador tiene un plazo de cinco minutos y evita repetir el evento durante el mismo intento de Template 7. Si falla la selección del asesor antes de este punto, no se emite Contact: la ausencia de conversiones por sí sola no permite distinguir ese fallo de un abandono.

## Evidencia productiva de solo lectura

- Hasta la captura de esta revisión: catorce entradas de Diana identificadas por atribución Meta/fbc. Trece se agruparon entre 13:28:00 y 13:28:35, sin utm_campaign; una entrada posterior, 14:58:06, llevaba campaña y la ruta `/gast`. Esto no acredita catorce personas reales ni prueba que el conjunto inicial pertenezca al anuncio del usuario. La URL fuente omite deliberadamente los parámetros, por lo que se comprobó el override mediante el HTML y las pruebas aisladas, sin inferirlo desde parámetros ausentes de la tabla.
- Ningún Contact de Diana con atribución Meta en esa ventana. No hay un rechazo CAPI de Contact asociado a esos visitantes en las conversiones consultadas.
- La prueba que el usuario identificó como Elsa produjo un Contact a las 15:16:29 de Argentina, seguido por la cuenta `elsa557520`. El evento tenía `from_meta_ads=false`, sin fbc; CAPI se omitió con `skipped_not_meta_ads`, conforme a la política vigente. Esto no desactiva el Contact de Pixel del navegador, que el usuario observó con Pixel Helper.
- La consulta de logs productivos de Vercel devolvió cincuenta registros en la ventana solicitada, con HTTP 200 en los registros de API mostrados, incluidos destino, tracking y start de la prueba. Es una captura limitada; no demuestra la ausencia de fallos fuera de lo conservado por los logs.

## Verificación aislada del HTML publicado

Se descargó el HTML mediante GET sin ejecutar tracking. Después se ejecutó en un servidor loopback, con todas las APIs, creaciones y eventos interceptados/simulados. Solo se descargaron assets públicos estáticos. Se forzó el fallback fetch de `sendTrackBestEffort` para inspeccionar el payload de forma fiable; no se certifica aquí el transporte real sendBeacon.

Seis comprobaciones pasaron: Chrome y Safari/WebKit, con destino disponible y no disponible en la ruta directa, y con destino disponible desde `/gast?landing=diana`. Con destino disponible se produjo exactamente un Contact antes del start de cuenta, al píxel correcto y conservando fbc; el caso con parámetro envió `landing=diana` y `landing_resolution=url_parameter`. Sin destino no se produjo Contact. No hubo errores de JavaScript en estas comprobaciones ni altas/eventos de prueba enviados a producción.

Esta revisión no cambia la política, el disparador ni el código de tracking y no atribuye una causa definitiva al rendimiento del anuncio. La corrección solicitada para la hora del inbox se documenta en `internal-chat/docs/validation/inbox-last-message-time-20261030.md`.
