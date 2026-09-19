# Recuperación del cierre documental

La validación técnica del release está acreditada. **El cierre local es válido con la excepción de conservación externa autorizada por el usuario.** El checkpoint documental `docs(release): resolve rollout prerequisites` contiene exclusivamente los 19 documentos inventariados en [review.json](review.json). El commit que contiene este informe aporta su identificador; la auditoría comprueba mensaje, padre, inventario y estado limpio después de crearlo. Producción permanece exclusivamente en lectura.

Se trabajó con `gpt-6-astra`, esfuerzo `xhigh`, confirmado en el registro de la sesión activa. Se recuperó `main` en `835fdc08a5940e72ae54db3b53c947a0786dc4db`, once commits por delante de `origin/main`, con ocho documentos modificados, siete nuevos, índice sin cambios y sin conflictos. No existía `docs(release): resolve rollout prerequisites` en referencias, reflog ni entre los commits desconectados inspeccionados. Estos últimos eran históricos y se conservaron.

Windows registra un apagado inesperado mediante los eventos 41 y 6008 al reiniciar a las 19:02 UTC del 19 de septiembre. La última salida conservada de la sesión anterior, a las 18:42:48 UTC, terminó con código cero: mostraba la limpieza rechazada y el commit pendiente. No quedó una respuesta final. **No hay evidencia de un build, test o migración local interrumpidos por el apagado.** Se recuperó una tarea inconclusa cuyo bloqueo de limpieza ya estaba registrado. El horario del cierre que menciona el evento 6008 contradice otros registros persistidos; no se atribuye una hora exacta al corte ni se afirma que terminara un proceso activo.

| Punto | Estado encontrado | Resultado de recuperación |
| --- | --- | --- |
| 1. Candidato Node 24 | Completado y acreditado | Archivos fuente, reportes y hashes íntegros; 57/57 pruebas y build aprobados previamente. |
| 2. Reversión | Completado y acreditado | Baseline y fallback compatible compilados; tres archivos Git reproducidos exactamente en memoria. Los manifiestos no son binarios Production desplegables. |
| 3. Receptor clásico | Completado y acreditado | Fuente desplegada y siete controles sintéticos preservados. |
| 4. Data API | Completado y acreditado | GET remoto reconfirmó public/graphql_public; private/inbox_private excluidos. |
| 5. Tres Edge Functions | Completado y acreditado | Versiones, verify_jwt y hashes remotos coinciden con el informe. |
| 6. REVALIDATION_ENV | Completado y acreditado | Ausencia reconfirmada por metadata; configurarla es una escritura futura. |
| 7. Runbook | Completado y acreditado | Orden, responsables, pausa, aceptación y restricciones de rollback documentados. |
| 8. Ensayo local | Completado y acreditado | 274/274 y 228 registros; fallo histórico del oráculo y continuación satisfactoria conservados. |
| 9. Documentación y validación | Interrumpido en su cierre | Completado con auditoría y excepción de conservación externa autorizada. |
| 10. Checkpoint | No iniciado | Se cierra con el commit documental contenedor y su validación posterior. |

No se repitieron builds ni suites funcionales. Los reportes originales coinciden con los documentos y con sus hashes previos. Las salidas completas de los builds no se habían persistido: se conservan códigos de salida, duraciones y hashes de salida, sin inventar logs. El archivo original del ensayo registra un timeout del oráculo histórico; la continuación íntegra resuelve ese caso sin modificar la aplicación ni las migraciones.

La evidencia preservada incluye 17 reportes, 13 scripts de apoyo y cinco documentos originales en [recovered-evidence.json](recovered-evidence.json). Los campos `content` conservan los bytes UTF-8 exactos de reportes y documentos. Dos scripts reemplazan su ruta local por `<repository>` y un probe antiguo separa el prefijo textual de una URL sintética; se registran el hash original, el hash conservado y la transformación. Son evidencia histórica, no instrucciones para ejecutarlos. Los fixtures y binarios temporales permanecen en su ubicación original.

El inventario inicial de documentos, sus timestamps/hashes, el índice, reflog, archivos temporales y relecturas remotas están en [recovery.json](recovery.json). La auditoría reproducible es `node docs/release/pre-production/audit-recovery.mjs`: verifica JSON, referencias, contenido conservado, inventario, migraciones, alcance documental, `.env`, excepción autorizada y estado de Git. Sólo utiliza evidencia documental y objetos Git; no lee ni requiere el directorio temporal. Los archivos tar de fuentes se reproducen en memoria desde sus commits para comparar hashes, sin crear copias en disco.

Docker estaba apagado. Se inició su motor para inspeccionarlo: quedó operativo, sin recursos del ensayo. Sólo existe el contenedor ajeno `codex-p8-mysql`, detenido desde el 4 de septiembre, mismo ID y política de reinicio `no`; no se ejecutó ninguna operación sobre él ni sus datos. Los ocho volúmenes ajenos coinciden con la última salida anterior. Las redes son bridge/host/none; el motor recreó su bridge predeterminado al iniciar. Los dos directorios codex-index de trabajos anteriores permanecen intactos. No se inspeccionaron repositorios hermanos.

La comprobación remota confirmó `origin/main` y Vercel en `a4e752cf58f628813d3979d598b60d480caaac8d`, el clásico en `3322b634a06504ae469a4faee0383148707bc9b5`, 268 migraciones remotas y las versiones Edge anteriores. Se usaron GET de metadata y una transacción SQL READ ONLY con límites de 1500 ms/250 ms y ROLLBACK. No hubo push, deploy, migraciones remotas, cambios de variables ni revelación o rotación de secretos.

## Excepción de conservación autorizada

Se conservan 44 archivos propios del ensayo, 46.106.759 bytes (46,1 MB decimales), en:

```text
C:\Users\Leo\AppData\Local\Temp\release-prereq-bRshc8
```

Por ejemplo, el archivo candidato permanece en `C:\Users\Leo\AppData\Local\Temp\release-prereq-bRshc8\candidate.tar`. [recovery.json](recovery.json) enumera las **44 rutas absolutas exactas**, tamaños y hashes. La ruta documentada es una excepción expresa al filtro de rutas personales de la auditoría, limitada a este directorio y a los dos documentos de recuperación; no permite otras rutas personales.

Se verificaron pertenencia exclusiva al ensayo mediante ownership.json, 44/44 hashes, ausencia de enlaces/reparse points y ubicación externa. No están tracked, staged ni en el inventario del commit y no modifican la aplicación. No hay archivos temporales del ensayo en el repositorio. El commit incluye documentación de evidencia, no archivos externos, tar, logs, builds ni fixtures del directorio temporal.

Se inspeccionaron los archivos de texto y 1.061 archivos fuente dentro de los tar, sin extraerlos. No se identificaron credenciales reales, secretos productivos, claves privadas, JWT ni archivos .env. Las coincidencias de patrones se revisaron: son plantillas de conexión, referencias a variables y canarios/fixtures sintéticos sin capacidad de acceso productivo. El tar público de la CLI coincide con el checksum oficial de su versión; no contiene configuración local. No se muestran valores sensibles. La auditoría detallada y sus límites están en recovery.json.

El control automático había rechazado la limpieza recursiva protegida y la eliminación individual de candidate.tar con **`blocked by policy`**; los comandos no se ejecutaron. El usuario autorizó conservarlos y reemplazó el requisito anterior por: cero temporales dentro del repositorio, cero temporales staged o en el commit, cero recursos Docker propios residuales y temporales externos documentados. **Los cuatro criterios se cumplen.** Tras esa autorización hubo cero intentos de eliminación, cero cambios de permisos y cero intentos de eludir la política. Las clasificaciones iniciales y documentos originales preservados son snapshots históricos; su bloqueo anterior queda superado por esta decisión.

La eliminación posterior es **opcional**: abrir el Explorador de Windows, pegar la ruta exacta anterior, confirmar el nombre y ownership.json, volver a la carpeta superior y eliminar únicamente `release-prereq-bRshc8` con la acción normal Eliminar. No modificar permisos ni desactivar protecciones; si Windows impide la operación, dejarlo conservado. El checkpoint y su revalidación no dependen de eliminarlo. No tocar otros directorios temporales, repositorios hermanos ni recursos Docker ajenos.

El cierre no concede autorización para push, despliegues, migraciones remotas, cambios de variables, pruebas que escriban en producción ni rotación de secretos.
