# Unit economics

Marco cuantitativo para razonar sobre el margen de contribución por transacción en SharemeChat. Este documento cuantifica el reparto modelo/plataforma (50-60% escalonado por facturación bruta rolling 30d — vigente por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) que sobrescribió el 75-79% inicial de [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md)) y aproxima los fees PSP con los valores conocidos de la fase soft launch cripto ([ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md)).

El contexto económico subyacente (wallet, consumo por tiempo, gifts con reparto, payouts) está descrito en [business-model.md](business-model.md). La estructura de packs y el umbral mínimo de recarga están en [pricing.md](pricing.md). El detalle del sistema de tramos y del rango de precio autoservicio vive en [sistema-tiers-modelos.md](sistema-tiers-modelos.md). La estrategia de PSP en [psp-strategy.md](psp-strategy.md).

## Ingreso bruto por transacción

El ingreso bruto de una recarga es el importe del pack adquirido por el cliente. Los tres packs vigentes (10 / 20 / 40 €) están descritos en [pricing.md](pricing.md); no se repite aquí la tabla. El pack mínimo es de 10 €, decidido en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) precisamente para mantener una relación sana entre importe y costes fijos del procesador.

## Comisión del PSP

Al cierre de este documento (2026-07-24) el soft launch opera con dos PSPs adult-adjacent:

- **NOWPayments (cripto USDT/USDC/BTC)**: fees efectivos aproximados del **~1% sobre el importe transaccionado**, sin fijo por transacción relevante. Ver [ADR-051](../06-decisions/adr-051-psp-puente-cripto-nowpayments.md) para el detalle de la integración vigente.
- **Paxum (wallet adult-specialist)**: modelo de fees similar en orden de magnitud. Se agrupa aquí con cripto para el análisis de márgenes porque no representa la rail tarjeta convencional.

Para **tarjeta**, el PSP tarjeta está en negociación activa con nuevos candidatos que acepten el perfil corporativo Estonia sin director residente (Segpay quedó cerrada por ese requisito, ver [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md)). Los fees típicos del sector adult están en el rango **10-15% + fijo pequeño por transacción**, con **rolling reserve del 5-10%** durante 6-12 meses del arranque, más **chargeback fees** (~€25/chargeback) y **refund fees**. Este documento asume **~13% de fees efectivos en tarjeta** como aproximación conservadora, a sustituir por cifras reales cuando el PSP cierre contrato.

## Reparto modelo / plataforma

Vigente por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) (sobrescribe [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D1 y §D5) con 4 tramos escalonados por facturación bruta rolling 30d:

| Tramo | Facturación bruta acumulada (rolling 30d) | % modelo | % empresa (bruto) |
|---|---|---:|---:|
| T1 | 0 – 1.000 € | **50%** | 50% |
| T2 | > 1.000 € | **54%** | 46% |
| T3 | > 4.000 € | **57%** | 43% |
| T4 | > 15.000 € | **60%** | 40% |

- Los tramos se recalculan diariamente por snapshot sobre la ventana rolling 30d de facturación bruta ([ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D6 sigue vigente en este aspecto).
- El reparto se aplica al **minuto 2 en adelante** de cada sesión. El **primer minuto trial** tiene régimen propio: la plataforma paga €0,07/min plano a la modelo, el cliente no paga.
- El precio por minuto NO es plano: la modelo elige dentro del rango que su tramo le permite (€1 T1; €1-3 T2; €1-6 T3; €1-9 T4). Ver [pricing.md](pricing.md).
- **Modalidad Master (modelo bajo estudio)**: aplica los mismos tramos y umbrales. La única diferencia económica es el destinatario del `STREAM_EARNING` (Master en lugar de modelo); el reparto interno Master↔modelo es acuerdo privado. Motor unificado — [ADR-056 §D4 revisión 2026-07-30](../06-decisions/adr-056-sistema-master-studio.md).
- La **política de payouts** mantiene los canales cableados en `PayoutRequest`; la cadencia concreta (semanal / mensual) sigue pendiente de definición operativa, no bloqueante para este marco.

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
- **reparto modelo**: 50-60% según tramo (vigente por [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md)).
- **costes asignados**: fijos mensuales por transacción según volumen (pendiente decidir método de imputación exacto por transacción; para análisis de margen unitario se desprecian fijos).

## Márgenes netos por tramo y método de pago

Asumiendo consumo de un pack tipo con reparto aplicado al minuto 2 en adelante:

### Ejemplo A: pack 10 € consumido en modelo T1 (tarifa €1/min)

- Modelo (50%): **€5,00**
- Empresa bruto (50%): **€5,00**
- Empresa neto:
  - **Cripto** (fees ~1%): 5,00 − 0,10 = **€4,90 neto** (49% neto sobre facturación).
  - **Tarjeta** (fees ~13%): 5,00 − 1,30 = **€3,70 neto** (37% neto sobre facturación).

### Ejemplo B: pack 20 € consumido en modelo T2 (tarifa €1/min)

- Modelo (54%): **€10,80**
- Empresa bruto (46%): **€9,20**
- Empresa neto:
  - **Cripto**: 9,20 − 0,20 = **€9,00 neto** (45% neto).
  - **Tarjeta**: 9,20 − 2,60 = **€6,60 neto** (33% neto).

### Ejemplo C: sesión 5 min en modelo T4 (tarifa €9/min = 45 €)

- Modelo (60%): **€27,00**
- Empresa bruto (40%): **€18,00**
- Empresa neto:
  - **Cripto**: 18,00 − 0,45 = **€17,55 neto** (39% neto).
  - **Tarjeta**: 18,00 − 5,85 = **€12,15 neto** (27% neto).

### Lectura sistémica

- **Cripto sostiene margen** empresa con mucha holgura (39-49% neto según tramo). Base robusta para fase soft launch y crecimiento.
- **Tarjeta ya no es delgada** con el nuevo reparto ADR-056: 27-37% neto según tramo. Aceptable, aunque los chargeback fees (~€25/chargeback) siguen siendo un riesgo real sobre tickets bajos (€25 sobre €10 devora 250% del ticket, no del margen).
- **Mix realista 50/50 cripto/tarjeta** en el arranque: margen neto agregado **32-43% sobre facturación** según tramo predominante — muy por encima del 12-19% que habría con el reparto ADR-052 original.
- **Sensibilidad principal del negocio**: chargebacks sobre tickets bajos, y volumen (para renegociar fees PSP tarjeta a la baja). El %reparto queda fijo estructuralmente por diseño ADR-056.

## Interacción con Estatus Pro y trial

- **Estatus Pro** (>1.500 €/mes acumulados rolling 30d) NO cambia el %reparto ni los fees. Solo habilita el toggle "aceptar trials sí/no" en el panel de la modelo.
- **Primer minuto trial** cuesta a la plataforma €0,07/min sin ingreso compensatorio. En régimen estacionario cada cliente activo consume ~3 minutos trial/día × €0,07 = **~€0,21/día por cliente que aproveche el cupo trial completo**, multiplicado por el número de clientes activos con trial habilitado. Métrica de gestión: **tasa de conversión "minuto 1 trial → minuto 2 pagado"**. Si cae bajo umbral, el ratio coste-adquisición se rompe.

## Gifts

El reparto de gifts sigue el **mismo motor de tramos que los streams** (`ModelTierService`): la modelo se lleva el **% de su tramo vigente** (INDIVIDUAL/MASTER T1-T4, **50-70%**), no un share fijo. Cambio de [ADR-056 revisión 2026-08-01](../06-decisions/adr-056-sistema-master-studio.md): el share fijo previo **`gift.model-share=0.90` (ADR-043 §5) se RETIRÓ** del código y de `application.properties`. Los gifts **no cuentan** hacia los umbrales de tramo ni Estatus Pro (son *level-independent income*: los consumen pero no los suben); no son un canal con reparto propio, sino con el reparto por tramo.

## Promociones de adquisición

Los bonos promocionales financiados por la plataforma se modelan como BFPM ([ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md)) y su coste no se imputa por transacción sino como coste de adquisición del período. La promoción de lanzamiento vigente (bono 10 € a los 100 primeros clientes, con su impacto económico y amplificadores de coste) está en [promo-100-primeros-clientes.md](promo-100-primeros-clientes.md).

## Programa de afiliados (retirado)

El programa de afiliadas modelos (30% revshare por cliente atribuido) queda **retirado** por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11. Aunque el reparto pasó de 75-79% a 50-60% con [ADR-056](../06-decisions/adr-056-sistema-master-studio.md), el %reparto sigue siendo competitivo frente al sector (LiveJasmin L1 30%, BongaCams ~35%) y no se justifica reintroducir el revshare de afiliadas. Ya no hay coste adicional de revshare a afiliados que restar del margen empresa. Ver [affiliate-program.md](affiliate-program.md) (stub de retirada) y [`../_deprecated/registro.md`](../_deprecated/registro.md) para el contenido histórico.

## Estado de este documento

Documento **cuantitativamente cerrado** en su parte estructural (reparto 50-60% [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md) + fees cripto ~1%) y **aproximado** en la parte tarjeta hasta que el PSP tarjeta cierre contrato. Cuando ese cierre ocurra, se sustituyen los fees ~13% asumidos por las cifras contractuales reales (fijo, variable, reserve, chargeback fees, refund fees).

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
- [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) — rediseño estructural del reparto y del rango de precio (§D1 y §D5 sobrescritos por ADR-056; resto vigente).
- [ADR-056](../06-decisions/adr-056-sistema-master-studio.md) — sistema Master/Studio: §D3 vigente para tramos y umbrales (50-60%, 0/1000/4000/15000 €); §D4 revisión 2026-07-30 unifica motor en INDIVIDUAL per modelo.
