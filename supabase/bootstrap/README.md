# Bootstrap del historial legado, exclusivamente local/CI

## Compatibilidad post-histórica autorizada

Después de las 268 migraciones y antes de las incrementales, el runner aplica `local-security-compatibility.sql`, sellado en `compatibility-manifest.json`. Reproduce únicamente la función/event trigger de RLS verificados contra el patrón oficial y los cuatro flags de tablas acreditados. No es una migración desplegable. `security-reference.json` permite comprobar íntegramente definición, propietarios, ACL, políticas y flags; cualquier diferencia aborta.

Cada reconstrucción ejecuta 61 pruebas sintéticas con rollback sobre las cuatro tablas y los roles anon/authenticated/service_role, incluido el permiso TRUNCATE inseguro que existe remotamente. No se endurece solo el local. Las dos reconstrucciones con la capa completaron 268/268 con fingerprints idénticos.

El comparador ignora solo orden físico de columnas y acepta diferencias de plataforma exactas y acreditadas. pg_net está resuelto mediante instalación nativa 0.19.5 antes del historial, con el hook antiguo evitado solo durante esa transacción. La seguridad completa se valida tras las 268 migraciones. Ver docs/optimization/phase-0/phase0b-pg-net-resolution.md. No hay diferencias pendientes.

Comando canónico desde la raíz del repositorio:

```text
node scripts/phase0/run-bootstrap-validation.mjs
```

Estado actual y resultado de las reconstrucciones: `docs/optimization/phase-0/bootstrap-validation.json` e informe `docs/optimization/phase-0/phase0b-bootstrap-report.md`. El defecto de secuencia vacía de `20260325201000` está corregido por autorización expresa y tiene seis pruebas independientes. Esto no acredita por sí solo el éxito de las 268 migraciones.

El runner intenta dos reconstrucciones limpias consecutivas y compara sus fingerprints solo si ambas completan todas las migraciones. Se detiene al primer error. El CLI estándar `supabase db reset` sigue siendo insuficiente porque ordena el historial legado por nombre; no usarlo como sustituto del adaptador.

## Una única fuente de esquema

`legacy-manifest.json` contiene 268 rutas, versiones, hashes SHA256, dependencias, orden y justificaciones. Solo referencia los SQL originales de `supabase/migrations`; no contiene copias de sus definiciones. El corte legado es `20260915190657`. Cada versión se ejecuta una sola vez por reconstrucción y se registra en el ledger local solo después de su SQL, en la misma transacción.

La excepción `20260427180000` recupera los seis statements remotos, agregando sus terminadores de archivo. `20260427190000` sustituye únicamente URL y autorización por settings sintéticos, conforme a la aprobación expresa. La procedencia y ambos hashes están en `phase0b-recovery-provenance.json`. No recuperar el Bearer histórico, tampoco para normalizar comparaciones.

La tercera excepción de contenido es `20260325201000`: consulta el mínimo real en pg_sequence para la tabla vacía, con is_called=false; con filas conserva MAX(internal_id), true. Evidencia antes/después: `phase0b-sequence-exception.md` y `bootstrap-sequence-contracts.json`.

La dependencia descubierta de pixel_id se resuelve adelantando íntegro su proveedor `20260426007000`, sin modificarlo. Antes de ejecutarlo se exige que conversions y conversions_config estén vacías. Si no lo están, se aborta; no se decide cómo transformar datos. Detalle: `phase0b-pixel-dependency.md`.

La misma barrera protege los proveedores adelantados de geo_source y lead_payload_raw. El backfill `20260426000000` se ejecuta antes de eliminar test_event_code, conforme a su precedencia acreditada en Git, con profiles/conversions_config vacías. No se cambia el contenido de esos archivos. Las dos reconstrucciones finales completaron 268/268 con fingerprint idéntico; Fase 0B está cerrada con las diferencias de plataforma justificadas en `phase0b-schema-review.md`.

El manifiesto legado tiene un hash de aprobación fijado en `bootstrap-manifest.mjs`. Un cambio de archivos, dependencias, excepciones, orden o manifiesto falla antes de crear recursos. No regenerar automáticamente este sello para hacer pasar una validación. Nuevas excepciones requieren una decisión explícita.

## Protección del destino

El comando no recibe URL, base, contenedor ni directorio de destino. Rechaza argumentos y variables de entorno de destino: Docker remoto/contexto alternativo, Supabase, PG, DATABASE, DB, POSTGRES y PHASE0. No carga `.env` del repositorio. La CLI trabaja en una carpeta temporal nueva, sin linked, migraciones copiadas ni seed.

La instancia parte del bootstrap oficial de Supabase CLI con solo PostgreSQL; auth y roles de plataforma se inicializan allí. No se clona el esquema de aplicación remoto. Se comprueba que public no contenga tablas de aplicación antes de aplicar las migraciones.

El runner comprueba el endpoint Docker local, nombre aleatorio inexistente, ID de contenedor creado por esa invocación y labels de proyecto de la CLI. Desconecta ese contenedor de sus redes iniciales, lo conecta exclusivamente a una red interna propia y comprueba la identidad por socket Unix. Deshabilita `cron.launch_active_jobs` antes de cargar cualquier SQL histórico y lo verifica antes de cada archivo. Los jobs pueden existir con active=true como metadata histórica; no se ejecutan mientras el interruptor global está apagado. La red interna impide HTTP externo incluso ante una llamada histórica accidental.

Antes de iniciar la CLI rechaza también colisiones con nombres de volúmenes y redes existentes, para no reutilizar una base previa aunque el contenedor haya sido eliminado. La limpieza exige identidad y labels; no elimina recursos preexistentes.

Toda contraseña local queda en memoria. No se guardan stdout/debug de CLI, SQL crudo ni stderr completo de PostgreSQL. Se registra solamente versión, hash, orden, duración, resultado y SQLSTATE/identificadores de esquema permitidos. No se admite psql shell escape ni SQL de control de transacciones incompatible con el wrapper.

Los fixtures de las suites existentes viven en sus propias bases sintéticas. El runner no introduce filas de negocio antes de terminar el esquema para compensar migraciones defectuosas. En particular, no inserta una conversión artificial para evitar el setval(0).

## Migraciones futuras

Crear una migración normal con la CLI después de verificar su ayuda; conservar orden cronológico posterior al corte. Registrar explícitamente su versión, filename y SHA256 en `incremental-manifest.json`, sin tocar las 268 entradas legadas. La lista está vacía en esta entrega. Archivos nuevos no registrados, versiones repetidas, retrodatadas o hashes distintos fallan.

```text
node scripts/phase0/check-future-migrations.mjs
node --test scripts/phase0/bootstrap-safety.test.mjs
```

El verificador rechaza referencias a tablas, funciones, tipos, secuencias/vistas o columnas creadas en migraciones posteriores. Es conservador: rechaza SQL dinámico futuro que no puede resolver estáticamente. No es un parser semántico completo de PostgreSQL; el replay limpio seguirá siendo obligatorio. No concede excepciones legadas nuevas a un archivo futuro. Después del legado, las entradas incrementales se ejecutan estrictamente en orden cronológico.

## Comparación y rollback

`bootstrap-catalog.sql` devuelve solo metadata: tablas/columnas/tipos/defaults hasheados, constraints, índices, funciones y seguridad, triggers, vistas, RLS, políticas, grants/default grants, extensiones, cron y colas. Incluye ensure_rls y rls_auto_enable. No devuelve credenciales, cuerpos de funciones, comandos cron en claro ni filas de aplicación.

`node scripts/phase0/compare-schema-metadata.mjs` exige un esquema local completo. Si no lo hay, devuelve estado blocked y exit code 1. Las diferencias se individualizan por objeto y quedan unresolved por defecto: no hay una lista genérica de excepciones aceptadas ni normalización que borre cambios de seguridad. Hash de un comando no significa igualdad semántica ni permite declarar explicada una diferencia de credenciales.

Rollback: detener el intento, conservar sus resultados y eliminar únicamente su contenedor por ID comprobado, volúmenes propios y redes con identidad/labels comprobados. No usa prune, no busca bases por URLs y no borra recursos ajenos. No elimina perfiles Chromium ni directorios de usuario. El proyecto temporal solo contiene configuración local; no se versiona.

## Higiene del entorno

El `.env` local conserva exactamente sus bytes, está ignorado y fue retirado del índice por autorización. Su único JWT se clasificó como clave pública anon legada; no se detectó una clave privilegiada. `.env.example` contiene únicamente nombres y ejemplos sintéticos. No se reescribió el historial ni se rotó ninguna clave. Una migración futura a sb_publishable_ requiere una tarea separada y no forma parte de este bootstrap.

Requisitos: Docker local disponible, imágenes oficiales ya disponibles o descargables, CLI compatible con las opciones verificadas mediante --help y Node. En este equipo se verificaron Docker 29.7.2 y Supabase CLI 2.75.0. La alternativa de solo DB evita el bloqueo de Vector documentado; no se presenta como validación del stack completo ni de Edge runtime.
