# Visión general del backoffice

El backoffice es una superficie independiente del producto, pero comparte backend y base de datos con el resto del sistema.

## Finalidad

- operación diaria
- revisión de modelos
- moderación
- finanzas
- control interno
- administración de accesos

## Módulos observables en código

- overview
- streams activos
- modelos
- moderación
- finanzas
- auditoría interna
- datos internos
- administración
- perfil de backoffice

## Principio de diseño

El backoffice no es un sistema separado; es una capa operativa interna montada sobre el mismo núcleo transaccional del producto.
