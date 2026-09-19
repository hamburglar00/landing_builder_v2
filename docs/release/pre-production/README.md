# Preparación para producción

Preparación completada el 19 de septiembre de 2026. **Lista para solicitar autorización de la ventana; producción no modificada ni autorizada para desplegar. Riesgo residual medio, condicionado al runbook y su aceptación.** Esta evaluación operativa no cierra hallazgos de seguridad ajenos al release. No hubo push, deploy, cambios de variables, rotaciones ni escrituras remotas.

El cierre incluye la excepción autorizada por el usuario: 44 archivos temporales externos, 46.106.759 bytes, permanecen fuera del repositorio por `blocked by policy`. No hay temporales dentro del repositorio, staged o incluidos en el checkpoint, ni recursos Docker propios residuales. No se volvió a intentar eliminarlos ni se cambiaron permisos. Sus rutas exactas, auditoría y eliminación manual opcional están en [recuperación](recovery.md) e [inventario externo](recovery.json). La revalidación documental funciona sin leer esos archivos.

## Baseline acreditado

Vercel sirve el commit `a4e752cf58f628813d3979d598b60d480caaac8d`, rama main, proyecto landing-builder-v2-k259, deployment `dpl_BWmUkha6NhVzCFwMZmfckC1fQXYq`. El alias mkt.panelbotadmin.com se consultó por separado y apunta a ese deployment. constructor.panelbotadmin.com también figura entre sus dominios. Root Directory actual: frontend; runtime del deployment: Node 24.x.

Después de fetch, origin/main coincide con ese commit. Esto fue comprobado, no supuesto. El candidato validado es `835fdc08a5940e72ae54db3b53c947a0786dc4db`; su aplicación es idéntica a 6287c9ae, objeto del inventario anterior. Supabase fdkjkzpjqfbaavylapun conserva 268 migraciones, hasta 20260915190657, y PostgreSQL 17.6.1.063. Las seis migraciones 269–274 no están aplicadas. Las tres Edge Functions administrativas conservan sus fuentes anteriores, acreditadas por hash con el baseline Git; una difiere únicamente en finales de línea.

El inventario de código anterior conserva **10 commits y 324 archivos: 304 agregados, 19 modificados y uno retirado del seguimiento**. El candidato actual añade nueve documentos, dando once commits y 333 archivos frente al baseline. Este checkpoint vuelve a cambiar únicamente documentación. Son 29 archivos de código/migraciones con impacto operativo; el inventario distingue las demás categorías y sus superposiciones. La baja es .env: sigue físicamente local, ignorado y no rastreado; no se leyó su contenido ni su blob histórico. Este checkpoint documental será un commit adicional y no cambia el candidato de aplicación auditado.

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

## Preparación resuelta y autorizaciones pendientes

- **B1 — Procedimiento resuelto; escritura pendiente:** REVALIDATION_ENV sigue ausente. Configurar production en Vercel Production y crear un nuevo deployment requiere autorización. Sin ella revalidación falla cerrada. Ver [variables](environment-check.json).
- **B2 — Ventana diseñada:** pausa administrativa, recarga, orden y reapertura están en [operational-runbook.md](operational-runbook.md). No existe un interruptor de mantenimiento implementado; es una pausa operativa. Un bloqueo técnico adicional requeriría una regla autorizada limitada al panel.
- **B3 — Node 24 y reversión resueltos localmente:** v24.21.0/npm 11.19.0; lockfile, TypeScript, 57/57 tests y build real npm run build aprobados. Baseline y alternativa ad436ff1 también compilan. El baseline es incompatible después de 270; la alternativa conserva seguridad y permite revertir el lector Inbox. Falta crear sus deployments Production. [Candidato](candidate.json) y [reversión](rollback-artifact.json).
- **B4 — Clásico acreditado:** Vercel public-landing-bl sirve el commit 3322b634 de public_landing_bl desde la raíz. POST name/secret es compatible; siete pruebas sintéticas con el código desplegado aprobaron. No necesita cambio de código. El acuerdo de credenciales reales requiere un smoke autorizado; no se leyeron ni probaron valores. Rotación servidor separada o aceptación explícita del riesgo residual mientras se programa. [Contrato](classic-receiver.json).
- **B5 — Data API y ejecución resueltas:** exposición remota public/graphql_public; private/inbox_private excluidos. Coinciden 61 relaciones y 84 firmas públicas; GraphQL conserva el stub sin extensión habilitada documentado aparte en 1A. El ejecutor CLI con límites y rollback transaccional fue probado localmente. [Data API](data-api.json).
- **Ensayo completado:** 274/274, 191 controles de transiciones/seguridad, 36 de Inbox y una conclusión de rollback aprobados. Una segunda provisión 274 completó el Inbox tras un timeout exclusivo del oráculo histórico; el fallo y la corrección local se conservan. Ningún timeout de aplicación cambió. Resumen 111,4 ms, detalle 14,6 ms, 20.987 bytes y cero mensajes precargados. [Ensayo](rollout-rehearsal.json).

No queda una dependencia de investigación local sin resolver. Pendientes de autorización/ejecución: configuración y deployments Production; ventana y seis migraciones; tres publicaciones Edge; promoción y aceptación con fixtures controlados; coordinación de la rotación futura. Los builds locales usaron configuración sintética y se retiraron tras extraer manifiestos; los archivos fuente y de apoyo externos se conservan por la excepción autorizada. No publicar bundles sintéticos con --prebuilt.

El riesgo previo de 1B.5 sigue aceptado y diferido; no bloquea por sí solo estas remediaciones. Los advisors actuales arrojan 104 hallazgos de seguridad en seis categorías y 427 de rendimiento en siete. No equivalen a nuevos fallos del release ni están todos dentro de este alcance; quedan documentados con enlaces oficiales en el baseline, sin corregir otros hallazgos.

## Plan y límites

Orden: configuración y artefactos → ventana del panel → migraciones 269, 270, 271, 272, 273, 274 → tres Edge Functions → aplicación Vercel → smoke tests y reapertura. No ejecutar un push a main como primer paso: el vínculo Git puede publicar el frontend antes de completar sus dependencias. [Runbook cronológico](operational-runbook.md) y [coexistencia](rollout.md).

Se reutilizó evidencia histórica no afectada y se agregó validación Node 24, contrato clásico y ensayo sintético dirigido. No se ejecutó ESLint otra vez ni se modificó aplicación o migraciones. Cliente y servidor se inspeccionaron por separado; 80 assets cliente no contienen el canario privado. Las consultas remotas fueron GET o transacciones READ ONLY de 1,5 segundos, con lock_timeout de 250 ms. No se invocaron endpoints de negocio ni se leyeron archivos .env. Los reportes conservan metadatos/agregados, no mensajes ni secretos.

[Baseline desplegado](deployed-baseline.json) · [Migraciones](migration-plan.md) · [Variables](environment-check.json) · [Smoke tests](smoke-tests.md) · [Rollback](rollback.md) · [Revisión e integridad](review.json).

Referencias de evidencia: [Fase 0](../../optimization/phase-0/README.md), [1A](../../security/phase-1a/README.md), [1B.1](../../security/phase-1b1/README.md), [1B.2](../../security/phase-1b2/implementation.md), [1B.3](../../security/phase-1b3/implementation.md), [1B.4](../../security/phase-1b4/README.md), [1B.5 diferida](../../security/phase-1b5/README.md) e [Inbox](../../optimization/inbox/README.md).
