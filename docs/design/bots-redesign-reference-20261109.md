# Rediseño de la pantalla Bots (`/dashboard/bots`)

## Objetivo

Reorganizar la UI de la pantalla **Bots** para que sea más clara y minimalista, **sin quitar ninguna funcionalidad ni cambiar la lógica**. Es un cambio solo de presentación: los mismos datos, endpoints, handlers, permisos y confirmaciones que hoy. Si algo de este documento obliga a tocar lógica de negocio, frená y avisá antes de hacerlo.

Antes de empezar:
1. Ubicá el componente/página de la ruta `/dashboard/bots` y todos sus subcomponentes (barra de filtros, filas por gerencia, detalle de WhatsApp, detalle de Atrio, "Métricas de Atrio").
2. Listá cada acción que existe hoy en la pantalla y verificá, al terminar, que todas siguen disponibles (ver la tabla "Dónde queda cada función").
3. Reutilizá los estilos y componentes existentes del proyecto (botones, inputs, menús, badges). Si hay tokens de color, usalos; los valores de abajo son la referencia visual.

---

## Estructura de la página (de arriba hacia abajo)

### 1. Encabezado
- **Izquierda:** título `Bots` (24px, bold). Debajo, en una sola línea chica (12.5px, gris):
  `WhatsApp y Atrio por gerencia · ● Sincronizado 14:07, próxima en 04:54 · Sincronizar ahora`
  - El punto verde y el horario vienen de los datos actuales de sincronización.
  - "Sincronizar ahora" es un enlace/botón de texto en verde que dispara la **misma acción** que el botón "Sincronizar" actual.
  - El texto "Métricas de mensajes calculadas por backend cada 30 min" pasa a un `title`/tooltip sobre el indicador de sincronización.
- **Derecha (alineados a la derecha):** `Grupos de trabajo` (botón secundario, con borde) y `Vincular bots` (botón primario, verde). Mismas acciones que hoy.
- Se elimina el eyebrow "OPERACIÓN" y las tres líneas de texto técnico actuales.

### 2. Barra de filtros (una sola fila)
De izquierda a derecha:
1. **Buscador:** placeholder `Buscar gerencia, asesor, bot o teléfono`. Máximo ~380px de ancho.
2. **Canal:** tres opciones de texto sin bordes `Todos 71 · WhatsApp 66 · Atrio 7` (los números son contadores calculados). La opción activa con fondo sutil. Reemplaza las pestañas actuales Todos/WhatsApp/Atrio.
3. **Solo activas:** interruptor (switch) con etiqueta. Misma lógica que el botón "Solo activas 28/71" actual.
4. **Acciones** (alineado a la derecha): botón con menú desplegable que agrupa las acciones masivas. Ver contenido abajo.

**No agregar** filtro de orden ni bloque de resumen/KPIs.

#### Menú "Acciones" (en este orden)
- Contadores de WhatsApp
- Mensajes de WhatsApp
- Sincronización automática 00:00 — con su interruptor On/Off dentro del ítem (es el actual "Auto 00:00")
- — separador —
- Reiniciar asignaciones de Atrio…
- Reiniciar chats de Atrio…
- — separador —
- **Borrar teléfonos inactivos…** (texto rojo, último ítem)

Las acciones de reinicio y borrado mantienen o agregan **confirmación** antes de ejecutarse. Se elimina el bloque desplegable "Métricas de Atrio" (sus dos acciones pasan a este menú).

### 3. Tabla única
Una sola tabla para todos los canales, con **una sola cabecera** (no hay cabeceras distintas para WhatsApp y Atrio).

**Columnas, en este orden:**

| # | Columna | Alineación | Contenido |
|---|---|---|---|
| 1 | GERENCIA | izq. | Nombre (semibold) y debajo `ID 272` en gris chico |
| 2 | ASESOR | izq. | Nombre del asesor y debajo su handle (`/gera`) en gris |
| 3 | CANAL | izq. | `WhatsApp`, `Atrio` o `WhatsApp + Atrio` (texto gris, sin badge) |
| 4 | BOT | izq. | Atrio: `Bot 1035 · MKT` y debajo la plataforma (`Rey de Ases`). WhatsApp: el número de teléfono |
| 5 | TIPO | izq. | Ej. `mkt` |
| 6 | USO | izq. | Ej. `WhatsApp publicitario` — **solo texto**, sin desplegable en la tabla |
| 7 | ESTADO | izq. | Punto de color + texto (ver Estados) |
| 8 | CONTADOR | der. | Contador. En Atrio es el valor de "Asignaciones" |
| 9 | CHATS INICIADOS | der. | Atrio: chats iniciados. WhatsApp: mensajes recibidos |
| 10 | HISTÓRICO | der. | Histórico |
| 11 | (acciones) | der. | Botón ⋯ y, si corresponde, flecha de desplegar |

**Regla del guion:** si un dato no aplica a ese canal o a ese nivel, se muestra `–` (guion medio) **centrado** en la celda, en gris tenue.

Números con `font-variant-numeric: tabular-nums` y separador de miles (`1.908`).

Se eliminan de las filas: la etiqueta `PBadmin` (se repetía en todas) y el ID entre paréntesis pegado al nombre (pasa debajo, en gris).

#### Filas: regla de una sola fila
- **Gerencia con un solo asesor/bot** (caso típico de Atrio, ej. *afrika*): se muestra **en una única fila** con todos los datos de ese asesor/bot (asesor, canal, bot, estado, contador, chats, histórico). **No** se muestra una fila de resumen más una fila de detalle. Esa fila no lleva flecha de desplegar.
- **Gerencia con varios elementos** (ej. una gerencia de WhatsApp con 4 teléfonos): la fila de la gerencia muestra los totales (ASESOR `–`, BOT `4 teléfonos`, TIPO `–`, USO `–`) y es un **desplegable**. Al abrirla aparece **un renglón por teléfono/asesor**, usando **las mismas columnas** que la cabecera:
  - Primera columna: `└` como sangría visual.
  - Teléfono de WhatsApp: ASESOR `–`, CANAL `WhatsApp`, BOT = número, TIPO `mkt`, USO `WhatsApp publicitario`, ESTADO del teléfono (ej. `No disponible`), CONTADOR, CHATS INICIADOS (mensajes), HISTÓRICO. La "Última sync" pasa a tooltip sobre el estado.
  - Asesor de Atrio: ASESOR + handle, CANAL `Atrio`, BOT + plataforma, TIPO `–`, USO `–`, estado, asignaciones, chats, histórico, y su propio menú ⋯.

#### Desplegar
- Toda la fila de la gerencia es clickeable para abrir/cerrar (cursor pointer), además de la flecha.
- Los clicks dentro del menú ⋯ **no** deben abrir/cerrar la fila (`stopPropagation`).
- Accesibilidad: la flecha es un `<button>` con `aria-expanded` y `aria-label="Ver detalle"`.

#### Menú ⋯ de cada fila de gerencia
- Administrar gerencia
- Sincronizar
- Si la fila es de **un solo asesor de Atrio**, a continuación: Abrir asesor · Abrir chat del bot · Editar vínculo · Reiniciar asignaciones… · Reiniciar chats… · separador · **Quitar asesor…** (rojo)
- Si la gerencia es de **WhatsApp**: bloque "Reparto equitativo por" con dos opciones `Contador | Mensajes` (es el actual "Equitativo por"), separador, Reiniciar contador… · Reiniciar mensajes…

#### Menú ⋯ de cada renglón de asesor de Atrio (dentro de un desplegable)
Abrir asesor · Abrir chat del bot · Editar vínculo · separador · Reiniciar asignaciones… · Reiniciar chats… · separador · **Quitar asesor…** (rojo)

#### Estados (columna ESTADO)
Punto de 6px + texto en palabras, nunca solo color:
- Verde (`#6FD08C`, texto `#CDE9D5`): `Activo`, `1 publicitario activo`, `2 publicitarios activos`.
- Ámbar (`#F2B35B`, texto `#F2C27A`): `Sin publicitarios activos`, `Sin managers activos` (reemplaza el aviso amarillo que hoy aparece dentro del detalle).
- Gris (`#4A565C`, texto `#8A958F`): `No disponible`.
- No usar rojo para "0 publicitarios": el rojo queda para errores reales y acciones destructivas.

### 4. Pie
- Izquierda: `10 de 71 gerencias` (gris chico). Corrige el actual pie si dice "registros".
- Derecha: paginación compacta `‹ 1 2 … 8 ›`, página actual con fondo sutil.

---

## Estilo visual

Mantener la estética oscura del builder. Valores de referencia:

| Elemento | Valor |
|---|---|
| Fondo de la página | `#0A0F12` |
| Tabla: borde externo | `1px solid #2A363D`, `border-radius: 12px` |
| **Cabecera de la tabla** | fondo `#16211A`, borde inferior `#2C4A1E`, texto `#9DE865`, 11px, bold, mayúsculas, `letter-spacing: 0.06em` |
| Filas alternadas | par `#131B20`, impar `#18232A` (ninguna igual al fondo de la página) |
| Separador entre filas | `1px solid #222E35` |
| Renglones desplegados (hijos) | fondo `#0E151A`, borde superior `#1F2A30` |
| Texto principal | `#EEF3EE` |
| Texto secundario | `#A3ADA7` |
| Texto tenue / guiones | `#6F7A74` / `#5E6A64` |
| Verde de marca (botón primario, enlaces) | `#8EE04E`, texto sobre verde `#0B1410` |
| Menús desplegables | fondo `#131B20`, borde `#26323A`, radio 11px, ítems 13px |
| Ítems destructivos | texto `#F07A7E` |
| Tipografía | Inter (la del proyecto) |

Padding de filas: `11px 12px`. Gap entre columnas: `14px`.

Grid de referencia para cabecera, filas y renglones hijos (los tres deben usar **la misma** definición para que las columnas queden alineadas):

```css
grid-template-columns:
  minmax(0,1.4fr)  /* GERENCIA */
  minmax(0,0.9fr)  /* ASESOR */
  104px            /* CANAL */
  minmax(0,1.2fr)  /* BOT */
  56px             /* TIPO */
  156px            /* USO */
  minmax(0,1.2fr)  /* ESTADO */
  80px             /* CONTADOR */
  108px            /* CHATS INICIADOS */
  84px             /* HISTÓRICO */
  64px;            /* acciones */
```

(Si la tabla actual es `<table>`, se puede implementar como `<table>` con `colgroup`; lo importante es que cabecera, filas y renglones hijos compartan columnas.)

## Responsive
- La tabla va dentro de un contenedor con `overflow-x: auto` y un `min-width` (~1260px) para que en pantallas angostas se desplace de costado dentro de su caja, sin romper la página.
- El encabezado y la barra de filtros hacen *wrap*.

---

## Dónde queda cada función (checklist: nada se pierde)

| Hoy | En el rediseño |
|---|---|
| Grupos de trabajo | Botón secundario, arriba a la derecha |
| Vincular Bots | Botón primario, arriba a la derecha |
| Próxima sincronización / última actualización | Línea chica bajo el título + tooltip |
| Sincronizar (barra) | "Sincronizar ahora" bajo el título |
| Buscador | Barra de filtros |
| Solo activas 28/71 | Interruptor en la barra de filtros |
| Pestañas Todos / WhatsApp / Atrio | Selector de canal con contadores |
| Auto 00:00 | Menú Acciones → Sincronización automática |
| Contadores WhatsApp | Menú Acciones |
| Mensajes WhatsApp | Menú Acciones |
| Borrar teléfonos inactivos | Menú Acciones (último, rojo, con confirmación) |
| Métricas de Atrio → Reiniciar asignaciones de Atrio | Menú Acciones |
| Métricas de Atrio → Reiniciar chats de Atrio | Menú Acciones |
| Detalle WhatsApp → Administrar gerencia | Menú ⋯ de la fila |
| Detalle WhatsApp → Sincronizar | Menú ⋯ de la fila |
| Detalle WhatsApp → Equitativo por Contador / Mensajes recibidos | Menú ⋯ de la fila ("Reparto equitativo por") |
| Detalle WhatsApp → Reiniciar contador / Reiniciar mensajes | Menú ⋯ de la fila |
| Detalle WhatsApp → aviso "Sin managers activos…" | Columna ESTADO de la gerencia |
| Detalle WhatsApp → tabla de teléfonos (teléfono, estado, tipo, uso, contador, mensajes, históricos, última sync) | Renglones hijos con las columnas de la tabla única; última sync en tooltip |
| Detalle WhatsApp → selector de Uso por teléfono | La celda USO muestra solo texto. **Mantener la posibilidad de cambiarlo**: moverlo al menú ⋯ del renglón del teléfono ("Cambiar uso…") o al hacer click en la celda. Consultar si hay dudas |
| Detalle Atrio → Administrar → Abrir asesor, Abrir chat del bot, Editar vínculo, Reiniciar asignaciones, Reiniciar chats, Quitar asesor | Menú ⋯ (de la fila si es asesor único, o del renglón hijo) |
| Etiqueta PBadmin | Se elimina de la vista (si hay más de un origen, mostrarlo en el detalle o como filtro) |

## Criterios de aceptación
- [ ] Ninguna acción de la tabla anterior dejó de estar disponible.
- [ ] No se modificaron endpoints, lógica de negocio ni permisos.
- [ ] Hay una única cabecera de columnas y los renglones hijos quedan alineados con ella.
- [ ] Los `–` están centrados y en gris tenue.
- [ ] Las gerencias con un solo asesor/bot ocupan una sola fila, sin flecha.
- [ ] Toda la fila de una gerencia con varios elementos abre/cierra el desplegable; el menú ⋯ no lo dispara.
- [ ] Reinicios, "Quitar asesor" y "Borrar teléfonos inactivos" piden confirmación.
- [ ] Las filas alternan dos tonos y ninguna tiene el mismo color que el fondo de la página.
- [ ] A 390px de ancho la página no se desborda; la tabla se desplaza dentro de su contenedor.
- [ ] Botones con solo ícono tienen `aria-label`; los menús son navegables con teclado.