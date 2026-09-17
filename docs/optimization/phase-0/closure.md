# Cierre definitivo de Fase 0

Dictamen: **Fase 0 cerrada**, formalizado el 17 de septiembre de 2026. Se cierra la línea base, la caracterización, la reconstrucción local/CI y la estrategia de rollback. Este dictamen no declara reparados los defectos conocidos ni inicia Fase 0C o Fase 1. El registro separado y obligatorio es [pending-findings.md](pending-findings.md).

## Evidencia final acreditada

Las suites corresponden a la ejecución final de Fase 0B del 17 de septiembre. Este pase es documental: se verificaron evidencia, Git, entorno y artefactos sin volver a ejecutar las suites ni iniciar bases.

| Reconstrucción | Migraciones | Arranque local | Replay |
| --- | ---: | ---: | ---: |
| 1 | 268/268 | 34341 ms | 447006 ms |
| 2 | 268/268 | 34701 ms | 346792 ms |

Fingerprint bruto idéntico: fb5a310693c0aeb8e0825bb09c1bf33aa26aa1e108d1b78e9938c1819a793671.

Fingerprint compuesto idéntico: 182bbc25af1c91fc8e275513ec1cb564fb031fb9091e98caf357ce6ed4b902b5.

Fuente: bootstrap-validation.json, bootstrap-final-summary.json y bootstrap-schema-diff.json. Las 268 versiones se ejecutaron una sola vez por reconstrucción según el manifiesto aprobado; no se omitieron migraciones. Las tres excepciones históricas previamente autorizadas siguen documentadas; ninguna se modificó en esta formalización.

## Resultado completo de comprobaciones

| Suite o conjunto | Aprobadas únicas | Fallidas |
| --- | ---: | ---: |
| collector | 5 | 0 |
| deno | 41 | 0 |
| frontend | 99 | 0 |
| sql-and-integration | 112 | 0 |
| concurrency | 22 | 0 |
| handler-concurrency | 20 | 0 |
| bootstrap-safety.test.mjs | 19 | 0 |
| bootstrap-compatibility.test.mjs | 6 | 0 |
| bootstrap-net.test.mjs | 8 | 0 |
| Secuencia | 6 | 0 |
| Matriz RLS | 61 | 0 |
| Matriz pg_net | 46 | 0 |
| Idempotencia instalación | 1 | 0 |

Total: **446 aprobadas, cero fallidas y cero pruebas únicas omitidas**. Son 391 existentes más 55 incorporadas al cierre de pg_net. La invocación genérica del frontend omite una integración que pasó separadamente en sql-and-integration; se cuenta una sola vez. Las matrices RLS/net y la idempotencia se repitieron en ambas bases; las migraciones no se suman como tests.

TypeScript: exit 0. Build: exit 0, 73928 ms. ESLint: exit 0, cero errores y 18 advertencias preexistentes, no corregidas. Advisors locales no disponibles en CLI 2.75.0; no se los contabiliza como aprobados. Fuentes: verification-results.json, bootstrap-unit-results.json, bootstrap-sequence-contracts.json y bootstrap-build-results.json.

## Paridad y resolución de pg_net

Ocho diferencias físicas/de plataforma justificadas individualmente; cero pendientes de reconstrucción/paridad:

1. relations: public||conversions_config|.
2. relations: public||conversions|.
3. relations: public||gerencias|.
4. relations: public||landings|.
5. event_triggers: ||graphql_watch_ddl|.
6. event_triggers: ||graphql_watch_drop|.
7. extensions: graphql||pg_graphql|.
8. provider_hooks: extensions.grant_pg_net_access().

Las primeras cuatro son únicamente orden físico de columnas; las tres siguientes son la extensión pg_graphql local y sus event triggers miembros; la última es el hook de instalación antiguo de la plataforma CLI. Las justificaciones y pares exactos están en phase0b-schema-review.md y bootstrap-schema-diff.json. No hay exclusiones genéricas de seguridad.

Ambos entornos tienen PostgreSQL 17.6 y pg_net 0.19.5. El hook local aplicaba atributos de seguridad antiguos sin condición de versión. Se resolvió mediante instalación nativa de pg_net en la base vacía propia, con event_triggers=false únicamente durante esa transacción y restauración a on antes del replay. No se editaron archivos internos de la extensión ni producción. Las doce funciones miembro y la seguridad efectiva de anon, authenticated, authenticator, service_role y postgres coinciden con remoto. Las pruebas de acceso y revocaciones se revirtieron; no quedó instrumentación, cola ni respuestas. Ver phase0b-pg-net-resolution.md.

## Entorno, red y datos

.env permanece físicamente local, ignorado y fuera del índice. Su JWT legado tiene role=anon, sin evidencia de credencial privilegiada; .env.example contiene solo nombres y ejemplos sintéticos. La retirada del seguimiento está staged desde la autorización anterior, aún sin commit; no se reescribió Git ni se rotaron claves. Los valores no se copian al informe.

No hubo escrituras remotas. Las pruebas bloquearon transporte externo real y simularon Meta/CAPI; pg_net no confirmó requests HTTP. No se afirma ausencia absoluta de conexiones de red de toda la fase: hubo acceso autorizado READ ONLY a metadata remota y consultas de documentación/descargas de herramientas. En esta formalización no se usó ningún servicio remoto.

Cron permaneció globalmente detenido (launch_active_jobs=off), aunque las definiciones históricas conservan active=true. Cero filas residuales de cola/respuestas y cero recursos Docker atribuibles a los runners al terminar. Se conservan los perfiles Chromium anteriores y carpetas de configuración temporal; no se intentó limpiarlos ni eludir una política. Los recursos ajenos o de procedencia no acreditada no se eliminan. Por eso no se afirma que toda la PC carezca de temporales.

Auditoría y procedencia: artifact-audit.json, final-safety-verification.json y final-inventory.json. Los fixtures son sintéticos. Los snapshots remotos contienen metadata de esquema y estadísticas agregadas; no contienen filas de usuarios, clientes, conversiones reales ni credenciales. Se conservan los 19 archivos iniciales.

## Hallazgos NO corregidos

- Duplicación concurrente de Lead: ocho envíos con identidades distintas.
- Duplicación de reintentos CAPI: cuatro envíos del mismo evento.
- Lead diferido: cuatro conversiones/envíos e identidades distintas para una entrada.
- Incrementos perdidos en contadores de reintentos.
- TRUNCATE de anon/authenticated sobre las cuatro tablas acreditadas.
- Permisos amplios de PUBLIC en net y demás riesgos/limitaciones de seguridad enumerados en pending-findings.md.
- Optimizaciones futuras de Conversiones y Audiencias, timeout ARS y medición integrada contra backend completo.

Las caracterizaciones verdes incluyen esos defectos. No certifican procesamiento o entrega únicos ni deduplicación real de Meta. No se modificaron recepción/envío de eventos, payloads, identidades, atribución, monedas ni comportamiento del frontend. Las correcciones requieren una fase separada autorizada.

## Git y checkpoint propuesto

Base: main, HEAD a4e752cf58f628813d3979d598b60d480caaac8d, referencia upstream local origin/main. No se hizo fetch; igualdad con la referencia local no acredita actualidad del remoto. Estado detallado y archivos exactos: final-inventory.json. No se modificó el índice en este pase ni se ejecutaron commit o push.

Inventario final: 168 archivos nuevos no rastreados, cuatro archivos rastreados modificados y una retirada del seguimiento (.env), ya staged. Total propuesto: 173 rutas; cero conflictos y ninguna eliminación física de archivos rastreados. Los cuatro modificados son .gitignore y las tres excepciones SQL previamente autorizadas. La auditoría final revisó 171 artefactos, sin hallazgos, y verificó la conservación de los 19 originales. artifact-audit.json es el reporte generado, por eso no se escanea recursivamente a sí mismo; .env se clasifica en memoria y no se incluye entre los artefactos a publicar.

Propuesta únicamente: checkpoint-proposal.md. Incluye tests, herramientas/evidencia, bootstrap y las tres excepciones históricas ya autorizadas, .gitignore, .env.example y retirada de .env del seguimiento; nunca el archivo físico local.

Los resultados históricos se conservan en closure-history.md, README-history.md y final-summary-history.json; no reemplazan este dictamen. Los generadores antiguos write-closure.mjs y write-phase0b-pg-net-closure.mjs emiten informes de sus etapas: no deben usarse para sustituir este cierre definitivo sin reconciliar expresamente el documento.
