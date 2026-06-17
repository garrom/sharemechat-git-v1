# Unit economics

Marco paramétrico para razonar sobre el margen de contribución por transacción en SharemeChat. Este documento **no fija cifras cerradas**: enumera las variables que componen el margen y deja como parámetros abiertos las que todavía no están decididas. Se actualizará cuando Segpay cierre tarifas y cuando el reparto modelo/plataforma quede formalizado.

El contexto económico subyacente (wallet, consumo por tiempo, gifts con reparto, payouts) está descrito en [business-model.md](business-model.md). La estructura de packs y el umbral mínimo de recarga están en [pricing.md](pricing.md). La estrategia de PSP en [psp-strategy.md](psp-strategy.md).

## Ingreso bruto por transacción

El ingreso bruto de una recarga es el importe del pack adquirido por el cliente. Los tres packs vigentes (10 / 20 / 40 €) están descritos en [pricing.md](pricing.md); no se repite aquí la tabla. El pack mínimo es de 10 €, decidido en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) precisamente para mantener una relación sana entre importe y costes fijos del procesador.

## Comisión del PSP

**Pendiente de cierre de tarifas con Segpay.** La vía activa de onboarding es Segpay (condicional, en due diligence) según [psp-strategy.md](psp-strategy.md), pero no hay contrato firmado y, por tanto, no hay tarifa cerrada que aplicar. Una vez Segpay confirme, la comisión del PSP se descompondrá típicamente en:

- una **parte fija por transacción** (impacta más, en términos relativos, sobre los packs pequeños — uno de los motivos por los que se eliminó el pack de 5 € en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md));
- una **parte variable** proporcional al importe;
- eventuales **reserve/rolling reserve** y costes adicionales (chargeback fees, refund fees) habituales en el régimen adult/streaming.

Hasta que esos valores estén cerrados, la comisión del PSP entra en la fórmula como variable, no como cifra.

## Reparto modelo / plataforma

El reparto entre modelo y plataforma existe a nivel de mecánica en el ledger: el consumo durante una sesión se descompone en `STREAM_CHARGE` (cliente), `STREAM_EARNING` (modelo) y `STREAM_MARGIN` (plataforma), siguiendo las reglas vigentes de tarifa por minuto y *tier* de la modelo (ver [ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md), sección de modelo contable). El concepto de reparto modelo/plataforma se reconoce expresamente como tal en [business-model.md](business-model.md) y se preserva en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md).

El **detalle del sistema de tiers, las tarifas por minuto vigentes, los umbrales de progresión y la mecánica del primer minuto gratis** está documentado en [sistema-tiers-modelos.md](sistema-tiers-modelos.md). Resumen para la fórmula del margen de contribución: la modelo gana `first_minute_earning_per_min` × duración del primer minuto + `next_minutes_earning_per_min` × duración del resto, donde ambas tarifas dependen del tier resuelto por el snapshot diario (`model_tier_daily_snapshots`). En el régimen vigente, el reparto bruto por minuto de los minutos siguientes va del **85% para la plataforma en tier base (5-15)** al **60% en tier alto (9-40)**. Los porcentajes netos del reparto (tras PSP, AWS y costes fijos) siguen pendientes del cierre con Segpay y del resto de variables abiertas en este documento.

La política de payouts a la modelo (umbrales de payout, calendario de retiros, retenciones, formas de pago) **sigue pendiente** de formalización y entra en la fórmula como parámetro abierto.

## Costes fijos asignables

Sobre el ingreso de la sociedad cargan los costes operativos que no son por transacción sino por período. Las categorías ya reconocidas en [accounting-status.md](accounting-status.md) son:

- **Infraestructura cloud** (AWS) — actualmente fuera del circuito Companio, asumida por el socio.
- **Gestión contable** (cuota mensual de Companio).
- **Costes legales / de incorporación** (constitución de la sociedad, ya registrada).
- **Registros y marcas** (OEPM y similares) — actualmente fuera del circuito Companio.

A estos se sumarán, cuando proceda, los costes asociados a proveedores ya identificados en el resto de la documentación (verificación de edad/identidad, moderación de contenido) cuyas tarifas no son objeto de este documento. No se asignan cifras aquí: el objetivo de este apartado es enumerar las categorías que deberán imputarse cuando se quiera cerrar la cuenta unitaria.

## Margen de contribución

El margen de contribución por transacción se expresa como:

> **margen = ingreso bruto − comisión PSP − reparto modelo − costes asignados**

Donde:

- **ingreso bruto** está cerrado por pack (ver [pricing.md](pricing.md)).
- **comisión PSP** queda pendiente del cierre de tarifas con Segpay.
- **reparto modelo** queda pendiente de formalizar la política de payouts y los porcentajes asociados.
- **costes asignados** queda pendiente de decidir cómo se imputan a cada transacción los costes fijos enumerados arriba (por transacción, por minuto consumido, por ventana temporal, etc.).

Mientras dos de estos cuatro términos no estén cerrados, no es posible cerrar el margen de contribución unitario. La fórmula queda registrada como marco para evitar que cada análisis ad hoc reinvente la descomposición.

## Estado de este documento

Documento **paramétrico y abierto**. Se completará en dos hitos:

1. **Cuando Segpay cierre comisiones**: se sustituye el placeholder de comisión PSP por las tarifas reales (fija, variable, reservas, fees adicionales).
2. **Cuando se formalice la política de payouts**: se sustituye el placeholder de reparto modelo por los porcentajes vigentes y, si aplica, su modulación por tier.

Hasta entonces, este documento sirve como marco compartido para evitar declarar cifras provisionales que no se sostengan, y como check-list de qué falta para poder cerrar la cuenta unitaria.

## Referencias

- [business-model.md](business-model.md) — modelo de negocio y monetización.
- [pricing.md](pricing.md) — estructura de packs.
- [sistema-tiers-modelos.md](sistema-tiers-modelos.md) — sistema de tiers de retribución de modelos, tarifas por minuto vigentes, snapshot diario, primer minuto gratis para el cliente y desglose plataforma/modelo por tier.
- [psp-strategy.md](psp-strategy.md) — estrategia de PSP (Segpay como vía activa).
- [accounting-status.md](accounting-status.md) — categorías de coste contabilizadas.
- [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) — simplificación de pricing y umbral mínimo.
- [ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md) — mecánica de ledger del consumo (reparto cliente/modelo/plataforma).
