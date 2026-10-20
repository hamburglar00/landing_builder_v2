# Decisiones de producto

Antes de cambiar Template 7, su identidad, los recursos, Atrio o los gateways, leer [las decisiones aprobadas](docs/DECISIONES_APROBADAS_ATRIO_TEMPLATE7_GATEWAYS.md). Conservar ese contrato, actualizarlo cuando el usuario cambie una decisión y validar los comportamientos relacionados antes de publicar.

## Mejoras compartidas: siempre los cuatro gateways

Aplicar y verificar las mejoras comunes en Rey de Ases (`landing-autologuin`), Ases del Norte (`ases-gateway`), Ganamos NET (`ganamos-gateway`) y Ganamos+ (`multi-skin-gateway`) en el mismo lote. Priorizar lógica compartida y documentar excepciones del proveedor. El SDK canónico es `landing-autologuin/public/gateway-app-sdk.js`: ejecutar `node scripts/sync-gateway-app-sdk.mjs` y luego `--check`. Si la mejora vive en Atrio, mantener su implementación única y verificar la integración de los cuatro. Ganamos+ requiere revisar también el Worker público de Cloudflare. Registrar cobertura, configuración y publicación por casino. API2 permanece solo en local.
