# Publicación web de recuperación de acceso — 27/10/2026

El usuario autorizó desplegar todas las aplicaciones web disponibles y reservó el despliegue de API2 al programador. Se publicaron los commits previamente probados, sin nuevas modificaciones de aplicación. Rama de los seis repositorios: `fix/template7-session-reentry`.

## Producción verificada

| Aplicación | Commit publicado | Despliegue Vercel activo | Anterior para rollback |
|---|---|---|---|
| Builder | `1ce2f4c5ad5416812fb63d0fe7d53d7783068c3f` | `dpl_4PVCtjsJjFX1AeaCFp3LfvSEcASL` | `dpl_7jKkueVayfcfdySrAhZ8AeubjW4B` |
| Clásico | `217954eee952d4d729ca32071e67c6e4a9fa81ba` | `dpl_2FwrHRikfmAFdfJNAdcrpg2y617L` | `dpl_CPcVw27KXf5K14Vw6XqjscmqQH3U` |
| Rey de Ases | `030cc493a3c5230b0d82d389518cab748ced6226` | `dpl_2mKTCaSYtgdqwzbPEPs1b72kkj11` | `dpl_8o4DhJa5cAD1c8niPypBB6xd9o74` |
| Ases del Norte | `b7bb14cb69221cd22a6abe026ac6728befde131f` | `dpl_J1Ge8hx71gjkkNbwfCpjXwQiGuMs` | `dpl_6kb5pRkGEnkjJZJDGJE7BFy6xPLL` |
| Ganamos NET | `73f907b57513b9cbf96a072a8e2764984393c999` | `dpl_Gdf5YVSeRZtwuJ8qaDgUtnoN1oJq` | `dpl_GXCjPHK8ntS8sfpjYSVFEuogBTqR` |
| Ganamos+ | `2e9859664845f2cbbc9ceb9a2b28e8bc002abccb` | `dpl_C8SuoHC6w6hmFFSKKkmcf6jMcAb8` | `dpl_3c3S793iQKyW9Z7dEBCuMJm7no4h` |

Los seis proyectos terminaron en `READY`; la API de Vercel confirma el despliegue de producción y SHA indicados. Cada publicación partió de un archivo de Git del commit exacto, excluyendo archivos de entorno. Las compilaciones se prepararon sin asignar dominios y se promovieron luego de comprobar el SHA, el estado READY y que producción no hubiera cambiado durante la preparación.

El Worker `multi-skin-gateway`, que sirve `ganamosnet.global`, se compiló mediante OpenNext desde el mismo commit de Ganamos+. Versión activa al 100%: `d5c37012-2039-4cfd-8cff-2add73b861fd`; despliegue Cloudflare: `fafc71e0-586c-44f9-8e25-b2bcc57358cd`. Versión anterior para rollback: `da48127a-b2da-4a51-95f1-388e3cb8e76c`. Compilación y despliegue correctos; no se modificó el relay.

## Comprobación pública

Verificada el 27/10/2026 a las 21:24 de Argentina (28/10 a las 00:24 UTC). Evidencia: [resultados de las comprobaciones](entry-recovery-production-public-20261027.json).

- HTTP 200 en `/diana` del motor clásico, `/l/ganamos-net-demo` de Builder y `/prepare?t=p1.public-deploy-check` de los cuatro gateways.
- Se extrajo `fetchWithEntryRecovery` de cada HTML público y se ejecutó aisladamente en Chromium y WebKit, con transporte simulado: 48 escenarios correctos. Se cubrieron JSON truncado, corte durante la lectura, vencimiento del tiempo de lectura y error HTTP permanente con cuerpo incompleto.
- Las fallas transitorias recuperaron usando el mismo cuerpo/token; el error permanente se devolvió sin repetirlo. El JSON completo sigue dentro del plazo de la solicitud.
- Solo se descargó HTML en producción. No se ejecutaron las páginas reales ni sus scripts de tracking; no se activaron pases, crearon jugadores, emitieron conversiones ni realizaron operaciones financieras.

Las pruebas previas de estos commits comprendieron 3 pruebas unitarias de recuperación, 56 escenarios de navegador con los HTML compilados locales, TypeScript y sincronización compartida. La comprobación pública verifica el código realmente servido, pero no certifica un alta real con API2 y proveedor.

## Dependencia pendiente de confirmación

API2 debe ejecutar `2752ebe34acd4291f051c46283aac96075f123f3` de `feature/atrio-integration`, con la migración `20261027000001_add_atrio_provision_recovery.ts` correctamente aplicada. Ese despliegue corresponde al programador; este paso no confirma el commit que ejecuta API2 ni reintenta el alta de Benja. No se necesita otra migración Builder para esta publicación. Ganamos+ conserva su falta de integración PBAdmin para altas.

El commit de documentación posterior a la publicación no cambia los artefactos de aplicación de la tabla.
