# Estrategia de PSP

Este documento describe la dirección de trabajo de SharemeChat respecto a procesadores de pago (PSP), bajo la clasificación adult/streaming adoptada en [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md).

## Estado actual

**Ningún PSP está cerrado contractualmente.**

- **CCBill**: contactado, mantuvo conversaciones de onboarding iniciales y posteriormente dejó de responder. No queda como vía cerrada formalmente; queda como vía silente.
- **Segpay**: vía activa de onboarding. Comunicación abierta, con due diligence en curso. Sin contrato firmado al cierre de este documento.

La integración técnica con CCBill existe parcialmente en código (`CcbillService`, `BillingController`, `PaymentSession`, `CcbillNotifyRequestDTO`) por trabajo previo a esta fase. No hay integración técnica con Segpay todavía.

## Principio operativo: redundancia de PSP

SharemeChat no quiere depender de un único PSP. La dependencia de un PSP único en el vertical adult es un riesgo operacional dominante: cierre de cuenta, recategorización forzada o cambio unilateral de condiciones pueden interrumpir el flujo de cobro sin alternativa preparada.

La dirección de trabajo es:

- Avanzar con Segpay como vía activa.
- Mantener disponible la opción de reactivar CCBill o de incorporar un tercer PSP adult-specialist cuando proceda.
- Diseñar la integración técnica para que el contrato entre la lógica de wallet/recarga y el PSP sea sustituible: el PSP se invoca a través de un servicio que abstrae el proveedor concreto (patrón análogo al `KycProviderConfigService` para verificación).

Este principio queda como dirección, no como implementación cerrada. El frente operativo sigue siendo Segpay; CCBill no se descarta formalmente.

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
