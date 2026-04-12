# Entorno AUDIT

## Propósito

AUDIT se plantea como un entorno aislado para revisión, validación y preparación de auditorías sin interferir con TEST.

## Aporte útil consolidado del material previo

La documentación previa permite sostener que AUDIT:

- replica la topología lógica de TEST
- dispone de superficie pública, superficie admin, backend y assets dedicados
- tiene profile de aplicación propio
- utiliza base de datos separada
- se preparó con saneado funcional de datos para evitar arrastrar actividad operativa de TEST

## Estado documentable

AUDIT debe entenderse como entorno construido y funcional a nivel base, con estos hitos ya absorbidos a nivel lógico:

- aislamiento de aplicación y datos
- base de datos preparada como entorno limpio
- despliegue previsto para frontend, backend y validación end-to-end

## Saneado aplicado

Se elimina del corpus principal el detalle de:

- identificadores de distribuciones y certificados
- buckets concretos
- endpoints exactos de base de datos
- direcciones IP públicas
- security groups y subnets específicas

## Riesgos y dudas

- la documentación previa detectaba diferencias de fallback SPA entre TEST y AUDIT en la capa edge
- el código versionado de WebSocket sigue mostrando orígenes permitidos centrados en TEST y localhost

Ambos puntos deben revisarse cuando se actualice específicamente la documentación y validación técnica del entorno AUDIT.
