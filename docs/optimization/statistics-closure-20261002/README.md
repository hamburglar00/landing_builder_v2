# Estado de Estadísticas al cerrar esta etapa

Fecha: 2026-10-02. Se detiene el trabajo de optimización de Estadísticas para pasar a otras tareas. **La mejora integral de latencia no está implementada ni acreditada.** Este cierre no cambia métricas, filtros, monedas, atribución, RLS ni el recorrido productivo de consultas.

## Mejora acotada separada de la optimización integral

El commit `3c514c5` cambia sólo `frontend/components/conversiones/StatsPanel.tsx`: agrupa una vez las filas por campaña, dispositivo y landing, y reutiliza esos grupos al calcular cada desglose. Mantiene el orden de entrada y las funciones de métricas existentes. Reduce recorridos repetidos en el navegador, pero no reduce las filas descargadas, el costo de SQL ni el tiempo de Máximo. **No hay una medición de mejora visible de pantalla atribuible a este cambio.**

Validación antes del release: TypeScript con Node 24.21.0, 15 tests focalizados y ESLint del componente aprobados; ESLint emitió dos avisos preexistentes de dependencias de hooks y cero errores. `git diff --check` y el guard de encoding del commit aprobaron. No se ejecutó una suite amplia ni se modificó la base.

## Qué se intentó y retiró

- [Ruta de hasta siete días](../statistics-seven-day/result.md): equivalencia y velocidad local aprobadas; falló el límite de latencia del endpoint en Preview hosted y se retiraron código, migración 281, objetos y usuarios temporales.
- [Agregado relacional de períodos cortos](../statistics-aggregate-short-20260930/result.md): Hoy pasó localmente, pero siete días completos superó el límite SQL; se retiró. No se habilitó ruta rápida para ningún preset.
- [Copia de hechos para Máximo](../statistics-prepared-async-20260930/feasibility.md): con 280.000 conversiones sintéticas, la consulta exacta alcanzó el timeout de 60 segundos. La copia pequeña y un caché simple no acreditan frescura inmediata ni el minuto inicial.

Los ensayos anteriores no son código de producto vigente. El script `scripts/optimization/probe-statistics-facts-local.mjs` conserva sólo la prueba descartable de la última hipótesis; no se ejecuta desde la aplicación.

## Estado funcional que permanece

Hoy, Ayer, Esta semana, Este mes, Mes pasado, Máximo y Personalizado siguen por el recorrido productivo anterior. No hay nueva RPC activa, migración 281, refresco programado, caché de informe ni cálculo preparado en servidor para la pestaña. Máximo en ARS y alcance de administrador global conserva el riesgo de demora o timeout ya observado. El ledger Supabase conocido permanece en 280; este cierre no realiza escrituras remotas de base de datos.

## Qué faltaría para retomar y terminar la optimización integral

1. Implementar una ruta que filtre temprano y entregue métricas exactas sin descargar todo el historial al navegador. Si la frescura inmediata sigue siendo obligatoria, debe mantener o invalidar coherentemente los estados de conversiones, inicios, ocultamientos y configuración por usuario y filtro.
2. Acreditar paridad integral con producción para ARS/PYG, administrador/cliente, todos los presets, fechas personalizadas, período vacío y límites de Buenos Aires; probar RLS, concurrencia y costo de escritura.
3. Medir en un entorno representativo los objetivos acordados: primera consulta extensa, incluido Máximo, en hasta 60 segundos; repetición inmediata sin cambios; conversiones nuevas visibles inmediatamente. Si no se cumplen a la vez, acordar explícitamente cuál objetivo puede cambiar antes de integrar.
4. Sólo después de pasar esos gates, integrar frontend/servidor, preparar rollback y hacer un rollout separado con observación. La mejora pequeña de agrupación no sustituye esos pasos.

No se continuará el experimento de arquitectura como parte de este cierre.
