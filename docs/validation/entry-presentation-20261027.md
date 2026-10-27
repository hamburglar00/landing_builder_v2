# Presentación del recorrido Template 7 → gateway — 27/10/2026

## Alcance

Fuente común de transición y preparación en Rey, sincronizada a Ases del Norte,
Ganamos NET y Ganamos+. Constructor y clásico consumen la misma transición.
Mi perfil se modifica una sola vez en Atrio. No hay cambios de API2, Panel3,
operaciones financieras, tracking, DB o migraciones. Ganamos+ mantiene su
excepción: sin altas PBAdmin; la UI y el acceso de cuentas existentes sí aplican.

La nueva consulta `purpose: entry` utiliza el endpoint privado de credenciales
existente, solo después del login. Exige mismo origen, request ID y sesión
HttpOnly; rechaza selección de cuenta o conversación. Perfil/chat mantienen
su contrato. Respuesta `private, no-store`; nunca se incorpora la clave al HTML
inicial, bootstrap público, URL, localStorage o analytics. La consulta tiene
timeout de cuatro segundos y corre sin retener la navegación ni el botón.

## Pantallas y textos

No todas aparecen en cada visita. Se omite creación al recuperar una cuenta;
los estados rápidos pueden durar muy poco. No hay demoras agregadas para
hacerlos visibles. La espera administrable de la tarjeta se conserva sin avisos.

| Estado | Texto y controles |
| --- | --- |
| Formulario de Diana (HTML público revisado el 27/10) | «CREÁ TU CUENTA EN GANAMOS NET». «Ingresá tu nombre para crear tu usuario ¡en menos de 2 minutos ya estas jugando!». Campo «Tu nombre», ejemplo de nombre rotativo, CTA «CREAR USUARIO». Título, descripción e imagen dependen de la landing. WhatsApp opcional solo si está configurado. |
| Confirmación del nombre / creación | Logo de la página. «Creando tu cuenta». «Estamos preparando tu acceso.». Indicador de carga. En clásico ocurre sobre la landing; constructor puede continuar con el mismo estado en `/prepare`. |
| Entrada de un pase ya emitido | Logo. «Ingresando a la plataforma». «Estamos preparando tu acceso.». Indicador de carga. Se usa, entre otros casos, al llegar desde el clásico. |
| Cuenta creada | Logo. «¡Tu cuenta está lista!». «Guardá tu usuario y clave para volver a ingresar.». USUARIO y CLAVE, cada uno con «Copiar» / «Copiado». «Continuar a la plataforma». Durante login: «Estamos preparando tu ingreso.». Mientras se consulta la clave: «Consultando…»; si falla: «Disponible en Mi perfil». Al estar listo el ingreso, el área de estado queda vacía durante la espera configurada. |
| Continuar pulsado antes de finalizar login | CTA deshabilitado con spinner: «Preparando tu ingreso…». Debajo: «Estamos confirmando tu acceso.». No inicia otra autenticación. |
| Navegación efectiva | CTA con spinner: «Ingresando a la plataforma…». Debajo: «Estamos abriendo la plataforma.». Es feedback del trabajo en curso, no un anuncio de autoredirección. |
| Plataforma autenticada, chat aún preparando datos | Capa de transición con logo. «Conectando con tu asesor». «Tu sesión en la plataforma está lista.». Indicador hasta recibir el chat hidratado y los datos para cargar (o confirmar que no hay billetera configurada). |
| Recorrido listo | Desaparece la transición. Plataforma autenticada y widget utilizable con asesor, conversación, tarjeta de carga y chips que correspondan a su configuración. El contenido del proveedor puede incluir sus propios avisos, por ejemplo mayoría de edad. |

Alternativas y recuperación:

| Caso | Texto y controles |
| --- | --- |
| Creación/preparación fallida | «No pudimos completar el acceso». «Esperá unos segundos e intentá nuevamente.». «Reintentar». Conserva el intento recuperable. |
| Pase ausente o malformado | «No pudimos preparar tu acceso». «Volvé a la página anterior e intentá nuevamente.». |
| Error en la landing | «No pudimos abrir tu cuenta ahora. Podés reintentar en 45 segundos.». Luego: «Podés volver a intentar. No se creará una cuenta duplicada.». |
| Conexión del chat lenta (20 s) | «No pudimos completar la conexión». «La conexión está tardando más de lo esperado. Podés reintentar sin crear otra cuenta.». «Reintentar conexión» / «Continuar al chat». |
| Chat listo pero datos de carga fallidos | Mismo título y botones. «El chat está disponible, pero no pudimos obtener los datos para cargar. Podés reintentar o continuar al chat.». |
| Navegador interno que necesita salida | «Continuá con tu acceso». Android: «Estás en un navegador interno. Tocá para abrir en Chrome y continuar con tu cuenta.», «Abrir en Chrome». iOS: «Estás en un navegador interno. Abrí este enlace en Safari desde el menú de la app, o copialo y pegalo en Safari.», «Abrir enlace». Ambos: «Copiar enlace» y «El enlace es temporal y de un solo uso. Abrilo una sola vez.». |
| Recuperación de sesión | «Recuperando tu acceso…». Si no hay sesión recuperable: «Ingresá a tu cuenta», Usuario, Contraseña con ojo, «Ingresar», «Si todavía no tenés una cuenta, ingresá desde el enlace de tu asesor.». No es parte del alta normal. |

## Instalación: comportamiento existente, sin modificar

- SDK y funciones de app se habilitan tras la señal de chat/datos iniciales
  disponibles. Una solicitud explícita también puede habilitarlos.
- Si el recorrido solicita abrir el chat, el aviso automático se posterga;
  al cerrarlo se agenda para 600 ms después. Si el SDK no está listo, espera
  su inicialización.
- Sin esa postergación, iOS agenda el aviso 1.500 ms después de inicializar
  esas funciones. Un navegador con instalación nativa disponible lo agenda
  a 1.200 ms. No es una espera desde el clic en Crear usuario.
- No se ofrece instalación automática estando en modo app/standalone.
  «Ahora no» guarda la desestimación en localStorage del navegador/origen.
  Borrar sus datos o usar otra sesión privada puede perder ese recuerdo.
- Una invitación del asesor es independiente: tiene su propio ID y recuerdo
  de atención. Puede volver a ofrecer el instructivo tras descartar el automático.
- Propuesta todavía no aplicada: tarjeta discreta «Guardá tu acceso en este
  teléfono» después de una interacción útil, y abrir el instructivo solo al
  tocar «Instalar app». Conservar la invitación explícita y el acceso al
  instructivo desde el menú. No usar la mera llegada como motivo para un modal.

## Validación

- `check-entry-presentation.mjs`: 56 escenarios de navegador. Chromium y
  WebKit, 320×568, 390×844, 844×390 y 1366×768; tres paletas del perfil,
  cuatro gateways, copia de clave, fondos y restauración del tema al cerrar.
- `check-gateway-entry-ux.mjs`: 40 escenarios. Ambos motores, cuatro gateways,
  feedback de Continuar, una autenticación, movimiento/reapertura del chat,
  reducción de movimiento, zonas inferiores y centrado de invitaciones.
- Pruebas unitarias del endpoint: mismo origen, sesión requerida, rechazo de
  IDs ajenos y ausencia de caché. Pruebas del cliente: clave de otra cuenta
  rechazada y consulta pendiente incapaz de frenar la entrada.
- Fixtures locales: ninguna cuenta real creada, ningún mensaje enviado,
  ninguna operación financiera o evento de Meta emitido.
- TypeScript en Builder, Atrio y cuatro gateways; ESLint en los dos componentes
  de Atrio. Sincronización de transición, renderer clásico, SDK, movimiento y
  credenciales verificada. El instructivo y los disparadores de instalación
  no fueron editados.

Capturas y reportes locales: `.vercel/validation-entry-presentation-20261027/`
y `.vercel/validation-entry-ux/` (ignorados por Git). El tinte de las barras
nativas de Safari/Chrome requiere validación física del iPhone; WebKit de
escritorio no lo acredita. La captura de Chrome del usuario muestra incógnito,
que puede conservar el tema propio del navegador.

## Publicación verificada

Los siete repositorios quedaron comiteados y pusheados a sus ramas existentes.
Los siete builds de Vercel finalizaron READY y fueron promovidos. Se guardó el
despliegue anterior de cada proyecto antes de promover, comprobando que nadie
lo hubiera cambiado durante la preparación.

| Proyecto | Commit publicado | Despliegue Vercel |
| --- | --- | --- |
| Rey | `644b610` | `dpl_EGaw86s2usGfzNLUC4PwQKU5N64m` |
| Ases del Norte | `2a9e087` | `dpl_GM4ErwzKEVPahW7MF17SwMgrv9FZ` |
| Ganamos NET | `3080e87` | `dpl_TYmUgioXn1yh1MvU2o2UutxQe5ke` |
| Ganamos+ | `f1967c4` | `dpl_4LfY6mVSEuvRcDks8qUREPqycJUW` |
| Atrio | `51fcb5e` | `dpl_9DZECRtu1ce8NegdaPBRbvUsiEYj` |
| Builder | `4e1437d` | `dpl_4Bq8rCv4jYVktVzUyQ2vXU11o8Rg` |
| Clásico | `343a0fc` | `dpl_HSD5SyxYDsC8ztxVWhxZCpVVrGUE` |

Ganamos+ también quedó publicado en Cloudflare: versión
`a5ce092c-97d7-4938-8220-be8298a3c14f`, conservando variables y secretos.
Versión anterior del Worker: `5a196d9d-770f-43b4-98b7-d24d385d26fc`.

La [verificación pública](entry-presentation-public-20261027.json) comparó los
JS/CSS servidos por los cuatro dominios con las fuentes normalizando finales de
línea; comprobó la tarjeta con clave de ambos motores mediante GET del HTML,
sin ejecutarlo ni activar pases, y el rechazo 401 del endpoint sin sesión.
En Diana se verificó la transición actualizada tanto en clásico como constructor.
El bundle público del widget, descargado por `/embed/warm` sin montar el chat,
contiene «Tu cuenta» y ya no contiene «Tu cuenta del casino».

Resultado final local: 116 pruebas unitarias de gateways y 96 escenarios de
navegador aprobados. Ninguna creación o transacción productiva durante las
verificaciones. La validación física de barras nativas queda a cargo de la
prueba del usuario en su iPhone.

Despliegues anteriores para rollback: Rey `dpl_CUJVFgzEoZ1RhKfbZnBgugAxpMZf`,
Ases `dpl_9dWoSAHiu782HVXp3qhqCYvSpsUT`, NET `dpl_4bNMx7HtRjkd1hovbgVgCvnwyrS3`,
Ganamos+ `dpl_278fJtDA857BkWDXjn79UxP5UUBi`, Atrio `dpl_9Utpo9iR2epmb7uDzRZxRz4TYPR9`,
Builder `dpl_9yNFw8gEzauYWhZqTRhL78eeCKdL`, clásico `dpl_BK2aCxM8t729ZGqthc4q9KKGoqme`.
