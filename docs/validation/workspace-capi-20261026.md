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
- Pendiente registrar commit y despliegue del frontend tras su verificación.
