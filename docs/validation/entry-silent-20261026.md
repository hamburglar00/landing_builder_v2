# Espera sin aviso de redirección — 26/10/2026

Se elimina «Vas a ingresar automáticamente.» sin reemplazarlo por otro aviso.
Durante la espera configurada, el estado queda vacío. Conserva el espacio del
estado para evitar saltos de posición. La duración, el adelanto con Continuar,
la autenticación única y el feedback del ingreso efectivo siguen igual.

La fuente común es `landing-autologuin/src/lib/preparation-page.ts` y se
sincroniza con los otros tres gateways. La pantalla compartida atiende ambos
motores. No cambia el código del constructor, clásico o Atrio ni requiere DB.
