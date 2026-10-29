# Recuperación de altas antiguas — 28/10/2026

> Etapa anterior, conservada como registro. El acuerdo posterior autoriza sustituir candidatos no vinculados y modifica las guardas de recuperación. Entrega y migraciones vigentes: [altas, widget y Kobe](safe-entry-widget-kobe-20261028.md).

El navegador de Benja retomaba el intento `benja6168` del día anterior. El registro estaba `uncertain`, sin cuenta de plataforma confirmada; la recuperación se detenía tras una ejecución porque el presupuesto de 24 horas usaba la fecha original. Incógnito creó otra identidad y `ropero8960`. El saldo de esa segunda cuenta se verificó en 1.200 ARS y el usuario confirmó que faltaba actualizar la página; no forma parte de este cambio.

## Comportamiento entregado

- Ajuste posterior del usuario: conservar el alta rápida con su nombre. Las cuentas nuevas Atrio llevan seis cifras. Un rechazo explícito de nombre ocupado conserva una prueba durable (`username_conflict`), verifica si era la cuenta del mismo intento y, solo con una prueba suficiente de que no es utilizable para este intento, reserva otra variante de forma atómica. Un éxito inicial sigue haciendo una única creación; las colisiones confirmadas no agregan pausas artificiales. No se implementaron cuentas precreadas ni se modificaron usuarios existentes.

- API2 guarda `recovery_started_at` al reservar o reactivar una recuperación detenida. Conserva `created_at`, identidad y credenciales; las peticiones repetidas no prolongan una ventana ya activa. Una recuperación anterior al despliegue sin fecha de ventana la obtiene al ser reclamada, sin activar masivamente filas detenidas.
- Endpoint privado `GET /api/v2/bot/atrio/advisors/:advisor/players/:player/entry-status?manager_id=…&agency_id=…`, protegido por las API keys existentes. Exige manager y gerencia explícitos, valida permisos y scope y devuelve `pending`, `completed` o `absent`. No devuelve usuario/clave, no llama al proveedor ni modifica el intento.
- Atrio busca la identidad del dispositivo y la cuenta de la conexión exacta. Si falta la cuenta, solo recupera automáticamente un intento de API2 del mismo contexto y landing. Incluye selección por pool y asesor fijo. Un fallo de consulta no se interpreta como ausencia ni autoriza otra cuenta.
- Constructor y clásico retoman el nombre y la promo almacenados. El clásico sin pool también consulta la identidad y muestra la transición durante la recuperación. Se conserva el mismo recorrido de verificación, vinculación y autologin.
- Transporte compartido: presupuesto total de 30 segundos, máximo 15 segundos por petición, sin esperar un `Retry-After` que exceda ese presupuesto. La página del gateway cambia el feedback a los 8 segundos; a los 45 segundos permite retomar. Las respuestas tardías no pueden navegar ni activar otro paso de una ejecución descartada. El siguiente intento conserva el mismo token.
- Fuente de transición: `landing-autologuin/src/lib/preparation-page.ts`, sincronizada y comprobada con `scripts/sync-preparation-page.mjs`. Transporte: `frontend/lib/reyDeAses/request-recovery.ts`, sincronizado con `scripts/sync-entry-recovery.mjs`.

## Cobertura por destino

| Destino | Cambio común | Alta |
| --- | --- | --- |
| Rey de Ases | Detección, transporte y transición | Conciliar pertenencia y clave; no repetir un alta incierta |
| Ases del Norte | Detección, transporte y transición | Conciliar pertenencia y clave; no repetir un formulario posiblemente enviado |
| Ganamos NET | Detección, transporte y transición | Mismo usuario/clave; repetir solo con ausencia comprobada |
| Ganamos+ | Transporte y transición, también en el código que sirve el Worker | Conserva su integración actual; sin alta PBAdmin ni sustitución por NET |

## Validación local

- API2: pruebas de provisión, proveedores, diagnósticos, estado privado, recuperación y variantes de nombre; TypeScript. MySQL 8.4 descartable: migraciones UP/DOWN, SQL manual idempotente, concurrencia, retorno de un intento de dos días y sustitución exclusiva de un nombre rechazado. Red externa de negocio bloqueada. Resultado final del backend en `api2/docs/validation/atrio-entry-recovery-20261028.md`.
- Atrio: 4 pruebas de identidad recordada y preparación privada aprobadas, incluida la respuesta plana real de API2, errores de scope y exclusión de Plus de altas PBAdmin; TypeScript aprobado.
- Builder: 15 pruebas aprobadas del runtime compilado, regreso con/sin pool, ambos motores, transporte cortado, JSON truncado, límite total y `Retry-After`; TypeScript aprobado en Builder y clásico.
- Gateways: 21 regresiones de preparación aprobadas por cada proveedor (84), incluidos usuario/clave, espera configurada, timeout de login, respuesta tardía y retoma con el mismo token; TypeScript aprobado en los cuatro. La transición aborta las solicitudes de login descartadas para impedir que una respuesta tardía reemplace la cookie de otro intento.
- `node scripts/check-entry-recovery.mjs`: 64 escenarios reales en Chromium y WebKit con ambos motores y las cuatro páginas de gateway compiladas; todos los requests de negocio interceptados.

No se crearon usuarios, no se reintentó Benja y no se realizaron operaciones financieras reales. Las pruebas simuladas no certifican disponibilidad del proveedor en producción.

## Despliegue pendiente

1. API2 se actualizó por `git pull --ff-only origin feature/atrio-integration` hasta `dc7f3a61`, incluyendo el SQL manual del programador. Este cambio permanece local y el despliegue corresponde al programador.
2. Aplicar **una** alternativa antes del código nuevo de API2: `database/migrations/2026_10_28_000001_atrio_recovery_window.sql` (SQL manual idempotente), o `20261028000001_add_atrio_recovery_window.ts` por Adonis. No aplicar ambos mecanismos. La migración anterior de recuperación debe estar instalada. La nueva migración no reescribe intentos ni toca tablas financieras.
3. Desplegar API2 y comprobar el endpoint de estado. Luego publicar Atrio, Builder, clásico y los cuatro gateways. Ganamos+ incluye Vercel y su Worker. No publicar el nuevo lector web de pendientes antes de que API2 ofrezca ese endpoint.
4. El regreso del mismo navegador debe conservar el intento original, conciliar/crear según el proveedor, mostrar únicamente credenciales confirmadas y finalizar el acceso. Si el proveedor no responde, debe aparecer feedback y una acción para retomar, sin spinner indefinido.

Rollback: volver al código web anterior y mantener la columna aditiva. Antes de volver a un API2 que no reconoce `username_conflict`, resolver los intentos en ese estado con el código nuevo; no convertirlos manualmente en éxitos ni repetir altas inciertas. No eliminar la columna mientras el código nuevo siga ejecutándose.
