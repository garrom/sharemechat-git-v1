# Estrategia de PSP

Este documento describe la dirección de trabajo de SharemeChat respecto a procesadores de pago (PSP), bajo la clasificación adult/streaming adoptada en [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md).

## Estado actual

**Ningún PSP está cerrado contractualmente.**

- **CCBill**: contactado, mantuvo conversaciones de onboarding iniciales y posteriormente dejó de responder. No queda como vía cerrada formalmente; queda como vía silente.
- **Segpay**: vía activa de onboarding, **condicional**. Comunicación abierta, due diligence en curso. Sin contrato firmado al cierre de este documento. La continuidad con Segpay depende de que su equipo de compliance acepte el método de verificación de edad de cliente decidido por el producto (estimación facial vía Veriff + comprobación secundaria solo para casos borderline; ver [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)). Si Segpay exige documento de identidad para el 100% de los consumidores, no se continúa con Segpay y se activa el plan B descrito más abajo.

La integración técnica con CCBill existe parcialmente en código (`CcbillService`, `BillingController`, `PaymentSession`, `CcbillNotifyRequestDTO`) por trabajo previo a esta fase. No hay integración técnica con Segpay todavía.

## Principio operativo: redundancia de PSP

SharemeChat no quiere depender de un único PSP. La dependencia de un PSP único en el vertical adult es un riesgo operacional dominante: cierre de cuenta, recategorización forzada o cambio unilateral de condiciones pueden interrumpir el flujo de cobro sin alternativa preparada.

La dirección de trabajo es:

- Avanzar con Segpay como vía activa, sabiendo que es condicional al método de verificación de cliente.
- Mantener disponible la opción de reactivar CCBill o de incorporar un tercer PSP adult-specialist cuando proceda.
- Diseñar la integración técnica para que el contrato entre la lógica de wallet/recarga y el PSP sea sustituible: el PSP se invoca a través de un servicio que abstrae el proveedor concreto (patrón análogo al `KycProviderConfigService` para verificación).

Este principio queda como dirección, no como implementación cerrada. El frente operativo actual sigue siendo Segpay; CCBill no se descarta formalmente.

## Plan B de PSP

Como contingencia ante el escenario en que Segpay no acepte el método de verificación de cliente decidido en ADR-029, hay que mantener alineado un adquirente adult-specialist alternativo. **Candidatos** identificados (no seleccionados, no contactados formalmente al cierre de este documento):

- **Verotel / Vendo**
- **RocketGate**
- **Epoch**

La selección entre estos candidatos (o de un cuarto que aparezca) se hará si y cuando el plan B se active. Mientras tanto, la responsabilidad operativa es mantener la información actualizada (cobertura geográfica de cada uno, condiciones generales conocidas, postura sobre métodos de age assurance) para poder mover rápido si Segpay queda descartado.

El plan B no se activa de forma exploratoria: hacer onboarding paralelo con dos PSPs adult-specialist a la vez añadiría coste y carga de due diligence sin retorno claro mientras la vía Segpay esté abierta. El umbral de activación es una respuesta negativa de Segpay sobre el método de verificación de cliente, o un cierre inesperado de la vía Segpay por otra razón.

## Requisitos derivados de Segpay (vía activa)

La diligencia con Segpay impone obligaciones que aplican aunque el PSP final cambie. El listado accionable vive en [compliance-deliverables.md](compliance-deliverables.md). Resumen direccional:

- **Adult Content Due Diligence Checklist de Segpay**: documento operativo que cubre el cuerpo del onboarding. Incluye preguntas sobre verificación de edad, modelo de monetización y reporting (ver `compliance-deliverables.md` para detalle).
- **Verificación de edad** de modelos y de clientes (dirección de trabajo en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md)).
- **Moderación de contenido robusta en tiempo real** sobre streaming (dirección de trabajo en [ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md)).
- **Declaración 2257 en el footer** + Records Custodian nombrado antes del go-live.
- **Resolución de quejas** en 5 días hábiles + reporting mensual al portal del PSP + nil report cuando no hay actividad relevante.

## Implicaciones sobre el código existente

La integración CCBill en código (`CcbillService`, `POST /api/billing/ccbill/session`, webhook `/api/billing/ccbill/notify`) no se elimina: queda disponible por si CCBill se reactiva. El webhook sigue siendo un punto sensible con riesgo crítico antes de dinero real, según ya documentado en [known-risks.md](../04-operations/known-risks.md) y en `pending-hardening.md`.

Cuando arranque la implementación con Segpay, se hará en paralelo a la CCBill existente, no como reemplazo. El servicio de wallet/recarga elegirá el PSP de salida según configuración.

## Lo que NO está decidido

- Qué PSP queda como prioritario en producción.
- Si Segpay cierra y CCBill no reaparece, qué tercer PSP adult-specialist se evalúa.
- El roadmap concreto de implementación técnica con Segpay (cuándo, qué endpoints, qué autenticación de webhook).

Estas decisiones se documentarán cuando se cierren. Mientras tanto, el principio (clasificación adult/streaming + redundancia de PSP) gobierna las decisiones de diseño hacia delante.

## Referencias

- [ADR-028 - Clasificación adult/streaming](../06-decisions/adr-028-business-classification-adult-streaming.md)
- [ADR-029 - Arquitectura de verificación de edad e identidad](../06-decisions/adr-029-age-and-identity-verification-architecture.md)
- [ADR-030 - Pipeline de moderación: build vs rent](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md)
- [compliance-deliverables.md](compliance-deliverables.md) — entregables accionables que el PSP exige.
- [known-risks.md](../04-operations/known-risks.md) — riesgo PSP no cerrado y riesgo webhook sin validar.
