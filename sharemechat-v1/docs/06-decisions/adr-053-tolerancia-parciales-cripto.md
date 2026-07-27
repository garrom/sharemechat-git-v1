# ADR-053 — Tolerancia para pagos parciales cripto (partially_paid)

**Fecha**: 2026-07-27
**Estado**: aceptado, implementado en `PspWebhookOrchestratorService` + `NowPaymentsPaymentProvider` + `WebhookEvent`
**Contexto**: ADR-051 (integración NOWPayments) marcó por defecto `partially_paid → FAILED` sin tolerancia. Un caso real 2026-07-26 (prueba manual del operador en PROD, order `2a3b8735-642c-4f22-a196-1f7143793aaf`) llegó con `actually_paid=11.371482` frente a `pay_amount=11.37148291` USDC pedidos — ratio 99,999999% en la moneda cripto pero equivalente en EUR bajó a 9,977€ (99,77% de los 10€) por fluctuación USDC/EUR durante las 2h30m que tardó el operador entre crear invoice y enviar desde Kraken. El vendor marcó `partially_paid` y nuestro backend rechazó por diseño, requiriendo intervención manual vía SQL para acreditar los 10€ del pack.

Ese caso NO era fraude ni error grande — era el ciclo normal de cripto con volatilidad microscópica y una cliente-persona nuevo en la operativa. Con clientes reales de flujo continuo, la frecuencia de estos parciales se estima en 3-5% de los pagos cripto (mayor cuanto más tarde el cliente en completar el pago tras crear la invoice).

## D1 — Aceptar `partially_paid` como SUCCESS con criterio de doble tolerancia

El orquestador `PspWebhookOrchestratorService.handleStatus` rescata pagos `partially_paid` si cumplen **AMBAS** condiciones:

1. **Ratio ≥ 99%**: `actually_paid / pay_amount >= 0.99` calculado en la moneda cripto del pago (sin conversión a EUR).
2. **Diferencia absoluta EUR ≤ 1€**: `price_amount_eur × (1 - ratio) <= 1.00`.

Si ambas se cumplen, se trata como SUCCESS: se acredita el pack completo (price + bonus) al usuario, se marca `payment_sessions.status=SUCCESS`, se emite WS `wallet:credited`. Se loggea a WARN con el ratio y la decisión para observabilidad.

Si alguna condición no se cumple, sigue como FAILED. Casos donde el ratio es <99% o donde la diferencia supera 1€ implican fluctuación excepcional, fraude posible o error humano genuino — merecen revisión manual, no acreditación automática.

## D2 — Coste operativo asumido

**Peor caso por evento**:
- Pack P10 con ratio 99% → diff 0,10€.
- Pack P100 con ratio 99% → diff 1,00€ (tope absoluto).
- Pack P100 con ratio 98,5% → diff 1,50€ → **NO acredita** (bloquea por diff, aunque ratio también quedaría por debajo del 99%).

**Frecuencia esperada**: 3-5% de los pagos cripto en la fase actual de PRELAUNCH. Al escalar tráfico y con clientes experimentados que ejecutan la retirada en 2-5 min desde exchange, se reducirá a <1%.

**Coste financiero esperado mensual**: despreciable en la fase actual. En volumen sostenido: <0,5% del ingreso cripto bruto.

**Trade-off a favor**:
- Ahorra horas de gestión manual (SQL/panel admin para cada parcial).
- Elimina fricción al cliente (que pagó "casi todo" y ve su saldo acreditado sin drama).
- Coste real esperado << coste operativo del rechazo manual.

## D3 — Alternativas evaluadas

**A) Aceptar cualquier `partially_paid` sin condiciones** (tolerancia 100%). Descartado: expone a fraude por infra-pago intencional y a errores gruesos del cliente sin visibilidad.

**B) Tolerancia porcentual amplia (ej. 95%)**. Descartado en review con operador: 5% en P100 son 5€ absorbidos por evento, desproporcionado. La causa real (fluctuación EUR/cripto) casi nunca supera 1% en ventanas <60 min.

**C) Solo tolerancia absoluta (diff ≤ 1€) sin ratio**. Descartado: un pago de 50% en P100 (50€ perdidos, 1€ diff sobre 100€ no aplica correctamente) requiere el filtro ratio para evitar patologías.

**D) Redondeo al entero EUR** (propuesta inicial del operador). Descartado: en P10 permitiría hasta 10% de pérdida (9€ redondea a 10) — demasiado. Tolerancia doble (ratio + diff) cubre la intuición con controles precisos.

**E) Cambiar el vendor por otro con menor sensibilidad a fluctuación**. Descartado: NOWPayments es la referencia adult-friendly; el problema es estructural cripto, no vendor.

**F) Frontend guía visual "cómo pagar rápido"**. Complementario, no sustituye. Queda como frente separado.

## D4 — Alcance técnico

**Modificados**:
- `dto/WebhookEvent.java`: 2 campos nuevos `payAmountCrypto` + `actuallyPaidCrypto` (nullable BigDecimal). Compat: constructor original preservado; nuevo constructor con 8 args.
- `provider/nowpayments/NowPaymentsPaymentProvider.java`: extracción de `pay_amount` + `actually_paid` del JSON del webhook. Helper `decimalOrNull` nuevo.
- `service/PspWebhookOrchestratorService.java`: refactor del switch case SUCCESS/FAILED extrayendo `creditAndNotify` (reutilizable) + método nuevo `isPartialWithinTolerance`. Constantes `PARTIAL_MIN_RATIO=0.99` y `PARTIAL_MAX_ABS_DIFF_EUR=1.00`.
- `dto/PaymentStatus.java`: comentario actualizado con referencia a este ADR.

**No modificados**:
- Frontend: sin cambios (todo backend).
- BD: sin migración (los campos ya vienen en el payload del webhook, no persistimos actually_paid).
- Otros providers: `PaymentProvider.parseWebhook` es agnóstico; providers futuros que no emitan estos campos dejan null y no aplican tolerancia.

## D5 — Observabilidad y evolución

- Log WARN en cada análisis de tolerancia (aceptado o rechazado) con ratio + diff + decisión.
- Contar activaciones mensuales para calibrar el umbral 99% si aparece patrón sistemático.
- Si a los 6 meses se ve que <0,1% de casos activan la tolerancia y el resto encajan bien, se puede subir el ratio a 99,5%.
- Si aparecen quejas sistemáticas por casos límite (ratio 98,x%), se puede bajar el ratio a 98% con revisión del coste operativo real.

## Referencias

- [ADR-051 — PSP puente cripto NOWPayments](adr-051-psp-puente-cripto-nowpayments.md)
- Caso real 2026-07-26 order `2a3b8735-642c-4f22-a196-1f7143793aaf`: primera detección del problema en PROD real.
- `docs/project-log.md` entrada 2026-07-27 (bitácora del cierre).
