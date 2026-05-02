# Visión general de entornos

La documentación actual permite distinguir tres niveles de entorno:

- TEST como entorno operativo principal de producto y backoffice
- AUDIT como clon estructural aislado para revisión y validación
- PRODUCTION como capa pública más limitada, con foco visible en landing y assets

## Política por entornos

En este repositorio se documenta por entorno:

- propósito
- diferencias funcionales
- dependencias lógicas relevantes
- riesgos o incertidumbres versionadas

No se documenta por entorno:

- inventario exhaustivo de recursos cloud
- identificadores concretos
- topología sensible de red

## Diferencias generales observadas

- TEST es la referencia funcional más claramente soportada por código
- AUDIT ya aparece contemplado en configuración y en documentación operativa previa
- PRODUCTION está menos descrito en el código del backend y más presente como superficie pública y de assets

## Product Operational Mode por entorno

La capa Product Operational Mode (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)) está implementada en backend con alcance parcial; ver detalle operativo en [runbooks.md](../04-operations/runbooks.md). La intención de configuración por entorno es:

- **TEST y AUDIT**: modo `OPEN` con registros de cliente y modelo cerrados server-side. Las cuentas existentes operan con normalidad; los endpoints públicos de registro responden cierre aunque alguien conozca la URL. **Configuración aplicada y validada con tráfico real**: `PRODUCT_ACCESS_MODE=OPEN`, `PRODUCT_REGISTRATION_CLIENT_ENABLED=false`, `PRODUCT_REGISTRATION_MODEL_ENABLED=false`.
- **PRO prelaunch**: modo `PRELAUNCH` con registros configurables, en principio abiertos para captación de Fase 1 del roadmap. Pendiente de validación operativa antes de activarse en PRO.
- **PRO normal**: modo `OPEN` con registros abiertos.
- **Mantenimiento puntual** en cualquier entorno: modo `MAINTENANCE` activado durante la ventana operativa, con registros según decisión del momento. Implementado en código pero no ejercitado aún en entornos.
