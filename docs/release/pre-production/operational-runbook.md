# Ventana de publicación

Procedimiento futuro, **no autorizado para ejecutar en producción en este pase**. Candidato validado: `835fdc08a5940e72ae54db3b53c947a0786dc4db`; el checkpoint de estos documentos sólo agrega documentación. Proyecto Vercel: landing-builder-v2-k259, Root Directory frontend, Node 24.x. Supabase: fdkjkzpjqfbaavylapun. No publicar primero mediante push a main: podría activar Vercel antes de sus dependencias.

Responsables por capacidad acreditada: coordinador del panel, operador autorizado de Supabase y operador autorizado del equipo Vercel. La metadata acredita proyectos y equipo, no la persona de guardia. Quien autorice la ventana deberá asignarla. Duraciones productivas no medidas: los tres builds locales tardaron aproximadamente 3–4 minutos cada uno; esto no estima la cola de Vercel. Reservar una ventana que incluya dos builds y aceptación humana, sin prometer una duración cerrada. Los tiempos locales de las seis migraciones están en [rollout-rehearsal.json](rollout-rehearsal.json).

1. **Aviso — coordinador.** Comunicar suspensión de administración/publicación y hora de revisión. Confirmar operadores, cuentas sintéticas A/B/admin, landings y canal de prueba. Mantener landings, ingestión, workers y colas funcionando. Registrar sólo identificadores técnicos y agregados.
2. **Pausa del panel — coordinador.** Detener las operaciones administrativas de los usuarios activos. No existe un interruptor de mantenimiento acreditado en el código: esta es una pausa operativa coordinada, no un bloqueo técnico ya implementado. Si se exige bloqueo técnico, acordar una regla limitada al panel y sus rutas administrativas antes de ejecutar; no activar protección global de Vercel que corte landings o webhooks.
3. **Pestañas antiguas — coordinador.** Pedir cerrar pestañas y suspender acciones pendientes. Al reabrir, exigir recarga completa y comprobar la versión nueva. Entre 270 y la promoción habrá incompatibilidades deliberadas; no restaurar permisos para ocultarlas.
4. **Configuración y artefactos — operador Vercel.** Confirmar proyecto/Production y agregar únicamente REVALIDATION_ENV con valor no secreto production. Verificar su presencia por nombre. Crear deployments Production del candidato y de la alternativa ad436ff1 sin asignar dominios; registrar IDs y esperar estado READY. El clásico ya es compatible por código. El acuerdo entre credenciales existentes se verifica después mediante una publicación controlada autorizada, sin imprimir valores. No rotar como parte implícita de este paso.
5. **Migraciones — operador Supabase.** Revalidar ledger 268, hashes, schemas public/graphql_public, índices y locks por metadata acotada. El dry-run debe listar exactamente las seis versiones 269–274. Aplicarlas secuencialmente con la CLI y los límites probados abajo. Ante timeout, detener; no matar sesiones ajenas ni aumentar límites. Confirmar ledger 274 y ACL efectivos. No reaplicar históricos o SQL de compatibilidad local.
6. **Edge — operador Supabase.** Publicar solamente sync-phones, reset-phone-counters y reset-phone-messages, en ese orden. Conservar verify_jwt false/false/true. Registrar versiones y bundles nuevos; verificar OPTIONS y casos sintéticos autorizados. No publicar otras funciones ni ejecutar un cron/reset real para comprobar permisos.
7. **Vercel — operador Vercel.** Promover el deployment candidato Production ya construido. Verificar aliases, commit y estado. El fallback compatible debe estar READY antes de la reapertura; su ID no existe todavía en producción. No promover Preview ni el baseline a4e752 después de 270.
8. **Aceptación — operadores y coordinador.** Ejecutar [smoke-tests.md](smoke-tests.md): aislamiento, nombre, teléfonos, revalidación clásica/constructor, público, Inbox, ACL y agregados de cola. Cero secreto en respuestas y cero fuga entre tenants. Nada de HAR con auth o cuerpos reales. Un GET sin sesión sólo acredita denegación, no publicación legítima.
9. **Reapertura — coordinador.** Sólo tras todos los controles. Recarga completa de clientes, confirmación del nuevo contrato y operación normal. Si falla una operación, mantenerla suspendida y preservar la recepción pública.
10. **Observación — operadores.** Comparar errores/latencia/backlog agregados con el baseline. Observar al menos dos ciclos naturales de sync/worker; verificar el reset diario en su horario natural. Un job SQL exitoso no prueba el HTTP posterior. Programar aparte la rotación del secreto históricamente accesible al navegador.
11. **Rollback — operador según componente.** Antes de 270 se puede mantener el deployment previo. Después, si falla sólo el lector Inbox, promover el fallback ad436ff1 conservando 274. Si hay fuga, fallo de autorización o revalidación, cerrar la operación y hacer forward-fix; ese fallback comparte el código de seguridad. No volver a handlers vulnerables, grants públicos, secretos viejos ni restaurar backups sobre eventos nuevos. Ver [rollback.md](rollback.md).

## Comandos futuros, con puntos de control

Ayuda de Vercel 50.34.3 y Supabase 2.75.0 consultada. Ejecutar únicamente tras autorización remota y desde copias aisladas del commit correcto, vinculadas al proyecto acreditado. No copiar variables a archivos locales.

```text
vercel env add REVALIDATION_ENV production --value production --yes
vercel env ls production
vercel deploy --prod --skip-domain
```

El último comando se ejecutará una vez desde el candidato y otra desde ad436ff1, con Root Directory frontend y configuración Production. No usar --prebuilt: los bundles locales contienen configuración sintética. Guardar los dos IDs nuevos, no inventarlos. La configuración de Project Settings no cambia un deployment anterior.

El ejecutor CLI fue probado localmente con límites efectivos y rollback del archivo fallido junto con su entrada de ledger. Esta versión usa pgconn: **PGOPTIONS no acredita estos límites**. Crear un archivo temporal de servicio PostgreSQL que contenga exclusivamente:

```ini
[release-bounded]
lock_timeout=5s
statement_timeout=45s
```

En el proceso de la CLI, asignar PGSERVICEFILE a ese archivo y PGSERVICE a release-bounded. Conservar/restaurar cualquier valor previo de ambas variables del proceso y retirar sólo ese archivo propio al finalizar. El archivo no lleva host, usuario, contraseña ni token. Usar las credenciales ya configuradas por el procedimiento autorizado; nunca ponerlas en documentación o argumentos visibles.

```text
supabase db push --linked --dry-run
supabase db push --linked --yes
```

Confirmar entre ambos comandos que sólo aparecen las seis versiones previstas. No usar --include-all, --include-roles, --include-seed, reset, repair o cambios de extensiones. Los 45 segundos son un límite por statement de la conexión, no una promesa de tiempo total. La CLI ejecuta cada archivo y su ledger en una transacción; la prueba local confirmó ausencia de efectos parciales ante un error intencional.

```text
supabase functions deploy sync-phones --project-ref fdkjkzpjqfbaavylapun --no-verify-jwt
supabase functions deploy reset-phone-counters --project-ref fdkjkzpjqfbaavylapun --no-verify-jwt
supabase functions deploy reset-phone-messages --project-ref fdkjkzpjqfbaavylapun
vercel promote <candidate-deployment-id>
```

Rollback limitado al Inbox, si corresponde: `vercel promote <compatible-fallback-deployment-id>`. No se proporciona un rollback Edge antiguo porque restituiría su autorización insegura. La publicación remota, los fixtures remotos y cualquier rotación requieren autorización; este runbook no la concede.

Evidencia: [candidato](candidate.json), [artefactos de reversión](rollback-artifact.json), [clásico](classic-receiver.json), [Data API](data-api.json), [Edge](edge-functions.json), [ensayo](rollout-rehearsal.json). Plataforma: [CLI y transacción](https://github.com/supabase/cli/blob/v2.75.0/pkg/migration/file.go), [configuración pgconn](https://github.com/jackc/pgconn/blob/v1.14.3/config.go), [promoción Vercel](https://vercel.com/docs/deployments/promoting-a-deployment).
