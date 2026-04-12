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
