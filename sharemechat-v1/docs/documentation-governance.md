# Gobierno documental y de decisión - SharemeChat

## Propósito

Este documento define cómo mantener la documentación del proyecto y cómo registrar cambios técnicos, operativos y de arquitectura de forma consistente.

La documentación del repositorio principal debe contener conocimiento funcional, técnico y operativo durable, pero no inventario sensible exhaustivo de infraestructura.

## Regla principal

Antes de modificar o crear documentación, identificar primero la naturaleza real del cambio o hallazgo.

## Clasificación del caso

### Caso 1. Cambio de arquitectura o diseño técnico
Ejemplos:
- cambio de flujo backend
- cambio en realtime
- cambio de estrategia de storage
- cambio en autenticación
- cambio en separación de superficies o entornos

Acción:
- actualizar el documento de arquitectura correspondiente en `docs/02-architecture/`
- si la decisión es relevante o con impacto duradero, crear o actualizar ADR en `docs/06-decisions/`

### Caso 2. Cambio de comportamiento de un entorno
Ejemplos:
- TEST y AUDIT dejan de comportarse igual
- se despliega nueva topología
- cambia el estado de AUDIT
- cambia una limitación de PRODUCTION

Acción:
- actualizar `docs/03-environments/`
- si afecta a planificación o fases, actualizar también `docs/07-roadmap/`

### Caso 3. Incidencia, anomalía o problema detectado
Ejemplos:
- deep-link falla en AUDIT
- WebSocket no está alineado con la intención de entorno
- fallback SPA es inconsistente
- error operativo repetible

Acción:
- registrar el caso en `docs/04-operations/incident-notes.md`
- si sigue existiendo riesgo o deuda, reflejarlo también en `docs/04-operations/known-risks.md`

### Caso 4. Problema resuelto
Ejemplos:
- una incidencia ya está corregida
- una divergencia de entorno ya quedó alineada
- un riesgo ya no aplica

Acción:
- actualizar el documento donde se describía el problema
- dejar constancia de resolución en `incident-notes.md`
- ajustar o retirar el punto correspondiente de `known-risks.md` si ya no aplica
- actualizar arquitectura o entorno si la solución cambia la realidad del sistema

### Caso 5. Cambio funcional o de negocio
Ejemplos:
- cambia el rol real de USER
- cambia onboarding de CLIENT o MODEL
- cambia lógica de wallet, gifts o compliance
- cambia alcance del backoffice

Acción:
- actualizar `docs/01-business/`
- actualizar `docs/05-backoffice/` si aplica
- actualizar `docs/02-architecture/` si el cambio funcional implica cambio técnico real

### Caso 6. Decisión estructural importante
Ejemplos:
- adoptar nueva estrategia de despliegue
- sustituir integración externa
- cambiar patrón de seguridad
- rehacer arquitectura realtime
- introducir un nuevo entorno

Acción:
- crear ADR nuevo en `docs/06-decisions/`
- después actualizar la documentación de estado y arquitectura afectada

### Caso 7. Estado de fase, deuda o siguiente etapa
Ejemplos:
- fase actual cambia
- se completa una etapa
- aparece una nueva prioridad
- se redefine el plan de hardening
- AUDIT entra en nueva fase

Acción:
- actualizar `docs/07-roadmap/current-phase.md`
- actualizar `docs/07-roadmap/pending-hardening.md` o `audit-environment-plan.md` si aplica

## Regla de no duplicidad

No duplicar la misma información en varios documentos si no aporta valor claro.
Cada dato debe tener un lugar principal.
Los demás documentos deben resumir o enlazar conceptualmente, no repetir.

## Regla de saneado

No documentar en el repo principal:
- IDs reales de CloudFront
- ARNs
- IPs públicas
- hostnames exactos de RDS
- IDs de security groups, subnets o VPC
- inventario sensible detallado de infraestructura

Sustituir por nombres lógicos:
- distribución pública TEST
- bucket privado de frontend del entorno AUDIT
- instancia RDS MySQL del entorno TEST
- security group del backend
- certificado wildcard del entorno

## Regla de evidencia

No afirmar como hecho algo que no esté razonablemente soportado por:
- código del repositorio
- configuración versionada
- documentación interna previa fiable

Si existe duda, expresarla de forma profesional dentro del documento.

## Regla de mantenimiento

Ante cualquier cambio relevante:
1. identificar el tipo de cambio
2. actualizar el documento principal correcto
3. crear ADR si la decisión es estructural
4. registrar incidencia o riesgo si procede
5. evitar duplicidad y detalle sensible

## Mapa rápido de destino

- negocio y lógica funcional -> `docs/01-business/`
- arquitectura técnica -> `docs/02-architecture/`
- entornos -> `docs/03-environments/`
- operación, incidencias y riesgos -> `docs/04-operations/`
- backoffice -> `docs/05-backoffice/`
- decisiones de arquitectura -> `docs/06-decisions/`
- fase actual y planificación -> `docs/07-roadmap/`

## Regla final

Antes de editar, decidir primero qué tipo de cambio es.
Después escribir solo en el lugar correcto.
No reorganizar toda la documentación salvo petición explícita.