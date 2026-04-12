# Modelo de permisos

## Roles de backoffice

- `ADMIN`
- `SUPPORT`
- `AUDIT`

## Resolución de acceso

El acceso efectivo combina:

- rol de producto, con acceso implícito si el usuario es `ADMIN`
- roles explícitos de backoffice
- permisos heredados por rol
- overrides individuales por usuario

## Capacidades del modelo

El diseño soporta:

- asignación de roles
- ampliación puntual de permisos
- retirada puntual de permisos
- activación o desactivación del acceso
- trazabilidad de cambios en el acceso

## Lectura operativa

Este modelo es una de las piezas más industriales del proyecto y justifica que la documentación interna mantenga una sección propia de backoffice en lugar de diluirla dentro de un README general.
