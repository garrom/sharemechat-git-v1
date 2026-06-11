# Modelo de negocio

SharemeChat opera como una plataforma de videochat 1-a-1 de pago entre clientes y modelos remuneradas. A efectos de pagos y compliance se clasifica como merchant **adult/streaming**, no como dating. La decisión y su justificación viven en [ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md); el alcance operativo de compliance derivado vive en [compliance-scope.md](compliance-scope.md) y [compliance-deliverables.md](compliance-deliverables.md).

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

La economía interna y la trazabilidad contable parecen más maduras que la integración PSP externa. Ningún PSP está cerrado contractualmente: la vía activa de onboarding es Segpay (condicional, con due diligence en curso), mientras que CCBill quedó como vía silente tras conversaciones iniciales. La integración PSP a nivel de código sigue siendo parcial. El detalle de la estrategia vive en [psp-strategy.md](psp-strategy.md).
