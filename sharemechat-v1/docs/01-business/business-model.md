# Modelo de negocio

SharemeChat opera como una plataforma de videochat 1-a-1 de pago entre clientes y modelos remuneradas. A efectos de pagos y compliance se clasifica como merchant **adult/streaming** ([ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md), decisión cerrada que no se reabre): MCC adult, régimen normativo adult, PSP adult-specialist (CardBilling / Verotel vía activa). Dentro de esa clasificación regulatoria, el posicionamiento de producto es **adult dating intimate 1-a-1 entre adultos verificados**, no cam adult broadcast público. La diferencia es de descripción del producto y de experiencia de usuario, no de MCC ni de régimen: sigue siendo adult/streaming regulatoriamente, y los entregables de compliance (declaración 2257, políticas formales del PSP, reporting mensual, DPIA biométrico) aplican íntegros. Comparables del posicionamiento adult dating intimate: CooMeet, LuckyCrush, Chatspin. El alcance operativo de compliance derivado vive en [compliance-scope.md](compliance-scope.md) y [compliance-deliverables.md](compliance-deliverables.md).

Características operativas del posicionamiento:

- Sesiones privadas 1-a-1, no broadcast público ni sala multi-cliente.
- KYC obligatorio para ambas partes vía un proveedor único especializado (identidad y edad). Modelos pasan flujo completo de identidad (documento + selfie + liveness + face match); clientes pasan estimación facial de edad con fallback documental para casos borderline. Las sesiones no arrancan si alguna de las dos partes no ha completado el flujo aplicable a su rol.
- Contenido adult-themed (incluida nudity consensual) entre adultos verificados en sesión privada 1-a-1 está permitido dentro del marco legal aplicable. Zona pública del producto (landing, blog, superficies de marketing) NO contiene contenido adult-themed, solo descripción del servicio.
- Moderación visual real-time obligatoria sobre la sesión privada con kill switch automático para categorías de tolerancia cero (CSAM, gore, contenido no consentido aparente, símbolos de odio) y revisión humana asíncrona para casos borderline. Detalle técnico en [ADR-036](../06-decisions/adr-036-moderation-pipeline-architectural-stance.md) y [ADR-037](../06-decisions/adr-037-moderation-visual-vendor-sightengine.md).
- Sin grabación ni rebroadcast de sesiones privadas.

## Núcleo de monetización

El repositorio refleja un modelo económico basado en:

- wallet interna para clientes
- consumo asociado a sesiones y tiempo de interacción
- gifts con reparto entre modelo y plataforma
- retiros solicitados por modelos

La trazabilidad económica se apoya en ledger interno y snapshots de balance, lo que permite auditar movimientos de usuario y de plataforma con bastante detalle.

## Actores principales

- cliente: usuario que consume saldo y utiliza random, chat y llamadas
- modelo: usuaria aprobada para operar y generar ingresos
- plataforma: mantiene margen, control operativo y revisión administrativa

## Madurez observada

La economía interna y la trazabilidad contable parecen más maduras que la integración PSP externa. Ningún PSP está cerrado contractualmente: la vía activa de onboarding es CardBilling / Verotel (condicional, con due diligence en curso), mientras que CCBill quedó como vía silente tras conversaciones iniciales. La integración PSP a nivel de código sigue siendo parcial. El detalle de la estrategia vive en [psp-strategy.md](psp-strategy.md).
