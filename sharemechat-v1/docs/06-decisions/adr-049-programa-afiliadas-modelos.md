# ADR-049 — Programa de afiliadas de modelos: atribución cliente único, revshare lifetime 30% con umbral mensual de facturación, magic link temprano y bono de bienvenida al cliente

> Estado: VIGENTE
> Fecha: 2026-07-11
> Vigencia esperada: hasta que el volumen o el vertical justifiquen tiers de revshare, atribución multi-touch, o un rediseño del ciclo económico
> Reemplaza: N/A (documento nuevo). Complementa y aterriza técnicamente [`../01-business/affiliate-program.md`](../01-business/affiliate-program.md).
> Ver también: [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md), [ADR-012](adr-012-bfpm-platform-funded-bonus.md), [ADR-021](adr-021-email-tag-routing.md), [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md), [ADR-048](adr-048-pagina-publica-modelo-slug.md)

## Estado

Aceptada. Diseño estructural del sistema técnico de afiliadas. Cero implementación en esta iteración. Cuando toque materializar, el entorno de trabajo será **solo TEST** de momento; AUDIT y PROD se replican en una fase posterior condicionada a la decisión de corte del operador tras el pivote soft launch (ADR-047).

## Contexto

SharemeChat está en fase coming-soon sin tráfico real. El operador va a lanzar el programa de afiliadas **antes** de captar tráfico para poder ofrecerlo a modelos durante el outreach de reclutamiento (ver ADR-047 gate de apertura: ≥10 modelos verificadas activas).

El documento business [`../01-business/affiliate-program.md`](../01-business/affiliate-program.md) fija las condiciones comerciales: 30% revshare lifetime, cliente único por afiliado (last-touch cookie 90 días previa a la primera compra), payout Wise mensual, cooldown antifraude por chargeback. Este ADR aterriza técnicamente esas condiciones y añade las decisiones estructurales que ese documento no cerraba: umbral mensual de facturación propia como gate del cobro, magic link temprano tipo Uber/Airbnb para reducir cross-device breakage, bono de bienvenida al cliente referido, primer favorito automático, email de invitación.

Reconciliación con el business doc: el business doc habla de payout Wise con mínimo 50 USD mensual como cadencia estándar. El operador confirma en esta iteración que el **canal de payout es el mismo que streaming** (ya en Wise vía `PayoutRequest`). El cierre mensual y la cadencia concreta se decide en la subpasada de motor de comisiones; el ADR no fija cadencia diaria/semanal/mensual porque depende del cierre PSP real que aún no está integrado.

## Análisis previo

Mapeo del código actual del repo antes de decidir qué reutilizar y qué crear.

### Componentes reutilizables

- **Entidad `Client`** en [`src/main/java/com/sharemechat/entity/Client.java`](../../src/main/java/com/sharemechat/entity/Client.java): tabla `clients` con `user_id` (PK, FK a `users`), `saldo_actual`, `total_pagos`, `streaming_hours`. Extensible con una columna FK opcional a la modelo referidora (afiliada).
- **Entidad `FavoriteModel`** en [`Entity/FavoriteModel.java`](../../src/main/java/com/sharemechat/entity/FavoriteModel.java): tabla `favorites_models` con `client_id`, `model_id`, `status`, `invited`. El campo `invited` (string) permite marcar el primer favorito automático del cliente referido con un valor específico (`REFERRAL`) sin cambiar contrato de UI existente.
- **Entidad `PaymentSession`** en [`Entity/PaymentSession.java`](../../src/main/java/com/sharemechat/entity/PaymentSession.java): tabla `payment_sessions` con `user_id`, `pack_id`, `amount`, `status` (`PENDING`/`SUCCESS`/`FAILED`/`EXPIRED`), `psp_transaction_id`. El evento `SUCCESS` es el disparador natural del cálculo de comisión. Refunds/chargebacks entrarán por webhook PSP cuando esté integrado (ver ADR-047: PSPs vía NOWPayments + Paxum en el soft launch).
- **Entidades `Transaction`, `Balance`, `PlatformTransaction`, `PlatformBalance`** ([`Entity/Transaction.java`](../../src/main/java/com/sharemechat/entity/Transaction.java) y ledger de plataforma): el patrón BFPM Fase 4A (ADR-012) — con `BONUS_GRANT` en el ledger cliente y `BONUS_FUNDING` negativo en el ledger plataforma — sirve exactamente para el bono de bienvenida al cliente referido, con `operation_type` distinto (`REFERRAL_WELCOME_GRANT` / `REFERRAL_WELCOME_FUNDING`). El invariante `Σ GRANT + Σ FUNDING = 0` se preserva.
- **Entidad `PayoutRequest`** en [`Entity/PayoutRequest.java`](../../src/main/java/com/sharemechat/entity/PayoutRequest.java): tabla `payout_requests` con `model_user_id`, `amount`, `currency`, `status`, `admin_notes`. El canal Wise ya está cableado. Se puede extender con una columna `payout_type` (`STREAM` | `AFFILIATE`) para separar comisiones de streaming vs afiliación en el reporting sin romper la superficie admin actual.
- **`EmailVerificationService` + `EmailVerificationToken`** en [`Service/EmailVerificationService.java`](../../src/main/java/com/sharemechat/service/EmailVerificationService.java): patrón token opaco con TTL, hash SHA-256 en BD y consumo idempotente. Es el patrón replicable exacto para el magic link temprano del referral, con contexto distinto (`REFERRAL_LINK`) o tabla nueva. Ya se usa `SecureRandom` + `Base64` + `MessageDigest`.
- **`EmailService` + `EmailCopyRenderer`** con Graph API (ver `application.properties` sección `email.graph.*` + ADR-021): pipeline transaccional para enviar el email de verificación existente. Reutilizable para el email de invitación al cliente referido y para el email del magic link.
- **`UserService.registerClient`** en `UserService.java:80` es el punto único de instrumentación del flujo de registro cliente. La atribución al referrer y los side-effects (primer favorito + bono + email de invitación) se cablean ahí.
- **Auth-risk** (ADR-008): la instrumentación de `AuthRiskService` sobre login/refresh sigue aplicando a los clientes referidos sin cambios.

### Componentes que hay que crear

- **Código de afiliación por modelo**: tabla nueva `affiliate_codes` con `model_user_id`, `code` (identificador corto único), `active`, `created_at`. Sirve para materializar la URL/QR de la modelo y para el `?ref=<code>` de la landing pública. No se usa el `slug` del perfil (ADR-048) como código directo porque el slug es humano y editable; el `code` es máquina y estable.
- **Atribución cliente → modelo**: columna nueva `referrer_model_user_id BIGINT NULL` en `clients` (más simple que tabla puente porque es 1-a-1 permanente por decisión del operador). Índice para reporting agregado.
- **Magic link temprano**: tabla nueva `affiliate_link_tokens` con `token_hash`, `code_id` (FK), `email` opcional, `ttl`, `consumed_at`. Patrón calcado de `email_verification_tokens`.
- **Log de eventos de tracking**: tabla nueva `affiliate_click_events` (o `affiliate_events`) con `code_id`, `event_type` (`CLICK` | `EMAIL_SUBMITTED` | `LINK_CONSUMED` | `REGISTERED` | `FIRST_PAYMENT`), `ip_hash`, `ua_hash`, `created_at`. Base agregable para el panel de stats de la modelo sin exponer PII.
- **Comisiones**: tabla nueva `affiliate_commissions` con `id`, `client_user_id`, `referrer_model_user_id`, `payment_session_id` (FK), `base_amount`, `rate` (0.30), `commission_amount`, `period_yyyymm` (mes calendario del cobro), `status` (`ACCRUED` | `PAYABLE` | `SKIPPED_NO_ACTIVITY` | `REVERSED_CHARGEBACK` | `PAID`), `paid_via_payout_request_id` (FK a `payout_requests`), timestamps.
- **Motor de cálculo y cierre mensual**: servicio `AffiliateCommissionService` con dos operaciones: (a) al `SUCCESS` de `PaymentSession` de un cliente atribuido, crear fila `ACCRUED` con `commission_amount = base_amount × 0.30` y `period_yyyymm = mes cobro`; (b) job mensual `MonthlyAffiliateSettlementJob` que al cerrar el mes evalúa el umbral de facturación propia por modelo (definido en D5) y setea comisiones del mes a `PAYABLE` o `SKIPPED_NO_ACTIVITY`.
- **Servicio de reversos**: al procesar un chargeback/refund vía webhook PSP (aún no integrado) o vía endpoint admin manual, generar fila `REVERSED_CHARGEBACK` con `commission_amount` negativo, arrastrando el saldo a meses futuros si es negativo neto en el mes.
- **Endpoints REST**:
  - `POST /api/models/me/affiliate/activate` — modelo activa el programa; genera `affiliate_codes` si no existe.
  - `GET /api/models/me/affiliate` — devuelve código, URL canónica, URL con QR embebido (o `svg` inline), stats agregadas.
  - `POST /api/public/affiliate/click` — landing pública registra visita con `ref=<code>` (setea cookie 90 días, escribe `affiliate_click_events`).
  - `POST /api/public/affiliate/magic-link` — email opcional del visitante para el magic link temprano (dispara email con token).
  - `GET /api/public/affiliate/link/consume?token=<token>` — consume magic link, setea cookie de referral en el navegador nuevo y redirige a `/register/client?ref=`.
  - `POST /api/admin/affiliate/settle` — trigger manual del cierre mensual (además del schedule automático).
- **Frontend product**: página `/model/affiliate` con URL/QR descargable + stats (clicks, `EMAIL_SUBMITTED`, registros, clientes activos, ingresos por afiliación mes actual y acumulado).
- **Frontend product**: página landing `/i/:token` que consume el magic link.
- **Frontend product**: banner o modal en el flujo de registro cliente cuando entra por referral, mostrando el bono de bienvenida.
- **Frontend admin (opcional en esta fase)**: panel de afiliaciones con listado, estado, comisiones agregadas.

## Decisión

### D1 — Elegibilidad de modelo afiliada

Solo modelos con `verificationStatus = APPROVED` (KYC completo, incluido contrato firmado y assets aprobados según ADR-046 flujo modelo) pueden activar el programa. La activación es explícita: la modelo entra en el panel `/model/affiliate` y pulsa un CTA "Activar programa de afiliadas" — no automática al aprobar KYC. Coherente con el business doc §3 que dice "cualquier modelo con KYC APPROVED es elegible automáticamente" — el matiz técnico es que la activación explícita genera la fila `affiliate_codes`; sin activación la modelo no tiene código operativo.

Entidades externas (blogs, agencias, estudios) del business doc §3 quedan **fuera del alcance de este ADR**. Se abre frente separado cuando exista onboarding B2B real. La estructura de tablas (`affiliate_codes.model_user_id NOT NULL`) es acotada a modelos por ahora; cuando entren entidades externas, se decidirá si se extiende con `affiliate_codes.model_user_id NULL + external_affiliate_id` o si se crea tabla independiente.

### D2 — Modelo económico: 30% revshare lifetime sobre importe cobrado

Comisión = **30% del importe cobrado** de cada transacción confirmada del cliente atribuido, sin fecha de caducidad, mientras la relación cliente↔modelo permanezca vigente. Aplica a compras del cliente con **cualquier modelo** de la plataforma, no solo con la referidora.

Base = `amount` de la `PaymentSession` con `status = SUCCESS`. **No** se calcula sobre importe facturado (importe anunciado al cliente) ni sobre importe recogido después de deducir fees PSP: es sobre el importe efectivamente cobrado por la plataforma antes de fees. Los fees PSP los asume la plataforma como coste operativo, no se deducen del `base_amount` de la comisión. Se documenta explícitamente para evitar ambigüedad futura.

Rate hardcoded a `0.30` en la property `affiliate.commission.rate=0.30` con default en `application.properties`; nunca leído desde BD por row. Si el operador quiere cambiar la tasa globalmente en el futuro, se cambia la property y se redespliega; nunca por cliente ni por modelo individual (el business doc §2 lo fija como tier único).

### D3 — Atribución cliente único, permanente, por magic link o cookie previa a la primera compra

Cliente único → una modelo referidora. **Una vez atribuido, no se re-atribuye jamás.** La atribución se resuelve en el momento del registro (`registerClient`) por la primera fuente disponible en este orden:

1. **Token de magic link consumido** (parámetro `?ref=` en la URL del `/register/client` proveniente del `/i/:token` recién consumido). Vía preferente porque asegura el link cross-device.
2. **Cookie de referral en el navegador** (`sharemechat.referral_code`, TTL 90 días, HttpOnly, SameSite=Lax). Cookie última que ganó, coherente con business doc §4 (last-touch).
3. **Sin fuente**: cliente sin atribución. Se registra normalmente sin referrer, sin bono, sin primer favorito, sin email de invitación.

Al identificarse el `referrer_model_user_id`, se persiste en `clients.referrer_model_user_id` **de forma inmutable**. Cualquier intento posterior de sobrescribir esa columna es un bug del código y debe rechazarse a nivel service (guard defensivo).

### D4 — Umbral mensual de facturación propia como gate del cobro

La modelo cobra comisión de un mes calendario **solo si en ese mismo mes calendario ha facturado algo propio** (streaming real con `StreamRecord.confirmed_at != NULL` en el mes, o equivalente en el modelo económico vigente cuando llegue PSP real).

Semántica exacta:

- Al `SUCCESS` de la `PaymentSession` del cliente atribuido, se persiste `affiliate_commissions` con `status = ACCRUED` (comisión devengada, aún no evaluada).
- El `MonthlyAffiliateSettlementJob` (cron nocturno del día 1 del mes siguiente) evalúa por cada `referrer_model_user_id` si tiene al menos una sesión propia confirmada en el mes cerrado (`period_yyyymm`).
- Si sí → todas las comisiones `ACCRUED` de esa modelo en ese mes pasan a `PAYABLE`.
- Si no → pasan a `SKIPPED_NO_ACTIVITY`. **La comisión se pierde, no se acumula**; el business doc §4 y el operador coinciden en que el umbral es simple y sin arrastre.

Justificación: el umbral es una salvaguarda contra afiliadas totalmente inactivas que sigan generando payout indefinidamente. Un umbral mínimo de facturación propia («al menos una sesión propia el mes») mantiene el programa alineado con "modelo activa" sin introducir cifras arbitrarias de EUR mínimos.

La query concreta de "facturación propia" (¿sesión confirmada? ¿EUR mínimo? ¿sesión no gratuita?) se cierra en la subpasada 5 del trabajo derivado, ancorada al schema `stream_records` vigente en el momento de implementar.

### D5 — Cliente único por modelo, sin conflictos de atribución

Un cliente tiene, a lo sumo, un `referrer_model_user_id`. Un `referrer_model_user_id` puede tener muchos clientes atribuidos. Sin multi-atribución, sin first-touch ni last-touch competitivos post-registro: la decisión se congela en `registerClient` según D3 y ya no se toca.

Consecuencia: si el cliente pincha después otra URL con `?ref=` de otra modelo, la cookie se actualiza en el navegador (para futuros clientes no registrados que compartan ese navegador — caso raro), pero el `clients.referrer_model_user_id` del cliente ya registrado no cambia.

### D6 — Primer favorito automático y email de invitación al cliente

Al `registerClient` con atribución exitosa:

1. Se inserta `favorites_models(client_id=<user.id>, model_id=<referrer.id>, status='active', invited='REFERRAL')`. El valor `REFERRAL` en `invited` es nuevo y coexiste con los valores actuales (`pending` por defecto). No requiere migración del CHECK existente si `invited` es `VARCHAR` sin CHECK; a verificar en la subpasada de esquema.
2. Se dispara email de invitación al cliente notificando que fue invitado por la modelo referidora, con foto y URL del perfil `/m/:slug` (ADR-048) como CTA. Copy en `EmailCopyRenderer` con clave nueva `REFERRAL_INVITATION`, ES + EN según `user.uiLocale`.

Rollback si el insert de favorito o el envío de email fallan: el registro cliente sigue OK, la atribución se conserva, y se loguea WARN. No revertimos el registro por un side-effect de invitación fallido.

### D7 — Bono de bienvenida al cliente: 10 € financiado por plataforma, usable con cualquier modelo

Al `registerClient` con atribución exitosa, se dispara un bono de bienvenida BFPM (patrón ADR-012) por importe de **10 € EUR**:

- `Transaction(operation_type='REFERRAL_WELCOME_GRANT', amount=+10.00, user=cliente, description='Bono de bienvenida referido por modelo #<id>')` + `Balance` correspondiente.
- `PlatformTransaction(operation_type='REFERRAL_WELCOME_FUNDING', amount=-10.00, description=...)` + `PlatformBalance`.
- Invariante `Σ REFERRAL_WELCOME_GRANT + Σ REFERRAL_WELCOME_FUNDING = 0` (mismo patrón BFPM).

El bono es **saldo real EUR** en el ledger del cliente, indistinguible de un `INGRESO` para el consumo. **No está atado a la modelo referidora**: el cliente puede gastarlo con cualquier modelo de la plataforma. Coherente con "bono usable con cualquier modelo" del operador.

Rate del bono: property `affiliate.welcome-bonus.amount-eur=10.00`. Se apaga poniendo `0.00`.

**Anti-abuso**: el bono se dispara **únicamente si hay atribución** (`referrer_model_user_id != null`) al registrar. Un cliente que se registra sin URL de referral no lo recibe. Un cliente que llega por URL sin `?ref=` (sin código) tampoco. Impide farmear el bono creando cuentas sin pasar por el flujo de referral.

Interacción con auditoría contable (ADR-012 Fase 4B-a): el `ACCOUNTING_AUDIT` job se extiende con checks equivalentes a los BFPM sobre `REFERRAL_WELCOME_GRANT` / `REFERRAL_WELCOME_FUNDING`. Detalle en subpasada 4.

### D8 — Chargeback y refund: reverso proporcional de comisión

Si una `PaymentSession` que ya generó una fila `affiliate_commissions` sufre chargeback o refund después del cobro:

- Se genera una nueva fila `affiliate_commissions` con `status = REVERSED_CHARGEBACK`, `base_amount` negativo por el importe reembolsado, `commission_amount` negativo por 30% del reverso, `payment_session_id` referenciando la sesión original.
- Si la comisión original ya estaba `PAID` (payout ejecutado en un mes anterior): el importe negativo entra al mes en curso como arrastre. Si el saldo mensual de la modelo queda negativo, arrastra a meses siguientes hasta compensar (business doc §4). Nunca se genera clawback contra el saldo de streaming propio de la modelo — solo compensa contra comisiones futuras.
- Si la comisión estaba `PAYABLE` no pagada (pendiente): se cancela con el negativo antes del payout mensual.
- Si estaba `ACCRUED`: se cancela con el negativo.

El chargeback llega en el futuro por webhook del PSP; en la fase actual (soft launch) puede materializarse por endpoint admin manual `POST /api/admin/affiliate/chargeback` con el `payment_session_id` y la razón. Se documenta en subpasada 5.

### D9 — Bajas y expulsión de la modelo afiliada

- **Baja voluntaria**: la modelo pulsa "Salir del programa de afiliadas" en `/model/affiliate`. Efecto: `affiliate_codes.active = false`. La URL sigue resolviendo a la landing con `ref=` como código válido pero **no se atribuyen nuevos clientes**. Los clientes ya atribuidos (`clients.referrer_model_user_id`) siguen igual pero ninguna nueva `PaymentSession SUCCESS` genera comisión.
- **Expulsión** (operador vía admin): equivalente. `POST /api/admin/affiliate/deactivate` cambia `affiliate_codes.active = false` con motivo.
- **Bono de bienvenida del cliente ya emitido** sigue vigente sin restricciones — es saldo del cliente, no de la modelo.
- **Comisiones pendientes en estado `PAYABLE` no pagadas**: se pagan normalmente en el siguiente ciclo mensual si el umbral D4 se cumple. Si la baja es por fraude confirmado, el operador puede cancelar manualmente vía endpoint admin.

### D10 — Payout: mismo canal que streaming, gobernado por el motor de comisiones

El payout de comisiones se ejecuta por el **mismo canal técnico y humano que el payout de streaming**: `PayoutRequest` (Wise, mismo review admin, mismo estado `REQUESTED/APPROVED/REJECTED/PAID/CANCELED`).

Extensión mínima: columna `payout_type VARCHAR(20) NOT NULL DEFAULT 'STREAM'` en `payout_requests`. Valor `'AFFILIATE'` para las filas creadas por el motor de comisiones. Filtro admin en el panel de payouts para separar visualmente.

Cadencia: **cierre mensual** por `MonthlyAffiliateSettlementJob` — no hay payout por transacción individual. Al cierre del mes, el job agrega todas las comisiones `PAYABLE` de cada modelo, restando reversos, y genera un único `PayoutRequest(payout_type='AFFILIATE', amount=Σ, currency='EUR', status='REQUESTED')` por modelo con saldo positivo.

Umbral mínimo de payout: property `affiliate.payout.min-amount-eur=50.00`. Si el saldo mensual de una modelo está por debajo, se acumula al mes siguiente sin generar `PayoutRequest`. Coincide con business doc §5.

Retención PSP: cuando exista PSP con retención (chargeback window), el motor puede diferir el paso a `PAYABLE` hasta cerrar la ventana. Fase actual (cripto Paxum ADR-047, sin chargeback window equivalente): no aplica. Se documenta en subpasada como decisión operativa futura.

### D11 — Panel de la modelo: URL, QR, stats agregadas

`GET /api/models/me/affiliate` devuelve:

```
{
  code: "abc123",
  active: true,
  url_canonical: "https://sharemechat.com/m/lucia?ref=abc123",
  qr_svg: "<svg …/>",
  stats: {
    clicks_total, clicks_last_30d,
    email_submitted_total,
    link_consumed_total,
    registrations_total,
    active_clients_total,   // clients con ≥1 PaymentSession SUCCESS
    commissions_accrued_current_month_eur,
    commissions_paid_lifetime_eur
  }
}
```

Refresco al abrir la página y polling cada 30 s vía hook estilo `useConversationPolling` (patrón ADR-046). Estadísticas actualizadas en tiempo casi real; el operador acepta el matiz "casi" y no lo exige a nivel milisegundos.

QR generado server-side (una lib Java estándar tipo ZXing o generación SVG inline) — el ADR no fija la lib concreta, se decide en la subpasada 7.

### D12 — Magic link temprano tipo Uber/Airbnb

Objetivo del magic link: reducir la pérdida de atribución cuando el visitante ve la URL en móvil (por ejemplo desde X o Reddit) pero se registra después desde desktop. El patrón Uber/Airbnb es: pedir el email en cuanto el visitante entra en la landing, enviarle un link único que preserva el `ref=` al abrirlo en cualquier dispositivo.

Flujo:

1. Visitante entra a `sharemechat.com/m/lucia?ref=abc123` (o directamente `sharemechat.com/i?ref=abc123` como landing pura).
2. La página muestra un input opcional de email con CTA "Guárdate el link para más tarde" o "Regístrate desde tu ordenador".
3. Si el visitante mete email → `POST /api/public/affiliate/magic-link { code, email }`. Backend genera token opaco, guarda hash en `affiliate_link_tokens`, dispara email al visitante con URL `sharemechat.com/i/<token>` (patrón calcado de email de verificación).
4. El visitante abre el email en desktop y pincha el enlace → `GET /api/public/affiliate/link/consume?token=<token>` marca el token consumido, setea la cookie de referral en el navegador nuevo, y redirige a `/register/client?ref=abc123`.
5. Si el visitante se registra directamente sin usar el magic link (mismo dispositivo, sin cross-device), la cookie 90 días del paso 1 sigue siendo la fuente de atribución.

Coexistencia con la cookie: la cookie es la vía primaria same-device; el magic link es la vía cross-device. No compiten; suman.

Anti-abuso del magic link: rate limit del endpoint `POST /api/public/affiliate/magic-link` a 5 envíos por IP por hora (patrón `security.ratelimit.*` existente). El email del visitante NO se persiste asociado al usuario final si no se registra (privacy-friendly): solo vive en la fila `affiliate_link_tokens` con TTL corto (72 h) y se anonimiza tras consumo o expiración.

### D13 — Log de eventos y superficie de reporting

`affiliate_click_events` acumula `CLICK` / `EMAIL_SUBMITTED` / `LINK_CONSUMED` / `REGISTERED` / `FIRST_PAYMENT` con `ip_hash` y `ua_hash` (nunca IP plana, patrón ADR-008 Auth-risk). Cadencia de retención: 12 meses (property `affiliate.events.retention-months=12`); un job de limpieza mensual purga filas más antiguas. Los agregados de `affiliate_commissions` (comisiones acumuladas) no expiran; los eventos crudos sí.

Panel admin (opcional en esta fase, ver subpasada 8): listado de afiliadas activas, comisiones acumuladas, chargebacks, alertas de cooldown antifraude (>3% chargeback sostenido, business doc §4). Se abre en frente separado cuando el operador lo priorice; no es prerrequisito para lanzar el programa a modelos con el panel product.

## Alternativas descartadas

### Tabla puente `client_referrals` en lugar de columna `clients.referrer_model_user_id`

Rechazada. La relación es 1-a-1 permanente por decisión del operador (D5). Una columna FK es más simple, se indexa mejor, y evita una tabla puente vacía la mayor parte del tiempo. Si en el futuro entra multi-atribución (blogs con `ref=studioX` sobre perfil de Lucía, business doc §6), se abrirá tabla puente entonces con una migración limpia.

### Rate variable por modelo o por tier

Rechazada. Business doc §2 fija tier único 30%. Variabilizarlo introduce complejidad operativa (¿quién sube/baja tier?, ¿por qué criterio?, ¿retroactivo?) sin retorno demostrado. Property global cambia la tasa para todos los futuros, nunca para clientes ya atribuidos.

### Comisión sobre importe facturado en lugar de importe cobrado

Rechazada. El operador es explícito: "se aplica sobre importe cobrado, no facturado". Coherente con business doc §4 que descuenta chargebacks. Facturar sobre facturado obligaría a reversos constantes y a lógica de ventana de chargeback compleja. Cobrado como base = ledger de PSP como fuente única.

### Umbral de facturación mensual con cifra concreta EUR (por ejemplo "≥100 EUR facturados")

Rechazada. El operador dice "solo cobra comisión si ha facturado algo en el mes calendario del cobro del cliente. Umbral simple." Fijar 100 EUR o similar requiere justificación empírica que no existe pre-launch. "Al menos una sesión propia confirmada en el mes" es umbral simple, verificable en query, y alineado con "modelo activa" que es la intención del operador.

### Bono de bienvenida atado a la modelo referidora

Rechazada. El operador es explícito: "usable con cualquier modelo, no atado a la referidora". Atar el bono a la referidora reduce la conversión del bono (si la modelo referidora está offline o no ofrece lo que el cliente busca) y perjudica la experiencia. Bono como saldo real disponible en toda la plataforma es la vía canónica BFPM (ADR-012).

### Payout de comisiones por transacción en lugar de mensual agregado

Rechazada. Genera ruido operativo (muchos `PayoutRequest` pequeños), fricción en Wise (fees por transacción), y complica el reverso por chargeback (revertir un payout ya ejecutado es coste alto). Cierre mensual agregado es el estándar de industria.

### Magic link sustituyendo la cookie por completo

Rechazada. La cookie same-device sigue siendo el flujo mayoritario y funciona sin fricción (el visitante no tiene que dar email). El magic link es la salvaguarda cross-device, no el reemplazo.

### Endpoint público `POST /api/public/affiliate/attribute` para que el frontend registre atribución sin fuente confiable

Rechazada. Abre superficie de manipulación (cualquiera podría atribuir clientes falsos a cualquier modelo). Toda la atribución se resuelve server-side en `registerClient` leyendo cookie propia o token de magic link consumido; el frontend no puede aportar `referrer_model_user_id` en el body de registro.

## Consecuencias

Positivas:

- Un solo canal técnico (`PayoutRequest`) para payout de streaming y afiliación → menos superficie admin, menos trabajo de mantenimiento.
- Reutilización del patrón BFPM (ADR-012) para el bono de bienvenida → invariante contable ya validado en producción, sin nuevo modelo económico.
- Reutilización del patrón `EmailVerificationToken` para magic link → cero I/O nuevo en el pipeline de email, mismo TTL y consumo idempotente.
- Umbral D4 alineado con "modelo activa" → protege contra afiliadas dormidas cobrando indefinidamente, sin cifra arbitraria.
- Atribución inmutable D3+D5 → cero conflictos de atribución, cero disputas entre modelos por el mismo cliente.
- Panel modelo con URL/QR y stats casi-real → material tangible para la modelo compartir y motivar, requisito de negocio.

Negativas / coste operativo:

- Cinco tablas nuevas (`affiliate_codes`, `affiliate_link_tokens`, `affiliate_click_events`, `affiliate_commissions`, y potencialmente `affiliate_external_partners` en el futuro para B2B). Superficie de mantenimiento nueva.
- Un job scheduled nuevo (`MonthlyAffiliateSettlementJob`) que hay que operar y monitorizar. Si el job falla, las comisiones del mes quedan `ACCRUED` sin resolver; el operador tiene que intervenir manualmente. Se documenta en runbook.
- Ledger BFPM extendido con `REFERRAL_WELCOME_GRANT` / `REFERRAL_WELCOME_FUNDING` → `ACCOUNTING_AUDIT` job hay que ampliarlo con checks equivalentes. Trabajo derivado en subpasada 4.
- Reversos por chargeback traen complejidad: comisiones `PAID` en meses anteriores no se pueden "des-pagar"; el reverso arrastra a meses futuros y puede dejar la modelo con saldo mensual negativo. Requiere UI clara y comunicación explícita a la modelo.
- Cross-device via magic link exige email opcional del visitante; conversión visitante → email → click es << 100%. La atribución cross-device seguirá teniendo pérdidas residuales, aunque menores que sin magic link.

## Deudas diferidas (fuera del alcance de este ADR)

- **Onboarding B2B de entidades externas** (blogs, agencias, estudios) del business doc §3-§6. Requiere revisión manual, aceptación de terms específicos, y estructura de `affiliate_codes` extendida. Frente propio cuando aparezca demanda concreta.
- **Cooldown antifraude automático** por >3% chargeback sostenido 3 meses (business doc §4). Ahora el operador suspende manualmente vía endpoint admin. Automatización con detección + suspensión + revisión manual → sub-fase posterior.
- **Webhook PSP para chargebacks/refunds** que hoy no existe (soft launch cripto vía Paxum/NOWPayments está entrando; los flows de chargeback se materializan cuando exista PSP tarjeta con ventana). En la fase actual el operador procesa chargebacks manualmente vía endpoint admin (D8). Cuando el PSP tarjeta esté integrado, el motor de comisiones lee del webhook.
- **Panel admin de afiliaciones** con listado, estado, comisiones agregadas, alertas de cooldown. Opcional en fase inicial; el operador puede consultar por SQL directo si necesita. Frente propio cuando el volumen justifique UI.
- **Detección de auto-referral** (una modelo comparte su URL, se auto-registra como cliente con otra cuenta y gana comisión sobre sí misma). Anti-abuso adicional: `registerClient` compara `email_hash(client_email)` contra `email_hash(referrer_email)` y contra `email_hash` de cualquier `alt_email` de la modelo, y si coincide → registra sin atribución + log. Detalle en subpasada 4 si el operador lo prioriza; opcional en la fase inicial dado que el volumen de modelos es bajo y el operador puede detectar manualmente.
- **Retención propia del cliente atribuido** (ejemplo: cliente atribuido a modelo A durante 6 meses, deja de comprar 12 meses, vuelve — ¿sigue atribuido?). Business doc dice "lifetime". Este ADR mantiene la atribución permanente sin caducidad. Frente propio si el volumen justifica caducidad.

## Trabajo derivado — subpasadas propuestas

Ordenadas por dependencia lógica. El operador confirma cadencia y agrupación cuando toque implementar.

1. **Migración Flyway V16 + entidades JPA + repositorios base**. Crea `affiliate_codes`, `affiliate_link_tokens`, `affiliate_click_events`, `affiliate_commissions`. Añade columna `clients.referrer_model_user_id` con FK e índice. Extiende `payout_requests.payout_type`. Entidades `AffiliateCode`, `AffiliateLinkToken`, `AffiliateClickEvent`, `AffiliateCommission` y sus repositorios `JpaRepository`. Cero lógica de negocio en esta pasada. Cero endpoints.
2. **Servicio de generación de códigos + endpoint activación afiliación modelo**. `AffiliateCodeService.generateForModel(userId)` con SecureRandom + Base64 URL-safe, longitud 8, colisión-check con reintento. Endpoint `POST /api/models/me/affiliate/activate` protegido por `hasRole('MODEL')` + `verificationStatus=APPROVED`. Guard defensivo si ya tiene código. Test unitario del generador + MockMvc del endpoint.
3. **Landing pública `?ref=` + magic link temprano + cookie de referral**. Endpoints `POST /api/public/affiliate/click`, `POST /api/public/affiliate/magic-link`, `GET /api/public/affiliate/link/consume`. Cookie `sharemechat.referral_code` con TTL 90 días. Rate limit del magic link. Copy EN + ES del email del magic link (`EmailCopyRenderer` clave `REFERRAL_MAGIC_LINK`). Frontend product página `/i/:token`.
4. **Instrumentación de `registerClient` con referral + bono de bienvenida + primer favorito automático + email de invitación + auditoría contable extendida**. `UserService.registerClient` lee cookie/token, resuelve `referrer_model_user_id`, insert `favorites_models(invited='REFERRAL')`, dispara `TransactionService.creditWelcomeReferralBonus` (patrón BFPM ADR-012), envía email `REFERRAL_INVITATION`. Extiende `ACCOUNTING_AUDIT` con checks `REFERRAL_INVARIANT_BREACH` y `REFERRAL_GRANT_WITHOUT_FUNDING`. Tests: registro con cookie, registro con token, registro sin fuente, invariante contable.
5. **Motor de comisiones + cierre mensual + chargeback endpoint**. `AffiliateCommissionService.accrue(paymentSession)` en el hook `SUCCESS` de `PaymentSession`. `MonthlyAffiliateSettlementJob` cron 03:00 UTC día 1 del mes evaluando umbral D4 y transitando `ACCRUED → PAYABLE | SKIPPED_NO_ACTIVITY`. Endpoint `POST /api/admin/affiliate/chargeback { payment_session_id, refunded_amount, reason }` que genera fila `REVERSED_CHARGEBACK`. Tests: alta de comisión ok, umbral cumplido, umbral no cumplido, chargeback antes/después del payout.
6. **Payout de comisiones vía `PayoutRequest`**. Al final del `MonthlyAffiliateSettlementJob`, agregar comisiones `PAYABLE` por modelo, restar reversos, generar un único `PayoutRequest(payout_type='AFFILIATE', amount=Σ, currency='EUR', status='REQUESTED')` por modelo si Σ ≥ `affiliate.payout.min-amount-eur`. Panel admin de payouts filtra por `payout_type`. Tests: agregación, arrastre por chargeback, umbral no cumplido.
7. **Panel modelo product `/model/affiliate`**. Página React con URL canónica visible + QR descargable (lib QR JS o SVG server-side) + stats agregadas de D11 con polling 30 s. Hook `useAffiliateStats` con endpoint `GET /api/models/me/affiliate`. i18n ES + EN. Guard: si `!verificationStatus === APPROVED`, mostrar mensaje "completa tu KYC para activar el programa"; si `!activated`, mostrar CTA de activación (subpasada 2).
8. **Panel admin de afiliaciones (opcional en fase inicial)**. Listado de afiliadas activas + comisiones agregadas + chargebacks + alertas de cooldown. Endpoint `GET /api/admin/affiliate/summary`. Frontend admin, i18n. Se pospone si el operador prefiere consultar por SQL en esta fase.

Aproximadamente 7-8 subpasadas efectivas (la 8 puede diferirse). El detalle exacto de cada una — nombres finales de columnas, propiedades exactas, endpoints — se cierra en la implementación con la doc del ADR como contrato.

## Trazabilidad

- Documento business: [`../01-business/affiliate-program.md`](../01-business/affiliate-program.md).
- Estrategia de captación y encaje: [`../07-roadmap/plan-captacion-trafico-2026-q3.md`](../07-roadmap/plan-captacion-trafico-2026-q3.md) § P3.
- Página pública de modelo (pieza técnica adyacente): [ADR-048](adr-048-pagina-publica-modelo-slug.md).
- Pivote soft launch (contexto de PSP y prioridad de reclutamiento): [ADR-047](adr-047-pivote-soft-launch-cripto-paxum.md).
- Patrón BFPM (base del bono de bienvenida): [ADR-012](adr-012-bfpm-platform-funded-bonus.md).
- Precio y umbral (contexto tarifario general): [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md).
- Pipeline transaccional de email (base del email de invitación y del magic link): [ADR-021](adr-021-email-tag-routing.md).
- Deuda operativa asociada abierta en el mismo commit: entrada 2026-07-11 en [`../04-operations/known-debt.md`](../04-operations/known-debt.md).

---

**Alcance de entorno**: cuando toque implementar las subpasadas, el entorno de trabajo es **solo TEST** de momento. AUDIT y PROD se propagan en una fase posterior condicionada a la decisión de corte del operador tras cerrar el frente en TEST.
