# Modelo de precio

SharemeChat monetiza con un modelo **pay-per-use, sin suscripción**. El cliente compra saldo prepago en EUR a través de la wallet interna y lo consume por tiempo en sesiones de videochat 1:1, además de en gifts. El mecanismo económico subyacente (wallet, consumo por tiempo, gifts con reparto entre modelo y plataforma, payouts a modelos) está descrito en [business-model.md](business-model.md). La estructura de packs y el umbral mínimo se decidieron en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md).

## Packs vigentes

La oferta se compone de tres packs cerrados, sin compra libre de minutos sueltos:

- **10 €** — equivalente aproximado a 10 minutos.
- **20 €** — equivalente aproximado a 22 minutos.
- **40 €** — equivalente aproximado a 44 minutos.

El pack mínimo es de 10 €. La fuente de verdad es el **saldo comprado en EUR** y la tarifa por minuto vigente; la equivalencia en minutos es una referencia derivada de esa tarifa, no una promesa fija por pack (ver [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md)).

## Principios

- Sin suscripción ni compromiso recurrente.
- Pago por uso, con packs cerrados de importe redondo.
- Ticket medio-alto: se evitan los micropagos.
- Decisión de compra simple, alineada con el comportamiento real del usuario en videochat 1:1.

## Histórico

La oferta inicial contemplaba un pack de 5 € que se **eliminó**: un ticket tan bajo dejaba un margen prácticamente nulo o negativo una vez considerados los costes fijos del procesador de pago, y generaba más operaciones pequeñas sin valor estratégico claro antes de tener datos reales de conversión. El detalle de la decisión y de las alternativas descartadas está en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md). Si en una fase posterior los datos demuestran que un ticket inferior mejora la conversión sin destruir margen, la decisión podrá reabrirse mediante una revisión formal del pricing.

## Alcance de este documento

Este documento describe la estructura de precio de cara al cliente. El análisis de márgenes, comisiones y costes de PSP queda fuera de su alcance y se tratará en un documento de unit-economics aparte.

## Referencias

- [business-model.md](business-model.md) — modelo de negocio y monetización.
- [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) — simplificación de pricing y umbral mínimo de recarga.
