# Reconstrucción diagnóstica única y auditoría de rutas

Base: main, ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb. Alcance: trazabilidad del harness, una reconstrucción nueva y clasificación sintáctica del detector. No se modifican migraciones, grants, RLS ni código productivo. No hay consultas ni escrituras remotas. Las suites pendientes no se ejecutan.

## Evidencia y límites

[reconstruction-diagnostic.json](reconstruction-diagnostic.json) contiene la ejecución única y sus resultados. [local-validation.json](local-validation.json) se conserva íntegro: su primera reconstrucción válida es la referencia y su segundo intento fallido sigue siendo evidencia histórica, sin convertirlo retroactivamente en un éxito.

El fallo anterior `Local command failed` no identificaba subcomando, estado de salida, señal ni timeout. Por sí solo no acredita una causa SQL, Docker, permisos o recursos. Una reconstrucción posterior exitosa permite comparar esquemas, pero no demostrar retrospectivamente por qué falló aquel proceso.

El comando reproducible es `node scripts/security/run-profile-reconstruction-diagnostic.mjs`. Inicia una sola base mediante el bootstrap aprobado, valida todos los hashes, ejecuta las 268 migraciones históricas, la compatibilidad post-histórica existente y el incremento 269. No reintenta migraciones ni reconstrucciones. No ejecuta las pruebas de profiles, Auth, Data API ni las suites de regresión en este diagnóstico.

Los fingerprints se calculan con las mismas consultas y canonicalización de la primera reconstrucción válida: catálogo de aplicación y metadata de seguridad de profiles. El reporte conserva también el hash del archivo de evidencia de referencia y compara las versiones/hashes de las 269 migraciones antes de iniciar.

## Trazabilidad sanitizada

El runtime admite un observador diagnóstico opcional. Cada comando registra etapa, migración actual y última completada, ejecutable y argumentos sanitizados, duración, exit code, señal, error de spawn, SQLSTATE y timeout. Conserva los últimos 40 comandos y todos los fallidos; los contadores globales y cada migración completada mantienen la continuidad sin acumular logs ilimitados.

Se preservan stdout/stderr sanitizados y sus tamaños. Config.Env, comandos de health checks y SQL de entrada nunca se guardan. Los resultados SQL que pueden contener definiciones o valores se sustituyen por un marcador explícito y su tamaño; no se presentan como salida cruda completa. Los errores SQL conservan severidad, SQLSTATE y mensaje sanitizado; se suprimen sentencias, contextos y literales. La salida de arranque se limita a estados reconocidos. JWT, autorización, credenciales, URLs, emails y rutas personales se redactan antes de escribir evidencia. No se lee .env.

Se capturan CPU y memoria del host y Docker, límites y uso del contenedor, espacio libre del workspace/directorio temporal y filesystems del contenedor. Las muestras se toman antes del arranque, después y cada 25 migraciones; ante fallo se capturan estado y logs antes de limpiar. Docker stats informa uso observado; los contadores acumulados de CPU del host se identifican como tales, sin inventar porcentajes instantáneos.

Timeouts sin ampliación: 180 segundos para el arranque CLI, 120 por comando síncrono, 45 para la transacción de migración, 5 para locks y 15 para cada lectura diagnóstica. Un fallo de lectura diagnóstica queda registrado y no se convierte en causa del fallo principal. No se cambia configuración para facilitar la prueba.

La ayuda instalada de Docker se consultó para stats, logs, system df e info. Referencias: [spawnSync](https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options) y [Docker stats](https://docs.docker.com/reference/cli/docker/container/stats/). No se guarda SQL sensible, salida inspect completa ni archivos de logs crudos.

## Falsos positivos acreditados

La regla anterior de `audit-profile-artifacts.mjs` buscaba un componente Unix con `Users` o `home` en cualquier posición, con comparación case-insensitive. Al no exigir raíz de ruta, encontraba el segmento users dentro de endpoints Auth.

| Archivo | Línea en el snapshot original | Texto sanitizado que activaba la regla |
| --- | --- | --- |
| README.md | 75 | `/admin/users/{id}` |
| scripts/security/profile-security-tests.mjs | 82 | `admin/users/${ids.approved}` |

El segundo texto se pasa a auth.request con DELETE; profile-auth-api.mjs le añade el host del contenedor GoTrue propio. El primero documenta ese mismo endpoint. No contienen drive, raíz home ni acceso al filesystem. No son rutas dependientes de la PC.

El ajuste mínimo se aplica en [artifact-paths.mjs](../../../scripts/security/artifact-paths.mjs): raíz Unix solo al inicio de una ruta o tras file URI, y raíces de perfil Windows por drive. Se preserva la detección conservadora de raíces ambiguas y se admiten separadores Windows escapados en JSON. No se excluyen directorios, archivos, líneas completas ni strings por contener palabras Auth/admin. Todas las reglas de credenciales permanecen intactas.

Casos positivos: drive Windows con separador normal, slash o escapado; raíz Users de macOS; raíz home de Linux; rutas entre comillas, en mensajes de error y file URI; endpoint y ruta real juntos en la misma línea. Casos negativos: ambos endpoints acreditados, segmentos internos de una URL HTTP y texto ordinario. Las rutas de prueba se construyen con nombres sintéticos en memoria para no incluir rutas reales de la PC en los artefactos.

[diagnostic-tools.test.mjs](../../../scripts/security/diagnostic-tools.test.mjs) contiene 10 tests: seis de clasificación y cuatro de redacción/proyección diagnóstica. Pasaron antes de integrar el detector y se repitieron tras los cambios de instrumentación y los casos adicionales de delimitadores; cuentan como 10 tests únicos, sin multiplicar ejecuciones. No son una ejecución de las suites de regresión pendientes.

## Limpieza y siguiente etapa

La limpieza conserva los controles de propiedad del bootstrap y elimina solo su base, redes y volúmenes. El diagnóstico vuelve a enumerar únicamente los nombres del proyecto aleatorio generado. Los cambios en recursos globales ajenos no son fallos ni disparan eliminaciones. No se borran perfiles Chromium ni recursos preexistentes.

## Resultado final

La única reconstrucción terminó 269/269, sin reintentos. Inicio: 2026-09-17T20:45:49.285Z; fin tras limpieza: 2026-09-17T21:01:40.643Z. Duración total instrumentada: 951358 ms. Se registraron 2845 comandos del bootstrap, cero fallidos, 14 muestras de recursos y cero fallos en las lecturas diagnósticas.

Fingerprint del catálogo de aplicación: `ca7fe3870eb5798cd8afa91c9e7cfa0d4e18f7cbf2e0994bad2f313b21fadeba`.

Fingerprint de seguridad de profiles: `298cfa463a05e1944d09fa724722116466db4b4b923621970c91f9a0a0f90fdf`.

Ambos son idénticos a la primera reconstrucción válida, con CLI 2.75.0 e imagen public.ecr.aws/supabase/postgres:17.6.1.075, mismo imageId. El archivo de referencia permaneció intacto. Ahora hay dos reconstrucciones completas acreditadas en ejecuciones separadas; el intento intermedio de 11/269 sigue registrado como fallido.

Docker informó 8 CPU y 7205425152 bytes de memoria asignada. Las muestras del contenedor variaron de 129.7 a 148.5 MiB, con máximo de CPU observado de 5.63%. El mínimo de espacio disponible del workspace observado fue 1398341632 bytes. Son muestras, no picos continuos ni una prueba causal del fallo anterior. No se observaron OOM ni reinicios del contenedor. Los logs relevantes conservados muestran el cierre/arranque normal de PostgreSQL durante la inicialización de la imagen.

La ejecución final verificó cron detenido, perfiles vacíos y cero filas en cola/respuestas net. Después de limpiar: cero contenedores, redes y volúmenes propios. No se modificaron recursos ajenos ni se ajustaron límites para completar la reconstrucción.

El fallo operativo anterior NO se reprodujo. No es posible asignarle retrospectivamente una causa exacta con el error genérico conservado. No se presenta como corregido un defecto no acreditado ni se inicia otro intento para buscarlo.

Hay evidencia suficiente para pasar a la validación final, pero esta no se ejecutó. El orquestador run-profile-regressions.mjs todavía exige que local-validation.json contenga dos reconstrucciones exitosas dentro de la misma invocación. Ese archivo histórico conserva el intento fallido. Antes de usar dicho orquestador habrá que acreditar también reconstruction-diagnostic.json en su precondición: resultado completo, 269 hashes iguales, referencia intacta, ambos fingerprints idénticos y limpieza aprobada. No se modifica esa precondición ni se omite el control en esta etapa diagnóstica.

De las 340 comprobaciones que el informe anterior no alcanzó, esta autorización resuelve la comparación de fingerprints. Las 338 históricas y la nueva prueba del directorio incremental siguen pendientes, además de TypeScript, build y ESLint. Las 10 pruebas nuevas de herramientas diagnósticas se informan separadamente. El resultado del escaneo final está en audit.json; Fase 1B.1 sigue sin cerrarse hasta completar su validación.
