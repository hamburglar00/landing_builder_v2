# Cierre de publicación y entrega a API2/Panel3

Autorización: publicar todo lo administrado por nosotros y subir API2/Panel3 para que su programador migre y despliegue. Las notas históricas «solo local» dejan de aplicar al commit/push de estos dos repositorios; no se tocó su producción.

## Aplicaciones productivas verificadas

| Aplicación | Commit de aplicación | Deployment READY |
| --- | --- | --- |
| Builder | `8aa021d` | `dpl_Fu7CQ5Ww1SAYovXjPi7D9R2Yi4Ez` |
| Renderer clásico | `5eb1e22` | `dpl_coYsuqhe5468exfWrQ95W88N7eBt` |
| Atrio | `6cecca8` | `dpl_9W65pnABVU1ppdqFVT8H53ssi5wS` |
| Rey de Ases | `f94a3c4` | `dpl_8iriSTWV5PA9geu2bpC7B8r5rn8E` |
| Ases del Norte | `1c317a7` | `dpl_E8fGPcnQHfD7duHEvmr8xjQzBQoR` |
| Ganamos NET | `3404de0` | `dpl_7PS7V6begz59AE3tT2KuePe72vCn` |
| Ganamos+ | `6205c17` | `dpl_79X9b8rbs5bDUQ4pqD5SvA2ArAf9` |

Ganamos+ sirve `ganamosnet.global` mediante Cloudflare, versión `123cb603-9661-48e0-b121-9646f5a09e4b` al 100 %. Estas aplicaciones ya estaban publicadas con los últimos cambios: se verificaron sin redeploy innecesario. Los cambios posteriores de esta entrega en Builder son documentación.

Los cuatro `/home` entregan el formulario actualizado al solicitar HTML, con «Tu plataforma y tu asesor»; la respuesta sin sesión conserva su HTTP 401 esperado. Builder y login de Atrio responden HTTP 200. SDK, ingreso compartido y catálogo multi skin pasaron sus comprobaciones de sincronización.

## Supabase y funciones

Builder: 313 versiones locales/remotas coincidentes, hasta `20261105193317`. Atrio: 159, hasta `20261105222333`. No hay migraciones pendientes; no se reejecutó DDL ya aplicado.

Se revisaron las 34 funciones de Builder y las tres de Atrio, junto con sus imports. Se encontraron dos diferencias funcionales y se publicaron:

- `conversions-test` **v15**: incorpora el helper compartido vigente para el evento configurado del CTA; mantiene `verify_jwt=false` y su validación interna de usuario.
- `whatsapp-cloud-send-message` **v4**: usa el `last_inbound_at` del contacto, con fallback al historial de eventos; mantiene `verify_jwt=true`.

Ambas quedaron ACTIVE, con fuentes remotas comparadas contra las locales. 31 pruebas Deno y chequeo de tipos de ambas funciones aprobados. El acceso público sin autorización devuelve 405/401 según su contrato; no se enviaron eventos Meta ni mensajes a clientes para probar.

Las otras diferencias detectadas eran formato (BOM/newline) y el código transpileado de la función histórica `sync-telegram-connections`, descargada en un directorio aislado porque la API de extracción no soportó ese bundle antiguo. No se sobrescribieron los archivos de trabajo al inspeccionarla.

## Entrega externa

API2 integró `3fe01b5b` (cuenta HG por CBU/alias) sin conflictos; Panel3 no tenía novedades remotas. Se preservaron backups completos antes del pull y el stash de API2. Se excluyen entornos privados y caché TypeScript del commit.

[Guía para el programador, con ocho migraciones, orden, ejecutor limitado y configuración](https://github.com/johndoe-cloud2/api2/blob/feature/atrio-integration/docs/releases/20261105-deploy.md).

Las funciones de Extensiones y de gerencia que necesitan API2 seguirán dependiendo de que se complete esa guía. Los subdominios nuevos por skin continúan pendientes del dominio elegido y DNS/HTTPS.
