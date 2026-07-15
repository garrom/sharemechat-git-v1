# ADR-051 — PSP puente cripto: NOWPayments Invoice API + arquitectura vendor-agnostic

> Estado: VIGENTE
> Fecha: 2026-07-16
> Vigencia esperada: hasta que exista un PSP tarjeta viable operativo o se decida rotar de vendor cripto.
> Ver también: [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-012](adr-012-bfpm-platform-funded-bonus.md), [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md), [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md), [ADR-030](adr-030-moderation-pipeline-build-vs-rent.md), [ADR-037](adr-037-moderation-visual-vendor-sightengine.md), [`../01-business/psp-strategy.md`](../01-business/psp-strategy.md).

## Estado

Aceptada. Frente activo iniciado 2026-07-16.

## Contexto

[ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md) (2026-07-09) declaró NOWPayments + Paxum como PSP puente para pasar de coming-soon a soft launch. La condición **Gate 3** del soft launch exige "PSP cripto en producción con al menos una transacción real completada end-to-end (compra de pack → wallet actualizada → sesión consumida)". Este ADR aterriza técnicamente esa decisión.

Estado técnico previo relevante:

- **CCBill fue eliminado del código** en commit `f9fea4a` (2026-06-08, cierre H7 en `docs/04-operations/known-debt.md:295-297`). No hay integración PSP viva. La directiva explícita del cierre H7 es: *"cuando se active el siguiente PSP, se crea controller/service nuevos limpios con HMAC desde el primer commit, sin arrastrar deuda"*.
- **`PaymentSession` entity** (`entity/PaymentSession.java:7-124`, tabla `payment_sessions` en `V1__baseline.sql:509-526`) sobrevive con schema neutral (`order_id UNIQUE`, `psp_transaction_id UNIQUE`, `status ∈ {PENDING, SUCCESS, FAILED, EXPIRED}`) pero **sin columna `provider`**.
- **`TransactionService.creditPackWithBonus(...)`** (`service/TransactionService.java:236-374`) implementa BFPM Fase 4A ([ADR-012](adr-012-bfpm-platform-funded-bonus.md)) atómicamente: `INGRESO` + `BONUS_GRANT` cliente + `BONUS_FUNDING` plataforma + actualiza `clients.saldo_actual/total_pagos` + promueve `USER→CLIENT` si `firstPayment`. Está huérfano (sin caller) esperando al próximo PSP. Contiene una string hardcoded `"Recarga via CCBILL ..."` (línea 290) heredada del código eliminado.
- **Patrón multi-vendor con validación webhook industrial ya probado** en KYC Didit (`service/KycSessionService.processDiditWebhook` líneas 438-498): anti-replay por timestamp (ventana 300s), HMAC verify constant-time (`security/HmacSha256.verifyHexHmacSha256:51-66`), parseo de `event_id` con fallback SHA-256 del body si el vendor no lo envía (líneas 481-490), dedup por `UNIQUE(provider, provider_event_id)` en tabla `kyc_webhook_events` (`V1__baseline.sql:295-313`), persistencia de todos los eventos (aceptados y rechazados) para auditoría.
- **Contract reservado para PSP en sistema de afiliadas**: `Constants.AffiliateCommissionSourceType.PAYMENT_SESSION` (`Constants.java:362`) y FK `payment_session_id` en `V16__add_affiliate_system_schema.sql:135,154`. La integración PSP ya está esperando ser conectada al programa de afiliadas.

En el horizonte próximo vienen PSPs adicionales: Vendo, CommerceGate, RocketGate como candidatos para tarjeta ([ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md), `psp-strategy.md`). El diseño debe absorberlos con cambio mínimo.

## Análisis previo

### Componentes reutilizables

- `PaymentSession` entity + `PaymentSessionRepository`. Schema neutral suficiente para multi-vendor con una columna adicional.
- `TransactionService.creditPackWithBonus(...)` como caller único de BFPM Fase 4A. Reutilizable sin cambios funcionales, requiere parametrizar el string hardcoded del provider.
- Patrón `KycSessionService.processDiditWebhook` como molde textual para el orquestador de webhooks PSP.
- `HmacSha256.verifyHexHmacSha256` (constant-time via `MessageDigest.isEqual`).
- Schema `kyc_webhook_events` como plantilla para `psp_webhook_events`.
- Patrón `KycProviderConfigService` / `StreamModerationProviderConfigService` para config runtime editable.
- Constants + FK ya reservados en sistema de afiliadas.

### Componentes a crear

- Interface `PaymentProvider` (agnóstica al vendor).
- Tabla `psp_webhook_events` (calcada de `kyc_webhook_events`).
- Tabla `psp_provider_config` (calcada de `kyc_provider_config`).
- Columna `provider` en `payment_sessions`.
- `NowPaymentsHttpClient` (adapter HTTP con `x-api-key`).
- `NowPaymentsSignatureVerifier` (HMAC-SHA512 sobre body ordenado alfabéticamente).
- `NowPaymentsPaymentProvider implements PaymentProvider`.
- `PspOrchestratorService` (vendor-agnostic, orquesta checkout).
- `PspWebhookOrchestratorService` (vendor-agnostic, orquesta webhook).
- `PspController` (REST checkout + status).
- Método `WebhookController.receiveNowPayments(...)`.
- Frontend: modal cripto, páginas `/checkout/success` + `/checkout/cancel`.

## Decisión

### D1 — Arquitectura vendor-agnostic desde día uno

Interface `PaymentProvider` con firma unificada:

```
String getProviderKey();
CreateInvoiceResult createInvoice(CreateInvoiceRequest req);
PaymentStatus getPaymentStatus(String providerPaymentId);
boolean verifyWebhookSignature(byte[] rawBody, Map<String,String> headers);
WebhookEvent parseWebhook(byte[] rawBody);
```

Todo lo que vive por encima (orquestadores, controllers, integración con `TransactionService.creditPackWithBonus`) es vendor-agnostic. NOWPayments es implementación concreta, no ciudadano privilegiado. Cuando llegue Vendo/CommerceGate/RocketGate: `XyzPaymentProvider implements PaymentProvider` + INSERT en `psp_provider_config`. Cero cambios en el orquestador, cero en BFPM, cero en el schema. Este contrato es el precio de la coherencia futura y se paga completo el primer día — la directiva de H7 (no arrastrar deuda) impide diferirlo al segundo vendor.

### D2 — Modo custodial + Invoice API + BTC/USDT/USDC

- **Custodial**: NOWPayments recibe cripto del cliente, convierte al spot rate del momento y transfiere EUR a nuestra cuenta bancaria. Sin custodia de cripto en nuestra infra. Sin wallets seed. Sin gestión de volatilidad. Nuestro código trabaja SOLO en EUR (coherente con BFPM Fase 4A que también es EUR).
- **Invoice API** (`POST /v1/invoice`): hosted checkout en `invoice.nowpayments.io/...`. Redirigimos al cliente allí. NOWPayments gestiona UI de pago, QR, direcciones dinámicas, expiración, retries. Nosotros recibimos webhook IPN al completarse. Rechazada la alternativa Payments API custom por más superficie de trabajo frontend sin beneficio funcional (solo estético).
- **Monedas iniciales**: BTC, USDT (preferiendo TRC-20 por fees), USDC. Enviamos `pay_currency=null` en la creación → el cliente elige en el hosted checkout de NOWPayments. Mejor UX y máxima flexibilidad sin código nuestro.
- Rechazada la opción **non-custodial** (recibir cripto en wallet propia) por seed management, contabilidad multi-moneda, exposición a volatilidad y riesgo custodial legal. El beneficio (acumular cripto estratégicamente) no compensa la complejidad para el momento actual del proyecto.

### D3 — Tabla `psp_webhook_events` calcada de `kyc_webhook_events`

Nueva tabla via migración Flyway. Columnas:

- `id BIGINT AUTO_INCREMENT PRIMARY KEY`
- `provider VARCHAR(30) NOT NULL` (`'nowpayments'`, futuros `'vendo'`, etc.)
- `provider_event_id VARCHAR(100) NOT NULL` (event_id del vendor; si el vendor no lo envía, derivamos `SHA-256(rawBody)` como sintético — mismo patrón que Didit líneas 481-490)
- `provider_payment_id VARCHAR(100) NULL` (payment_id del vendor, para reconciliación)
- `provider_event_type VARCHAR(50) NULL` (tipo de evento reportado)
- `payment_status VARCHAR(30) NULL` (status snapshot al recibir)
- `is_signature_valid BOOLEAN NOT NULL`
- `is_processed BOOLEAN NOT NULL DEFAULT FALSE`
- `processing_error_message TEXT NULL`
- `payload_json LONGTEXT NOT NULL`
- `received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `processed_at DATETIME NULL`
- `UNIQUE(provider, provider_event_id)` para idempotencia
- `INDEX(provider, provider_payment_id)` para reconciliación

Se persiste SIEMPRE, aceptado o rechazado por firma, para auditoría completa. Anti-replay: ventana de 300s si el vendor envía timestamp; si no lo envía, la dedup por `event_id` es suficiente porque un replay real produce el mismo `event_id` (o el mismo body, y por tanto el mismo `SHA-256`).

### D4 — Endpoints REST específicos por vendor

- `POST /api/billing/nowpayments/checkout` (JWT auth, body `{packId}`) → `{invoice_url, orderId, sessionId}`.
- `GET /api/billing/session/{orderId}/status` (JWT auth) → status para polling desde success_url.
- `POST /api/webhooks/nowpayments/ipn` (`permitAll` con validación firma HMAC-SHA512 obligatoria).

Patrón calcado del KYC (`/api/kyc/didit/webhook`, `/api/kyc/veriff/webhook`). Cuando venga Vendo: `/api/billing/vendo/checkout` + `/api/webhooks/vendo/ipn` nuevos, sin tocar los de NOWPayments.

Rechazado el patrón genérico `/api/webhooks/psp/{provider}` (usado por moderación) porque cada vendor puede requerir headers específicos (nombre exacto de la cabecera de firma, timestamps, versiones de firma) y validación asimétrica que complica el ruteo genérico. La sensibilidad económica del webhook PSP recomienda endpoint explícito por vendor como defensa por diseño.

### D5 — `order_id` = UUID puro

`java.util.UUID.randomUUID().toString()`. 128 bits aleatorios. Persistido en `payment_sessions.order_id` (columna ya `UNIQUE` en el schema baseline). Enviado a NOWPayments como `order_id` en el request de invoice.

Rechazadas alternativas prefijo entorno + secuencial (`TEST-PS-{sessionId}`) por acoplamiento al entorno y requerir pre-crear `PaymentSession` antes de generar el order_id, complicando innecesariamente la transacción de creación. Con UUID puro se genera el order_id primero, se pasa a NOWPayments y a la vez se persiste `PaymentSession` en la misma transacción atómica sin race.

### D6 — `order_description` legible

Formato: `SharemeChat - Pack P{amount} ({env})`. Ejemplo: `SharemeChat - Pack P10 (test)`. Aparece en el panel operativo de NOWPayments y en el hosted checkout del cliente. Ayuda a distinguir tráfico TEST de PROD si en algún momento comparten cuenta NOWPayments.

### D7 — Revocación consciente del prerrequisito BFPM 4B-b

`pending-hardening.md:86` declaraba BFPM Fase 4B-b (reporting backoffice bonus + política refund con bonus) como prerrequisito antes del PSP real. Decisión: se ignora esa dependencia y se arranca NOWPayments YA. Justificación: sin PSP vivo no hay refund que gestionar, y la política de refund con bonus solo tiene sentido con transacciones reales que refundear. BFPM 4B-b se cierra tras tener el flujo NOWPayments operativo, no antes.

Esta revocación queda explícitamente documentada aquí como decisión consciente para no reproducir el bloqueo señalado en `pending-hardening.md`.

### D8 — Kill-switch doble: property por deploy + config runtime

- Property `psp.nowpayments.enabled=false` (default) en `application.properties` con override via env var `PSP_NOWPAYMENTS_ENABLED` en `/opt/sharemechat/config.env`. Cuando `false`, el endpoint checkout devuelve `503 PSP_UNAVAILABLE` y el webhook IPN devuelve `503`.
- Tabla `psp_provider_config` (calcada de `kyc_provider_config`) con fila `provider_key='nowpayments', active_mode ∈ {ENABLED, DISABLED}, note`. Kill-switch runtime editable sin redeploy (patrón `KycProviderConfigService.setModelOnboardingMode`).
- En TEST arranca `false` para deploy inicial sin consumir transacciones sandbox de NOWPayments. Se activa manualmente tras verificación de credenciales.
- En AUDIT y PROD arranca `false`. AUDIT se activa cuando se replique el frente. PROD se activa cuando Gate 3 del soft launch esté listo (≥10 modelos verificadas + página `/m/:slug` + este PSP en producción con credenciales live).

### D9 — Integración con `TransactionService.creditPackWithBonus`

`PspWebhookOrchestratorService`, al recibir un evento con `payment_status='finished'`, adquiere lock sobre la fila `payment_sessions` (`SELECT ... FOR UPDATE` por `provider + psp_transaction_id`) y llama a `TransactionService.creditPackWithBonus(userId, priceEur, bonusEur, orderId, packId, firstPayment)`. Idempotencia doble:

1. Dedup por `UNIQUE(provider, provider_event_id)` en `psp_webhook_events` bloquea la segunda entrega del mismo evento a nivel base de datos.
2. Lock sobre `payment_sessions` bloquea la aplicación concurrente por otro camino ([ADR-012](adr-012-bfpm-platform-funded-bonus.md):297,332,372 documenta este riesgo).

Parámetro `firstPayment` = `!clientRepo.hasAnyPreviousSuccess(userId)`.

Refactor: el string hardcoded `"Recarga via CCBILL pack=... order=..."` en `TransactionService.java:290` se parametriza a `"Recarga via {provider} pack={pack} order={order}"` recibiendo `provider` como argumento del método.

### D10 — Reconciliación proactiva por polling GET status

Además del webhook IPN, el orquestador expone `GET /api/billing/session/{orderId}/status` que el frontend usa para polling desde la página `/checkout/success` cada 3 segundos hasta ver `SUCCESS` (max 5 min). Si el webhook llega antes, el status se actualiza; si el webhook se retrasa o pierde por temporal issue, el frontend ve `PENDING` prolongado y muestra "esperando confirmación blockchain" con opción de refresh manual.

Reconciliación background pasiva (job periódico que llama a NOWPayments `GET /v1/payment/{id}` para sessions `PENDING` con más de 30 min) queda como deuda diferida (#D-41 abajo). No es necesario para el arranque; el polling frontend cubre la ventana usable.

## Alternativas descartadas

- **Payments API custom (no Invoice API)**: gestionar dirección + QR + expiración desde nuestra UI. Rechazado en D2. Más código frontend, sin beneficio funcional sobre hosted checkout.
- **Non-custodial**: seed management + volatilidad + custodia. Rechazado en D2. Complejidad sin retorno operativo.
- **Genérico `/api/webhooks/psp/{provider}`**: rechazado en D4. Path específico por vendor es defensa por diseño.
- **Prefijo secuencial en `order_id`**: rechazado en D5. UUID puro es más limpio.
- **Reutilizar el fichero `WebhookController` de moderación como plantilla genérica**: se descarta por asimetría de sensibilidad económica. El PSP webhook merece controller propio.
- **Diferir la interface `PaymentProvider` hasta el segundo vendor**: rechazado por directiva H7 (`known-debt.md:295-297`). Diseñar la interface el primer día es más barato que refactorizar en el segundo.
- **Coexistir con el código CCBill eliminado**: no aplica — ya no existe código CCBill (H7 cerrado 2026-06-08).

## Consecuencias

Positivas:

- Gate 3 del soft launch desbloqueado técnicamente.
- Cripto abre segmento de crypto natives y países con controles cambiarios ([ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md)).
- Los PSPs futuros de tarjeta se integran en un solo commit + un INSERT en `psp_provider_config`, sin tocar orquestador, BFPM, ni schema.
- Idempotencia industrial calcada de KYC (patrón ya probado en producción con Didit).
- Kill-switch doble permite corte inmediato ante incidencia de vendor.
- Custodial mantiene contabilidad interna 100 % en EUR, sin invadir el modelo financiero actual.

Negativas / coste operativo:

- Hosted checkout redirige fuera del dominio (posible fricción UX minoritaria para usuarios que no confían en redirects). Aceptable frente al ahorro de código.
- Dependencia de NOWPayments para conversión spot cripto→EUR. Si suben fees o cambian condiciones, no hay alternativa cripto inmediata (Paxum es wallet, no PSP cripto directo).
- BFPM Fase 4B-b diferido (D7) = política de refund con bonus pendiente cuando ocurra el primer refund real.
- Confirmaciones BTC lentas (10-30 min en cadena) generan ventana de "esperando confirmación" visible al usuario. Aceptable porque USDT/USDC son mucho más rápidos y el usuario elige la moneda.

Trade-off principal: se prioriza tener PSP vivo YA (soft launch prioritario según [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md)) sobre el pulido de política de refund y sobre la coexistencia con CCBill (que ya no existe).

## Deudas diferidas (fuera del alcance de este ADR)

- **#D-35** — BFPM Fase 4B-b: reporting backoffice bonus + política formal de refund con bonus. Cerrar tras primer flow completo NOWPayments en TEST. `pending-hardening.md:86`.
- **#D-36** — Sección Fase E en [ADR-050](adr-050-anti-fraude-camara-streaming.md) (deuda anterior no relacionada, refrescada aquí por completitud).
- **#D-37** — Propagación NOWPayments a AUDIT y PROD. AUDIT como entorno de auditoría transaccional externa (PSP hará onboarding contra AUDIT); PROD tras Gate 3 completo del soft launch.
- **#D-38** — Actualizar `psp-strategy.md` + `known-risks.md:12` + `known-debt.md` retirando menciones stale a CCBill "coexistente" (código eliminado en `f9fea4a`).
- **#D-39** — Coordinación IPs oficiales de NOWPayments para `COUNTRY_ACCESS_BYPASS_IPS` (`pending-hardening.md:761`).
- **#D-40** — Integración con sistema de afiliadas: al confirmarse pago via webhook, disparar `AffiliateCommissionService.accrueForPaymentSession(paymentSessionId)` reutilizando la FK ya reservada (`V16__add_affiliate_system_schema.sql:135,154`). No bloquea el arranque técnico; sí se cablea antes de Gate 3 en PROD.
- **#D-41** — Job periódico de reconciliación background: para sessions `PENDING` > 30 min, llamar `NowPaymentsPaymentProvider.getPaymentStatus(psp_transaction_id)` y sincronizar. Complementa el polling frontend con red de seguridad server-side. No requerido para arranque; sí antes de Gate 3.
- **#D-42** — Integración con Paxum (el segundo PSP puente del [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md)). Frente propio cuando NOWPayments esté estable y se tengan credenciales Paxum.
- **#D-43** — Cifrado del `IPN_SECRET` at-rest en `secrets.env`. Actualmente todos los secretos del sistema están en plaintext dentro de `secrets.env` con perms `0600 root:root` (convergido 2026-07-15). Si en el futuro se decide cifrar secretos, aplicar la política aquí también.

## Trabajo derivado — subpasadas propuestas

Ordenadas por dependencia lógica. El operador confirma cadencia y agrupación cuando toque implementar.

1. **Fase 0: ADR-051 redactado** — HECHA (este documento).
2. **Fase 1: Schema + abstracción**. Migraciones Flyway V26 (columna `provider` en `payment_sessions`), V27 (tabla `psp_webhook_events`), V28 (tabla `psp_provider_config` + seed fila `nowpayments/DISABLED`). Interface `PaymentProvider` + DTOs `CreateInvoiceRequest`, `CreateInvoiceResult`, `PaymentStatus`, `WebhookEvent`. `PspProviderConfigService`. Sin lógica de red, sin tests aún.
3. **Fase 2: Adapter NOWPayments**. `NowPaymentsHttpClient` (RestTemplate + `x-api-key`, timeouts 5s connect / 10s read). `NowPaymentsSignatureVerifier` (HMAC-SHA512, alphabetic sort). `NowPaymentsPaymentProvider implements PaymentProvider`. `@ConfigurationProperties` con env vars (`PSP_NOWPAYMENTS_API_KEY`, `PSP_NOWPAYMENTS_IPN_SECRET`, `PSP_NOWPAYMENTS_BASE_URL`, `PSP_NOWPAYMENTS_ENABLED`). Tests unitarios: signature valid/invalid, JSON alphabetic sort determinista, health check.
4. **Fase 3: Orquestadores + endpoints REST**. `PspOrchestratorService.createCheckout(userId, packId, providerKey)` genera UUID order_id + persiste `PaymentSession` PENDING + delega a `PaymentProvider.createInvoice(...)`. `PspWebhookOrchestratorService.processWebhook(providerKey, rawBody, headers)` calcado de `processDiditWebhook`. `PspController` REST. `WebhookController.receiveNowPayments`. Refactor `TransactionService.creditPackWithBonus` para parametrizar el string de provider.
5. **Fase 4: Frontend**. Modal "Pagar con cripto" con selección de pack. POST checkout → `window.location.href = invoice_url`. Página `/checkout/success?orderId=X` con polling `GET status` cada 3s (max 5 min). Página `/checkout/cancel` simple.
6. **Fase 5: Testing sandbox end-to-end**. Deploy TEST con credenciales sandbox NOWPayments. Toggle `PSP_NOWPAYMENTS_ENABLED=true`. Crear invoice desde UI → completar pago en sandbox NOWPayments (BTC testnet o simulación built-in) → verificar webhook recibido + BFPM aplicado + saldo cliente actualizado. Validación en BD: `payment_sessions.status=SUCCESS`, `psp_webhook_events.is_processed=true`, `transactions(INGRESO/BONUS_GRANT)` + `platform_transactions(BONUS_FUNDING)` creadas atómicamente.
7. **Fase 6: Activación TEST + preparación PROD + docs stale**. Documentar activación en `docs/03-environments/test.md`. Actualizar `psp-strategy.md` retirando menciones a CCBill. Marcar `known-risks.md:12` como resuelto (endpoint eliminado + nuevo NOWPayments con HMAC desde primer commit). Cuando Gate 3 esté listo → propagar a PROD.

Aproximadamente 7 subpasadas efectivas (la 1 ya hecha).

## Trazabilidad

- Marco estratégico: [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md) — pivote soft launch cripto + Paxum.
- BFPM: [ADR-012](adr-012-bfpm-platform-funded-bonus.md) — bonus fondeado por plataforma, patrón atómico reutilizado.
- Packs: [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md) — catálogo P10/P20/P40.
- Patrón multi-vendor de referencia (KYC): [ADR-035](adr-035-age-and-identity-verification-vendor-consolidation-on-didit.md) — Didit + Veriff con `KycProviderConfigService`.
- Patrón multi-vendor de referencia (moderación): [ADR-030](adr-030-moderation-pipeline-build-vs-rent.md) + [ADR-037](adr-037-moderation-visual-vendor-sightengine.md) — Sightengine con `StreamModerationProviderConfigService`.
- Estrategia PSP: [`../01-business/psp-strategy.md`](../01-business/psp-strategy.md) (con menciones stale a CCBill, resolver en #D-38).
- Cierre H7 CCBill: `docs/04-operations/known-debt.md:295-297`.
- Riesgos abiertos: `docs/04-operations/known-risks.md:12` (4 gates antes de dinero real: firma, origen/contrato, idempotencia, anti-replay — D3, D4, D9 cierran los cuatro).
