# Estrategia de PSP

Este documento describe la dirección de trabajo de SharemeChat respecto a procesadores de pago (PSP), bajo la clasificación adult/streaming adoptada en [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md).

## Estado actual

**Ningún PSP de tarjetas está cerrado contractualmente. La vía viva de pagos hoy es cripto vía NOWPayments (ADR-051, activada en PROD el 2026-07-17).**

- **NOWPayments (cripto puente)**: **vía activa y operativa en PROD** desde 2026-07-17. Custodial, Invoice API, BTC + USDT (Tron/Ethereum) + USDC (Ethereum). Cubre el requisito Gate 3 del pivote soft launch (ADR-047: al menos un flujo de pago real end-to-end). Detalle técnico en [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md). Este es el PSP con el que abren los primeros usuarios reales de PROD; los PSPs de tarjeta que se listan abajo cubren la segunda fase.
- **CardBilling (filial de Verotel)**: **primer PSP potencial de tarjetas Visa/Mastercard**. Sustituye a Segpay como primera vía a explorar para procesamiento con tarjeta en el vertical adult. Verotel es adquirente adult-specialist establecido; CardBilling es su filial dedicada al procesamiento de tarjeta. Contacto formal pendiente de iniciar. Sin contrato ni onboarding empezado al cierre de este documento.
- **Segpay**: **DESCARTADO** (decisión 2026-07-18) por incompatibilidad estructural con la geografía de la sociedad. Segpay exige que el director/beneficiario efectivo resida en el mismo país donde está constituida la empresa (Estonia, `Shareme Technologies OÜ`). El operador único de SharemeChat reside fuera de Estonia, lo que Segpay considera indicio de "empresa pantalla" y bloquea el onboarding. Este es un requisito inmovible del vendor, no negociable con documentación adicional. Segpay queda como referencia histórica de las conversaciones de onboarding tenidas; no se retoma.
- **CCBill**: contactado en fase previa, mantuvo conversaciones de onboarding iniciales y posteriormente dejó de responder. Queda como vía silente sin cerrar formalmente; puede reactivarse si vuelve a responder, pero no se persigue activamente.

La integración técnica con CCBill existe parcialmente en código (`CcbillService`, `BillingController`, `PaymentSession`, `CcbillNotifyRequestDTO`) por trabajo previo a esta fase — se mantiene dormida (`ccbill.enabled=false` implícito) por si CCBill vuelve. No hay integración técnica con Segpay, ni con CardBilling; la abstracción `PaymentProvider` introducida por ADR-051 permite añadir un adapter CardBilling en un solo commit futuro sin tocar el orquestador ni el ledger.

## Principio operativo: redundancia de PSP

SharemeChat no quiere depender de un único PSP. La dependencia de un PSP único en el vertical adult es un riesgo operacional dominante: cierre de cuenta, recategorización forzada o cambio unilateral de condiciones pueden interrumpir el flujo de cobro sin alternativa preparada.

La dirección de trabajo es:

- Operar en producción con NOWPayments (cripto puente) como cobertura principal del arranque soft launch.
- Contactar CardBilling (filial de Verotel) como primer PSP potencial de tarjeta, con perspectiva de onboarding a medio plazo cuando el volumen justifique el papeleo adult-experienced.
- Mantener CCBill como vía silente reactivable + un pool de PSPs adult-specialist alternativos identificados en el Plan B.
- Diseñar la integración técnica para que el contrato entre la lógica de wallet/recarga y el PSP sea sustituible: los PSPs se invocan a través de la interface `PaymentProvider` (ADR-051) que abstrae el proveedor concreto. Añadir un adapter nuevo (CardBilling, RocketGate, Epoch...) es un commit aislado sin tocar orquestador ni ledger.

## Plan B de PSP (contingencia adult-specialist para tarjeta)

Ante el escenario en que la conversación con CardBilling se cierre por cualquier razón (rechazo de compliance, condiciones no viables, etc.), hay que mantener alineados adquirentes adult-specialist alternativos. **Candidatos** identificados como Plan B (no contactados formalmente al cierre de este documento):

- **RocketGate**
- **Epoch**
- **Vendo** (independiente de Verotel; queda como opción viva aunque su matriz esté ya en primer plano vía CardBilling)

La selección entre estos candidatos (o de un cuarto que aparezca) se hará si y cuando el plan B se active. Mientras tanto, la responsabilidad operativa es mantener la información actualizada (cobertura geográfica de cada uno, condiciones generales conocidas, postura sobre métodos de age assurance) para poder mover rápido si CardBilling queda descartado.

El plan B no se activa de forma exploratoria: hacer onboarding paralelo con múltiples PSPs adult-specialist a la vez añadiría coste y carga de due diligence sin retorno claro mientras la vía CardBilling esté abierta y NOWPayments esté cubriendo la circulación real de dinero en producción.

## Requisitos derivados de CardBilling / Verotel (vía a activar)

La diligencia con CardBilling / Verotel para procesamiento de tarjeta en el vertical adult impone obligaciones que aplican con cualquier adquirente adult-specialist. Muchas coinciden con las que ya se estaban preparando para Segpay antes del descarte del 2026-07-18. El listado accionable vive en [compliance-deliverables.md](compliance-deliverables.md). Resumen direccional:

- **Adult Content Due Diligence** equivalente al que exige cualquier adquirente adult-specialist: verificación de edad, modelo de monetización, reporting.
- **Verificación de edad** de modelos y de clientes (dirección de trabajo en [ADR-029](../06-decisions/adr-029-age-and-identity-verification-architecture.md), consolidación Didit en [ADR-035](../06-decisions/adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md)).
- **Moderación de contenido robusta en tiempo real** sobre streaming (dirección de trabajo en [ADR-030](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md), vendor cerrado en [ADR-037](../06-decisions/adr-037-moderation-visual-vendor-sightengine.md)).
- **Declaración 2257 en el footer** + Records Custodian nombrado antes del go-live.
- **Resolución de quejas** en plazo razonable + reporting mensual al portal del PSP + nil report cuando no hay actividad relevante.
- **DPO nombrado y publicado en la política de privacidad** (compliance GDPR estándar exigible por cualquier adquirente serio; realizado 2026-07-18).

## Implicaciones sobre el código existente

La integración NOWPayments (ADR-051) está viva en PROD desde 2026-07-17: `PspOrchestratorService`, `PspWebhookOrchestratorService`, endpoints `/api/billing/nowpayments/checkout` y `/api/webhooks/nowpayments/ipn`, tabla `payment_sessions` con `provider='nowpayments'`. La abstracción `PaymentProvider` permite añadir un adapter CardBilling nuevo sin tocar orquestador ni ledger — se registra como bean adicional en `PaymentProviderRegistry` y queda disponible con su propio `provider_key`.

La integración CCBill previa en código (`CcbillService`, `POST /api/billing/ccbill/session`, webhook `/api/billing/ccbill/notify`) no se elimina: queda disponible por si CCBill se reactiva. El webhook sigue siendo un punto sensible con riesgo crítico antes de dinero real, según ya documentado en [known-risks.md](../04-operations/known-risks.md) y en `pending-hardening.md`. La activación real requeriría cerrar contrato + firmar HMAC del webhook (patrón calcado del ya operativo en NOWPayments y KYC Didit).

Cuando arranque la implementación con CardBilling, se hará como adapter adicional junto a NOWPayments y CCBill (dormido), no como reemplazo. El orquestador de wallet/recarga elegirá el PSP de salida según `provider_key` seleccionado por el usuario en el modal de compra o por política admin.

## Lo que NO está decidido

- Roadmap concreto de contacto e implementación técnica con CardBilling (cuándo iniciar onboarding, qué documentación reunir de antemano, qué endpoints tiene su API).
- Si CardBilling se cierra por incompatibilidad de compliance o condiciones no viables, qué candidato del Plan B (RocketGate / Epoch / Vendo) se contacta primero.
- Umbral de volumen a partir del cual el coste de plan de tarjeta se compensa con la comisión ganada frente al coste de fees de cripto (cripto tiende a ~1-2% con NOWPayments; tarjeta adult ~4-6%; el punto de indiferencia depende del volumen mensual y del ticket medio).

Estas decisiones se documentarán cuando se cierren. Mientras tanto, el principio (clasificación adult/streaming + redundancia de PSP + cripto operativo ya en PROD) gobierna las decisiones de diseño hacia delante.

## Referencias

- [ADR-028 - Clasificación adult/streaming](../06-decisions/adr-028-business-classification-adult-streaming.md)
- [ADR-029 - Arquitectura de verificación de edad e identidad](../06-decisions/adr-029-age-and-identity-verification-architecture.md)
- [ADR-030 - Pipeline de moderación: build vs rent](../06-decisions/adr-030-moderation-pipeline-build-vs-rent.md)
- [compliance-deliverables.md](compliance-deliverables.md) — entregables accionables que el PSP exige.
- [known-risks.md](../04-operations/known-risks.md) — riesgo PSP no cerrado y riesgo webhook sin validar.
