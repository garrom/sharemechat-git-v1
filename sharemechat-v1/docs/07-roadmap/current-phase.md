# Fase actual

## Fase activa general

SharemeChat está en **Fase 0 — Cierre de riesgos pre-PRO** del roadmap hacia GO LIVE.

Objetivo de esta fase:
cerrar riesgos estructurales antes de abrir PRO, especialmente en economía, acceso por entorno, PSP, KYC, compliance y configuración real por entorno.

El roadmap general vive en [go-live-roadmap.md](go-live-roadmap.md).
El backlog técnico vive en [pending-hardening.md](pending-hardening.md).
Este documento es el panel corto de estado y prioridad viva.

---

## Frente operativo activo: Gobierno económico pre-PSP

Objetivo:
cerrar la base económica interna antes de integrar CCBill real y antes de cualquier circulación de dinero real.

Secuencia actual:

1. **Gobierno por entorno de endpoints económicos directos** — HECHO
   - `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` implementado.
   - `/api/transactions/first` y `/api/transactions/add-balance` gobernados.
   - Validado en TEST.
   - AUDIT/PRO deben mantener la flag en `false` salvo decisión explícita.

2. **Corregir inicio facturable de streams** — HECHO
   - `endSession` calcula desde `billable_start`, con fallback defensivo a `confirmed_at`.
   - `start_time` queda como instante técnico, no como referencia de cobro final.
   - Validado en TEST con stream real.

3. **Centralizar packs 10 / 20 / 40 (Fase 3A)** — HECHO
   - Decisión estructural recogida en [ADR-011](../06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md).
   - Catálogo legacy `P5 / P15 / P30 / P45` eliminado del código funcional.
   - Backend (`CcbillService.resolvePackAmount`) acepta únicamente `P10 / P20 / P40` y rechaza el catálogo legacy con `400 / "PackId no soportado"`.
   - Frontend (`useAppModals.js`) muestra los tres packs `10 / 20 / 40 EUR` con `minutesGranted` igual a `priceEur` por construcción de Fase 3A.
   - Validado en TEST:
     - frontend muestra los packs `10 / 20 / 40`.
     - endpoints directos (`/api/transactions/first`, `/api/transactions/add-balance`) registran ingresos `10.00 / 20.00 / 40.00` con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=true` en TEST.
     - `POST /api/billing/ccbill/session` acepta `P10 / P20 / P40` y crea la `payment_sessions` con `amount` correspondiente.
     - `POST /api/billing/ccbill/session` rechaza `P5 / P15 / P30 / P45`.
   - Alcance limitado: `minutesGranted == priceEur`. Cualquier descuento por volumen o bonus exige BFPM.

4. **BFPM Fase 4A** — HECHO
   - Decisión estructural en [ADR-012](../06-decisions/adr-012-bfpm-platform-funded-bonus.md).
   - Implementado como bonus EUR financiado por plataforma. El saldo cliente sigue siendo EUR.
   - Catálogo BFPM vigente:
     - `P10` → `priceEur=10`, `minutesGranted=10`, sin bonus.
     - `P20` → `priceEur=20`, `minutesGranted=22`, bonus = 2 EUR.
     - `P40` → `priceEur=40`, `minutesGranted=44`, bonus = 4 EUR.
   - Por cada compra con bonus se crean atómicamente:
     - `Transaction(BONUS_GRANT)` y `Balance(BONUS_GRANT)` en ledger cliente.
     - `PlatformTransaction(BONUS_FUNDING)` negativo y `PlatformBalance` en ledger plataforma.
   - Validado en TEST: P10 sin bonus; P20 con `+2/-2`; P40 con `+4/-4`. Invariante `Σ BONUS_GRANT + Σ BONUS_FUNDING = 0` confirmada. `clients.saldo_actual` coincide con último balance. `clients.total_pagos` suma solo `priceEur` (no incluye bonus). Streaming posterior consume saldo aumentado normalmente y no genera nuevos `BONUS_GRANT`/`BONUS_FUNDING`. Gifts y `STREAM_MARGIN` siguen separados y cuadran.
   - No se han tocado en esta fase: ProductOperationalMode, StreamService, gifts, payout, tiers, auth-risk, KYC ni el webhook `notify`.

5. **BFPM Fase 4B-a — auditoría interna contable** — HECHO
   - Cuatro checks BFPM nuevos integrados en el job `ACCOUNTING_AUDIT`, scope `DEFAULT`:
     - `BFPM_INVARIANT_BREACH` (CRITICAL): valida `Σ BONUS_GRANT + Σ BONUS_FUNDING ≈ 0` con `EPSILON = 0.01`.
     - `BFPM_BONUS_GRANT_WITHOUT_FUNDING` (ERROR): `BONUS_GRANT` sin `BONUS_FUNDING` emparejado por descripción.
     - `BFPM_BONUS_FUNDING_WITHOUT_GRANT` (ERROR): sentido inverso.
     - `BFPM_TOTAL_PAGOS_MISMATCH` (WARNING): `clients.total_pagos != Σ Transaction(INGRESO)` con `EPSILON = 0.01`.
   - Validación TEST con `POST /api/admin/audit/run` (`scope=DEFAULT`, `dryRun=false`):
     - `audit_run_id=113`, `status=SUCCESS`, `checks_executed=7`, `anomalies_found=0`, `anomalies_created=0`, `execution_ms=316`.
     - `accounting_anomalies WHERE audit_run_id=113` → vacío.
     - `accounting_anomalies WHERE anomaly_type LIKE 'BFPM_%'` → vacío.
     - Invariante global confirmada: `sum_bonus_grant=6.00`, `sum_bonus_funding=-6.00`, `bfpm_invariant=0.00`.
   - Sin falsos positivos. Sin reporting backoffice todavía. Sin política de refund con bonus.
   - No se han tocado: ProductOperationalMode, StreamService, gifts, payout, tiers, auth-risk, KYC, webhook `notify`, schema ni migraciones.

6. **BFPM Fase 4B-b — reporting backoffice y política de refund** — SIGUIENTE
   - Endpoint admin con resumen BFPM (bonus emitido, financiado, número de pares, invariante actual).
   - Política documental y técnica de refund cuando el saldo cliente incluye bonus consumido o pendiente.
   - No mezclar con integración CCBill real.

7. **Integración CCBill real y firma webhook** — BLOQUEADO
   - Pendiente de recibir manual oficial de integración de CCBill.
   - No implementar firma, contrato definitivo ni validación final por inferencia.
   - Cuando llegue el manual, se abrirá el frente PSP real.

---

## Ya cerrado con consistencia

- Producto y backoffice sobre base común.
- Realtime dividido por `/match` y `/messages`.
- Trazabilidad económica y de streams.
- Product Operational Mode operativo para cierre de registro y simulación económica directa.
- Auth-risk Fase 1 y Fase 2 validadas en TEST y AUDIT.
- Pipeline perimetral AUDIT operativo.
- Billing de streams con doble ACK media y `billable_start` validado en TEST.
- CMS Fase 1 ([ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md)) COMPLETADO en TEST: backend `com.sharemechat.content`, schema MySQL `content_*`, bucket S3 privado `sharemechat-content-private-test` y panel backoffice operativos extremo a extremo. Sin IA, sin publicación pública, sin workflow editorial completo. Detalle en [test.md](../03-environments/test.md).

---

## Pendiente vivo fuera del frente activo

Estos puntos siguen pendientes, pero **no son el siguiente paso inmediato** salvo decisión explícita:

- Validar modos restrictivos completos de Product Operational Mode: `PRELAUNCH`, `MAINTENANCE`, `CLOSED`.
- Tratamiento frontend de códigos `PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE`, `REGISTRATION_CLOSED`, `SIMULATION_DISABLED`.
- Parametrización real de PRO.
- PSP CCBill real, bloqueado hasta recibir manual oficial.
- KYC externo end-to-end.
- Compliance entre REST y WebSocket.
- i18n producto/backoffice.
- Contrato funcional de errores REST/WebSocket/frontend.
- Extender auth-risk a login admin, refresh y forgot/reset password.
- Persistencia de logs en TEST cuando deje de arrancar manualmente.
- Siguiente paso CMS: Fase 2 (workflow editorial completo + versiones en `content_article_versions` + eventos en `content_review_events`).