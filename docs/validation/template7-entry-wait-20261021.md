# Espera de ingreso de Template 7

En Atrio, Super Admin → Integraciones → Ingreso desde Template 7. El switch y los segundos se guardan con «Guardar espera». La configuración es global, comienza apagada y conserva 4 segundos como valor inicial. Rango: enteros de 1 a 60, validado en UI, acción de servidor, lectura del gateway y Postgres.

Se mide el tiempo desde que se muestra la tarjeta del usuario; autenticar el casino y confirmar la cookie siguen en paralelo. Si el login tarda más que el mínimo elegido, se ingresa apenas termina. Continuar adelanta la navegación sólo cuando existe una sesión confirmada. La desactivación conserva el número elegido y elimina la pausa de los ingresos siguientes.

Los cuatro gateways comparten `landing-autologuin/src/lib/gateway-entry-settings.ts` y `preparation-page.ts`, sincronizados mediante `scripts/sync-entry-transition.mjs`. El clásico obtiene el usuario del handoff ya autenticado y no ejecuta otro alta ni finalize. El constructor conserva su protocolo `p1`. Sólo se entrega el usuario por la respuesta JSON; no se agregan contraseñas ni datos de cuenta a URLs o storage.

La configuración se lee desde un endpoint autenticado de Atrio, en paralelo con el login, y se incluye en la respuesta existente de preactivación. No agrega un viaje HTTP desde el navegador ni altera el HTML inicial de Template 7. La lectura tiene un timeout de 1,5 s; falta de configuración, error o valor inválido mantienen el acceso inmediato. La recuperación automática directa y el login manual no usan la espera.

La migración de Atrio aplicada es `20261021030508_gateway_entry_redirect_wait.sql`. Tabla singleton `gateway_entry_settings`, RLS activado, sin privilegios para anon/authenticated y política explícita que les deniega acceso. Sólo el servidor escribe después de verificar el rol super_admin y su sesión. No se cambió una preferencia activa de producción: el registro inicial quedó apagado, con 4 segundos. API2 y Panel3 no tienen cambios por este lote.

## Validación

- Pruebas de tiempo y metadatos compartidas: espera desactivada, 4 s, máximo 60 s, valores inválidos, login lento en paralelo, Continuar y navegación única; constructor y clásico.
- Lectura y wrapper: autenticación de servicio, timeout/error seguro, inicio concurrente con login, conservación de ambas cookies y respaldo de sesión, sin configuración en navegación normal.
- Atrio: rechaza admin/asesor/no autenticado/sesión ajena, rechaza campos desconocidos y duraciones fuera de rango; un fallo DB no informa éxito.
- Postgres aislado sin red: defaults, singleton, restricciones 1..60, escritura de servicio, denegación de clientes incluso al simular grants amplios.
- Diez comprobaciones de Chromium/WebKit: 320/390/1366 px, switch, guardar/reabrir, desactivar sin perder segundos, valores inválidos, error al guardar y recorrido de ambos motores. APIs simuladas, cero altas reales y cero cambios de preferencias productivas.
- Suites completas y builds de los cuatro gateways; build/tipado de Atrio, sincronización común y paquete OpenNext de Cloudflare. Dos pruebas externas opcionales del gateway Rey quedan fuera de la suite local.

Artefactos locales: `.vercel/validation-entry-wait/report.json` y `release.json`. Ganamos+ comparte la implementación y publicación del Worker; no se declara un alta real mediante PBAdmin, porque esa integración no existe.
