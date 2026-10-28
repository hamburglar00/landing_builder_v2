# Recordatorios de invitaciones — 28/10/2026

## Comportamiento

«Recordármelo después» pospone instalación, notificaciones y perfil. Primer plazo: dos horas desde el envío original (desde la primera presentación de la tarjeta contextual). Los siguientes plazos se cuentan desde cada nueva postergación. Solo una interacción posterior al plazo, respondida y sin una operación pendiente, habilita la reaparición. No se generan mensajes nuevos ni eventos de tracking.

El chat compartido persiste por jugador/tipo en localStorage y reserva la presentación con Web Locks cuando está disponible. Ante storage bloqueado, conserva estado en memoria durante esa apertura. El gateway guarda un recibo mínimo de descarte hasta que Atrio confirme su recepción; permite recargar inmediatamente sin perder la espera. Un recibo repetido no vuelve a posponer ni duplica avisos. No hay sincronización entre dispositivos.

La comprobación de perfil utiliza el endpoint existente. La instalación se confirma con standalone/appinstalled y las notificaciones con permiso y suscripción activa. Los reintentos no interrumpen cargas/retiros, la captura temprana de instalación ni la carga diferida del SDK. No cambia la creación de cuentas ni API2. No requiere migraciones.

## Alcance

Atrio implementa el controlador único y los gateways intercambian capacidad, estado y confirmaciones de descarte. Rey de Ases es fuente canónica del puente; `scripts/sync-gateway-install-offer.mjs` lo sincroniza con Ases del Norte, Ganamos NET y Ganamos+. `sync-gateway-app-sdk.mjs` conserva la captura común y actualiza la versión del recurso del cliente. Builder solo contiene sincronización, pruebas y documentación.

## Validación

- Pruebas de lógica: primer plazo, nuevas postergaciones, interacción posterior, descarte tardío, persistencia y separación por cliente/tipo, respuestas antiguas, cargas y retiros pendientes.
- Navegadores: `node scripts/check-contextual-install.mjs`, componente React y JS reales, Chromium/WebKit y los cuatro gateways. HTTP simulado, reloj controlado, sin altas, mensajes, cargas, retiros o notificaciones reales.
- Arranque diferido: `scripts/check-deferred-gateway-app.mjs`.
- TypeScript, ESLint, pruebas de presentación/promociones y sincronizaciones.

## Publicación

Publicación completada. Los cinco despliegues Vercel terminaron READY, con SHA coincidente, y se promovieron después de confirmar que la producción anterior no había cambiado. Builder solo publica documentación/scripts en Git, sin cambiar su aplicación.

| Aplicación | Commit | Despliegue Vercel |
|---|---|---|
| Atrio | `a430e53d73dc298a88e6be1081aba20af82cdb6d` | `dpl_683DiXAWuLbgwjFEr8mKQupQAric` |
| Rey de Ases | `316921e9f54552ca5df37432b88ed6d32bfb88a9` | `dpl_645gfJDkLA2NVwKRU1xeMG4aFQ22` |
| Ases del Norte | `046d7a7ec636418c1825b4d793e518609eae9207` | `dpl_7d25bJbQv3JUjjwxRW4BpzEVcUzx` |
| Ganamos NET | `1281b00c5cc1fb21a866fc85c2a21564c7f321a3` | `dpl_B6x6AzKGwLeNLmxZRwJ7LAr7iFDh` |
| Ganamos+ | `bac21df49a97521c4e612d7bb1f8a2ff4f6a72ea` | `dpl_DAzJp6TbgvoTqxmiFQwGLpMQxViu` |

Worker público de Ganamos+: `02d76cdd-3b34-4846-9117-a231cb60bce3`, compilado con OpenNext y publicado conservando variables/secretos con `--keep-vars`. Versión anterior: `d5c37012-2039-4cfd-8cff-2add73b861fd`. No se modificó el relay.

Resultados: 12 pruebas de lógica, 8 recorridos Chromium/WebKit (4 gateways), 32 escenarios de arranque diferido y 63 pruebas de presentación/promociones/puente (25 Rey, 13 Ases, 13 NET, 12 Plus). El puente incluye comprobación de suscripción push y recuperación del recibo de descarte, aislado por jugador. TypeScript/ESLint y cinco compilaciones Vercel correctas; OpenNext correcto. La validación de navegador incluye recarga inmediata y una invitación pospuesta presente en el historial inicial. Las capturas confirman que los dos botones de la tarjeta caben en móvil.

[Comprobación pública](invitation-reminders-public-20261028.json): los cuatro JS públicos coinciden con los archivos probados; `/embed/warm` referencia el bundle de Atrio con el controlador nuevo. Solo GET de HTML/JS, sin montar conversaciones ni ejecutar tracking. No certifica una instalación física en iPhone.

Despliegues anteriores para rollback: Atrio `dpl_A7TWUQ55W2KUBeqqD3XPySzUA2iP`, Rey `dpl_2mKTCaSYtgdqwzbPEPs1b72kkj11`, Ases `dpl_J1Ge8hx71gjkkNbwfCpjXwQiGuMs`, NET `dpl_Gdf5YVSeRZtwuJ8qaDgUtnoN1oJq`, Plus `dpl_C8SuoHC6w6hmFFSKKkmcf6jMcAb8`.
