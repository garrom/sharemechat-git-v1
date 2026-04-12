# Alcance de compliance

El proyecto contiene varios dominios con impacto claro en compliance y control operativo:

- age gate y aceptación de términos
- onboarding y KYC de modelos
- verificación de email
- restricciones por país
- moderación
- trazabilidad de streams
- wallet, gifts, refunds y payouts
- control de acceso de backoffice

## Qué mantiene este repositorio

En el corpus principal se documenta:

- el alcance funcional de estos dominios
- la lógica general de control
- las zonas con enforcement parcial o heterogéneo
- los riesgos funcionales observables desde código y configuración

## Qué no se documenta aquí

No se mantiene como documentación principal:

- inventario exhaustivo de infraestructura de seguridad
- configuraciones finas de red o cloud
- detalles operativos sensibles de auditoría externa

## Observación relevante

El proyecto ya incluye piezas pensadas para auditoría interna y revisión administrativa. Eso justifica mantener documentación de alcance y controles, pero no un inventario detallado de la infraestructura subyacente.
