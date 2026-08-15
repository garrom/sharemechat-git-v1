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

### Reparto y rango de precio (vigente por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md), sobrescribe [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D1 y §D5)

- **Reparto escalonado por facturación bruta rolling 30d**: 50% modelo en el tramo de entrada (T1), 54% al superar 1.000 €/mes (T2), 57% al superar 4.000 €/mes (T3), 60% al superar 15.000 €/mes (T4).
- **Rango de precio autoservicio por modelo**: €1/min fijo en T1; 1-3 €/min en T2; 1-6 €/min en T3; 1-9 €/min en T4. Cada modelo elige dentro del rango de su tramo; el precio se muestra en su tarjeta pública.
- **Estatus Pro** al superar 1.500 €/mes: feature única que permite a la modelo decidir si acepta clientes trial o no.
- **Precio único cripto/tarjeta**: el cliente paga el mismo precio pase lo que pase; la empresa absorbe el diferencial de fees como margen operativo.
- **Modalidad Master (modelo bajo estudio)**: mismos tramos y umbrales que la modelo libre; el 50-60% se abona al saldo del Master en lugar del de la modelo, y el reparto interno Master↔modelo es acuerdo privado (`internal_share_pct` auditable en BD). Motor unificado — [ADR-056 §D4 revisión 2026-07-30](../06-decisions/adr-056-sistema-master-studio.md).

Detalle completo del sistema en [sistema-tiers-modelos.md](sistema-tiers-modelos.md); estructura de packs y rango de precio de cara al cliente en [pricing.md](pricing.md); margen neto por método de pago en [unit-economics.md](unit-economics.md).

### Programa de afiliadas

El programa de afiliadas internas (30% revshare por cliente atribuido) queda **retirado** por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11. El nuevo reparto 50-60% modelo (vigente por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md), sobrescribe el 75-79% original de ADR-052) sigue mejorando la propuesta contra el sector (LiveJasmin L1 30%, BongaCams ~35%), lo que sostiene el incentivo a la modelo a traer clientes propios sin necesidad de programa adicional. La afiliación externa B2B (blogs, agencias, estudios) queda también descartada como programa estándar; acuerdos B2B se negocian caso por caso fuera del programa. Ver [affiliate-program.md](affiliate-program.md) (stub) para el estado formal del retiro.

## Actores principales

- cliente: usuario que consume saldo y utiliza random, chat y llamadas
- modelo: usuaria aprobada para operar y generar ingresos
- plataforma: mantiene margen, control operativo y revisión administrativa

## Madurez observada

La economía interna y la trazabilidad contable están más maduras que la integración PSP externa. El cobro cripto (NOWPayments) está vivo en PROD; el cobro con tarjeta se canaliza con CardBilling (grupo Verotel), que aceptó la estructura de la sociedad, con el onboarding en pausa por decisión del operador. La integración de tarjeta a nivel de código está pendiente (el registry `PaymentProvider` está listo para el adapter). El detalle vive en [psp-strategy.md](psp-strategy.md).
