# Movimiento continuo y maximizado del chat — 28/10/2026

Publicado en los cuatro gateways, incluido el Worker de Ganamos+. El usuario pidió apertura/cierre más fluidos y que maximizar llegue a la misma altura que con el teclado abierto.

## Cambio

- Antes, quitar el estado cerrado restauraba una altura de cero mediante una transición de 320 ms al mismo tiempo que escalaba la ventana. El iframe cambiaba de tamaño durante la apertura y su contenido se reacomodaba repetidamente.
- Ahora una fase breve y síncrona prepara el tamaño y la posición completos sin transición; después anima la transformación desde el botón. El iframe permanece montado. Al finalizar el cierre, el estado de tamaño cero tampoco anima su altura.
- `translate3d`, promoción de la ventana visible y una misma curva continua para ambos sentidos. Apertura y cierre mantienen 520 ms; el cierre conserva el contenido visible durante la contracción. Se respetan movimiento reducido, inversión rápida, accesibilidad y paso de toques estando cerrado.
- Maximizado: margen superior de 8 px, igual al usado con el teclado, conservando la separación inferior del gateway. `border-box` incluye el borde en la altura disponible. La adaptación al viewport del teclado tiene prioridad y Restaurar devuelve el alto normal.

## Comprobación

- Medición local de una apertura con 100 burbujas: antes Chromium observó 11 alturas internas diferentes y WebKit 13; después ambos observaron una única altura interna de 625 px mientras cambiaba la escala visible. Las muestras son evidencia del tamaño estable, no una certificación de FPS de un teléfono físico.
- `node scripts/check-gateway-entry-ux.mjs`: 40 escenarios aprobados, cuatro gateways, Chromium/WebKit, móvil vertical/horizontal y escritorio. Verifica altura interna estable durante apertura/cierre, tamaño visible intermedio, contenido visible durante la contracción, maximizado y teclado con el mismo borde superior, teclado dentro de su viewport, restauración, origen del mensaje, inversión rápida, iframe reutilizado, ausencia de bloqueo táctil estando cerrado, paletas y movimiento reducido. Las mediciones temporales se toman dentro del navegador.
- Vitest de assets y paleta: Rey 19, Ases 15, NET 15 y Plus 14; todas aprobadas.
- `node scripts/sync-gateway-chat-motion.mjs --check`: bloques compartidos iguales en los cuatro.
- Fixtures con tráfico interceptado; sin cuentas ni dinero reales. No se certificó la barra física de Safari de un iPhone.

## Fuentes y producción

Solo se modificaron `public/gateway-client.js` y `public/gateway-client.css` de cada gateway. Los commits de los assets están pusheados en `fix/template7-session-reentry`:

| Gateway | Commit de assets | Vercel activo |
| --- | --- | --- |
| Rey de Ases | `6b078d359a0f3e29ad2c52c2deb7bdc3d7a152ec` | `dpl_5BM2KVSri4E6rySniHEsVR6oYZQP` |
| Ases del Norte | `7abac912aeb080ec15ab6ffa7b1f46c0c04590d0` | `dpl_BDWe88qNjmUArhcyktMoCjeE7SE7` |
| Ganamos NET | `784f0e290e601dd28c8db6c2ed71507acd714836` | `dpl_nLr8mtHvPjdx6fT21v3zgWfNm3y8` |
| Ganamos+ | `12e85496e0a631818d66d19230576c17172182ea` | `dpl_CJ98PsvcDfozEaHVqMZrTWUp5t8Y` |

Para mantener pendiente el lote funcional que depende de API2, cada publicación conserva el código de su versión productiva previa y superpone únicamente los dos assets. Se verificó el árbol completo frente al commit base, admitiendo solo esos dos cambios y las terminaciones de línea de Windows. Bases respectivas: `6dfaeb0`, `299f3f2`, `a27b0a4`, `ae1feef`.

La metadata Vercel `gatewayBaseCommit`/`githubCommitSha` indica esa base y `releaseScope=chat-motion-ui` indica la publicación de UI. No interpretar el SHA base como si los assets nuevos estuvieran ausentes: sus commits y hashes están registrados aquí. Las cuatro builds quedaron READY y se promovieron después de comprobar el destino productivo anterior.

Worker Plus activo `0a4fc8bb-8918-40f1-89cd-f49ca77156da`, anterior `96215e0d-fa57-4034-b5f4-011a6a0dafea`. OpenNext compiló la misma fuente aislada; `wrangler deploy --keep-vars` conservó la configuración productiva. No se desplegó el relay.

## Verificación pública

Ocho assets públicos y cuatro `/api/health` devolvieron HTTP 200. Los ocho SHA-256 coincidieron con las fuentes publicadas:

| Dominio | JS SHA-256 | CSS SHA-256 |
| --- | --- | --- |
| `www.reydeases.fun` | `4e073a487094cbb9c61ba67d17b9034bc047cc590b2b2faf31f618820786fc3a` | `1460cc9f444f2f965b297fe3831a63b93aacd467a8596fb9f6e19c233ba78683` |
| `www.asesdelnorte.online` | `36b531dd4fcaa3ad35e02288002cb588e379dc8b45ec80da77e30bcb46209be3` | `a6bf69584a4945cd1d3424eda130467f5b7e3939102365f2cefcce38201357b3` |
| `www.ganamosnet.icu` | `126bd69dddb4ec70ba9221cdf3b711d39685b824657fc3caef1798f2aec6b88d` | `a6bf69584a4945cd1d3424eda130467f5b7e3939102365f2cefcce38201357b3` |
| `ganamosnet.global` | `95780546fc90dd0b4f245cf368fbf4772af0ace1413b68ebf6ddf5f5d03ea551` | `9c468030d8b8f522cb4a5523d0b6c999ae6638f0216d71f5473b6e4384865594` |

La recuperación de cuentas y el backend financiero siguen sujetos al despliegue coordinado de API2 indicado en [la entrega funcional](atrio-release-git-20261028.md). Esta publicación de UI no los adelanta.
