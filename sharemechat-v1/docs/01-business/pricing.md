# Modelo de precio

SharemeChat monetiza con un modelo **pay-per-use, sin suscripción**. El cliente compra saldo prepago en EUR a través de la wallet interna y lo consume por tiempo en sesiones de videochat 1:1, además de en gifts. El mecanismo económico subyacente (wallet, consumo por tiempo, gifts con reparto entre modelo y plataforma, payouts a modelos) está descrito en [business-model.md](business-model.md). La estructura de packs y el umbral mínimo se decidieron en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md). El régimen de reparto modelo/plataforma, rango de precio autoservicio y Estatus Pro vigente está formalizado en [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) y detallado en [sistema-tiers-modelos.md](sistema-tiers-modelos.md).

## Packs vigentes

La oferta se compone de tres packs cerrados, sin compra libre de minutos sueltos:

- **10 €** — aproximadamente 10 minutos a €1/min (tarifa base T0).
- **20 €** — aproximadamente 22 minutos a €1/min (2 min de bonus BFPM).
- **40 €** — aproximadamente 44 minutos a €1/min (4 min de bonus BFPM).

El pack mínimo es de 10 €. La fuente de verdad es el **saldo comprado en EUR** y la tarifa por minuto elegida por cada modelo; la equivalencia en minutos es una referencia derivada de esa tarifa, no una promesa fija por pack.

## Precio por minuto: rango autoservicio por modelo

**El precio por minuto NO es plano**. Cada modelo elige su tarifa dentro del rango que su tramo le permite ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D2):

| Tramo de la modelo | Rango de precio / min |
|---|---|
| T0 (entrada, 0 – 3.500 €/mes) | **1 €/min fijo** |
| T1 (> 3.500 €/mes) | 1 – 3 €/min |
| T2 (> 5.000 €/mes) | 1 – 6 €/min |
| T3 (> 6.500 €/mes) | 1 – 9 €/min |

- El techo actual es **€9/min** (property configurable). Ampliaciones futuras (€15/min o superior) no requieren migration.
- La tarifa elegida por cada modelo se **muestra claramente en su tarjeta de home y en la vista de perfil `/m/:slug`**. Sin precio visible, hay fricción de conversión y disputas.
- El cambio de tarifa es **efectivo inmediatamente** (el cliente que inicia sesión después del cambio ve el precio nuevo).
- **Cripto y tarjeta pagan el mismo precio**. La empresa absorbe el diferencial de fees entre métodos como margen operativo, sin comunicar diferencia al cliente ni a la modelo.

Detalle completo del sistema (mecánica de tramos, rangos, snapshot diario, panel de la modelo) en [sistema-tiers-modelos.md](sistema-tiers-modelos.md).

## Fricción conocida entre rango de precio y packs vigentes

Los packs 10 / 20 / 40 € están calibrados para tarifas cercanas a €1/min. Una modelo T3 con tarifa €9/min consume el pack de 10 € en poco más de un minuto. Rediseño de **packs premium** (importes más altos aptos para modelos T2/T3) queda como **deuda declarada** (ver [`../04-operations/known-debt.md`](../04-operations/known-debt.md)); no forma parte del scope inmediato de ADR-052.

Mientras esa deuda no se cierre, el cliente que quiera consumir varios minutos con una modelo T3 debe comprar varios packs consecutivos o el pack de 40 € que dura ~4,5 min a €9/min. El sistema funciona, pero la UX no está optimizada para el extremo alto del rango.

## Primer minuto trial

El primer minuto de cada sesión trial (cliente que entra a probar bajo el sistema de packs con cooldown) **no se cobra al cliente**; lo absorbe la plataforma pagando a la modelo a **€0,07/min plano** ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D8), independientemente del tramo de la modelo o de su tarifa autoservicio.

Existe un mecanismo anti-abuso por cliente basado en **packs de slots gratis con cooldown progresivo entre packs** (no un tope diario hard en minutos): en régimen estacionario equivale a ~3 minutos gratis cada 24 h. Detalle completo del mecanismo y de la interacción con Estatus Pro (modelos Pro pueden desactivar trial) en [sistema-tiers-modelos.md](sistema-tiers-modelos.md) § 6.

## Principios

- Sin suscripción ni compromiso recurrente.
- Pago por uso, con packs cerrados de importe redondo.
- Ticket medio-alto: se evitan los micropagos.
- Decisión de compra simple, alineada con el comportamiento real del usuario en videochat 1:1.
- Precio por minuto **por modelo**, no plano: la modelo con marca propia captura willingness-to-pay superior de sus clientes; la modelo generalista mantiene el mínimo del rango.

## Histórico

La oferta inicial contemplaba un pack de 5 € que se **eliminó**: un ticket tan bajo dejaba un margen prácticamente nulo o negativo una vez considerados los costes fijos del procesador de pago, y generaba más operaciones pequeñas sin valor estratégico claro antes de tener datos reales de conversión. El detalle de la decisión y de las alternativas descartadas está en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md).

El precio único **€1/min plano** vigente hasta el 2026-07-24 fue superseded por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), que introduce el rango autoservicio por modelo. Motivación: dar a modelos con audiencia propia palanca de captura de valor sobre sus clientes, sin canibalizar la propuesta base para modelos T0.

## Alcance de este documento

Este documento describe la estructura de precio de cara al cliente. El análisis de márgenes, comisiones y costes de PSP se trata en [unit-economics.md](unit-economics.md).

## Referencias

- [business-model.md](business-model.md) — modelo de negocio y monetización.
- [sistema-tiers-modelos.md](sistema-tiers-modelos.md) — sistema de tramos, rango de precio, Estatus Pro, primer minuto trial y reparto por método de pago.
- [unit-economics.md](unit-economics.md) — margen neto por método (cripto / tarjeta) y sensibilidad al mix.
- [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) — packs 10 / 20 / 40 y umbral mínimo de recarga.
- [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) — rediseño estructural del reparto y del rango de precio (vigente).
