# Contratos actuales que deben preservarse

Revalidación ampliada del 16 de septiembre de 2026: ver también `concurrency-results.json`, `screen-baseline.json` y `closure.md`. Las pruebas no redefinen ninguna regla ni corrigen diferencias preexistentes.

Son una descripción de las implementaciones observadas, no una redefinición comercial. Las diferencias entre subsistemas no se corrigen en Fase 0. Las fuentes son relativas a la raíz del repositorio; las migraciones citadas se leen como definición, no se aplican en producción.

## Configuración de landing

Fuentes: `supabase/functions/builder-config/index.ts`, `market.ts`, `frontend/components/public-landing/getLandingConfig.ts`, `PhonePrewarmScript.tsx`, `PublicLandingRuntimeScript.tsx` y pruebas actuales `publicLandingHtml`, `landingMarket`, `landingTemplateVariants`.

- Builder-config admite GET/POST y OPTIONS; nombre ausente 400, inexistente 404, fallo de consulta/servidor 500, método inválido 405.
- Se mantiene el merge de configuración y de la variante activa. ARS/PYG determina el prefijo operativo 54/595; no sustituirlo por una preferencia visual vieja del mercado.
- El consumidor Next usa `force-cache` y tag `landing-config:<name>`. 404 o respuesta sin nombre devuelve null; otro HTTP no exitoso lanza error. JSON inválido/red fallida también propaga error.
- La Edge publica ramas con Cache-Control de 10 o 60 segundos. La caché de Next y el caché HTTP son capas distintas; cambiar una sin invalidar correctamente la otra no es una optimización equivalente.
- HTML conserva Pixel/PageView únicos, identidad por pixel y slug, ausencia completa del pixel si no hay ID, Contact con eventID, orden posterior al formulario opcional y metadatos que no exponen comentarios internos.

## Asignación, prewarm y confirmación de teléfono

Fuentes: `supabase/functions/landing-phone/index.ts`, `phone-click/index.ts`, `supabase/migrations/20260905012831_fair_message_assignment_reservations.sql`, consumidores públicos indicados arriba.

- El GET landing-phone no es una lectura pura: puede reservar teléfono y registrar disponibilidad. No utilizarlo como benchmark en producción.
- Valida propietario/plan antes de asignar. Cliente/landing inexistente: 404; bloqueado: 403; fallo de validación/RPC: 500. `_status=not_found` o `no_assignments`: 404; `no_phones`: 503. No convertir un estado sin teléfono en éxito ficticio.
- Constructor puede usar caché fresca (hasta 90 segundos), estado ok y teléfono no vacío; una selección fair por gerencia o teléfono obliga a consultar el asignador. Éxito elimina `_status` y responde `no-store`.
- Llamada normal a `get_phone_for_landing` lleva `p_create_reservation=true`; `source=warmup` lleva false y no registra demanda. Chatrace usa su RPC y contador de ámbito propio. No confundir el prewarm real del visitante con el warmup técnico del cron.
- El navegador comparte la promesa por slug. Un initialPhone con `cacheRefreshedAt` fresco puede evitar una solicitud. El runtime reutiliza la promesa para el CTA; los errores de fetch del script se convierten en null. El helper TypeScript de teléfono devuelve null ante HTTP no exitoso, pero propaga errores de red/JSON: son contratos diferentes.
- Phone-click exige POST, landingName, phoneId y phone; valida landing, teléfono y pertenencia a gerencia. Incrementa contador de ámbito y extiende reserva. Fallo de extensión se registra sin convertir el éxito del contador en fallo; fallo del contador devuelve 500. El CTA utiliza el registro como best effort.
- La reserva usa bloqueo transaccional por landing. La extensión marca clicked, dura 30 segundos y acepta reservas recientes de hasta 10 minutos en estados prewarmed/clicked/expired. Un Lead posterior puede cerrar la reserva. El conteo por mensajes incorpora Leads y reservas vigentes; no equivale a contar clicks ni a contar requests de prewarm.
- No se presupone idempotencia del endpoint phone-click: el test asegura una invocación al contador POR solicitud válida, no una única contabilización de múltiples solicitudes repetidas.

Cobertura nueva: transporte del helper, estados HTTP del handler real mediante SDK simulado, plan bloqueado, no teléfono, caché fair, warmup y confirmación con errores. No cubre todavía competencia de múltiples conexiones por el asignador SQL ni navegación completa a WhatsApp.

## Contact, Lead, Purchase y atribución

Fuentes: `supabase/functions/conversions/index.ts`, `shared.ts`, `event_attribution.ts`, `pixel_attribution.ts`, `inbound_tracking.ts` y sus tests Deno.

- Endpoint POST con `name`; OPTIONS 200, otro método 405, nombre ausente 400, cliente inexistente 404, configuración/lookup fallido 500. No cambiar respuestas exitosas de procesamiento interno porque el envío a Meta haya fallado.
- Se conserva la normalización canónica de acción, IP/user agent y event_time. Cuando falta fecha del emisor se fija la recepción para replays diferidos.
- Contact, Lead y Purchase son etapas diferentes; Contact de CTA no demuestra recepción de un mensaje por el bot. No inferir un webhook Lead real desde un clic.
- Atribución debe mantener coherencia entre persona, promo, gerencia receptora y raíz Contact. Una promo vieja no debe trasladar la recarga a otra gerencia. El pixel explícito, la raíz del recorrido y los fallbacks existentes tienen orden probado.
- El switch y umbrales de Purchase CAPI afectan solamente elegibilidad de envío a Meta. Apagado conserva envío actual; prendido usa umbral inclusivo por moneda y conserva monedas sin umbral. No debe suprimir la compra interna, cambiar su monto ni afectar las audiencias exportables.
- Mantener contratos separados website y Business Messaging, origen CTWA, validación de ctwa_clid, omisión de fbc vencido y filtros existentes first/repeat, Meta Ads y switch maestro.

No hay una prueba integral del handler conversions y todos sus viajes a DB/Meta. Los tests actuales cubren helpers importantes; no prueban entrega real, transacciones completas ni equivalencia del código desplegado con main.

## Deduplicación e idempotencia

Fuentes: `conversions/index.ts` (`purchaseIdempotencyKeysFromPayload`, `claimPurchaseEvent`, `completePurchaseEventClaim`, `findExistingContactDuplicate`); migración `20260728163000_purchase_event_atomic_claims.sql`; tests Deno de atribución/reintentos.

- Contact busca duplicados por eventID/promo y contempla conflicto único de escritura. Lead sin promo conserva ventana de 24 horas por persona y gerencia; no deduplicar entre gerencias.
- Purchase usa claves estables de pago y action_event_id. La reserva SQL serializa claves ordenadas con advisory locks, por usuario. Repetir una clave retorna el eventID original. Sin claves estables el estado es unprotected, no existe garantía equivalente.
- Error previo permite reintentar. Processing es reclamable después de MÁS de cinco minutos; exactamente cinco no alcanza. Processed no se reprocesa. La finalización conserva la identidad persistida para CAPI.
- La deduplicación de compradores en una consulta NO reemplaza la idempotencia de ingestión. Tampoco puede aplicarse indiscriminadamente a métricas legacy que actualmente cuentan filas.

Cobertura nueva SQL: normalización de alias, duplicado, aislamiento por usuario, retry tras error, frontera de cinco minutos, persistencia de eventID y ausencia de permisos de navegador. Es secuencial; la garantía bajo dos conexiones concurrentes aún necesita una prueba específica.

## Funnel y métricas

Fuentes: `frontend/lib/conversionsDb.ts` (`fetchConversionRowsInternal`, `fetchConversionJourneyStartRowsInternal`, `buildFunnelContactsFromConversions`), `conversionStats.ts`, `conversionPageDataSource.ts`; `conversionStats.test.ts`.

- Datos de conversiones se paginan en bloques de 1.000, ordenados por created_at descendente; journeys por first_seen_at. Fechas se aplican inclusivamente. Visibilidad y ocultamientos del usuario se aplican antes de la vista. Admin mantiene alcance global; dashboard limita propietario.
- Es paginación de transporte; actualmente puede descargar todo el conjunto seleccionado. Para N exacto múltiplo de 1.000 sin límite necesita una solicitud vacía final. No usar solo el primer bloque en un agregado futuro.
- Funnel excluye test_event_code no vacío, agrupa por usuario + teléfono normalizado + contexto/gerencia con sus fallbacks. Usa el último estado; solo presenta lead/purchase; suma filas Purchase y ordena por última actividad.
- Core usa identificadores de etapa, deduplicación específica por usuario/teléfono y vínculos de external_id. Los recorridos publicitarios además respetan promo y gerencia. Registros distintos con el mismo purchase_event_id pueden sumar dos veces en este helper: se deja caracterizado, no se modifica.
- Core legacy interpreta tipos desconocidos como repeat si observaciones contiene REPEAT, y como first en caso contrario. Audiencias v2 NO hace esta inferencia. Promedio por persona y promedio por evento no son intercambiables.
- Mantener métricas de Leads reales y de Leads inferidos separadas: el frontend distingue ambos conceptos. No presentar la inferencia como evento realmente recibido.

## Audiencias Meta

Fuentes: migraciones `20260911200034_meta_audience_buyers_v2.sql`, `20260911201101_compact_meta_audience_buyers_v2_payload.sql`, `20260911213912_meta_audience_configs.sql`; `frontend/lib/metaAudienceDb.ts`, `metaAudienceExport.ts`, `metaAudienceRules.ts`, `metaAudienceConfig.ts`, `metaAudienceConfigDb.ts`; `MetaAudiencesPanel.tsx`.

### RPC e identidad

- auth.uid obligatorio, SECURITY INVOKER; solo ARS/PYG. Un usuario no hereda alcance admin global para esta RPC.
- Un único `p_as_of`; inicio <= fin <= as_of. El frontend limita fin al as_of. Fecha efectiva = purchase_event_time válido (1..32503680000), de lo contrario created_at. Historia hasta as_of inclusive. Período con ambos extremos inclusivos. Recencia = floor(segundos desde última compra / 86400), no diferencia de fechas del calendario.
- Incluye estado purchase O purchase_event_id no vacío. Excluye test_event_code con contenido después de trim. Valor negativo/null se normaliza a cero.
- Identidad conservadora: par Atrio/player; luego teléfono; email; external_id acotado por source; finalmente id de fila. No hay merge persistente por aliases. Teléfono elimina no dígitos y prefijo 00. Datos representativos de contacto usan agregación max, no necesariamente el último contacto cronológico.
- Evento deduplicado por transaction, coelsa, eventID, fila (en ese orden). Empate de evento elige fecha efectiva más reciente, created_at más reciente y UUID descendente.
- Primera carga histórica = PRIMER evento explícitamente first conocido después de deduplicar. Una recarga anterior no lo reemplaza. Si solo existen recargas, es null. Tipos desconocidos cuentan para total pero no para first/repeat.
- V2 incluye personas inactivas en el período; sus cantidades y sumas del período son cero, promedio/máximo null. Monedas siempre independientes.
- Transporte: un escalar JSON `{version:2,rows:[...]}`; cada fila tiene exactamente 28 posiciones fijadas por el mapper. Orden por customer_key. Preserva null y cero distintos. Versión/formato inválidos y claves duplicadas se rechazan. Una respuesta escalar evita el truncamiento de PostgREST a 1.000 filas; no significa que el payload sea pequeño.

### Períodos y reglas

- Períodos relativos incluyen hoy más N-1 días calendario en America/Argentina/Buenos_Aires, desde medianoche local hasta as_of. Custom persiste fechas, fin del día a milisegundos o as_of, lo que ocurra antes. PostgreSQL acepta microsegundos: el test nuevo fija esas fronteras sin cambiar el milisegundo de la UI.
- AND global; máximo 20 reglas. gt/gte/lt/lte/eq/between inclusivo; null no satisface una comparación normal.
- Scope all/first/repeat exige al menos una compra del tipo en el período; none no exige actividad. Cambiarlo no altera cómo se construye el universo histórico del ranking.
- Top X% usa valores 50/25/10/5/1. Universo separado por moneda. Métrica histórica considera historia; métrica del período excluye personas con cero compras del período. Null queda fuera; cero válido permanece.
- Orden descendente; umbral en posición ceil(N*X/100). Se incluyen TODAS las personas empatadas con el valor del umbral. Por eso puede entrar más de X%. Los rankings se calculan ANTES de scope y otras condiciones; no recalcularlos sobre el subconjunto ya filtrado. Cada regla top se evalúa respecto de su propio universo.

### Resumen, CSV y persistencia

- Reglas deciden personas; summaryValueMetric decide resumen; exportValueMetric decide valor por persona exportada. Cambiar los dos últimos no cambia pertenencia al segmento.
- Resumen toma todos los integrantes, incluso no exportables. Mediana/promedio del valor individual elegido; representadas = compras asociadas a la métrica, no necesariamente todas las históricas.
- Exportación requiere al menos uno de los identificadores seleccionados email/phone con valor. Value-based además exige monto elegido >0 y no null. Segmentada no agrega columna value. El contador de falta de identificador y el de falta de valor pueden superponerse.
- CSV: orden de campos seleccionado, todas las celdas entre comillas, comillas internas duplicadas, CRLF, valores con hasta dos decimales sin ceros finales. El builder no antepone BOM; el download sí. Reproducir bytes, orden y redondeo, no solo filas equivalentes.
- Presets cargan configuraciones editables, no otro algoritmo. Configs guardan definición, moneda, período, scope, reglas, métricas, identificadores y propietario; no guardan personas ni CSV. RLS y validación SQL permanecen intactas.
- Hoy reglas, percentiles, resumen y CSV se calculan en el navegador después de bajar compradores agregados. La prueba de pipeline fija su resultado actual para una implementación futura.

## Inicio

Fuentes: `frontend/app/(panel)/dashboard/inicio/page.tsx`, `fetchHomeOverviewStats` en conversionsDb, migraciones de caché `20260819175021` y cálculo `20260820020830_home_overview_meta_ads_full_summary.sql`.

- Pantalla requiere una moneda, obtiene auth y llama get_home_overview_stats_cached_by_currency. Mapea landings_count, porcentaje_carga, carga_promedio, total_cargado, jugadores_premium y retencion_activa_30d a números con fallback cero.
- La RPC valida usuario/admin y busca caché por usuario/moneda. Un miss calcula y ESCRIBE caché. No asumir que todo `get_*` es de solo lectura. Se observó su definición real con MCP; no se ejecutó un miss.
- Cálculo SQL usa mes de now() con zona de sesión PostgreSQL, excluye pruebas y ocultos, y resumen publicitario. Mantiene fórmula existente de inferidos, umbral premium por moneda, retención con cuatro compras en 30 días y antigüedad de al menos siete días.
- El helper puro del frontend tiene pruebas, pero no es el camino productivo de Inicio ni una prueba de paridad automática de la RPC. Tiene diferencias de identidad/recorridos frente al SQL legacy; no reemplazar uno por otro sin fixtures de paridad específicos.
- Carga promedio es ingreso dividido por cantidad de compras del conjunto, no promedio de promedios de personas. LandingsCount es el inventario suministrado/calculado, no la cantidad de compradores.

## Concurrencia caracterizada localmente

- Asignador SQL real: ocho conexiones contendiendo sobre la misma landing fair por mensajes producen ocho reservas distintas, repartidas 4/4 entre dos teléfonos equivalentes. Los workers SQL se liberan de una barrera solo después de comprobar que todos llegaron. El orden individual es aleatorio; no se afirma una secuencia de teléfonos que el contrato no garantiza.
- Warmups simultáneos no agregan reservas. Extensiones simultáneas conservan la identidad de una reserva y dejan estado clicked. Dieciséis incrementos reales conservan 16 en el contador global y 16 en el contador por scope, incluyendo la inserción inicial concurrente.
- Contact: restricciones originales de contact_event_id y promo_code rechazan siete de ocho inserciones idénticas. Los conflictos únicos esperados son parte del escenario aprobado, no pruebas fallidas.
- Lead/Purchase inbox: los índices reales distinguen action_event_id con/sin promo; ocho duplicados concurrentes dejan una fila en cada caso probado. Purchase también conserva unicidad por transaction y coelsa. Esto prueba restricciones de DB, no la respuesta HTTP completa del webhook ni toda la ventana de Lead sin promo.
- Claims Purchase: aliases superpuestos y orden invertido eligen un único claimant; todos observan el eventID persistido. Después de error solo un retry gana; processed rechaza los replays concurrentes. No se presupone exactly-once en la red a Meta.
- WhatsApp: se ejecutan las funciones reales `claimEvent` y `requeueStaleProcessingEvents`, extraídas por AST, contra PostgREST local con conexiones reales. Solo un worker cambia pending a processing; barridos concurrentes reencolan un evento vencido una vez; al alcanzar cinco intentos termina failed.
- Tracking: el módulo real `frontend/lib/tracking/queue.ts` recibe únicamente un cliente local inyectado. Persistencias concurrentes retienen una identidad, claims condicionales entregan el pendiente una vez, el backoff excluye trabajo futuro y un evento sent se reconoce como entregado en replays. No se contacta ningún upstream.

El esquema de dependencias sigue siendo sintético y acotado. Se cargan migraciones originales completas cuando es posible. Para métricas por scope se usa su prefijo DDL exacto (sin el bloque que parchea RPC legacy); para tablas de colas se extraen segmentos DDL exactos. No se modifican sus cuerpos productivos. Los grants auxiliares pertenecen solo al fixture local. No se certifican todas las policies, triggers ni el handler CAPI integral.

## Operaciones observadas por pantalla

El benchmark monta el frontend y layout reales; los datos/respuestas son ficticios y la moneda y fecha siguen el mismo procedimiento en ARS/PYG. La adquisición inicial del layout agrega auth, perfil, suscripción y configuración, además de precargas de rutas.

- Inicio: auth + RPC de caché por moneda y mapeo de tarjetas.
- Conversiones: configuración, preferencias, filtros de ocultos, conversiones paginadas, journeys, pixels y metadata; luego normalización, estadísticas, filtros y paginación visual. El fixture incluye 1.205 conversiones, de modo que efectivamente atraviesa más de un bloque.
- Audiencias: repite la carga de su contenedor y agrega el payload de compradores; mapper, reglas, percentiles y resumen se ejecutan en el navegador. No se elimina la carga genérica en Fase 0.
- Landings: auth, listado por workspace, settings y merge con configuración predeterminada.
- Editor: landing individual, settings, gerencias/grupos, asignaciones, Atrio y pixels; normalización del formulario y preview. No se pulsa Guardar ni Publicar.
- Teléfonos: suscripción/config, gerencias, teléfonos y phone_metrics; agrupación, ordenamiento y mapeo de contadores. No se resetean contadores del producto ni se cambia disponibilidad.
# Cierre acotado: concurrencia integral observada el 16 de septiembre

Esta sección prevalece sobre los pendientes históricos que más abajo indicaban falta de cobertura del handler. No redefine reglas de negocio ni aprueba los defectos observados. Se ejecutan completos los callbacks HTTP de conversions y retry-failed-conversions y sus imports actuales, contra PostgreSQL/PostgREST descartables. Deno.serve, entorno y transporte externo se inyectan en el harness; Meta nunca recibe eventos. Ver handler-concurrency-results.json y sus hashes de fuentes.

- Contact: ocho solicitudes iguales conservan una conversión y un envío en ARS/PYG, con las restricciones reales de unicidad.
- Purchase: ocho solicitudes con distintos action_event_id y la misma transacción comparten un claim, una conversión y un envío; el replay no reenvía. El claim no queda processing al terminar.
- Lead: ocho solicitudes simultáneas pueden enviar ocho veces sobre una sola conversión. La unicidad de conversion_inbox no protege el efecto externo: el handler continúa si insertInboundEvent devuelve null tras el conflicto.
- Reintentos CAPI de Contact, Lead y Purchase: cuatro workers alcanzan Meta antes de liberar las respuestas del simulador y envían cuatro veces el mismo event_id. Los workers no adquieren una reserva atómica. La deduplicación real de Meta no se prueba ni se presume.
- Contact/Lead: los cuatro reintentos pueden dejar retry_count=1, porque cada worker escribe el valor leído más uno. Se caracteriza la pérdida de incrementos; no se corrige.
- Lead diferido: se observó que cuatro workers drenan una sola entrada diferida, pero crean cuatro conversiones y cuatro event_id diferentes. No hay garantía de procesamiento único. La cantidad observada depende del intercalado y figura en el reporte.
- Recuperación: fallos HTTP 503 y fallos de red simulados conservan la identidad, permiten recuperación y dejan de reenviar después de enviado. Contact/Lead respetan el backoff de cinco minutos; el presupuesto Contact termina en seis intentos. Una cola drenada no demuestra ausencia de duplicados.

Estos resultados son riesgos de integridad para una fase futura específica de conversiones/CAPI. Cualquier corrección cambia comportamiento productivo y requiere un alcance separado. No corresponde incorporarla a la optimización de lectura de Fase 1.

Limitaciones: esquema de dependencias acotado con DDL base/índices/claims reales y columnas adicionales derivadas de interfaces actuales; no replica todos los triggers/RLS, Auth ni el aislamiento Deno Edge. No prueba aceptación/deduplicación real de Meta ni la caída de proceso después de que Meta acepte pero antes de persistir enviado.
