# Widget: compresión y altura publicados — 28/10/2026

El usuario autorizó publicar inmediatamente estos dos ajustes independientes. Solo se incluyeron `public/gateway-client.js` y `public/gateway-client.css` por gateway. El lote local de recuperación de cuentas/API2 permanece fuera de estas publicaciones.

- Compresión: 520 ms, cierre JS de respaldo 560 ms; contenido visible durante la contracción. Apertura y movimiento reducido conservados.
- Maximizado móvil: margen superior 32 px o safe area + 16 px; conserva ancho, restauración y teclado.
- Fuentes sincronizadas y 40 escenarios previamente aprobados en Chromium/WebKit, cuatro gateways, móvil vertical/horizontal y escritorio. La revisión en un iPhone físico de la barra del navegador sigue siendo independiente.

## Commits y publicaciones

Todos pusheados en `origin/fix/template7-session-reentry`. Se crearon fuentes aisladas desde cada commit para excluir los cambios funcionales todavía locales. Las cuatro publicaciones Vercel quedaron `READY` y se promovieron a producción tras comprobar sus commits y el destino anterior.

| Gateway | Commit | Vercel deployment |
| --- | --- | --- |
| Rey de Ases | `6dfaeb001a69670cb1fd0bf54a3d3aa2b4079afb` | `dpl_EfJeWTqEceg6rAUdGuJUJW3aJAn7` |
| Ases del Norte | `299f3f2f66003918c99c950385cc0d1d710a9fbd` | `dpl_EKQeka8NSeW9cX5s6L4tDjc7vL9r` |
| Ganamos NET | `a27b0a46d235a367f184af5483f6b00aa04c2bea` | `dpl_HFfQ8qZD9qtnVuVca8UtdF2pu5cB` |
| Ganamos+ | `ae1feeff306f14bc813c1c4ba657ec12a364af7a` | `dpl_5wJYV9YD2aHPXSSH4DwKReCCntF5` |

Plus también se compiló con OpenNext desde su fuente aislada y se publicó con `wrangler deploy --keep-vars`, preservando la configuración productiva y sin desplegar el relay. Worker activo: `96215e0d-fa57-4034-b5f4-011a6a0dafea`; anterior `747d0181-8b2b-431c-93c8-832f7858eed7`.

## Comprobación pública

Los ocho assets devolvieron HTTP 200 y SHA-256 idéntico al archivo del commit aislado. Los cuatro `/api/health` devolvieron 200. No se inició sesión ni se crearon cuentas o movimientos financieros.

| Dominio | JS SHA-256 | CSS SHA-256 |
| --- | --- | --- |
| `www.reydeases.fun` | `639ea6ab51d157ee6de542f5f70ee5f48602f117827546c272df63b007f582e3` | `559482d1dcbd6b9d2030b5ba3b396f7f1077f0e1b49269a8eb0f35422b267b8f` |
| `www.asesdelnorte.online` | `aa9c53234e00d9149c8f4341b9edd6621fe2c9e8d9b91fb699af0f0140cbd110` | `4b626362ccb5ca09fa06d9a96db8b9ee1dac62d9d165c380ac481c21638a245f` |
| `www.ganamosnet.icu` | `2d91d1c4b69e1878827586f7cc7afdb32faf47addb1cb3348a46ba972f38b6c5` | `4b626362ccb5ca09fa06d9a96db8b9ee1dac62d9d165c380ac481c21638a245f` |
| `ganamosnet.global` | `b122a9bfaf69985a9f7834c4ac5f7a6cd704b958301345cc78f7990a7582932f` | `dbed6acc943b28e6aac2518ff7a288543360da9b52d8701c755f28284e5ce377` |

## Pendiente funcional

Actualización posterior: el usuario autorizó comitear y pushear todo el lote funcional para su despliegue coordinado. Las referencias a trabajo local siguientes corresponden al momento en que se publicó la UI; el despliegue funcional sigue dependiendo de API2 y de las dos migraciones nuevas.

API2: recuperación breve, sustitución de candidatos no vinculados, historial y estado privado; crédito NET seguro y revisión por transferencia. Dos migraciones aditivas de altas, con alternativas SQL/Adonis. Sigue local y no desplegado; la conciliación del bono histórico de Kobe no se aplicó.

Web: retoma de cuentas y presupuestos acotados en Atrio, constructor, clásico y los cuatro gateways, incluidas pruebas y sincronización. Sigue local para coordinar su publicación después de API2. No hay otros commits de UI pendientes de push en los cuatro gateways.
