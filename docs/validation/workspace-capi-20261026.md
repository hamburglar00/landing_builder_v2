# CAPI por workspace y modal del píxel — 26/10/2026

## Alcance aprobado

Interruptor por cliente/workspace en Integraciones → Meta CAPI y modal de píxel sin tarjetas anidadas. Pausar únicamente PYG de goldencajeros; conservar ARS, otros clientes, el píxel del navegador y las conversiones internas. No requiere cambios en API2, Panel3, Atrio ni gateways.

## Implementación

- `conversions_config.capi_workspace_settings`: mapa ARS/PYG booleano, habilitado por defecto si falta la clave. RPC atómico `set_workspace_capi_enabled`, SECURITY INVOKER, autenticación obligatoria y políticas existentes de propietario/administrador. No admite usuarios anónimos, claves desconocidas ni valores no booleanos.
- La configuración se obtiene en la consulta existente. El bloqueo precede al envío y al acceso a proveedores externos en conversions, retry-failed-conversions y conversions-test. Omisiones persistidas con estado `skipped_workspace_capi_disabled`; sin reenvío del historial omitido al reactivar.
- El guardado de configuración del píxel no incluye el mapa de workspaces y no puede restaurar accidentalmente su estado anterior.
- Modal con secciones, separadores y líneas de dependencia; se mantienen campos protegidos, ayudas, validaciones y acciones fijas.

## Validación local

- `node scripts/check-workspace-capi.mjs`: seis grupos aprobados. Migración real, Postgres 17.6 y PostgREST desechables, sin puertos de DB publicados. Permisos y aislamiento por propietario, edición concurrente ARS/PYG, cuatro eventos por cuatro orígenes, solicitudes HTTP completas Contact/Lead/Purchase, conversiones internas conservadas, ARS activo con PYG pausado y cron sin reenvío del historial omitido.
- `node scripts/check-workspace-capi-ui.mjs`: ocho escenarios aprobados, Chromium y WebKit, 320×568, 390×844, 844×390 y 1366×768. Pantalla y helpers reales con fixture únicamente de IO: independencia de workspaces, fallo de guardado, cambio de workspace con guardado pendiente, persistencia al remontar, cancelación, validaciones, plazo de Repeat, monto mínimo y geo; guardar píxel conserva la pausa; botones accesibles y sin desborde horizontal.
- TypeScript del frontend y Deno check de las tres funciones. ESLint de los componentes de integración: cero errores; tres avisos preexistentes.
- Inspección visual de capturas móvil y escritorio en `.vercel/validation-workspace-capi-20261026/` (artefactos ignorados).
- Cero eventos enviados a Meta y cero escrituras en producción durante las pruebas.

## Publicación

- Migración aplicada en Builder (`fdkjkzpjqfbaavylapun`): `20261026202514_workspace_capi_control.sql`. Verificados SECURITY INVOKER, permiso authenticated, rechazo de anon y RLS existente sin cambios. Avisos de seguridad y rendimiento idénticos antes y después.
- Edge Functions activas: conversions 170, retry-failed-conversions 47, conversions-test 13. Conservan `verify_jwt=false` previo y sus validaciones internas existentes. Comparación de código remoto anterior con HEAD: entrypoints sin diferencias funcionales; la copia compartida más antigua de conversions-test se actualiza a la versión canónica existente.
- Verificado en DB: goldencajeros tiene `{"PYG":false}`, ARS sigue habilitado y cero otros clientes tienen overrides. No se modificaron flags de píxeles ni conversiones históricas.
- Commit publicado: `321e8976ac2d8c7b450eb43ac2f557d97837066f`, rama `fix/template7-session-reentry`.
- Frontend compilado y promovido: `dpl_E2D8JuhJJCwL8jWCiUqXDLepT1hL`, estado READY, fuente 321e897. Snapshot del commit sin archivos `.env*` ni `.dev.vars*`. Producción anterior: `dpl_4kpvJAYjBpryb96ThjSSjWTSjnU6` (0a128ac).
- `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`: HTTP 200 en Integraciones, bundle público contiene el interruptor y el RPC nuevos. Verificación de solo lectura, sin iniciar sesiones de clientes ni guardar ajustes desde la UI de producción.
- Funciones desplegadas verificadas: las tres incluyen la política y el archivo compartido. GET conversions → 405, POST sin autorización a retry-failed-conversions y conversions-test → 401. Sin crear conversiones ni enviar eventos reales.
- Árbol de trabajo limpio y rama sincronizada tras el registro de publicación. Sin cambios ni despliegues en API2, Panel3, Atrio o los gateways.

## Ajuste visual posterior: pestañas del píxel

- General, Eventos, Purchase y Ubicación en el mismo modal, una opción por fila y switches alineados a la derecha. Ancho de escritorio reducido y altura de 38rem; en móvil se conserva el alto disponible. Pestañas y acciones permanecen visibles mientras se desplaza el contenido.
- Navegación con flechas, Home/End y atributos de pestañas/panel/diálogo. Abrir comienza en General; el borrador se conserva entre pestañas y Cancelar lo descarta. Purchase desactivado ofrece volver a Eventos. Una combinación inválida de First/Repeat explica por qué no permite guardar desde cualquier pestaña.
- Prueba de interfaz existente ampliada: ocho escenarios en Chromium/WebKit y los cuatro tamaños anteriores. Verificados navegación por teclado, conservación/guardado/cancelación entre pestañas, validación visible fuera de Purchase, alineación de todos los switches y ausencia de desbordes; se conserva la prueba de aislamiento del workspace. TypeScript aprobado; ESLint sin errores, con los mismos tres avisos previos.
- Capturas con animaciones finalizadas en `.vercel/validation-pixel-tabs-20261026/`. Solo cambia la presentación, la prueba y la documentación; no cambia DB, RPC, filtros CAPI ni Edge Functions.
- Ajuste visual comiteado y pusheado en `c2d19e8` y `e1614b6`, misma rama `fix/template7-session-reentry`. Frontend READY y promovido: `dpl_BktAr452AFsuqXcYs4ccNkoCHcQF`, fuente `e1614b6984a47399eb3dcda491523e0c9cbf318c`; reemplaza `dpl_E2D8JuhJJCwL8jWCiUqXDLepT1hL`. Verificados HTTP 200 y controles de pestañas en los bundles publicados de constructor.panelbotadmin.com y mkt.panelbotadmin.com, sin guardar ajustes en producción. Cinco archivos modificados en total; ninguna migración ni publicación de funciones para este ajuste.
