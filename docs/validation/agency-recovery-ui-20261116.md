# Recuperacion y UI del acceso por gerencia ? 16/11/2026

## Alcance

Restaurar el intento de recuperar una sesion antes del formulario en los cuatro gateways y Ganamos+ Worker. Se detecto la regresion en HTML publico de Ases, Ganamos NET y Ganamos+: no invocaban resume. Reutilizar la implementacion autorizada y sus adaptadores de proveedor; validar cookie, origen, gerencia, asesor, cuenta, backend y skin; confirmar la cookie exacta antes de navegar. La cookie valida tiene prioridad sobre almacenamiento antiguo. No crear ni reasignar cuentas durante la recuperacion.

Sin sesion recuperable: login y CTA destacado No tengo usuario. Crear cuenta, ambos con texto blanco y contraste conservado. Ganamos+ usa la misma presentacion y wordmark de Ganamos NET; los iconos de instalacion conservan la pica. Las otras skins conservan su identidad. El login declara manifest, favicon y Apple icon, pinta html/body con su fondo y respeta insets. Ases usa gris #101114 para el casino despues del ingreso, separado del azul de login. Se reutiliza el progreso por etapas desde el envio del formulario, sin pausas agregadas ni afirmar finalizacion anticipada.

## Regresiones y validacion

- 418 pruebas focalizadas entre los cuatro gateways (106/105/104/103): recuperacion, confirmacion exacta, aislamiento, login, HTML y configuracion. TypeScript de los cuatro aprobado.
- 128 escenarios de navegador con Chromium/WebKit y movil/desktop: incluye cerrar la pestana, abrir otra y recuperar, ausencia de sesion, otra cuenta, error de red y cookies no confirmadas.
- 168 verificaciones de ajuste en Chromium/WebKit, cuatro proveedores y 320x480, 390x664, 1365x768: login, alta y errores sin desbordes. Se corrigio el ajuste de errores en pantallas compactas. No se afirma prueba fisica de iPhone.
- 41 archivos de iconos, incluidas las catorce skins: presentes y con dimensiones verificadas.
- Miniflare: recuperacion real del mismo token cifrado y aislamiento por host aprobados.
- Los sincronizadores y pruebas reciben PRODUCT_WORKTREES_FILE con todas las raices explicitas. Antes algunas pruebas compilaban otra copia; ahora tanto absWorkingDir como resolveDir y assets apuntan al candidato.

El chat, sus invitaciones, modales PWA, SDK, teclado, oscurecimiento, footer y margenes conservan sus fuentes aprobadas. No hay cambios de API2, reglas financieras, esquema, datos reales, tracking o motores de landings. Atrio/NexoBet mantienen sus adaptadores y bases independientes; estos cambios viven en los gateways que sirven a ambos.

## Limites de rendimiento y entrega

La recuperacion evita repetir el login manual de una cuenta con sesion vigente. No se promete un tiempo nuevo para la primera vinculacion: aun depende de los proveedores y del paquete de velocidad de API2 pendiente de despliegue por el programador. El intento, la validacion del destino y los limites existentes se conservan; no se eliminan controles para reducir esa espera. El error 409 sigue bloqueando vinculaciones incompatibles.

Checkpoint previo: C:/Users/Leo/Desktop/V2/CURSOR/.checkpoints/agency-recovery-ui-2026-11-16T19-58-44-487Z. Evidencia local: C:/Users/Leo/Desktop/V2/CURSOR/.local/agency-review-20261116. Publicacion y hashes por producto se registran en la evidencia coordinada de Atrio; no confundir commit con despliegue. Catalogo UX-029.
