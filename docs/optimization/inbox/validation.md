# Validación

La implementación local queda validada para checkpoint. La evidencia corresponde al código identificado por SHA-256 en [inventario](inventory.json), [pruebas SQL/Data API](tests.json), [navegador](browser.json) y [frontend](frontend-validation.json). No acredita un despliegue ni latencia productiva futura.

## Causa y mediciones

El RPC histórico reprodujo 57014 con ocho segundos tanto en producción, dentro de una transacción READ ONLY, como en el fixture local. No se conoce la fecha exacta de la captura original. La ejecución remota usó el último día con actividad y devolvió únicamente error sanitizado o agregados; no se registraron mensajes, teléfonos, nombres ni identificadores de clientes.

Los EXPLAIN remotos fueron sin ANALYZE. Metadatos y candidato tuvieron un límite de 1.500 ms; la reproducción del RPC conservó los ocho segundos del rol. Ningún ajuste de timeout es parte de la migración o aplicación. [Reproducción remota](remote-reproduction.json) separa cada consulta y sus límites.

Los EXPLAIN ANALYZE fueron exclusivamente sintéticos. El benchmark del cuerpo histórico sin corrección también agotó un presupuesto local de 60 segundos: no es un tiempo de ejecución completado ni un cambio del timeout de la aplicación. Los candidatos y RPC nuevos conservan ocho segundos. [Mediciones SQL](sql-measurements.json) registra variantes, scans, loops y buffers.

Para obtener un oráculo completo de equivalencia, se tomó el SELECT histórico sin cambiar expresiones, predicados, proyección ni orden; sus CTE se materializaron y se desactivaron localmente nestloop y JIT. Esto evita que el plan defectuoso impida comparar filas. El candidato se ejecutó con el planificador por defecto. No se presenta ese oráculo como rendimiento del RPC original.

## Cobertura aprobada

| Área | Evidencia |
| --- | --- |
| Reconstrucción | 274/274, SHA de migración final coincidente y 273 anteriores intactas. PostgreSQL local 17.6.1.075, producción 17.6.1.063; CLI 2.75.0. |
| SQL y Data API | 36 comprobaciones dirigidas, incluida la suite pgTAP de 10 aserciones; cero fallos. |
| Equivalencia | 15 casos de todas las columnas históricas no correspondientes al array de mensajes, más metadatos de vista previa. Primera, siguiente, final, sin fecha, ARS/PYG, etiquetas, no leídos y rango vacío. |
| Acceso | Cliente A/B, admin desde profiles.role protegido, auth.uid() null, anon, contacto ajeno y rechazo de parámetro tenant inyectado. Helpers privados y wrappers invoker. |
| Paginación | 269 conversaciones con empates, sin repetición ni omisión en datos estables. Detalle inicial igual a los 50 históricos; siguientes 10 y final; 240 mensajes de ambos sentidos con timestamp empatado en cinco páginas. |
| Estados | Marcación por lector, etiquetas, redirects, chat vacío y filtros históricos sin cambios. |
| Navegador | 12 comprobaciones sobre componente real en Chromium: requests, proyecciones, páginas, búsqueda local, nueve filtros, moneda, fechas, gerencia, selección vacía, detalle, vista previa y ventana de atención. |
| Frontend | 11 pruebas: conciliación de mensajes/estados, envíos optimistas, ventana de atención, autenticación Realtime y separación de vista previa/historial durante una carga. TypeScript y build aprobados. |
| ESLint | Cero errores; 18 advertencias en archivos no modificados. Sin advertencias nuevas en los archivos de esta mejora. |
| Bundle | 125 assets cliente inspeccionados; secreto sintético ausente, RPC nuevos presentes, RPC de precarga histórico ausente. Los artefactos servidor se clasifican aparte. |
| Integridad | Auditoría, inventario, hashes, referencias, UTF-8 y diff; consultar audit.json y el commit para el checkpoint final. |

El detalle autoriza el contacto antes de usar el cursor, incluso si el cliente manipula su timestamp o UUID. El cursor exclusivo no pierde microsegundos. Los desempates hacen estable una fotografía de datos; conversaciones conserva offset y la reacción histórica a actividad nueva, sin prometer una fotografía transaccional entre requests.

La revisión final reprodujo y corrigió una carrera en la implementación candidata: una vista previa sintética podía entrar al historial cuando llegaba un estado durante su carga y sobrescribir metadatos CTA. La vista previa quedó separada de los mensajes completos. Dos regresiones nuevas cubren ese caso y estados antiguos sucesivos; se repitió la validación frontend con los hashes finales, sin repetir SQL o reconstrucción, cuyos archivos no cambiaron.

La reconstrucción usa el bootstrap local acreditado, incluyendo su compatibilidad nativa de extensiones y ledger. Se reutilizan mediciones históricas ya acreditadas cuando su fixture no cambia; el informe identifica sus variantes. Un intento mecánico de reconstrucción falló durante una invocación Docker sin SQLSTATE y se repitió secuencialmente; la ejecución final completa quedó aprobada y limpió sus recursos. No se atribuye una causa no demostrada a ese fallo.

## Límites del navegador y del build

El navegador recibe respuestas HTTP loopback obtenidas de SQL sintético; Data API se prueba por separado con PostgREST real en una red interna, sin puertos publicados. Las etiquetas de gerencia y la selección vacía tienen fixtures de presentación adicionales identificados en browser.json. No se extrapola ese replay como latencia PostgreSQL ni como captura de producción.

El build se hizo en una copia temporal del frontend sin ningún archivo .env, con variables sintéticas y sin credenciales reales. El marcador privado usado es deliberadamente ficticio. Se inspeccionó .next/static; .next/server no es un bundle enviado al navegador.

Se midieron 1.000 mensajes normalizados al abrir antes y cero después. El listado recibe 20 resúmenes; seleccionar agrega 50 mensajes y cada página anterior otros 50. La búsqueda, gerencia y ocultos siguen operando sobre los 20 resúmenes de la página. Realtime y la conciliación del detalle cargado permanecen en el navegador; no necesitan descargar historiales de otros chats.

CPU, memoria y primera vista son una sola muestra instrumentada por variante. No son una mejora estadística acreditada. La reducción de bytes, objetos y trabajo de normalización sí se observa directamente. Las suites históricas no afectadas no se repitieron: no cambiaron sus archivos ni las primeras 273 migraciones.

## Recursos y alcance

Los runners registran limpieza de todos sus recursos propios; la lectura final de Docker confirmó cero remanentes propios. El contenedor ajeno codex-p8-mysql, las tres redes predeterminadas y ocho volúmenes ajenos permanecen intactos. Fixtures y copias temporales de build están fuera del repositorio.

No hubo escrituras productivas, llamadas de envío, cambios de negocio, despliegue ni acceso a repositorios hermanos. Fase 1B.5 continúa diferida. El rollout y la comprobación posterior en producción requieren autorización separada; ver [rollback](rollback.md).
