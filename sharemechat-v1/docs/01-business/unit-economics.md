# Unit economics

Marco cuantitativo para razonar sobre el margen de contribución por transacción en SharemeChat. Este documento **cierra por primera vez** el reparto modelo/plataforma (75-79% escalonado por facturación bruta rolling 30d, ver [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)) y aproxima los fees PSP con los valores conocidos de la fase soft launch cripto ([ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md)).

El contexto económico subyacente (wallet, consumo por tiempo, gifts con reparto, payouts) está descrito en [business-model.md](business-model.md). La estructura de packs y el umbral mínimo de recarga están en [pricing.md](pricing.md). El detalle del sistema de tramos y del rango de precio autoservicio vive en [sistema-tiers-modelos.md](sistema-tiers-modelos.md). La estrategia de PSP en [psp-strategy.md](psp-strategy.md).

## Ingreso bruto por transacción

El ingreso bruto de una recarga es el importe del pack adquirido por el cliente. Los tres packs vigentes (10 / 20 / 40 €) están descritos en [pricing.md](pricing.md); no se repite aquí la tabla. El pack mínimo es de 10 €, decidido en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) precisamente para mantener una relación sana entre importe y costes fijos del procesador.

## Comisión del PSP

Al cierre de este documento (2026-07-24) el soft launch opera con dos PSPs adult-adjacent:

- **NOWPayments (cripto USDT/USDC/BTC)**: fees efectivos aproximados del **~1% sobre el importe transaccionado**, sin fijo por transacción relevante. Ver [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md) para el detalle de la integración vigente.
- **Paxum (wallet adult-specialist)**: modelo de fees similar en orden de magnitud. Se agrupa aquí con cripto para el análisis de márgenes porque no representa la rail tarjeta convencional.

Para **tarjeta**, el PSP tarjeta está en negociación activa con nuevos candidatos que acepten el perfil corporativo Estonia sin director residente (Segpay quedó cerrada por ese requisito, ver [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md)). Los fees típicos del sector adult están en el rango **10-15% + fijo pequeño por transacción**, con **rolling reserve del 5-10%** durante 6-12 meses del arranque, más **chargeback fees** (~€25/chargeback) y **refund fees**. Este documento asume **~13% de fees efectivos en tarjeta** como aproximación conservadora, a sustituir por cifras reales cuando el PSP cierre contrato.

## Reparto modelo / plataforma

Cerrado por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D1 con 4 tramos escalonados por facturación bruta rolling 30d:

| Tramo | Facturación bruta acumulada (rolling 30d) | % modelo | % empresa (bruto) |
|---|---|---:|---:|
| T1 | 0 – 3.500 € | **75%** | 25% |
| T2 | > 3.500 € | **77%** | 23% |
| T3 | > 5.000 € | **78%** | 22% |
| T4 | > 6.500 € | **79%** | 21% |

- Los tramos se recalculan diariamente por snapshot sobre la ventana rolling 30d de facturación bruta ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D6).
- El reparto se aplica al **minuto 2 en adelante** de cada sesión. El **primer minuto trial** tiene régimen propio: la plataforma paga €0,07/min plano a la modelo, el cliente no paga.
- El precio por minuto NO es plano: la modelo elige dentro del rango que su tramo le permite (€1 T1; €1-3 T2; €1-6 T3; €1-9 T4). Ver [pricing.md](pricing.md).
- La **política de payouts** a la modelo mantiene el canal Wise ya cableado en `PayoutRequest`; la cadencia concreta (semanal / mensual) sigue pendiente de definición operativa, no bloqueante para este marco.

## Costes que absorbe el %empresa bruto

Según [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D7, dentro del %reparto empresa se cubren:

- Fees PSP (variable + fijo por transacción, tarjeta o cripto).
- Reserve / rolling reserve del PSP (si aplica).
- Coste técnico variable (bandwidth WebRTC, STUN/TURN, AWS por minuto streamed).
- Coste de moderación proactiva sobre esa modelo (Sightengine por operación, monitoring).

## Descuentos del payout siguiente de la modelo

Fuera del %reparto empresa, se descuentan directamente del payout de la modelo:

- Chargebacks del cliente sobre sesiones específicas con esa modelo.
- Refunds aprobados por queja específica del cliente sobre esa modelo.
- Sanciones PSP por incumplimiento claro y documentado de la modelo.

Umbral de suspensión temporal: chargebacks > ~5% de facturación bruta mensual de la modelo. Detalle concreto en T&C y contrato de modelo.

## Costes fijos asignables

Sobre el ingreso de la sociedad cargan los costes operativos que no son por transacción sino por período. Las categorías ya reconocidas en [accounting-status.md](accounting-status.md) son:

- **Infraestructura cloud** (AWS) — actualmente fuera del circuito Companio, asumida por el socio.
- **Gestión contable** (cuota mensual de Companio).
- **Costes legales / de incorporación** (constitución de la sociedad, ya registrada).
- **Registros y marcas** (OEPM y similares) — actualmente fuera del circuito Companio.
- **Moderación IA** (Sightengine plan Starter cuando se salte del Free; ver [`../06-decisions/adr-037-moderation-visual-vendor-sightengine.md`](../06-decisions/adr-037-moderation-visual-vendor-sightengine.md)).

A estos se sumarán, cuando proceda, los costes asociados a proveedores ya identificados en el resto de la documentación (KYC modelo/cliente vía Didit) cuyas tarifas no son objeto de este documento.

## Margen de contribución

El margen de contribución por transacción se expresa como:

> **margen = ingreso bruto − comisión PSP − reparto modelo − costes asignados**

Donde:

- **ingreso bruto** está cerrado por pack (ver [pricing.md](pricing.md)).
- **comisión PSP**: **~1% cripto**, **~13% tarjeta** (aproximaciones vigentes; tarjeta se sustituye por cifra real cuando el PSP cierre contrato).
- **reparto modelo**: 75-79% según tramo (cerrado por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)).
- **costes asignados**: fijos mensuales por transacción según volumen (pendiente decidir método de imputación exacto por transacción; para análisis de margen unitario se desprecian fijos).

## Márgenes netos por tramo y método de pago

Asumiendo consumo de un pack tipo con reparto aplicado al minuto 2 en adelante:

### Ejemplo A: pack 10 € consumido en modelo T1 (tarifa €1/min)

- Modelo (75%): **€7,50**
- Empresa bruto (25%): **€2,50**
- Empresa neto:
  - **Cripto** (fees ~1%): 2,50 − 0,10 = **€2,40 neto** (24% neto sobre facturación).
  - **Tarjeta** (fees ~13%): 2,50 − 1,30 = **€1,20 neto** (12% neto sobre facturación).

### Ejemplo B: pack 20 € consumido en modelo T2 (tarifa €1/min)

- Modelo (77%): **€15,40**
- Empresa bruto (23%): **€4,60**
- Empresa neto:
  - **Cripto**: 4,60 − 0,20 = **€4,40 neto** (22% neto).
  - **Tarjeta**: 4,60 − 2,60 = **€2,00 neto** (10% neto).

### Ejemplo C: sesión 5 min en modelo T4 (tarifa €9/min = 45 €)

- Modelo (79%): **€35,55**
- Empresa bruto (21%): **€9,45**
- Empresa neto:
  - **Cripto**: 9,45 − 0,45 = **€9,00 neto** (20% neto).
  - **Tarjeta**: 9,45 − 5,85 = **€3,60 neto** (8% neto).

### Lectura sistémica

- **Cripto sostiene margen** empresa con holgura (20-24% neto según tramo). Base sana para la fase soft launch.
- **Tarjeta es delgada** (8-12% neto según tramo). Sensible a chargebacks: un chargeback fee de €25 sobre un ticket de €10 devora ~10% del ticket, además del %fee normal. Un solo chargeback puede llevar la transacción a margen negativo.
- **Mix realista 50/50 cripto/tarjeta** en el arranque: margen neto agregado **12-19% sobre facturación** según tramo predominante.
- **Sensibilidad principal del negocio**: el mix cripto/tarjeta y el volumen (para renegociar fees PSP). El %reparto queda fijo estructuralmente.

## Interacción con Estatus Pro y trial

- **Estatus Pro** (>1.500 €/mes acumulados rolling 30d) NO cambia el %reparto ni los fees. Solo habilita el toggle "aceptar trials sí/no" en el panel de la modelo.
- **Primer minuto trial** cuesta a la plataforma €0,07/min sin ingreso compensatorio. En régimen estacionario cada cliente activo consume ~3 minutos trial/día × €0,07 = **~€0,21/día por cliente que aproveche el cupo trial completo**, multiplicado por el número de clientes activos con trial habilitado. Métrica de gestión: **tasa de conversión "minuto 1 trial → minuto 2 pagado"**. Si cae bajo umbral, el ratio coste-adquisición se rompe.

## Gifts

El reparto de gifts (**90% modelo / 10% plataforma**, sobre el bruto pagado por el cliente por el gift) NO cambia con [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md); sigue el régimen de [ADR-043](../06-decisions/adr-043-pricing-formalization-current-state.md) §5 (`gift.model-share=0.90` en `application.properties`). Los gifts **no cuentan** hacia los umbrales de tramo o Estatus Pro; son un canal económico separado con reparto propio.

## Programa de afiliados (retirado)

El programa de afiliadas modelos (30% revshare por cliente atribuido) queda **retirado** por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11. El nuevo reparto escalonado 75-79% sobre-incentiva a la modelo a traer clientes propios sin necesidad de programa adicional. Ya no hay coste adicional de revshare a afiliados que restar del margen empresa. Ver [affiliate-program.md](affiliate-program.md) (stub de retirada) y [`../_deprecated/registro.md`](../_deprecated/registro.md) para el contenido histórico.

## Estado de este documento

Documento **cuantitativamente cerrado** en su parte estructural (reparto 75-79% + fees cripto ~1%) y **aproximado** en la parte tarjeta hasta que el PSP tarjeta cierre contrato. Cuando ese cierre ocurra, se sustituyen los fees ~13% asumidos por las cifras contractuales reales (fijo, variable, reserve, chargeback fees, refund fees).

Adicionalmente pendiente de recalibrar tras ADR-052:

- **[financiero/modelo-financiero.md](financiero/modelo-financiero.md) + xlsx**: proyección numérica preliminar del margen mes a mes y del horizonte de break-even. La versión vigente asume el sistema de tiers previo (reparto 15-40% modelo) que quedó superseded. Recalibración pendiente en frente separado. Ver deuda declarada en [`../04-operations/known-debt.md`](../04-operations/known-debt.md).

## Referencias

- [business-model.md](business-model.md) — modelo de negocio y monetización.
- [pricing.md](pricing.md) — estructura de packs y rango de precio autoservicio.
- [sistema-tiers-modelos.md](sistema-tiers-modelos.md) — sistema de tramos, reparto, rango de precio, Estatus Pro, primer minuto trial.
- [financiero/modelo-financiero.md](financiero/modelo-financiero.md) — proyección numérica preliminar (pendiente recalibrar).
- [psp-strategy.md](psp-strategy.md) — estrategia de PSP.
- [accounting-status.md](accounting-status.md) — categorías de coste contabilizadas.
- [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) — packs y umbral mínimo.
- [ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md) — mecánica de ledger del consumo (reparto cliente/modelo/plataforma).
- [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md) — pivote soft launch cripto + Paxum.
- [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md) — PSP puente cripto (NOWPayments).
- [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) — rediseño estructural del reparto y del rango de precio (vigente).
