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

## Product Operational Mode por entorno (intención futura, pendiente de implementación)

Cuando Product Operational Mode esté implementado (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)), la intención de configuración por entorno es:

- **TEST y AUDIT**: modo `OPEN` con registros de cliente y modelo cerrados server-side. Las cuentas existentes operan con normalidad; los endpoints públicos de registro responden cierre aunque alguien conozca la URL.
- **PRO prelaunch**: modo `PRELAUNCH` con registros configurables, en principio abiertos para captación de Fase 1 del roadmap.
- **PRO normal**: modo `OPEN` con registros abiertos.
- **Mantenimiento puntual** en cualquier entorno: modo `MAINTENANCE` activado durante la ventana operativa, con registros según decisión del momento.

Hasta que la implementación se haga efectiva, todos los entornos se comportan como `OPEN` con registros abiertos por defecto.
