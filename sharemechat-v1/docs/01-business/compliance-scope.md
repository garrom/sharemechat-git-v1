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

## Marco regulatorio adoptado

A efectos de compliance, SharemeChat se clasifica como merchant adult/streaming. La decisión, su justificación y las opciones descartadas viven en [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md). Esa clasificación condiciona:

- la arquitectura de verificación de edad e identidad (modelos y clientes), definida en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)
- la arquitectura del pipeline de moderación, definida en [ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md)
- la estrategia de PSP (Segpay como vía activa, principio de redundancia), descrita en [psp-strategy.md](psp-strategy.md)
- los mercados servidos y el orden de activación, descritos en [geographic-strategy.md](geographic-strategy.md)

## Entregables accionables

El listado operativo de obligaciones derivadas de la clasificación adult/streaming y del onboarding con Segpay vive en [compliance-deliverables.md](compliance-deliverables.md). Incluye declaración 2257, Records Custodian, las cinco políticas formales que el PSP exige, resolución de quejas en 5 días hábiles, reporting mensual + nil report, valoración de membresía ASACP, y DPIA + base jurídica para procesamiento biométrico bajo GDPR.
