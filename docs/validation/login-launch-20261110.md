# Login: CTA en mayúsculas y despegue — 10/11/2026

## Alcance y fuente canónica

LandingBuilder: login, proveedor persistente del layout del panel y señal de llegada de Inicio, para cliente y administrador. Fuentes: `LandingBuilderLaunch`, su CSS y `LoginTransitionProvider`. Se reutiliza el isotipo SVG oficial; no se crean imágenes, vídeos, dependencias ni recursos de marca adicionales.

Los motores públicos, NexoBet, Atrio, los cuatro gateways, su SDK/Worker y API2 no participan de este login. El módulo compartido de marketing mantiene sus 24 archivos fijados sin diferencias. No hacen falta migraciones ni publicaciones de otros productos.

## Resultado

- CTA `ENTRAR AL PANEL` e `INGRESAR CON PBADMIN` en mayúsculas; conservar la condición de habilitación del acceso PBAdmin.
- Al enviar credenciales válidas, mostrar inmediatamente una transición completa con el cohete en espiral ascendente, cambios de escala para profundidad, llama, vapor, humo y partículas en la base. Trayectoria SVG de curvas suaves, con orientación automática del cohete y salida gradual.
- La transición persiste al desmontarse el login; permanece durante validación, rol, redirecciones y carga de Inicio. Se retira después de que el contenido de destino pinte, con un fundido de 240 ms. No esperar un ciclo ni introducir un tiempo mínimo de carga.
- Respetar los errores de autenticación y red, el fallback de rol existente, las comprobaciones de permisos y el bloqueo por plan. Permitir reintentar; impedir autenticaciones concurrentes por doble envío. Si se vuelve al login, limpiar la transición pendiente.
- Durante la transición, contenido subyacente `inert`, foco en el estado accesible y scroll del cuerpo bloqueado/restaurado. Sin texto de carga visible. Movimiento reducido: cohete estático y gases sin movimiento. Composición adaptada a móvil y horizontal.
- Ajuste posterior aprobado: eliminar el logo horizontal de la transición y mostrar solo el texto centrado «LandingBuilder», en blanco/verde. Se conserva un único cohete visible, animado o inmóvil según la preferencia de movimiento; no cambia el recorrido, la autenticación ni el cierre de la transición. Se reutilizan el isotipo y los estilos existentes, sin modificar archivos de marca compartidos.

## Validación

- TypeScript sin errores; ESLint de los ocho archivos TS/TSX modificados/nuevos sin errores, con cuatro advertencias previas del layout de cliente.
- `node scripts/test-login-launch-browser.mjs`: 16 escenarios con componentes reales y autenticación/router sintéticos, red externa bloqueada. Chromium/WebKit, 320×820, 390×820, 1280×820 y 844×390, movimiento normal/reducido.
- Se verifican mayúsculas de ambos CTA, inicio inmediato, ausencia de desborde, cobertura de pantalla, foco, bloqueo de interacción y doble envío; errores de credenciales y de red; reintento; espera de rol; persistencia entre rutas; regreso al login; retiro al estar listo el destino y restauración de scroll/interacción. Vuelo ascendente y lateral comprobado por posiciones del isotipo sobre la curva. Capturas móviles revisadas.
- `node scripts/sync-nexobet-marketing.mjs`: 24 archivos verificados sin cambios. Guardas de encoding y diff antes de commit.
- Revisión del ajuste de un solo cohete: componente real renderizado en Chromium/WebKit, 16 combinaciones de móvil/escritorio/horizontal y movimiento normal/reducido. Texto y contenedor centrados con menos de un píxel de diferencia, blanco/verde conservados, sin imagen de logo horizontal ni desbordes, un único isotipo visible. CSS y trayectoria del vuelo, proveedor y control del login sin modificaciones funcionales. ESLint del componente sin errores; capturas en `.vercel/login-single-rocket-20261110/`.

## Publicación

Publicar en `main` del proyecto Builder `landing-builder-v2-k259`; verificar READY y los alias `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com`. Los SHA, despliegues y comprobaciones posteriores del login real con servicios sustituidos se guardan en `.vercel/login-launch-20261110/` localmente. Esas pruebas no utilizan credenciales reales ni acreditan acceso a datos de clientes.
