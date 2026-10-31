# Imágenes y disponibilidad del chat — 31/10/2026

Implementación autorizada después de la auditoría de T7/T8 y la comparación con ganamosmayor.com. Incluye ambos motores, Atrio y los cuatro gateways; API2 permanece local. La prueba en las aplicaciones nativas del iPhone del usuario queda pendiente y no bloquea este lote.

## Comportamiento

- Editor: JPG/PNG/WebP/AVIF estáticos, hasta 4 MiB y 25 MP. El servidor autentica antes de decodificar; genera WebP de hasta 1920 px y 700 KiB. Conserva orientación, proporción y transparencia; elimina metadatos del derivado. Si un archivo compatible ya es más pequeño y no necesita normalización, se conserva. Un AVIF muy comprimido puede generar un WebP mayor por compatibilidad.
- Original y derivado se suben mediante el cliente autenticado a rutas nuevas dentro de su propia carpeta de Storage. La configuración utiliza únicamente la URL optimizada. Se conserva el original separado; no hay cambios de RLS, claves de servicio en el cliente ni sobrescritura de archivos existentes.
- T7 usa logo hasta 2x, fondo móvil de 640 px y versiones mayores en escritorio. La caja del logo queda reservada antes de descargarlo. La rotación conserva versiones y fallback por imagen.
- Clásica T7/T8 entrega el documento HTML público directamente desde middleware Node, sin hidratación ni chunks Next. Conserva metadatos, canonical, atribución y prioridad de `landing`. Las solicitudes RSC y los otros templates conservan su recorrido.
- `chat_usable` se emite cuando el compositor autenticado está visible y habilitado, después de dos frames. No depende de bienvenida/banco, no se emite en preload oculto ni con modales que cubren el input. `wallet_ready` y el antiguo `chat_ready` conservan su significado; los tiempos pueden solaparse y no deben sumarse.
- Bienvenida y banco realizan lecturas independientes en paralelo después de validar la misma identidad. La persistencia mantiene introducción → bienvenida → tarjeta y descarta resultados de vínculos modificados.
- Super Admin de Atrio: «Mostrar botón Continuar», desactivado por defecto e independiente de la espera. OFF mantiene el botón oculto y el ingreso automático. ON espera el clic con credenciales listas y revalida la misma sesión. El tiempo humano de lectura no consume el presupuesto de red.
- Preparación: presupuesto absoluto de 120 s para cuenta/finalización/login; cada operación mantiene sus límites 45/42 s y la confirmación de sesión comparte 15 s con su recuperación. Son máximos, no esperas mínimas.
- Rey, NET y Multi Skin pueden servir el prefijo autenticado antes de terminar el HTML del proveedor; en entrada inicial el script clásico permite arrancar también en WebKit antes del EOF. El resto se transforma completo, con cancelación propagada y fallback para estructuras inesperadas.
- Excepción Ases: mantiene inspección completa del HTML, porque un formulario de login tardío invalida los marcadores tempranos de saldo/usuario. Recibe las demás mejoras compartidas. No se omite una comprobación de sesión para ganar tiempo.

## Migraciones aplicadas

- Atrio `20261031170409_gateway_continue_button.sql`: booleano `continue_button_enabled NOT NULL DEFAULT false` y `manager_type` aditivo en contexto privado de respuestas. Verificado tras aplicar: botón false, espera false, segundos existentes 20 conservados.
- Builder `20261031170412_entry_funnel_chat_usable.sql`: admite el nuevo evento manteniendo permisos, payload cerrado y retención. Las advertencias de los asesores de seguridad antes/después son idénticas.

## Validación aislada

- Atrio: pruebas de configuración/roles, solapamiento real de promesas, identidad y relectura del banco. PGlite verifica SQL y permisos. UI real del switch en Chromium/WebKit a 390 y 1365 px, guardado ON/OFF simulado, sin desbordes.
- Componente real del chat: ocho escenarios Chromium/WebKit, tres temas, preload oculto, origen/ventana, reapertura y banco pendiente. Se pudo escribir mientras la respuesta de bienvenida/banco estaba retenida. Sin mensajes ni conversiones productivas.
- Telemetría: seis pruebas de contrato y ocho escenarios de navegador; PGlite comprueba idempotencia, aislamiento, rechazo de PII, roles y retención. No se crean artificialmente `chat_ready` ni `wallet_ready` al recibir `chat_usable`.
- Imágenes/renderer: 36 pruebas focales, seis de routing, smoke HTTP y tipos/lint en ambos motores. Sin escrituras de Storage productivas durante las pruebas.
- Gateways: pruebas del helper de streaming, reescritura, preparación y settings. Ocho escenarios reales de navegador con proxy, sesión y cliente compilados; upstream y widget aislados. Comparación del HTML concatenado con la transformación completa y verificación de identidad/cookies. Tipos en los cuatro repos y sincronizaciones canónicas comprobadas.

## Medición de imágenes

Misma configuración Diana, viewport 390×844, DPR 3. Originales públicos intactos.

| Recurso | Antes | Después |
| --- | ---: | ---: |
| Fondo | 108.530 bytes | 61.196 bytes |
| Logo | 30.752 bytes | 15.682 bytes |
| Total imágenes | 139.282 bytes | 76.878 bytes |

Reducción de imágenes: 44,8%. En la comparación Chromium/WebKit, la geometría final de tarjeta y campo es idéntica. Con el logo retenido 1800 ms, el salto de 54,86 px desaparece; CLS Chromium pasa de 0,106278 a 0. El fondo es ligeramente más suave por su menor resolución. Evidencia local ignorada: `.vercel/entry-performance-audit-20261031/optimized-images-layout.json` y capturas before/after.

La auditoría previa midió aproximadamente 203 KB en Builder, 337 KB en clásica y 33 KB en la competencia. Los primeros dos valores incluyen unos 139 KB de imágenes; clásica además cargaba recursos Next. No equivalen a tiempos de cuenta/proveedor ni certifican conversión. La comparación pública posterior se registra al completar la promoción.
