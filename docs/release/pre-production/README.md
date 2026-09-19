# Preparación para producción

Auditoría de lectura del 19 de septiembre de 2026. **Completa como auditoría documental; despliegue bloqueado. Riesgo general alto por coordinación y compatibilidad.** No hubo push, deploy, cambios de variables, rotaciones ni escrituras remotas.

## Baseline acreditado

Vercel sirve el commit `a4e752cf58f628813d3979d598b60d480caaac8d`, rama main, proyecto landing-builder-v2-k259, deployment `dpl_BWmUkha6NhVzCFwMZmfckC1fQXYq`. El alias mkt.panelbotadmin.com se consultó por separado y apunta a ese deployment. constructor.panelbotadmin.com también figura entre sus dominios. Root Directory actual: frontend; runtime del deployment: Node 24.x.

Después de fetch, origin/main coincide con ese commit. Esto fue comprobado, no supuesto. El candidato local es `6287c9ae0b22737f5e7df6fd95d85cf3c3bc6e12`. Supabase fdkjkzpjqfbaavylapun conserva 268 migraciones, hasta 20260915190657, y PostgreSQL 17.6.1.063. Las seis migraciones 269–274 no están aplicadas. Las tres Edge Functions administrativas conservan sus fuentes anteriores, acreditadas por hash con el baseline Git; una difiere únicamente en finales de línea.

La diferencia contiene **10 commits y 324 archivos: 304 agregados, 19 modificados y uno retirado del seguimiento**. Son 29 archivos de código/migraciones con impacto operativo; el inventario distingue las demás categorías y sus superposiciones. La baja es .env: sigue físicamente local, ignorado y no rastreado; no se leyó su contenido ni su blob histórico. Este checkpoint documental será un commit adicional y no cambia el candidato de aplicación auditado.

## Estado por fase

| Fase | Estado y contenido del release |
| --- | --- |
| 0 | Bootstrap y evidencia sintética; dos reconstrucciones 268/268, 446 comprobaciones. Incluye tres excepciones históricas para reconstrucción local; no reaplicarlas remotamente. |
| 1A | Diseño e inventario de acceso; documentación, sin remediación por sí misma. |
| 1B.1 | Migración 269: nombre propio editable; campos administrativos protegidos. 536 comprobaciones acreditadas. |
| 1B.2 | Migración 270 y consumidores seguros: secreto de revalidación exclusivamente servidor, destinos fijos y estado booleano. Requiere configuración y coordinación con el receptor clásico. |
| 1B.3 | Migración 271, tres handlers y clientes: administración de teléfonos por sesión y owner/admin; dos cron pierden EXECUTE público y mantienen postgres. |
| 1B.4 | Migraciones 272–273: privilegios internos, guarda de identidad nula, TRUNCATE retirado en 42/42 tablas localmente. |
| 1B.5 | **Diferida voluntariamente, implementación no iniciada.** conversions sigue sin autenticación criptográfica propia. No hay protección HMAC implementada. |
| Inbox | Migración 274 y carga acotada. Reconstrucción 274/274; listado local 94,5 ms, 20.987 bytes frente a 257.446; cero mensajes precargados. No es un resultado productivo desplegado. |

Las fuentes y hashes de los 324 archivos y los diez commits están en [release-inventory.json](release-inventory.json). Las revisiones antiguas describen snapshots de su checkpoint; sus contadores de staging/deploy no son el estado Git actual. Algunos hashes históricos corresponden a bytes Windows con finales mixtos, mientras Git conserva LF. El inventario de este release registra ambos hashes y verifica su equivalencia. La página Admin Tests de 1B.2 fue modificada legítimamente en 1B.3 y su evidencia vigente es la posterior.

## Bloqueos y condiciones de salida

1. **B1 — Configuración faltante:** REVALIDATION_ENV no existe en Vercel Production. Debe configurarse como production y entrar en un nuevo deployment; hoy el candidato falla cerrado en revalidación. Las demás credenciales requeridas existen por nombre, sin validación de sus valores.
2. **B2 — Ventana coordinada:** aprobar y ejecutar una suspensión breve de administración/publicación, con recarga de clientes antiguos. No hay una secuencia sin incompatibilidad temporal para secreto/teléfonos con estos artefactos exactos.
3. **B3 — Artefactos de despliegue y reversión:** preparar y verificar el candidato y una alternativa compatible bajo Node 24. La evidencia local usa Node 22.12.0. No se ejecutó otro build en esta auditoría ni existe aún un deployment de rollback compatible identificado.
4. **B4 — Contrato clásico y secreto:** acreditar versión efectiva del receptor, respuesta esperada sin redirects y acuerdo de credencial sin revelarla. Coordinar su rotación posterior al cierre de accesos o aceptar expresamente su riesgo residual mientras se programa. No se reabrió ni modificó el repositorio clásico.
5. **B5 — Preflight final:** confirmar que inbox_private/private no están expuestos por Data API, vigencia de los seis hashes, control de locks y disponibilidad de cuentas/canal de prueba. La configuración local los excluye; la lista remota de esquemas no se pudo acreditar desde la sesión SQL y no se interpreta un valor null como lista vacía.

El riesgo previo de 1B.5 sigue aceptado y diferido; no bloquea por sí solo estas remediaciones. Los advisors actuales arrojan 104 hallazgos de seguridad en seis categorías y 427 de rendimiento en siete. No equivalen a nuevos fallos del release ni están todos dentro de este alcance; quedan documentados con enlaces oficiales en el baseline, sin corregir otros hallazgos.

## Plan y límites

Orden: configuración y artefactos → ventana del panel → migraciones 269, 270, 271, 272, 273, 274 → tres Edge Functions → aplicación Vercel → smoke tests y reapertura. No ejecutar un push a main como primer paso: el vínculo Git puede publicar el frontend antes de completar sus dependencias. [Rollout detallado](rollout.md).

Se reutilizó evidencia funcional vigente; no se repitieron suites, reconstrucciones, TypeScript, build o ESLint. Las consultas remotas fueron GET o transacciones READ ONLY de 1,5 segundos, con lock_timeout de 250 ms. No se invocaron endpoints de negocio ni se leyeron archivos .env. Los reportes conservan metadatos/agregados, no mensajes ni secretos.

[Baseline desplegado](deployed-baseline.json) · [Migraciones](migration-plan.md) · [Variables](environment-check.json) · [Smoke tests](smoke-tests.md) · [Rollback](rollback.md) · [Revisión e integridad](review.json).

Referencias de evidencia: [Fase 0](../../optimization/phase-0/README.md), [1A](../../security/phase-1a/README.md), [1B.1](../../security/phase-1b1/README.md), [1B.2](../../security/phase-1b2/implementation.md), [1B.3](../../security/phase-1b3/implementation.md), [1B.4](../../security/phase-1b4/README.md), [1B.5 diferida](../../security/phase-1b5/README.md) e [Inbox](../../optimization/inbox/README.md).
