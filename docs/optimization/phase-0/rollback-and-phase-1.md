# Rollback y propuesta de Fase 1

## Estado al 16 de septiembre de 2026

No hay cambio productivo que revertir. Se conservan el commit base y los 19 artefactos iniciales; `artifact-audit.json` agrega inventario relativo y hashes de las nuevas herramientas/resultados. El cierre debe evaluarse con `closure.md`, no con el éxito de una suite aislada.

La suite ampliada incorpora DB concurrente, colas y pantallas sintéticas. Antes de habilitar una optimización futura todavía se necesita superar cualquier bloqueo del replay integral y obtener paridad de los caminos integrados que estos fixtures no ejercitan. El timeout ARS histórico sigue siendo una observación válida: un EXPLAIN estimado y una base sintética más rápida no lo eliminan.

Los runners eliminan exclusivamente contenedores/redes/volúmenes con nombres aleatorios que ellos crearon y directorios temporales cuya ruta verificaron. No requieren reset del proyecto vinculado ni restauración de datos reales. Para volver al estado previo de trabajo, revisar el inventario y retirar solo artefactos de Fase 0 autorizados; no usar limpiezas masivas.

La propuesta de Fase 1 que sigue es únicamente documentación histórica del siguiente alcance. No fue iniciada, aprobada ni implementada durante esta ampliación, aun si todas las pruebas locales pasan.

## Qué queda preparado ahora

Commit base, contratos y oráculos sintéticos ejecutables; manifiesto Edge desplegado sin secretos; huellas MD5 de definiciones SQL como referencia de identidad (no como control criptográfico); procedimientos de medición que no escriben en producción. Esto es una estrategia de rollback, no un backup recuperable de toda la base ni una función de rollback ya desplegada.

Fase 0 no precisa rollback productivo porque no cambió producción. Para descartar sus cambios locales, revisar y eliminar únicamente los archivos nuevos listados en esta carpeta y las rutas de tests/scripts indicadas en README. No ejecutar reset --hard, clean -fd ni restauración masiva que pueda borrar trabajo posterior.

## Reglas para próximas fases

1. Cada fase debe tener un cambio acotado, inventario exacto de artefactos anteriores y responsable operativo. Capturar commit/build frontend, versión/bundle Edge y definiciones/grants de las RPC afectadas antes del despliegue. Los metadatos actuales son referencia, no reemplazan esos artefactos.
2. Introducir primero caminos de lectura alternativos/versionados. Mantener el contrato y camino anterior durante la validación. Si se añade un selector de implementación, queda apagado por defecto y se ensaya también la vuelta al anterior; Fase 0 no añadió flags.
3. Comparar old/new en base sintética o snapshot común, con idénticos usuario, moneda, período, as_of, scope, reglas, orden de campos y métricas. Comparar todas las personas y los CSV completos, no solo conteos. En producción conservar solo número de diferencias/agregados, no identificadores ni CSV.
4. Exactitud: diferencias de miembros, moneda, nulos, contadores, atribución, código HTTP y CSV deben ser cero. No aceptar tolerancia monetaria general. Si cambia representación numeric/Number, documentar y probar el redondeo existente antes de aprobar el reemplazo.
5. Rendimiento: comparar mismas cargas con varias muestras y estado de caché anotado. Propuesta de gate posterior: sin nuevos timeouts; p95 sin regresión >20% y sin aumento de requests/bytes frente al mismo escenario controlado. El ARS cancelado aún no aporta un p95 válido y no permite aprobar por sí solo el gate.
6. Rollback inmediato ante diferencias de negocio, fuga entre usuarios/monedas, truncamiento o errores nuevos. Para regresión sostenida de tiempo, volver al camino anterior y conservar solo diagnóstico agregado. No continuar un canary mientras se investiga una diferencia de personas.

## Procedimientos según capa

- Frontend/Next: volver al artefacto anterior del proveedor o revertir el commit de la fase y desplegar únicamente frontend. Mantener los endpoints anteriores compatibles. Invalidar solo las tags/versiones afectadas si la fase tocó caché, sin vaciar todos los datos operativos.
- RPC de lectura: preferir nombre/version nueva; cambiar consumidor al endpoint anterior. Mantener nueva RPC sin uso mientras se diagnostica. No dropear tablas ni índices como reacción inicial. Si hubo reemplazo in-place, tener DDL exacto anterior incluyendo grants/search_path/volatilidad y una migración compensatoria revisada.
- Edge: volver al bundle exacto de la función y a su verify_jwt/import map de antes de esa fase. Nunca desplegar todas las funciones como rollback de una sola. Verificar también compatibilidad con SQL consumido.
- Índices futuros: reversión funcional primero, evaluar remover índice por separado con control de locks. Nunca quitar uno necesario para unicidad/idempotencia en una optimización de lectura.
- Colas, Purchase y CAPI: NO repetir eventos para comprobar rollback. Mantener eventIDs y estados persistidos; una reversión de código no deshace efectos enviados a Meta. Cualquier reconciliación de datos requiere diseño propio, fuera de estas fases de lectura.

Ensayo previo: en entorno local/sintético activar camino nuevo, ejecutar oráculos, volver al anterior y repetir. Antes de aprobar despliegue, demostrar que el frontend anterior puede leer las respuestas todavía disponibles y que ninguna migración irreversible es requisito de vuelta.

## Fase 1 propuesta, sin implementar

Primer cambio recomendado: evitar que abrir exclusivamente Audiencias Meta dispare la descarga genérica de conversiones y journeys de su página contenedora. Es una reducción de trabajo innecesario sin cambiar consultas, cálculos ni el contrato de la RPC de compradores. No resuelve por sí sola el timeout ARS.

Evidencia: el efecto de inicialización de `frontend/app/(panel)/dashboard/conversiones/page.tsx` invoca en paralelo fetchConversionsConfig, fetchVisibleConversions, fetchJourneyStarts y fetchPixelConfigs antes de cargar metadata de perfil/gerencias. `MetaAudiencesPanel` obtiene sus compradores mediante una RPC independiente. Separar dependencias permite evitar esas dos familias de datasets cuando la pestaña activa no las consume.

Alcance exacto propuesto:

1. Añadir primero tests de orquestación de pantalla con datasource falso: abrir Audiencias, pasar a Tabla/Funnel/Estadísticas, volver, cambiar ARS/PYG, cambiar período y cerrar sesión. Verificar también modo admin, sin asumir alcance idéntico al dashboard.
2. Separar carga de identidad/configuración/metadata requerida de la carga de conversiones/journeys. Mantener los fetchers actuales y aplicar carga diferida solo a datasets cuya ausencia no modifica la pestaña activa. No excluir metadata necesaria para exportar/configurar.
3. Conservar rango, filtros, ocultamientos, autoridad del usuario, loaders/errores y protección frente a respuestas tardías. Al entrar a una pestaña que necesita filas, ejecutar exactamente el camino actual. Invalidar resultados al cambiar usuario/moneda/período según corresponda.
4. No mover todavía reglas/percentiles a SQL, no cambiar RLS, no introducir caché compartida ni tocar Purchase/phone/CAPI. No hacer simultáneamente el refactor de conversions Edge.
5. Criterios: mismos miembros/resúmenes/CSV y configuraciones guardadas; cero llamadas a datasets genéricos innecesarios al entrar directamente a Audiencias; mismas consultas y resultados al abrir las otras pestañas; sin solicitudes obsoletas al alternar rápido moneda/período. Medir con el observador en sesión autenticada antes y después.
6. Rollback de esta Fase 1: restaurar el único artefacto frontend previo. No habría migración ni reversión de datos. Entregar diff pequeño y prueba de regreso al comportamiento anterior.

Archivos probables: página dashboard de conversiones, página admin si comparte el mismo disparo, conversionPageDataSource y tests de orquestación. Confirmar dependencias antes de tocar cada uno; el componente de reglas/exportación no debe cambiar.

Después, como fases separadas: investigar plan/latencia real de la RPC ARS; ensayar motor de segmentos y resúmenes en servidor con los oráculos actuales; generar CSV al solicitarlo; revisar jobs costosos. Su priorización debe usar las mediciones restantes. Ninguna de estas optimizaciones fue implementada en Fase 0.
# Adenda del cierre acotado

No hubo cambios productivos que revertir ni despliegues. Los nuevos riesgos de concurrencia quedan fuera de la propuesta de Fase 1: Lead simultáneo, Lead diferido, exclusión mutua de retry-failed-conversions y contadores de retry necesitan una fase propia de integridad de conversiones/CAPI. Sus correcciones no pueden introducirse silenciosamente como optimización ni como arreglo de tests.

En una futura corrección, mantener los event_id persistidos y no reenviar eventos para ensayar rollback. Volver a una versión anterior no revierte eventos aceptados por Meta. Preparar antes una estrategia específica de compatibilidad de claims y estados; no borrar inbox, claims, conversiones ni registros de reintentos.

Infraestructura local y replay histórico se evalúan con los nuevos informes local-start-*.json y vector-diagnostic.json. Los fixtures acotados son una alternativa ejecutable para pruebas; no un backup ni una réplica completa de producción. Las limitaciones de latencia de pantallas y causa del timeout ARS quedan para sus respectivas fases, según closure.md. Ningún pendiente autoriza por sí mismo cambios productivos.
