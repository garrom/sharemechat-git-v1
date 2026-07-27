# ADR-054 — Sistema de Tickets de Incidencias en Soporte

> Estado: VIGENTE
> Fecha: 2026-07-27
> Vigencia esperada: hasta que el volumen real de incidencias justifique automatización mayor (auto-approve compensación con umbrales por categoría) o hasta que el frente PSP tarjeta introduzca disputas/chargebacks que requieran una capa dedicada de dispute management.
> Ver también: [ADR-046](adr-046-panel-soporte-humano.md) (chat soporte + panel humano), [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md) + [ADR-012](adr-012-bfpm-platform-funded-bonus.md) (BFPM), [ADR-050](adr-050-anti-fraude-camara-streaming.md) (moderación), [ADR-053](adr-053-tolerancia-parciales-cripto.md) (tolerancia parciales), [ADR-052](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D7 (política descuentos chargebacks).

## Estado

Aceptada. Cero implementación en esta iteración. La materialización técnica (migration Flyway, entidades, servicios, controllers, frontend cliente y admin) se planifica en una secuencia de fases ejecutable en 2-3 sesiones dedicadas, condicionada a estabilidad de los frentes activos (ADR-052 sub-frente 3 en curso).

## Contexto

Al cierre de este ADR el sistema de soporte al usuario (ADR-046, Fase B cerrada en TEST+AUDIT el 2026-07-09) resuelve **consultas**: el `SupportBotService` responde vía LLM sobre la base de conocimiento (`support_bot_prompts` + ficheros `.md` cargados por `SupportKnowledgeBaseLoader`) y, cuando el bot no puede resolver, el flujo escala a agente humano (`support_conversations.resolution_status=ESCALATED` → estado `HUMAN_HANDLING` gestionado desde `AdminSupportPanel`).

Ese sistema es correcto para **dudas** ("¿cómo cambio mi contraseña?", "¿qué es un pack?", "¿cuánto tarda un retiro?"). No cubre bien **incidencias**: casos donde el usuario reporta que **algo falló** y espera resolución + posible compensación económica.

Ejemplo real del sector (extraído del planteamiento del operador):

> "Se ha caído el streaming en el minuto 3, devolvedme mi dinero."

Con la infraestructura actual esto se gestiona como una consulta más:
- El bot LLM no tiene contexto operativo del stream concreto del usuario (`stream_sessions`, `stream_events`), así que solo puede dar respuesta genérica o escalar.
- El agente humano recibe el escalado pero sin trazabilidad estructurada: qué stream, qué corte, si hubo evidencia técnica del problema, historial del cliente con reclamaciones previas.
- Si el agente decide compensar, existe [`POST /api/admin/finance/refund/{userId}`](../../src/main/java/com/sharemechat/controller/AdminController.java) que acredita saldo real al cliente y contrapartida negativa a plataforma vía [`TransactionService.manualRefundToClient`](../../src/main/java/com/sharemechat/service/TransactionService.java) — **es implementación real y correcta, no mock**. Pero la compensación queda sin link estructurado a la incidencia que la motivó: solo la descripción libre (`"Manual refund by adminId=X | <razón>"`) y la ausencia de un flujo de "esta compensación resuelve este ticket concreto".
- Sin dominio de ticket dedicado no hay estados propios (`OPEN → INVESTIGATING → RESOLVED_COMPENSATED / RESOLVED_NO_COMPENSATION / REJECTED_INVALID`), no hay SLA, no hay evidencia adjunta reutilizable, no hay antifraude estructural, y la métrica operativa "cuántas incidencias por categoría, con qué tasa de compensación, por qué motivo" es imposible de extraer sin auditoría manual de logs y descripciones libres.

El pivote de estrategia decidido el 2026-07-27 (**cripto como método secundario, PSP tarjeta como método principal en cuanto se cierre onboarding**) hace que el sistema de tickets pase de "nice to have" a **prerrequisito operativo**: al abrir PSP tarjeta con captación masiva llegarán inevitablemente reclamaciones por chargebacks preventivos, cortes técnicos, moderación auto-cut percibida como injusta, saldo no acreditado. Sin sistema estructurado, la gestión será ad-hoc, inconsistente entre agentes, poco defendible ante disputas PSP, y con coste operativo desproporcionado al volumen.

## Análisis previo

### Mapeo del código actual afectado

**Sistema de soporte (ADR-046)**:

- **`support_conversations`** en [`V12__add_support_schema.sql`](../../src/main/resources/db/migration/V12__add_support_schema.sql): chat 1:N con `support_messages`. Estados `OPEN / RESOLVED / ESCALATED / ABANDONED / RATE_LIMITED`. Reutilizable como canal de comunicación adjunto al ticket, sin fusionar dominios.
- **`SupportBotService`** con base de conocimiento + guards de escalado (early + race post-LLM). El bot puede detectar palabras clave de incidencia y ofrecer "¿Abrir ticket?" (D2 b2).
- **`SupportAdminController`** con 13 endpoints admin bajo `/api/admin/support/`. Extensible con nuevos endpoints para tickets bajo `/api/admin/tickets/`.
- **`AdminSupportPanel.jsx`** con sub-tabs Conversaciones + Profiles. Extensible con nueva sub-tab Tickets.

**Sistema económico**:

- **`manualRefundToClient`** en [`TransactionService.java:965`](../../src/main/java/com/sharemechat/service/TransactionService.java): endpoint real y funcional. Crea `Transaction(MANUAL_REFUND)` cliente + `Balance` + `Client.saldo_actual` + `PlatformTransaction(MANUAL_REFUND_EXPENSE)` + `platform_balance`, con validación de invariante y lock user. Cap 1000€, adminId + description obligatorios.
- **`AdminFinancePanel.jsx`** con formulario refund que llama al endpoint real. Reutilizable desde el flujo ticket (el agente humano en el panel del ticket clickea "Compensar X€" y el frontend llama al mismo endpoint con `ticketId` extra en el body).
- **`transactions`** en [`V1__baseline.sql`](../../src/main/resources/db/migration/V1__baseline.sql): tabla con `user_id`, `amount`, `operation_type`, `description`. **Se extiende** con columna nullable `ticket_id` FK a `support_tickets.id` (D4).

**Fuentes de verdad para verificación automática (D3)**:

- **`stream_sessions`** + **`stream_events`** + **`presence_events`**: qué stream, cuándo empezó, cuándo terminó, motivo del final (`USER_ENDED`, `MODERATION_CUT`, `KILL_PAIR_ADMIN`, `WS_DISCONNECT`), duración facturada real, cortes por reconexión.
- **`payment_sessions`** + **`psp_webhook_events`** + **`transactions`**: para incidencias tipo `PAYMENT_NOT_CREDITED`, verificar si hay `payment_sessions.status=SUCCESS` sin `Transaction(INGRESO)` correspondiente, o webhook rechazado, o drift ADR-053 sin recuperar.
- **`moderation_evidence`** + **`moderation_decisions`**: para incidencias tipo `MODERATION_FALSE_POSITIVE`, evidencia del corte y decisión (RED/AMBER + reason).
- **`user_audit_log`**: para incidencias tipo `ACCOUNT_ISSUE`, bloqueos/suspensiones recientes.

### Componentes que hay que crear

- **Migration Flyway V41** (nueva): tabla `support_tickets` + columna `transactions.ticket_id` nullable con FK.
- **Entity + Repository**: `SupportTicket`, `SupportTicketRepository`.
- **Servicio backend**: `TicketService` (CRUD ticket + gestión estados), `TicketVerificationService` (checks automáticos por categoría, devuelve JSON evidencia), `TicketCompensationService` (wrapper sobre `manualRefundToClient` que enlaza el refund al ticket y valida estados).
- **Controller cliente**: `TicketController` bajo `/api/tickets/` (POST crear, GET listado propio, GET detalle, POST añadir mensaje).
- **Controller admin**: extensión de `SupportAdminController` o nuevo `AdminTicketController` bajo `/api/admin/tickets/` (listado con filtros, detalle, verificación automática, cambiar estado, compensar).
- **Detección heurística en `SupportBotService`**: cuando el mensaje del usuario contiene keywords de incidencia, el bot responde con oferta explícita "¿Quieres que abramos un ticket para investigar esto?" y el usuario confirma (b2 del D2).
- **Frontend cliente**: sección "Mis incidencias" en dashboard cliente (`ClientDashboard.jsx` o página `/support/tickets`), formulario de apertura con categorías, listado con estado, drill-down con hilo de mensajes reutilizando `SupportChat.jsx`.
- **Frontend admin**: nueva sub-tab "Incidencias" en `AdminSupportPanel.jsx` con listado (filtros por categoría/estado/edad), drill-down con panel de verificación automática (muestra JSON evidencia formateado), botón "Compensar X€" con confirmación (llama al endpoint refund con `ticketId`), botón "Rechazar con motivo".
- **i18n**: extensión `admin.tickets.*` y `support.tickets.*` ES+EN.

### Componentes que no se tocan en este ADR

- `SupportBotService` core: el bot LLM sigue funcionando igual para consultas normales. La detección de incidencias es una capa aditiva en el guard pre-respuesta.
- `manualRefundToClient` core: se mantiene tal cual, solo se extiende el DTO con `ticketId` opcional y se añade validación bidireccional (si `ticketId` presente, verificar ticket existe y en estado `RESOLVED_COMPENSATED_PENDING_CREDIT`; si el refund se hace SIN `ticketId` sigue funcionando como hoy para casos ad-hoc pre-ticket).
- `AdminFinancePanel.jsx` core: sigue funcionando como panel de refund manual libre. El botón "Compensar" desde el ticket usa el mismo endpoint pero con `ticketId` en el body.
- Sistema BFPM (`BONUS_GRANT` + `BONUS_FUNDING`): NO se usa para tickets (ver D4 alternativa descartada A).

## Decisiones

### D1 — Ticket como entidad NUEVA (`support_tickets`) con conversación linkada opcional (Opción C)

El ticket es dominio propio con vida propia, no un tipo de conversación:

- Tabla nueva `support_tickets` con FK opcional `linked_conversation_id → support_conversations(id)` cuando el ticket nace de un escalado del bot.
- Cuando el usuario abre ticket directamente desde el formulario (D2 b1), `linked_conversation_id` puede quedar NULL o el backend crea una conversación asociada en modo `HUMAN_HANDLING` para el canal de comunicación.
- La comunicación agente humano ↔ cliente sobre el ticket va por `support_conversations` + `support_messages` existente (reutilización total de la infra ADR-046).

**Alternativa descartada**: extender `support_conversations` con `type = CONSULTA | INCIDENCIA` (mezcla dominios con lifecycles muy distintos — una conversación es efímera y dura minutos, un ticket puede durar días con evidencia y compensación).

### D2 — Apertura por dos vías: b1 explícito + b2 detección con confirmación

**b1 — Formulario explícito**: botón "Reportar incidencia" visible en dashboard cliente y en el chat de soporte. Categorías cerradas:
- `STREAM_INTERRUPTED` — corte de streaming
- `PAYMENT_NOT_CREDITED` — pago no acreditado
- `MODERATION_FALSE_POSITIVE` — corte por moderación percibido como injusto
- `ACCOUNT_ISSUE` — problema con la cuenta (bloqueo, cambio email, etc.)
- `OTHER` — no encaja en las anteriores, descripción libre

Todas requieren descripción libre + timestamp aproximado del problema.

**b2 — Detección heurística por el bot**: `SupportBotService` pre-clasifica el mensaje del usuario contra un conjunto de keywords/patrones de cada categoría. Si detecta señal fuerte (ratio ≥ umbral configurable), en vez de responder con la consulta genérica, responde con: **"Parece que estás reportando un problema con [categoría inferida]. ¿Quieres que abramos un ticket de incidencia para investigarlo?"** — el usuario confirma con un botón "Sí, abrir ticket" o rechaza con "No, es una consulta". La confirmación explícita **es obligatoria** — el bot NUNCA abre ticket sin consentimiento del usuario, para evitar tickets espurios que inflen el backlog.

**Alternativa descartada**: apertura implícita por el agente humano tras escalado sin consentimiento explícito del usuario (b3). Se descarta en la primera versión — el agente humano puede sugerir al usuario "esto sería mejor como ticket" pero el ticket se crea con el mismo botón b1 que ve el usuario. Evita fricción en el diseño y mantiene consistencia.

### D3 — Verificación automática, decisión humana obligatoria

Endpoint admin `POST /api/admin/tickets/{id}/verify` corre los checks aplicables a la categoría del ticket contra las fuentes internas y devuelve un JSON estructurado con evidencia. El agente humano lee la evidencia y decide. **El sistema NO propone auto-approve/auto-reject en esta versión.**

Estructura de la respuesta por categoría (ejemplo `STREAM_INTERRUPTED`):

```json
{
  "ticketId": 42,
  "category": "STREAM_INTERRUPTED",
  "verifiedAt": "2026-07-27T09:30:00Z",
  "signals": [
    {
      "source": "stream_sessions",
      "streamSessionId": 1789,
      "modelUserId": 12,
      "clientUserId": 35,
      "startedAt": "2026-07-27T09:15:23Z",
      "endedAt": "2026-07-27T09:18:41Z",
      "endReason": "WS_DISCONNECT",
      "billedSeconds": 198,
      "reconnectAttempts": 3,
      "signal": "STRONG_POSITIVE"
    }
  ],
  "recommendation": "MANUAL_REVIEW",
  "signalStrength": "STRONG"
}
```

- Campo `signal` por evidencia: `STRONG_POSITIVE` / `WEAK_POSITIVE` / `NEUTRAL` / `NEGATIVE`.
- Campo global `signalStrength`: máximo entre todas las señales.
- Campo `recommendation`: siempre `MANUAL_REVIEW` en esta versión. Reservado para futura evolución auto-approve/auto-reject cuando haya datos históricos suficientes.

**Alternativa descartada**: sistema auto-approve con umbrales por categoría (ejemplo: `STREAM_INTERRUPTED` con `WS_DISCONNECT` y `billedSeconds < 300` → auto-compensar 3 min). Se descarta en la primera versión — sin datos históricos no se pueden calibrar umbrales, y una decisión automática mal calibrada puede acumular fraude o irritar clientes legítimos. Se difiere a evolución futura (deuda registrada abajo).

### D4 — Compensación via `manualRefundToClient` con columna nueva `transactions.ticket_id`

Zero refactor del ledger contable. El flujo desde ticket:

1. Agente humano abre el ticket en el panel admin.
2. Verifica evidencia (endpoint D3).
3. Clickea "Compensar X€" → confirmación → llama a `POST /api/admin/finance/refund/{userId}` con body extendido: `{amount, operationType: "MANUAL_REFUND", description, ticketId}`.
4. Backend valida: si `ticketId` presente, verificar que el ticket existe, está en estado `RESOLVED_COMPENSATED_PENDING_CREDIT`, y pertenece al `userId` del path. Si algún check falla → 400.
5. Backend ejecuta `manualRefundToClient` como hoy, **añadiendo** `savedTx.setTicketId(ticketId)` antes del `save`.
6. Backend actualiza el ticket: estado → `RESOLVED_COMPENSATED`, campos `compensated_amount_eur` + `compensated_transaction_id` + `resolved_at` + `resolved_by_admin_id`.

**Ventajas de esta opción sobre BFPM (`BONUS_GRANT` + `BONUS_FUNDING`)**:
- Reuso completo del panel admin actual (mismo formulario, mismo endpoint, mismo servicio).
- No requiere refactor de `creditPackWithBonus` (que exige `price + packId` obligatorios que en ticket no aplican).
- Trazabilidad estructurada: `transactions.ticket_id` FK.
- Semánticamente `MANUAL_REFUND` encaja bien con "compensamos por incidencia real verificada".

**Alternativa descartada A — BFPM**: usar `BONUS_GRANT` + `BONUS_FUNDING` (patrón ADR-012 Fase 4A). Contablemente más limpio para clasificar la compensación como "coste de retention/marketing" en vez de "coste de refund". Se descarta por complejidad (requiere método hermano de `creditPackWithBonus` sin price/packId + adaptación del test BFPM 4B-a) sin beneficio operativo en el volumen previsible del primer año. Si en el futuro el reporting exige separar rigurosamente "compensaciones bono" vs "reembolsos reales", se puede migrar en un ADR futuro filtrando por `ticket_id IS NOT NULL`.

### D5 — Compensación siempre en EUR en el ledger, UX opcional en minutos

El ledger interno trabaja en EUR (invariante del sistema). Hoy 1€ = 1min, pero cuando aterrice el sub-frente 3 del ADR-052 (tarifa variable `chosen_rate_eur_per_min` de 1-9€/min por modelo), la equivalencia "X min = X€" se rompe.

- **Almacenamiento**: `support_tickets.compensated_amount_eur DECIMAL(10,2)`. Sin columna paralela en minutos.
- **UX admin**: el formulario de compensación acepta EUR y muestra referencia informativa "5€ ≈ 5 min al ratio actual" o "5€ ≈ N min a la tarifa €X/min de la modelo del stream reportado" cuando el ticket tiene stream asociado.
- **UX cliente**: el cliente ve el saldo acreditado en EUR (como hoy) + en dashboard "minutos disponibles" según ratio de modelo (feature ya existente/planificada).

### D6 — Estados del ticket

Enum cerrado con transiciones válidas explícitas:

- `OPEN` — recién creado por el cliente. Sin gestión iniciada.
- `INVESTIGATING` — agente humano lo tomó y está verificando/comunicándose.
- `RESOLVED_COMPENSATED_PENDING_CREDIT` — decisión de compensar tomada, pero el refund NO ejecutado todavía (transición efímera, se debe cerrar en la misma sesión de admin).
- `RESOLVED_COMPENSATED` — refund ejecutado y linkado.
- `RESOLVED_NO_COMPENSATION` — verificación no encontró evidencia suficiente o compensación no procede (con motivo explícito).
- `REJECTED_INVALID` — ticket duplicado, spam, no encaja en categorías (con motivo explícito).
- `ABANDONED` — cliente no responde tras N días con ticket pendiente de información suya.

**Transiciones válidas**: `OPEN → INVESTIGATING → RESOLVED_COMPENSATED_PENDING_CREDIT → RESOLVED_COMPENSATED` (happy path con compensación). `OPEN → INVESTIGATING → RESOLVED_NO_COMPENSATION` (verificado sin compensación). `OPEN → REJECTED_INVALID` (rechazo directo por spam/duplicado). `OPEN → INVESTIGATING → ABANDONED` (cliente no responde). Cualquier otra transición → 400.

### D7 — Anti-fraude estructural

Reglas mínimas en la primera versión:

- **Rate limit por usuario**: máximo **2 tickets abiertos simultáneos** (estado no terminal) + máximo **5 tickets creados en 30 días naturales rolling**. Superar cualquiera → error explícito al cliente con motivo.
- **Historial de compensaciones**: si el usuario tiene **≥ 3 tickets `RESOLVED_COMPENSATED` en 90 días**, el ticket nuevo se marca con flag `high_history_flag=true` visible en el panel admin como aviso amarillo. NO bloquea la apertura, solo alerta al agente humano.
- **Auto-rechazo por ausencia de señal**: si el ticket es de categoría con verificación automática disponible (`STREAM_INTERRUPTED`, `PAYMENT_NOT_CREDITED`, `MODERATION_FALSE_POSITIVE`) y la verificación devuelve `signalStrength = NEGATIVE` (todas las señales negativas o neutras), el sistema NO auto-rechaza pero destaca el veredicto en rojo en el panel admin. La decisión sigue siendo humana. Deuda: cuando haya datos históricos de N meses, evaluar activar auto-rechazo por ausencia total de señal.
- **Categoría `OTHER`**: siempre requiere verificación manual completa. Sin verificación automática disponible por definición.

### D8 — Estructura del hilo de comunicación

Cada ticket tiene **una conversación asociada** para comunicación con el cliente:

- Al crear el ticket (D2 b1 o b2), el backend crea automáticamente una `support_conversations` en estado `HUMAN_HANDLING` con `linked_conversation_id` set en `support_tickets`.
- El cliente ve el hilo con `SupportChat.jsx` (misma UI que soporte humano actual), con un badge/etiqueta "Ticket #42 - STREAM_INTERRUPTED - INVESTIGATING" arriba.
- El agente humano usa el mismo panel de conversación humana del ADR-046 con el mismo badge de contexto ticket.
- Los mensajes intercambiados sobre el ticket viven en `support_messages` (reutilización total).

## Modelo de datos

### Migration V41 — `V41__add_support_tickets.sql`

```sql
-- V41 (ADR-054, 2026-07-27): sistema de tickets de incidencias.

CREATE TABLE support_tickets (
    id                              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id                         BIGINT NOT NULL,
    category                        VARCHAR(40) NOT NULL,
    status                          VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    description                     TEXT NOT NULL,
    reported_incident_at            DATETIME NULL,
    linked_conversation_id          BIGINT NULL,
    linked_stream_session_id        BIGINT NULL,
    linked_payment_session_id       BIGINT NULL,
    verification_last_run_at        DATETIME NULL,
    verification_last_result_json   JSON NULL,
    verification_last_signal        VARCHAR(20) NULL,
    compensated_amount_eur          DECIMAL(10,2) NULL,
    compensated_transaction_id      BIGINT NULL,
    resolved_at                     DATETIME NULL,
    resolved_by_admin_id            BIGINT NULL,
    resolution_notes                TEXT NULL,
    high_history_flag               TINYINT(1) NOT NULL DEFAULT 0,
    created_at                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_ticket_conv FOREIGN KEY (linked_conversation_id) REFERENCES support_conversations(id),
    CONSTRAINT fk_ticket_stream FOREIGN KEY (linked_stream_session_id) REFERENCES stream_sessions(id),
    CONSTRAINT fk_ticket_payment FOREIGN KEY (linked_payment_session_id) REFERENCES payment_sessions(id),
    CONSTRAINT fk_ticket_admin FOREIGN KEY (resolved_by_admin_id) REFERENCES users(id),
    CONSTRAINT chk_ticket_category CHECK (category IN (
        'STREAM_INTERRUPTED','PAYMENT_NOT_CREDITED','MODERATION_FALSE_POSITIVE','ACCOUNT_ISSUE','OTHER'
    )),
    CONSTRAINT chk_ticket_status CHECK (status IN (
        'OPEN','INVESTIGATING','RESOLVED_COMPENSATED_PENDING_CREDIT','RESOLVED_COMPENSATED',
        'RESOLVED_NO_COMPENSATION','REJECTED_INVALID','ABANDONED'
    )),
    CONSTRAINT chk_ticket_signal CHECK (verification_last_signal IS NULL
        OR verification_last_signal IN ('STRONG_POSITIVE','WEAK_POSITIVE','NEUTRAL','NEGATIVE')),
    INDEX idx_ticket_user (user_id, created_at DESC),
    INDEX idx_ticket_status (status, created_at DESC),
    INDEX idx_ticket_category (category, created_at DESC)
);

ALTER TABLE transactions
    ADD COLUMN ticket_id BIGINT NULL,
    ADD CONSTRAINT fk_tx_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
    ADD INDEX idx_tx_ticket (ticket_id);

-- FK circular resuelto por orden de INSERT: primero se crea el ticket (RESOLVED_COMPENSATED_PENDING_CREDIT),
-- luego se crea la transaction con ticket_id set, luego se update-a el ticket con compensated_transaction_id.
ALTER TABLE support_tickets
    ADD CONSTRAINT fk_ticket_tx FOREIGN KEY (compensated_transaction_id) REFERENCES transactions(id);
```

### Cambios en `TransactionRequestDTO`

- Nuevo campo opcional `Long ticketId`.
- Si presente, se propaga a `Transaction.setTicketId(ticketId)` en `manualRefundToClient`.

## Fases de implementación planificadas

Ejecutable en 2-3 sesiones dedicadas. Cada fase es un commit desplegable por sí solo.

1. **Fase T1 — backend base**: migration V41, entities (`SupportTicket`), repository, `TicketService` (CRUD + estados), `TicketVerificationService` con checks de al menos 2 categorías (`STREAM_INTERRUPTED` + `PAYMENT_NOT_CREDITED`), extensión `TransactionRequestDTO` + validación bidireccional en `manualRefundToClient`. Tests unitarios de cada servicio.
2. **Fase T2 — controllers y endpoints**: `TicketController` cliente + endpoints admin (listado con filtros, detalle, verify, cambiar estado). Tests MockMvc.
3. **Fase T3 — detección heurística bot**: extensión `SupportBotService` con pre-clasificación por keywords + oferta de apertura con confirmación (b2 del D2).
4. **Fase T4 — frontend cliente**: sección "Mis incidencias" en dashboard cliente + formulario apertura + listado + drill-down con hilo.
5. **Fase T5 — frontend admin**: sub-tab Incidencias en `AdminSupportPanel.jsx` + listado con filtros + drill-down con panel verificación + botón compensar reutilizando `AdminFinancePanel` endpoint.
6. **Fase T6 — nivelación TEST + AUDIT + PROD** según el frente de replicación estándar (ADR-046 secuencia paso 7 sirve de patrón).

## Alternativas descartadas de arquitectura

**A) Fusionar ticket con conversación (`support_conversations.type`)**: mezcla dominios con lifecycle muy distinto (conversación efímera vs ticket con evidencia y compensación). Descartado en D1.

**B) Ticket sin conversación asociada (comunicación por email)**: pierde ventaja de reutilizar chat en tiempo real ya construido. Descartado — el ADR-046 ya nos da la superficie chat lista.

**C) Compensación via BFPM (`BONUS_GRANT` + `BONUS_FUNDING`)**: contablemente más limpio pero requiere refactor sin beneficio operativo en el volumen del primer año. Descartado en D4.

**D) Sistema auto-approve/auto-reject con umbrales por categoría**: sin datos históricos no se pueden calibrar. Descartado en D3, reservado para evolución futura.

**E) Categorías abiertas (texto libre) en vez de enum cerrado**: dificulta reporting operativo y anti-fraude. Descartado — enum cerrado + `OTHER` como escape para casos no previstos.

**F) Ticket abierto directamente por el bot sin confirmación del usuario**: alto riesgo de tickets espurios que inflen el backlog y dañen la relación de confianza. Descartado en D2 b2 — confirmación explícita obligatoria.

## Deudas y evoluciones futuras

- **#D-45**: evaluar activar auto-approve/auto-reject cuando haya ≥3 meses de datos históricos de tickets. Calibrar umbrales por categoría con la tasa real de compensación humana.
- **#D-46**: tabla de compensación máxima recomendada por categoría (referencia informativa, no bloqueante) mostrada en el panel admin junto al botón "Compensar". Ejemplo inicial: `STREAM_INTERRUPTED` → hasta 5 min, `PAYMENT_NOT_CREDITED` → importe no acreditado + 2 min, `MODERATION_FALSE_POSITIVE` → hasta 3 min. Aparece cuando el operador tenga sensibilidad real del sector.
- **#D-47**: notificación WS + email al cliente cuando el agente responde en el hilo del ticket o cambia el estado. Reutilizar `wsSupport.notifyUserById` (patrón ADR-053 wallet:credited).
- **#D-48**: reporting admin de tickets por categoría / estado / tasa de compensación / coste mensual acumulado. Extensión del dashboard admin financiero.
- **#D-49**: integración con futuro frente PSP tarjeta cuando aterrice — anticipar chargebacks preventivos (cliente amenaza chargeback → abrir ticket automáticamente y ofrecer compensación antes que perder el pago vía PSP con fee de chargeback).
- **#D-50**: playbook operativo agente humano para tickets (`docs/04-operations/runbooks.md`): flujo, criterios de decisión, ejemplos por categoría. Se redacta tras las primeras 20-30 gestiones reales para capturar patrones reales.
- **#D-51 (2026-07-27)**: extensión del sistema de tickets a **modelos** (ADR-055 futuro). Levantada en conversación tras cerrar T4. NO es copy-paste del actual:
  - Categorías distintas: `PAYOUT_ISSUE`, `MODEL_MODERATION_APPEAL`, `TIER_CALCULATION_DISPUTE` (relevante con ADR-052 aterrizando tramos T1-T4), `HARASSMENT_FROM_CLIENT`. Las 4 actuales no aplican tal cual.
  - Compensación distinta: el modelo no tiene "saldo cliente" que acreditar. Sería nota manual en próximo payout, sobre-transferencia one-off, o simplemente resolución sin comp económica (probablemente 80% de casos). Zero reuso del endpoint `manualRefundToClient` — necesita mecánica propia.
  - Solapamiento con lo existente: `complaints` (quejas P2P) y apelaciones de `moderation`. Riesgo de 3 canales confundiendo modelo y agente. Requiere decisión previa sobre unificar/coexistir/reemplazar.
  - **Timing**: abrir tras 2-4 semanas de rodaje real del sistema clientes (T5+T6) para capturar lecciones antes de rediseñar. No arrancar en paralelo.

## Referencias

- [ADR-046 — Panel soporte humano](adr-046-panel-soporte-humano.md) (infra soporte reutilizada)
- [ADR-011](adr-011-pricing-simplification-and-minimum-threshold.md) + [ADR-012](adr-012-bfpm-platform-funded-bonus.md) (BFPM — alternativa descartada A del D4)
- [ADR-050 — Anti-fraude cámara streaming](adr-050-anti-fraude-camara-streaming.md) (fuente de verdad para `MODERATION_FALSE_POSITIVE`)
- [ADR-053 — Tolerancia parciales cripto](adr-053-tolerancia-parciales-cripto.md) (fuente de verdad para `PAYMENT_NOT_CREDITED` en flujo cripto)
- [ADR-052 §D7](adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) (política descuentos chargebacks — conectará con este sistema cuando PSP tarjeta aterrice)
- [`TransactionService.manualRefundToClient`](../../src/main/java/com/sharemechat/service/TransactionService.java) (endpoint real reutilizado en D4)
- [`AdminFinancePanel.jsx`](../../frontend/src/pages/admin/AdminFinancePanel.jsx) (UI real reutilizada como base de la UI de compensación desde ticket)
