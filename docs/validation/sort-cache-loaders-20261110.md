# Redirección: métricas reutilizables e indicadores de carga — 10/11/2026

## Alcance

Producto afectado: panel de LandingBuilder, cliente y administrador. Fuentes canónicas: `usePagedBotsWorkspace`, `atrioMetricsCache` y `LandingBuilderLoading` de Builder. Atrio conserva sus contratos y cálculos; solo cambia cuándo el panel vuelve a consultarlos. Sin migraciones ni cambios de eventos, datos, permisos, paginación o reparto.

El clásico, NexoBet, los cuatro gateways, el Worker público y API2 quedan fuera del lote: no consumen este directorio ni deben adoptar la identidad de carga de Builder. Los 24 archivos del módulo de marketing compartido verifican sin diferencias con `node scripts/sync-nexobet-marketing.mjs`. No hay recursos de marca nuevos ni modificaciones de los SVG existentes.

## Comportamiento

- Las métricas proceden de respuestas reales de Atrio, conservadas en memoria por instancia del hook. Clave: propietario + vínculo local + asesor; alcance: sesión/usuario, workspace y permiso Atrio. Caducidad: cinco minutos; máximo 500 entradas.
- Cambiar orden, página o filtros reutiliza entradas vigentes y consultas en curso. Los asesores nuevos o vencidos de la página se consultan por propietario, en lotes de hasta 100. No se descargan otras páginas. Los ausentes de una respuesta válida se conservan como ausentes durante la misma caducidad.
- Sincronizar, acciones y refresco programado invalidan antes de consultar. Cambiar alcance o desmontar aborta e invalida; una respuesta antigua no puede restaurar la caché. Un fallo no queda memorizado como consulta pendiente. Se conserva la reindexación del directorio cuando Atrio informa cambios.
- La ordenación sigue en servidor antes del límite de 50. No se promete un cambio instantáneo para páginas nunca visitadas ni se oculta el tiempo de la consulta de Builder. Se retira la espera de 200 ms en orden/página/filtros; la búsqueda conserva su debounce.
- Cargas generales: marca y puntos; paneles y botones: puntos de tamaño acorde. Redirección: isotipo de cohete con recorrido horizontal, fuera del contenedor que desplaza la tabla. Tablas anchas: puntos centrados en el ancho visible. Los textos de carga permanecen accesibles, sin leyenda visible; errores y etiquetas de operaciones se conservan.

## Validación previa a publicación

- TypeScript: `tsc --noEmit --incremental false --project frontend/tsconfig.json`, sin errores.
- ESLint sobre archivos TS/TSX modificados: cero errores; seis advertencias previas en layout, promoción y dependencias de un callback del controlador de teléfonos.
- Desde `frontend`, `tsx --import ./tests/revalidation-server-loader.mjs --test tests/atrioMetricsCache.test.ts tests/botsWorkspace.test.ts tests/botsWorkspaceRoute.test.ts`: 24 pruebas aprobadas, incluyendo siete de caché, aislamiento, caducidad, concurrencia, invalidación y reintento.
- Revisión de componentes reales con servicios inertes: 16 escenarios en Chromium/WebKit, anchos 320/390/768/1280 y ambas preferencias de movimiento. Cohete en movimiento normal, inmóvil al reducir movimiento; marca, puntos de panel y botón; centrado en tablas anchas, sin desborde del documento ni leyendas visibles. Capturas revisadas en móvil.
- El script de navegador del directorio ahora espera `aria-busy=false` y verifica reutilización al ordenar/filtrar/paginar, consulta por demanda de asesores nuevos, valores reales conservados y actualización al sincronizar. Las pruebas usan identidad y servicios sintéticos; no escriben datos de producción.

## Publicación y comprobación

Destino: `main` del repositorio Builder, proyecto Vercel `landing-builder-v2-k259`, dominios `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`. Publicación independiente de otros productos. La comprobación de SHA, estado READY, alias y navegador se registra en `.vercel/sort-cache-loaders-20261110/` localmente al finalizar la entrega. Las pruebas de navegador se ejecutan sobre la versión desplegada con servicios sustituidos; no acreditan acceso a métricas reales de clientes.
