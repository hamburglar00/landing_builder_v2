# Rollback y forward-fix

Plan preparado, no ejecutado. Mantener el panel administrativo suspendido si una etapa queda incompleta; conservar landings, recepción y colas siempre que sea seguro. No resetear la base, vaciar colas, borrar datos ni restaurar un backup sobre producción como reversión automática.

## Vercel

Deployment previo real: dpl_BWmUkha6NhVzCFwMZmfckC1fQXYq, commit a4e752cf58f628813d3979d598b60d480caaac8d.

Antes de 270, ese deployment sigue siendo una referencia válida para la aplicación anterior con 269. **Después de 270 no es un rollback general compatible**: vuelve a leer el secreto desde navegador y depende de la RPC revocada. Después del cambio Edge también envía credenciales/payloads antiguos de teléfonos.

Preparar antes de la ventana un deployment alternativo desde ad436ff1ee3a329c1d6c702d0ce2cbfd05f92981: conserva todas las remediaciones y el lector Inbox anterior, cuya RPC sigue soportada y optimizada por 274. Debe tener REVALIDATION_ENV=production, configuración servidor y validación Node 24; su ID todavía no existe y es un requisito previo. Si falla sólo Inbox, mover aliases a ese artefacto y conservar 274.

Si falla revalidación o autorización de teléfonos, ese mismo código de seguridad puede compartir el defecto. No prometer que volver a ad436 lo arregla: mantener la operación cerrada y preparar forward-fix mínimo. La ingestión pública no requiere revertir todo el panel.

Vercel cambia aliases a un build inmutable; no reconstruye variables al hacer rollback. Una variable corregida en Project Settings requiere un nuevo deployment para quedar efectiva. Ver [Instant Rollback](https://vercel.com/docs/instant-rollback).

## Edge Functions

Registrar las versiones/bundles antes y después de cada una de las tres publicaciones. Baseline: sync-phones v27 (verify_jwt=false), reset-phone-counters v11 (false), reset-phone-messages v4 (true). El helper compartido forma parte de cada bundle.

Esas versiones antiguas no son una reversión segura ordinaria: carecen de la autorización nueva y requieren user_id que los botones nuevos omiten. Ante fallo de una función, suspender sólo su operación manual y aplicar un forward-fix con la misma sesión/owner/admin. Conservar intacta la rama cron de sync y sus credenciales. No desplegar todas las Edge Functions ni cambiar verify_jwt globalmente.

Una reversión excepcional que restaure un handler vulnerable exigiría autorización y aceptación de riesgo específicas, no incluidas aquí. No hay actualmente una segunda versión segura remota para cada handler.

## Migraciones

Cada archivo debe ser transaccional. Si falla antes de COMMIT, rollback de esa transacción; registrar cuáles versiones anteriores sí quedaron aplicadas. Si 270 ya está aplicada, no reabrir el frontend antiguo para resolver la interrupción.

- 269: corregir consumidor/grant de columna concreto si el contrato legítimo lo demuestra; conservar protección de role/id/created_at.
- 270: conservar secreto fuera del navegador y grants mínimos. No devolver verify_revalidate_secret a roles públicos ni reintroducir URL editable con credenciales.
- 271: conservar aislamiento e inmutabilidad. Revisar el caso real con fixtures y forward-fix; no recrear All users can select gerencia phones.
- 272/273: mantener denegaciones de TRUNCATE/EXECUTE. Cualquier excepción requiere acreditar consumidor y conceder únicamente lo necesario mediante una migración nueva revisada.
- 274: primero revertir sólo el lector Inbox al artefacto compatible. Mantener la RPC histórica optimizada. Si hubiera una regresión SQL, crear una migración correctiva tras reproducirla; no editar el archivo aplicado ni subir el timeout. Retirar helpers/wrappers sólo cuando no tengan consumidores; sin CASCADE.

No se promete un down.sql automático: restaurar ACL históricos generales reintroduce vulnerabilidades. Las pruebas de rollback de datos sintéticos acreditan atomicidad, no una reversión productiva completa.

## Variables y secreto

Antes de configurar, registrar únicamente nombres/ámbitos/tipos y versión de configuración, nunca valores. REVALIDATION_ENV es nueva; quitarla desactiva revalidación, no restaura el flujo seguro anterior. Conservar las claves privadas existentes. No copiar una service-role a NEXT_PUBLIC ni a Preview.

Si se rota la credencial de revalidación en la operación separada, coordinar settings y receptor clásico; constructor usa la misma base. No volver al secreto potencialmente expuesto para facilitar rollback. Confirmar acuerdo servidor-servidor sin imprimir valores. Si falta acuerdo, dejar publicación cerrada y conservar guardado.

## Criterios de activación

Fuga de tenant/secreto, cambio de negocio, error persistente en consumidores legítimos, RPC inexistente, 57014 recurrente, bloqueo que exceda el presupuesto o aumento sostenido del backlog: detener promoción/reapertura. Si aún no se aplicó 270, puede mantenerse la aplicación anterior; si ya se aplicó, usar artefacto compatible o forward-fix. Nunca resolver una falla ampliando permisos de forma general.

Backups/PITR son recuperación ante desastre y tienen riesgo de perder eventos posteriores; no son el rollback de este release. No se ejecutó ni se acreditó un ensayo de restauración productiva en este pase.
