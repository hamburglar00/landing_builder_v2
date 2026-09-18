# Rollout y rollback

No se ejecutó deploy, rollback remoto ni escritura productiva. La migración 274 solo modifica lectores y agrega helpers/entradas de lectura. No transforma filas ni cambia triggers, RLS, envío, recepción, asignaciones o estados persistidos.

Desplegar primero la migración y comprobar acceso owner/admin, denegación anon, proyecciones y latencia; después desplegar el frontend. La firma y respuesta completas del RPC histórico siguen disponibles.

Para revertir el frontend, restaurar el lector del commit base manteniendo el SQL optimizado. El componente anterior se ejercita con respuestas sintéticas del lector compatible y no necesita los RPC nuevos. Reaparecería la precarga de mensajes, pero no hace falta reintroducir el plan SQL que produjo el timeout.

Para retirar objetos nuevos, usar otra migración revisada después de acreditar que no quedan consumidores. Retirar únicamente ambos wrappers y sus helpers; eliminar el esquema solo si está vacío, sin CASCADE. Restaurar el cuerpo SQL histórico solo ante una regresión acreditada, pues reintroduce el problema de rendimiento. No modificar migraciones aplicadas ni borrar datos.

El rollback de despliegue no se ejecutó: se comprueba compatibilidad local del lector anterior. Los runners limpian únicamente recursos cuya propiedad verifican. codex-p8-mysql permanece intacto. Directorios sintéticos y copias de build quedan fuera del repositorio; no se hace limpieza global.
