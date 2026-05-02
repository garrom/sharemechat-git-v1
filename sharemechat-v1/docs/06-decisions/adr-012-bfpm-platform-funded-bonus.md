# ADR-012: BFPM como bonus financiado por plataforma

## Estado

Aceptada.

- **Fase 4A — implementación mínima viable**: implementada y validada en TEST. Catálogo vigente con bonus operativo (`P20` y `P40`); `P10` sin bonus.
- **Fase 4B-a — auditoría interna contable**: implementada y validada en TEST. Cuatro checks BFPM integrados en `ACCOUNTING_AUDIT` scope `DEFAULT`. Sin falsos positivos.
- **Fase 4B-b — reporting backoffice + política de refund con bonus**: pendiente.
- **Integración CCBill real y firma webhook**: bloqueada hasta recibir el manual oficial. Esta ADR no anticipa contrato PSP.

Esta ADR define el contrato contable que cualquier implementación o evolución posterior debe respetar.

## Contexto

SharemeChat opera con un modelo prepago en EUR. ADR-011 fijó el catálogo vigente de packs en `P10 / P20 / P40` y dejó explícito que el sistema **no debe prometer minutos que no estén respaldados por la tarifa por minuto vigente**.

En Fase 3A, el catálogo se implementó con `minutesGranted == priceEur`: `P20` concede 20 EUR de saldo y, al rate `1 €/min`, 20 minutos. No hay descuento por volumen y no existe ventaja comercial en subir de pack más allá de la conveniencia.

El siguiente paso natural del frente económico pre-PSP es introducir descuento por volumen real. La forma más natural comercialmente es **conceder más minutos al subir de pack**, lo cual exige separar `priceEur` de `minutesGranted`. Los valores concretos del catálogo BFPM vigente se recogen más adelante, en "Ejemplo operativo" y "Validación TEST"; cualquier valor de minutos citado fuera de esas secciones es ilustrativo, no autoridad.

El sistema actual tiene tres restricciones estructurales relevantes para la decisión:

1. La unidad real del saldo cliente es EUR. Lo confirma el cap por saldo en `StreamService.endSession` y la fórmula `cost = ratePerMinute × seconds / 60`.
2. El ingreso de la modelo se calcula independientemente del rate cliente, según el tier vigente. Cambiar el rate cliente o conceder bonus no altera el ingreso de la modelo en ningún caso.
3. Los EUR pagados al PSP no se registran hoy como ingreso directo en `platform_balances`. La plataforma se acredita exclusivamente vía `STREAM_MARGIN` durante el consumo. BFPM no resuelve esa observación de fondo; solo introduce el coste promocional como una nueva categoría de movimiento.

Sobre estas restricciones, BFPM debe modelarse de forma que no rompa ninguna de las invariantes ya validadas (Fase 1, Fase 2, Fase 3A) y que mantenga la unidad EUR en todo el ledger.

## Problema

Antes de la integración real con CCBill o de cualquier circulación de dinero real era necesario decidir:

- cómo conceder más minutos que los pagados sin crear "saldo virtual" sin trazabilidad;
- dónde se registra el coste promocional asumido por la plataforma;
- qué `operationType` se usan para distinguir el bonus de la recarga normal y de los movimientos económicos existentes;
- cómo se mantiene la coherencia con `endSession`, gifts, payout, tiers y la auditoría contable;
- si BFPM justifica una wallet de minutos separada o si el saldo EUR sigue siendo unidad común.

## Decisión

Se introduce **BFPM (Bonus For Paid Minutes)** como un mecanismo de **bonus EUR financiado contablemente por la plataforma**, modelado mediante dos asientos contrapuestos por compra:

1. Sobre el cliente:
   - `Transaction(client, +priceEur, op="INGRESO")` y su `Balance` correspondiente.
   - Si el pack concede bonus (`bonusEur > 0`): `Transaction(client, +bonusEur, op="BONUS_GRANT")` y su `Balance` consecutivo.

2. Sobre la plataforma:
   - Si hay bonus: `PlatformTransaction(-bonusEur, op="BONUS_FUNDING")` y su `PlatformBalance` consecutivo.

Las tres escrituras (cuando hay bonus, cuatro escrituras incluyendo los balances correspondientes) deben ejecutarse de forma **atómica** dentro de una sola transacción.

El saldo cliente **sigue siendo EUR** y sigue siendo fungible: una vez acreditado, el saldo proveniente de `INGRESO` y el proveniente de `BONUS_GRANT` son indistinguibles para el consumo. El cliente consume normalmente y el sistema descuenta del balance sin distinguir origen.

`StreamService.endSession` **no cambia**: sigue debitando del balance cliente y repartiendo entre modelo y plataforma según las reglas vigentes (cost por minuto, tier modelo, margen plataforma).

## Modelo contable decidido

### Estructura de ledger por compra con bonus

| Tabla | Operación | Importe | Sujeto |
|---|---|---|---|
| `transactions` | `INGRESO` | `+priceEur` | cliente |
| `balances` | `INGRESO` | `+priceEur` | cliente |
| `transactions` | `BONUS_GRANT` | `+bonusEur` | cliente |
| `balances` | `BONUS_GRANT` | `+bonusEur` | cliente |
| `platform_transactions` | `BONUS_FUNDING` | `-bonusEur` | plataforma |
| `platform_balances` | `BONUS_FUNDING` | `-bonusEur` | plataforma |

Si `bonusEur == 0` (pack sin bonus, como ocurre en Fase 3A), las dos últimas filas no se escriben y el flujo es idéntico al actual.

### Invariante contable BFPM

Para todo intervalo temporal:

```
Σ amount(transactions, op = BONUS_GRANT)
+
Σ amount(platform_transactions, op = BONUS_FUNDING)
= 0
```

La auditoría contable debe verificar esta invariante explícitamente. Cualquier desviación indica:

- un fallo de atomicidad en el método de acreditación;
- una modificación manual del ledger sin contrapartida;
- un bug en la lógica de cálculo del bonus.

### Trazabilidad por compra

Cada par `BONUS_GRANT` (cliente) ↔ `BONUS_FUNDING` (plataforma) debe ser **emparejable** a una compra concreta. Mecanismos aceptables:

- referencia a `payment_session.id` (vía FK opcional o vía descripción estructurada);
- mismo `payment_session.order_id` en la descripción de ambas filas;
- mismo timestamp lógico dentro de la transacción.

La elección concreta (FK vs descripción) es decisión de implementación dentro de Fase 4A, siempre que la consulta de auditoría pueda emparejar de forma determinista.

### Caches denormalizadas

`clients.saldo_actual` se actualiza al final de la transacción al valor del último `Balance` (que ya incluye `INGRESO + BONUS_GRANT`).

`clients.total_pagos` se incrementa **solo** en `priceEur`, no en `priceEur + bonusEur`. La razón: `total_pagos` representa el importe efectivamente pagado por el cliente, no su saldo recibido. Esto debe quedar explícito en código y en queries derivadas.

## Ejemplo operativo

Catálogo BFPM Fase 4A vigente:

| Pack | priceEur | minutesGranted | bonusEur (rate = 1 €/min) |
|---|---|---|---|
| `P10` | 10.00 | 10 | 0.00 |
| `P20` | 20.00 | 22 | 2.00 |
| `P40` | 40.00 | 44 | 4.00 |

Pack `P20` con `priceEur = 20`, `minutesGranted = 22`, `ratePerMinute = 1`. Bonus implícito `= 2`.

Estado previo:

- `balances`: último balance cliente = `B0`.
- `platform_balances`: último balance plataforma = `P0`.

Tras la compra (vía PSP simulado o vía endpoint directo cuando proceda):

- `transactions`: dos filas cliente, `(INGRESO, +20)` y `(BONUS_GRANT, +2)`.
- `balances`: dos filas consecutivas cliente, `B0+20` y `B0+22`.
- `platform_transactions`: una fila, `(BONUS_FUNDING, -2)`.
- `platform_balances`: una fila, `P0-2`.
- `clients.saldo_actual = B0 + 22`.
- `clients.total_pagos += 20`.

Tras consumir 22 minutos exactos, asumiendo tier BASE de la modelo:

- `cost = 22 × 1.00 = 22.00`.
- `modelEarning = 0.05 × 1 + 0.15 × 21 = 3.20`.
- `platformEarning = 22.00 - 3.20 = 18.80`.

Movimientos en cierre de stream:

- `transactions`: `(STREAM_CHARGE, -22.00)` cliente y `(STREAM_EARNING, +3.20)` modelo.
- `platform_transactions`: `(STREAM_MARGIN, +18.80)`.
- `balances` cliente: `B0` (vuelve al estado previo a la compra).
- `balances` modelo: `+3.20`.
- `platform_balances`: pasa de `P0-2` a `P0-2+18.80 = P0+16.80`.

Cierre del ciclo:

- PSP recibió `+20.00` (caja real).
- Modelo cobrará `3.20` vía `payout_requests`.
- Plataforma neto operativo `= 16.80`.
- Caja real plataforma `= 20.00 - 3.20 = 16.80`.

El `platform_balance` refleja exactamente el resultado económico real del ciclo. La operación cuadra.

## Validación TEST

Validación en TEST realizada sobre el catálogo BFPM Fase 4A vigente:

- **P10**: `priceEur = 10`, `minutesGranted = 10`, `bonusEur = 0`. Solo se escribe `INGRESO +10.00` en cliente. **No** se escribe `BONUS_GRANT` ni `BONUS_FUNDING`.
- **P20**: `priceEur = 20`, `minutesGranted = 22`, `bonusEur = 2`. Se escriben `INGRESO +20.00`, `BONUS_GRANT +2.00` (cliente) y `BONUS_FUNDING -2.00` (plataforma).
- **P40**: `priceEur = 40`, `minutesGranted = 44`, `bonusEur = 4`. Se escriben `INGRESO +40.00`, `BONUS_GRANT +4.00` (cliente) y `BONUS_FUNDING -4.00` (plataforma).
- **Invariante BFPM**: `Σ amount(BONUS_GRANT) + Σ amount(BONUS_FUNDING) = 0.00` confirmada globalmente.
- **Trazabilidad**: emparejamiento por descripción estructurada `pack=… order=…` confirmado entre cada `BONUS_GRANT` (cliente) y su `BONUS_FUNDING` (plataforma).
- **Caches denormalizadas**: `clients.saldo_actual` coincide con el último `Balance` del cliente. `clients.total_pagos` suma exclusivamente `priceEur` (no incluye bonus).
- **Streaming posterior**: el consumo de saldo aumentado funciona normalmente con `endSession` desde `billable_start`. **No** se generan nuevos `BONUS_GRANT` ni `BONUS_FUNDING` durante el consumo. El reparto modelo / plataforma se hace con las reglas vigentes (`STREAM_CHARGE`, `STREAM_EARNING`, `STREAM_MARGIN`).
- **Gifts y `STREAM_MARGIN`**: siguen separados de los movimientos BFPM y cuadran sin interferencia.
- **Catálogo legacy**: `P5 / P15 / P30 / P45` siguen rechazándose en `CcbillService.resolvePack` con `IllegalArgumentException`.

No se han tocado en Fase 4A: `ProductOperationalMode*`, `StreamService`, gifts, payout, tiers, auth-risk, KYC ni el webhook `notify`. La firma del webhook CCBill sigue bloqueada hasta recibir el manual oficial.

### Validación TEST — Fase 4B-a (auditoría interna)

Validación realizada disparando el job de auditoría sobre el ledger BFPM ya generado en Fase 4A.

- Endpoint: `POST /api/admin/audit/run`.
- Parámetros: `scope=DEFAULT`, `dryRun=false`, `trigger=API`.

Resultado del run (`audit_runs.id = 113`, `job_name=ACCOUNTING_AUDIT`):

| Campo | Valor |
|---|---|
| status | `SUCCESS` |
| checks_executed | 7 |
| anomalies_found | 0 |
| anomalies_created | 0 |
| anomalies_updated | 0 |
| execution_ms | 316 |
| started_at | 2026-05-01 20:05:12 |
| finished_at | 2026-05-01 20:05:13 |
| error_message | NULL |

Verificaciones MySQL post-run:

- `SELECT * FROM accounting_anomalies WHERE audit_run_id = 113;` → `Empty set`.
- `SELECT * FROM accounting_anomalies WHERE anomaly_type LIKE 'BFPM_%';` → `Empty set`.
- Invariante global confirmada en BD:
  - `sum_bonus_grant = 6.00`
  - `sum_bonus_funding = -6.00`
  - `bfpm_invariant = 0.00`

Conclusión:

- los cuatro checks BFPM (`BFPM_INVARIANT_BREACH`, `BFPM_BONUS_GRANT_WITHOUT_FUNDING`, `BFPM_BONUS_FUNDING_WITHOUT_GRANT`, `BFPM_TOTAL_PAGOS_MISMATCH`) ejecutan correctamente dentro del scope `DEFAULT`;
- no generan falsos positivos sobre el ledger BFPM válido producido por Fase 4A;
- no interfieren con los checks contables ni de session integrity preexistentes.

Lo que **no** cubre Fase 4B-a:

- no introduce reporting BFPM en backoffice (queda para Fase 4B-b);
- no decide la política de refund cuando el saldo cliente incluye bonus consumido o pendiente (queda para Fase 4B-b);
- no toca la integración CCBill real ni la firma del webhook (bloqueadas hasta el manual oficial).

No se han tocado en Fase 4B-a: `Constants.OperationTypes`, `TransactionService`, `CcbillService`, `StreamService`, `BillingController`, `ProductOperationalMode*`, gifts, payout, tiers, auth-risk, KYC, webhook `notify`, schema ni migraciones. Solo se han modificado `BalanceLedgerAuditRepository.java` y `AccountingAuditJobImpl.java`.

## Por qué no wallet de minutos separada

Una alternativa evaluada consistía en introducir una tabla `time_balances` paralela donde el cliente almacenara minutos en lugar de EUR. Se descarta por:

- exigiría reescribir `StreamService.endSession` para descontar minutos en lugar de EUR;
- exigiría reescribir `endIfBelowThreshold` y el cap por saldo;
- introduce ambigüedad en `clients.saldo_actual` y en la invariante `lastBalance == clients.saldo_actual`;
- gifts deberían convertirse a "minutos equivalentes" o se necesitaría wallet EUR paralelo;
- refunds dejarían de ser triviales (¿se reembolsa tiempo o EUR?);
- migración de clientes con saldo EUR previo no es trivial;
- no aporta beneficio comercial frente al modelo de bonus EUR si el frontend ya muestra minutos como dato visible;
- riesgo técnico alto, esfuerzo de varias semanas, frente a un beneficio marginal.

La alternativa BFPM cumple el mismo objetivo comercial (más minutos por más euros pagados) sin tocar la unidad del ledger.

## Por qué no rate efectivo por pack

Una segunda alternativa evaluada consistía en aplicar un `ratePerMinute` distinto al saldo proveniente de cada pack. Se descarta por:

- el saldo deja de ser fungible: hace falta rastrear de qué pack proviene cada euro y consumirlo en algún orden (FIFO/LIFO);
- `endSession` debe integrar consumo a tarifa variable, no fórmula simple;
- el reparto modelo / plataforma se vuelve no determinista por pack;
- gifts pierden semántica clara si la fuente de los EUR consumidos tiene rate variable;
- la auditoría debe trazar consumo a pool de origen;
- esfuerzo y riesgo muy altos.

BFPM mantiene el saldo fungible y la fórmula de cobro intacta.

## Por qué no saldo virtual

Una tercera alternativa, más tentadora por su simplicidad aparente, sería **acreditar al cliente más saldo del recibido del PSP sin contrapartida en plataforma**. Por ejemplo, en `P20` registrar directamente `+24` al cliente y nada en plataforma.

Se descarta sin reservas porque:

- rompe la trazabilidad económica: el ledger plataforma ya no puede cuadrarse contra caja real;
- introduce una asimetría sistémica: la suma de balances cliente excede la suma del dinero efectivamente recibido;
- la auditoría contable existente no podría detectar ni explicar la divergencia;
- bloquearía la integración con cualquier PSP que exija conciliación;
- pone en riesgo el cierre fiscal del producto.

La regla **"no debe existir saldo virtual sin trazabilidad"** es invariante de diseño en SharemeChat. BFPM la respeta exigiendo que cada euro acreditado al cliente como bonus tenga una contrapartida explícita en plataforma.

## Consecuencias

- el catálogo backend pasa a representar packs con dos campos: `priceEur` y `minutesGranted`;
- la diferencia entre ambos, traducida a EUR (`bonusEur = minutesGranted × ratePerMinute - priceEur`), es lo que se acredita como bonus;
- el frontend puede mostrar de forma honesta la oferta comercial: "paga 20 EUR, recibe 22 minutos";
- `StreamService` no requiere ningún cambio;
- gifts y payout no requieren cambios;
- tiers no requieren cambios;
- la auditoría contable debe extenderse para reconocer la nueva pareja de operaciones;
- `platform_balances` puede tomar valores temporalmente negativos en la ventana entre `BONUS_FUNDING` y consumo posterior. Esto es **aceptado y documentado** como comportamiento esperado;
- el ingreso PSP físico sigue sin registrarse en `platform_balances` como entrada directa; BFPM no aborda esa observación;
- `clients.total_pagos` registra solo lo realmente pagado, no el saldo recibido;
- `manualRefundToClient` requerirá decisión de política antes de operar sobre saldos que incluyan bonus consumido o pendiente;
- BFPM es **prerrequisito de Fase 5 CCBill real**: ningún pago real debe entrar al sistema antes de que BFPM esté implementado y validado.

## Riesgos

### Atomicidad de la acreditación

Si las tres escrituras de la compra con bonus no se ejecutan en la misma transacción, el cliente puede recibir bonus sin contrapartida en plataforma, o viceversa. Mitigación obligatoria: una única `@Transactional` que envuelve las tres escrituras.

### Falsos positivos en auditoría contable

`AccountingAuditJob` y `BalanceLedgerAuditRepository` no conocen los nuevos `operationType`. Hasta que Fase 4B los integre, las consultas de auditoría podrían marcar las nuevas filas como anomalías. Mitigación: documentar `BONUS_GRANT` y `BONUS_FUNDING` como tipos esperados antes de activar BFPM en cualquier entorno con auditoría activa.

### platform_balance negativo temporalmente

Tras un `BONUS_FUNDING` y antes del consumo del bonus, `platform_balance` puede ser inferior a su estado previo o incluso negativo. No es un error: refleja que la plataforma ha adelantado el bonus. Mitigación: documentar la invariante "`platform_balance` puede ser temporalmente negativo entre `BONUS_FUNDING` y consumo; cuadra al final del ciclo".

### Refund parcial sobre saldo con bonus

Si el cliente solicita refund de una compra que incluía bonus parcialmente consumido, hace falta decidir si el refund:

- devuelve solo el `priceEur` y libera `BONUS_FUNDING` proporcional;
- devuelve la totalidad del saldo restante;
- bloquea refund si parte del bonus ya se ha consumido.

Mitigación: la política se decide antes de implementar. No se asume aquí. Esta ADR no resuelve refund con BFPM activo.

### Concurrencia en webhook PSP

Dos webhooks idempotentes simultáneos para la misma `payment_session` no deben aplicar bonus dos veces. Mitigación: la idempotencia ya cubierta en `CcbillService.completeSession` (status `PENDING` y `psp_transaction_id` único) debe extenderse al método de acreditación con bonus.

### Migración entre Fase 3A y Fase 4A

Clientes que recargaron en Fase 3A (`minutesGranted == priceEur`) no recibieron bonus retroactivo. Decisión: no se concede bonus retroactivo. Documentar.

### Frontend con bundle stale

Si el frontend cacheado muestra packs sin `minutesGranted` y backend lo acredita con bonus, no hay riesgo: backend lee el catálogo backend, no la información del request. El bonus se aplica correctamente; solo la UX puede no reflejar la oferta nueva hasta que el bundle se refresque.

### Endpoints directos `/api/transactions/first` y `/api/transactions/add-balance`

Estos endpoints aceptan `amount` arbitrario y son simulación gobernada por `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED`. Decisión recomendada: **no aplicar bonus** en endpoints directos, manteniendo separación clara entre "simulación cruda" y "compra real con catálogo". Esta decisión se confirma en Fase 4A.

## Relación con ADR-011

ADR-011 (Pricing simplification and minimum threshold) decidió:

- catálogo vigente: `10 / 20 / 40 EUR`;
- mínimo de transacción: `10 EUR`;
- principio: la oferta comercial debe expresar saldo en EUR y, si comunica equivalencia en tiempo, debe derivarla de la tarifa vigente;
- en Fase 3A: `minutesGranted == priceEur`.

ADR-011 no decidió cómo modelar `minutesGranted > priceEur`. Esta ADR-012 cierra ese hueco respetando los principios de ADR-011:

- catálogo simple (sigue siendo `P10 / P20 / P40`);
- saldo en EUR (sigue siendo la unidad);
- equivalencia en tiempo derivada del rate (sigue cumpliéndose: el bonus se calcula como `minutesGranted × rate - priceEur`).

La pareja ADR-011 + ADR-012 define el modelo económico de pack vigente para la apertura del PSP.

## Relación con CCBill

La integración real con CCBill y la verificación de firma del webhook **siguen bloqueadas** hasta recibir el manual oficial. ADR-012 no aborda firma, contrato real, ni parámetros definitivos del PSP.

BFPM se implementa sobre el placeholder PSP actual (sandbox). Cuando llegue el manual oficial, la integración real conectará con `CcbillService.completeSession` que ya invocará el flujo de acreditación con bonus.

BFPM es **prerrequisito** para activar CCBill real:

- sin BFPM, los pagos reales producirían `addBalance(20)` plano, sin diferenciación comercial entre packs;
- con BFPM, el primer pago real ya acredita correctamente el bonus.

No se debe activar el flujo PSP real antes de que BFPM esté implementado y validado en TEST/AUDIT.

## Relación con auditoría contable

`AccountingAuditJob` y `BalanceLedgerAuditRepository` deben extenderse en Fase 4B para:

- reconocer `BONUS_GRANT` como `operationType` válido en `transactions` y `balances`;
- reconocer `BONUS_FUNDING` como `operationType` válido en `platform_transactions` y `platform_balances`;
- verificar la invariante BFPM `Σ BONUS_GRANT + Σ BONUS_FUNDING = 0` por entorno y por intervalo temporal;
- excluir explícitamente `platform_balance` negativo dentro de la ventana de bonus pendiente de consumo;
- emparejar cada `BONUS_GRANT` con su `BONUS_FUNDING` correspondiente (vía FK a `payment_session` o vía descripción estructurada).

Hasta que Fase 4B entre, BFPM solo debe activarse en entornos donde la auditoría no genere alertas. TEST y AUDIT pueden operar con BFPM activo siempre que se documente el `operationType` nuevo como esperado.

## Estado de implementación

- decisión aceptada;
- **Fase 4A — implementación mínima viable**: completada y validada en TEST. Detalles:
  - catálogo extendido (`priceEur` + `minutesGranted` por pack) implementado en `CcbillService` (record interno `Pack`);
  - método transaccional único `TransactionService.creditPackWithBonus(...)` que acredita cliente y plataforma atómicamente;
  - integración con `CcbillService.completeSession` para invocar el método nuevo tras pago aprobado;
  - frontend (`useAppModals.js`) alineado con `minutesGranted` por pack;
  - nuevos `operationType` `BONUS_GRANT` (cliente) y `BONUS_FUNDING` (plataforma) añadidos a `Constants.OperationTypes`;
  - validación en TEST sobre compras P10 / P20 / P40 (ver sección "Validación TEST").
- **Fase 4B-a — auditoría interna contable**: completada y validada en TEST. Detalles:
  - extensión de `BalanceLedgerAuditRepository` con cuatro métodos read-only (`getBfpmInvariantSummary`, `findBonusGrantsWithoutFunding`, `findBonusFundingsWithoutGrant`, `findClientsTotalPagosVsIngresoMismatch`);
  - cuatro checks nuevos en `AccountingAuditJobImpl.runDefaultAccountingChecks`: `BFPM_INVARIANT_BREACH` (CRITICAL), `BFPM_BONUS_GRANT_WITHOUT_FUNDING` (ERROR), `BFPM_BONUS_FUNDING_WITHOUT_GRANT` (ERROR), `BFPM_TOTAL_PAGOS_MISMATCH` (WARNING);
  - mismo `EPSILON = 0.01` que el resto de invariantes contables;
  - validación TEST con `audit_run_id=113` y `anomalies_found=0` (ver sección "Validación TEST — Fase 4B-a").
- **Fase 4B-b — reporting backoffice y política de refund con bonus**: pendiente. Alcance:
  - endpoint admin con resumen BFPM (bonus emitido / financiado / número de pares / invariante actual);
  - decisión documental y técnica de refund cuando el saldo cliente incluye bonus consumido o pendiente;
  - alertas operativas si procede.
- **Fase 5 — CCBill real y firma webhook**: **sigue bloqueada** hasta recibir el manual oficial de integración. No se infiere ni se implementa por aproximación.

Esta ADR es la fuente de verdad de la decisión sobre el contrato contable de BFPM. Cualquier matiz futuro sobre el modelo de bonus debe registrarse aquí o en una ADR posterior; no debe filtrarse a runbooks ni a documentación operativa sin pasar por la decisión documental.

## Alternativas consideradas

### Wallet de minutos separada

Tabla `time_balances` paralela donde el cliente almacena minutos en lugar de EUR.

Rechazada por refactor profundo, ambigüedad de unidad, complicaciones en gifts, refunds y migración. Detalle en sección "Por qué no wallet de minutos separada".

### Rate efectivo por pack

Aplicar un `ratePerMinute` distinto al saldo proveniente de cada pack.

Rechazada por pérdida de fungibilidad del saldo, complejidad en `endSession`, no determinismo en reparto modelo/plataforma y auditoría compleja. Detalle en sección "Por qué no rate efectivo por pack".

### Saldo virtual sin contrapartida

Acreditar al cliente más saldo del recibido del PSP sin asiento en plataforma.

Rechazada sin reservas por romper la trazabilidad económica del sistema y por contradecir la invariante de diseño "no debe existir saldo virtual sin trazabilidad". Detalle en sección "Por qué no saldo virtual".

### Mantener Fase 3A (sin bonus)

Cumplir el catálogo `10 / 20 / 40` sin descuento por volumen.

Rechazada porque elimina el incentivo comercial real para subir de pack. La oferta comercial sería plana: el cliente solo gana conveniencia, no valor por euro. No es viable como modelo de monetización antes de la apertura del PSP.

### Bonus aplicado también a endpoints directos

Aplicar BFPM también a `/api/transactions/first` y `/api/transactions/add-balance`.

Rechazada en esta fase. Estos endpoints son simulación gobernada por `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` y aceptan `amount` arbitrario. Aplicar bonus aquí mezclaría dos contratos distintos. La decisión final dentro de Fase 4A es no aplicar bonus en endpoints directos, manteniendo BFPM exclusivamente en el flujo PSP (placeholder o real).
