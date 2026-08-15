# Promoción de lanzamiento — Bono 10 € a los 100 primeros clientes

> Estado: APROBADA a nivel de negocio (operador, 2026-08-15) · **implementación técnica pendiente**
> Ámbito: adquisición de clientes en la apertura (coming-soon → soft launch)
> Ver también: [unit-economics.md](unit-economics.md), [pricing.md](pricing.md), [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md), [ADR-012 (BFPM)](../06-decisions/adr-012-bfpm-platform-funded-bonus.md), [ADR-056](../06-decisions/adr-056-sistema-master-studio.md), [launch-strategy.md](launch-strategy.md)

## 1. Qué es

Bono de bienvenida de **10 €** para los **primeros 100 clientes** registrados. Se acredita **automáticamente al activar el modo premium** (primera recarga, cuyo mínimo es 10 € por [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md)). El bono se suma al saldo del cliente y es **fungible** como cualquier saldo: se consume en minutos o gifts sin distinguir su origen (mecánica de bono financiado por plataforma, [ADR-012 / BFPM](../06-decisions/adr-012-bfpm-platform-funded-bonus.md)).

Se comunica en el **email de bienvenida**, y **solo a clientes**: la variante de modelo del mismo email no incluye el bono.

## 2. Supuestos del cálculo

- 100 clientes; cada uno recarga el mínimo de **10 € reales** (obligatorio para activar el premium y recibir el bono) y recibe **10 € de bono** → **20 € de saldo** por cliente.
- Todo el saldo se gasta en sesiones (minuto 2 en adelante), con **reparto modelo 50 %**. Ese 50 % **no es una aproximación**: es el tramo **T1** real de la apertura (0–1.000 € de facturación bruta rolling 30d, [ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md)). Todas las modelos arrancan en T1, así que en el lanzamiento el reparto es 50 % de forma efectiva.
- Se desprecian, por ser de segundo orden en el aproximado, el primer minuto trial (€0,07/min) y los fees del PSP (~1 % cripto).

## 3. Impacto económico

| Concepto | 1 cliente | 100 clientes |
|---|---:|---:|
| Recarga real cobrada (ingreso caja) | +10 € | **+1.000 €** |
| Bono emitido (crédito, no es caja) | 10 € | 1.000 € |
| Saldo total gastado | 20 € | 2.000 € |
| Pago a modelos (50 % del gasto) | −10 € | **−1.000 €** |
| **Caja neta plataforma** | **0 €** | **0 €** |

## 4. Lectura

- **Es caja-neutral (≈ 0 €)** en el escenario de gasto completo: los **1.000 €** de recargas cubren **exactamente** los **1.000 €** de pago a modelos. En estos 100 clientes la plataforma cede toda su comisión (su 50 %), que es justo el bono.
- **Coste real del bono a reservar: ≤ 500 €.** El bono de 1.000 €, gastado al 50 %, son 500 € de pago real a modelos; la otra mitad es la comisión (ficticia) de la plataforma. Esos 500 € quedan **cubiertos de sobra** por los 1.000 € de recargas. Sin recarga no hay bono (hay que cargar para activarlo), así que el riesgo está **acotado por diseño**.
- **Si no se gasta todo el saldo** (lo normal por churn), la plataforma queda **en positivo**: menos pago a modelos y retiene parte de los 10 € reales. El 0 € es el peor caso realista de gasto completo.
- **Qué se compra con ello**: 100 clientes activados y pagando + **1.000 € inyectados a modelos** (liquidez que las retiene en el arranque, cuello de botella del marketplace según [launch-strategy.md §6](launch-strategy.md)) + gancho de marketing. **CAC efectivo ≈ 0–5 €/cliente.**

## 5. Amplificadores de coste (a vigilar)

- **Gifts (reparto 90 % modelo).** Si el bono se gasta en **gifts** en vez de minutos, la modelo se lleva el **90 %** ([unit-economics.md § Gifts](unit-economics.md), [ADR-043 §5](../06-decisions/adr-043-pricing-formalization-current-state.md)). En el extremo de bono 100 % a gifts, el pago a modelos por el bono sube de 500 € a **900 €** y la caja neta agregada empeora (los 1.000 € de recarga solo compensan si esa parte se gasta en minutos al 50 %). Es la sensibilidad principal de la promo; a vigilar con datos reales.
- **Fundadoras (70 %).** El operador fija un reparto del **70 %** para las **15 primeras modelos** ("fundadoras"). **Aviso de consistencia:** [unit-economics.md](unit-economics.md) documenta el reparto escalonado **50-60 %** ([ADR-056 §D3](../06-decisions/adr-056-sistema-master-studio.md)) **sin** tramo de fundadoras al 70 %; ese 70 % **no está formalizado en ninguna ADR**. En el gasto que caiga sobre fundadoras el coste sube por encima de lo calculado aquí. Si se confirma, **requiere decisión documental propia (ADR)** antes de operarlo.
- **Primer minuto trial.** Coste plano de €0,07/min por sesión trial, sin ingreso compensatorio ([unit-economics.md § Interacción con Estatus Pro y trial](unit-economics.md)).

## 6. Requisitos de implementación (BFPM)

La promo **no está implementada**. Si se implementa, el bono debe seguir el **contrato contable BFPM** ([ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md)):

- Asientos **atómicos** `BONUS_GRANT` (cliente +10 €) ↔ `BONUS_FUNDING` (plataforma −10 €), con la invariante `Σ BONUS_GRANT + Σ BONUS_FUNDING = 0` y trazabilidad por evento.
- `clients.total_pagos` suma **solo la recarga real** (10 €), no el bono.
- La mecánica BFPM vigente está ligada a **packs** (P20 = +2 €, P40 = +4 €); este bono es un **disparador nuevo** (activación del premium / primera recarga), que **hoy no existe** en el código.

Decisiones abiertas antes de activar en PROD: trigger técnico del bono; **contador/tope de 100** (cómo se cierra la promo al llegar al cliente 100); **política de caducidad** del bono no consumido; y **política de refund con bono** (abierta en [ADR-012 Fase 4B-b](../06-decisions/adr-012-bfpm-platform-funded-bonus.md)).

## 7. Estado

- **Negocio:** aprobada por el operador (2026-08-15) con los números de este documento.
- **Comunicación:** lista — el bono se anuncia en el email de bienvenida (variante cliente).
- **Técnica:** pendiente (trigger BFPM nuevo + contador de 100 + caducidad/refund). **No activar en PROD** hasta implementación validada en TEST/AUDIT.
