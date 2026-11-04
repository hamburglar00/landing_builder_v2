# Entrada paralela y configuración compartida — 03/11/2026

## Alcance

Autorizado: implementar, comprobar, comitear, pushear, migrar y publicar las mejoras debatidas. API2 no se modifica ni se despliega. El lote conserva y publica también el trabajo local autorizado de T9, cuyos contratos y assets ya comparten los productores de telemetría.

El chat se prepara mientras responde el login y deja de esperar el HTML del casino: la página autenticada `/entry` contiene el cliente existente de gateway y un iframe del casino del mismo origen. Los scripts/HTML de cada proveedor siguen pasando por sus adaptadores y controles actuales. Solo nuestro iframe omite su segundo chat. Al navegar a ingreso/salida se abandona la envoltura. No se modifica el SDK canónico.

La reutilización mantiene un pase válido y comprueba la sesión de la misma cuenta. Ante verificación negativa o incierta, conserva el login original. Rey mantiene consume/release, auditorías y persistencia; Ases comprueba el documento completo; NET conserva activación; Multi Skin usa su relay y la skin firmada.

El catálogo privado de Atrio contiene configuración y referencias, sin usuarios/contraseñas ni autoridad sobre pagos. Builder tiene outbox con revisiones, notificación posterior al commit mediante pg_net y confirmación condicional. Los cambios locales de Atrio reconstruyen la proyección. El cron cada cinco minutos recupera cambios pendientes y refresca inventario PBAdmin de los asesores usados mediante el endpoint existente de lectura. Lotes acotados, lease de 90 s, respuesta HTTP 202 y ejecución posterior conservada por Next. Permisos y asignaciones por dispositivo siguen siendo comprobaciones en vivo. La lectura agregada se usa en la configuración de pools con fallback al lector previo; no reemplaza la selección dinámica por una asignación cacheada.

La precarga de chat solo usa `prepare_gateway_chat`, detrás de un cache privado de 30 s. No activa llegada, bienvenida, CBU ni LEAD. La caché guarda metadatos y vuelve a leer el historial; los cambios de configuración la invalidan. La entrada visible y sus eventos comerciales mantienen las reglas anteriores.

## Comprobaciones

- PostgreSQL desechable: 28 comprobaciones de catálogo/precarga/versiones/permisos/exclusión y 25 del colector de tiempos. La prueba del bootstrap real también ejecuta el nuevo cache: 12 escenarios internos de precarga, bienvenida, skin, repetición, Full Carga, rotación bancaria, chat directo y privilegios.
- Navegadores con HTTP aislado: 12 escenarios Chromium/WebKit mantienen bloqueado el HTML del casino y permiten usar el chat; después llega el casino sin montar otro chat y se prueba la salida a login. Cuatro gateways y tres marcas Multi Skin.
- Otros 10 escenarios comprueban descarga diferida de emojis/stickers/promociones y ausencia del SDK legacy antes del compositor. Se mantienen las pruebas anteriores de polling, entrada visible y eventos por intento.
- Los tests completos de gateways detectaron expectativas antiguas sobre query extras: el runtime no cambió. El saneador ya ignoraba y quitaba `redirect` desde el commit del 30/10. Se actualizaron esos fixtures conservando rechazo de origen, ruta, duplicados funcionales, credenciales y fragmentos. Ases tenía además un fixture anterior al campo `continueButtonEnabled`; se ajustó al contrato vigente. En Builder, un test de orden inspeccionaba un literal del observador de tiempos; ahora compara las llamadas reales.
- Sin creación de cuentas, comprobantes, conversiones Meta ni operaciones financieras productivas en estas pruebas. Emulación Chromium/WebKit no certifica las apps nativas de Instagram/Facebook en iPhone.
- Suites completas de gateways: Rey 453 aprobadas y siete omitidas previas; Ases 380, NET 386 y Multi Skin 404 aprobadas. Builder 106 pruebas aprobadas. Después de actualizar Next, se repitieron 63 casos de rutas/sesiones y las 106 de Builder; además de las compilaciones y navegadores afectados.

## Actualización necesaria detectada al compilar

La compilación de Rey emitió un aviso de vulnerabilidades de Next. Se confirmó con `npm audit` y los avisos revisados del mantenedor: [optimización de imágenes](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) y [use cache](https://github.com/advisories/GHSA-673q-mjm6-r5xr). Los rangos también incluían las otras aplicaciones del lote. Se actualizó Next a 16.4.5 en Builder, Atrio y los cuatro gateways, y a 15.5.28 en el clásico, con sus lockfiles. No se ejecutó una actualización general de dependencias ni se modificó API2.

Las migraciones se aplicaron en ambos proyectos y sus registros MCP se alinearon exclusivamente con las cinco versiones de este lote. El asesor de seguridad no agregó WARN/ERROR frente al estado anterior: los únicos INFO nuevos corresponden a tablas privadas con RLS y sin políticas para clientes, intencionalmente reservadas a service_role.

## Orden de activación

1. Migraciones Builder: T9, tiempos por intento y fuente del catálogo. Atrio: preparación de chat y catálogo/cron.
2. Clave específica `ENTRY_CATALOG_SYNC_SECRET` en Edge, Atrio y Vault de los dos proyectos. Publicar `entry-catalog-source` y `builder-config`.
3. Publicar Atrio, Builder, clásico, los cuatro gateways y Ganamos+ Worker. Conservar assets anteriores y validar scripts canónicos.
4. Verificar los commits activos, cron/outbox/catálogo y lecturas públicas. Las mejoras de segundos se calcularán con nuevas cohortes reales, sin sumar percentiles de etapas que se solapan.

Estado: validación y publicación en curso. Las referencias finales se completan al verificar producción.

El primer build remoto del constructor detectó que `effectiveSkinEntry.test.ts` importaba el repositorio hermano del clásico, disponible solo en el workspace. Se excluyó exclusivamente ese archivo del build de aplicación y se añadió `test:entry-integration` con configuración TypeScript propia, para conservar tanto su comprobación estricta como su ejecución local. El resto de pruebas y el código productivo siguen en la comprobación original.
