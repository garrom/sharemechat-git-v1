# ADR-046 — Panel Soporte Humano del Agente IA

## Estado

Aceptada (2026-07-08). Backend (Fase B.3.1) implementado en el mismo commit.

## Contexto

Tras cerrar el refactor arquitectural del Agente IA ([ADR-044](adr-044-knowledge-base-externa.md), Fases 1.A → 1.D) el bot funciona en TEST/AUDIT/PROD con router determinista + BdC en tabla. Falta la superficie humana: cuando el bot escala una conversación, hoy queda en `ESCALATED` sin canal operativo para que el equipo la atienda. Este ADR abre el frente B.3 y cierra su primera fase B.3.1 (backend + migración + tests).

Alcance de B.3.1: schema, entidades, servicios, endpoints admin. **Sin frontend**. El panel admin (B.3.2) y el renderizado cliente del mensaje humano (B.3.3) se aplazan a commits separados.

## Decisión

### Modelo de datos

Se introduce una **identidad de servicio** desacoplada del user real:

- **`backoffice_agent_profile`** (`id`, `display_name UNIQUE`, `active`, `category NULL`, `created_by`, timestamps). Máscara pública con la que un agente firma mensajes ("Pepito (Soporte)"). Sin borrado físico: la desactivación preserva historial.
- **`backoffice_agent_profile_grant`** (tabla puente N:N). Un mismo user puede tener grant a varias profiles; una profile puede ser compartida por varios users (turno rotativo). Sin owner único.
- **`support_conversations`** gana `assigned_agent_id` (user real, auditoría), `assigned_at` y `assigned_profile_id` (identidad pública). CHECK constraint bi-columna garantiza `(agent, profile)` NULL o NOT NULL a la vez. El CHECK del `resolution_status` se amplía con `HUMAN_HANDLING`.
- **`support_messages`** gana `sent_by_user_id` y `sent_by_profile_id`, poblados sólo cuando `sender='HUMAN'`. Cubre trazabilidad "qué persona real firmó cada mensaje bajo qué profile" — necesario para auditoría interna y Segpay, sin exponer al cliente.

### Restricción MySQL 8 · FK con acción referencial + CHECK sobre misma columna

Durante el primer intento de deploy TEST (2026‑07‑08 13:06 UTC) la V15 original falló al añadir el `chk_support_conv_assign_bicolumn` porque MySQL 8.x no permite `CHECK` sobre columnas cuyas FKs tengan acción referencial (`ON DELETE SET NULL`, `CASCADE`, etc.). La acción modifica la columna y MySQL no puede reevaluar el CHECK después. Ver [MySQL Reference Manual · CHECK Constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html).

Ante el trade‑off:

- **Mantener `ON DELETE SET NULL` y sacrificar el CHECK** → invariante bi‑columna queda como responsabilidad exclusiva del `SupportHumanHandlingService`. Menos defensa en profundidad.
- **Mantener el CHECK y sacrificar `ON DELETE SET NULL`** → las FKs `fk_support_conv_assigned_agent` y `fk_support_conv_assigned_profile` pasan a `RESTRICT` implícito. Un DELETE físico de un `user` o `backoffice_agent_profile` con conversaciones asignadas será rechazado por MySQL.

Se elige la segunda opción. Razones:

- En este proyecto los users **no se borran físicamente**: GDPR se implementa por anonimización, no por `DELETE`.
- Las profiles usan **soft delete** (`active=false`), nunca `DELETE`.
- Por tanto el `RESTRICT` solo actuaría en un escenario operativo excepcional (limpieza manual), donde tener que resolver primero las conversaciones asignadas es un requisito operativo razonable y trazable.
- El CHECK bi‑columna aporta valor real como defensa en profundidad contra bugs futuros del service, y su coste operativo es cero.

La FK `fk_bap_created_by` (columna `created_by` en `backoffice_agent_profile`) y las FKs `fk_support_msg_sent_by_user` / `fk_support_msg_sent_by_profile` **sí** conservan `ON DELETE SET NULL` porque esas columnas no participan en ningún CHECK.

### Ciclo de vida

`OPEN → ESCALATED → HUMAN_HANDLING → RESOLVED`. Al hacer claim un admin, la conv pasa a `HUMAN_HANDLING` y el bot deja de responder. Al hacer `release`, vuelve a `ESCALATED` (queda disponible para otro agente). `RESOLVED` mantiene `assigned_agent_id`/`assigned_profile_id` en fila para preservar el histórico (no se limpian).

### Bloqueo del bot

Doble guard en `SupportBotService`:

1. **Guard temprano** tras `getOrCreateActiveConversation`: si `conversation.assigned_agent_id != null`, se salta el LLM call *entero* (no se llama a Claude, no se toca rate-limit). El mensaje del user se persiste esperando al humano. La respuesta al cliente devuelve `{humanHandling: true, reply: null, resolutionStatus: "HUMAN_HANDLING"}`.
2. **Race check post-LLM** con `touchIfStillUnassigned` (`UPDATE ... WHERE assigned_agent_id IS NULL`). Si un admin hizo claim durante los ~5-8s de la llamada Claude, `rowCount=0` → se descarta la respuesta LLM sin persistir y sin cobrar tokens al user. Los tokens API ya consumidos se asumen como coste del race (raro, aceptable). Log `[SUPPORT-BOT] race lost claim during LLM call, discarding reply` con `tokens_in/out` para trazabilidad.

### Ampliación de "conversación activa"

`getOrCreateActiveConversation` sustituye a `getOrCreateOpenConversation` y busca por `status IN (OPEN, ESCALATED, HUMAN_HANDLING, RATE_LIMITED)`. Sólo `RESOLVED` y `ABANDONED` disparan conversación nueva. Sin este cambio, un user con conversación bajo claim humano que envía otro mensaje crearía una `OPEN` paralela y el humano quedaría mirando la vieja. Requisito del contrato B.3.

### Claim atómico

`claimIfUnassigned` es `UPDATE ... WHERE assigned_agent_id IS NULL` con check de `ROW_COUNT`. Si `0`, otro agent ya tomó el caso → 409. Sin locks explícitos, sin deadlocks.

### Validación de grants

Antes del `claim`, el service valida `hasActiveGrant(currentUserId, profileId)`. Si falta, 403 con mensaje neutro "Profile no disponible para tu cuenta" — no distingue "no existe" de "no activa" de "no autorizada" para no filtrar oráculo.

### Permisos

Dos permisos nuevos en `BackofficeAuthorities`:

- **`PERM_SUPPORT_CHAT_HANDLE`** (`support.chat_handle`): operar sobre conversaciones (claim, release, message, resolve, listar, ver detalle, pending-count). Se otorga por defecto a `ROLE_SUPPORT` vía `SUPPORT_PHASE1_PERMISSIONS`.
- **`PERM_SUPPORT_PROFILE_MANAGE`** (`support.profile_manage`): CRUD de profiles y grants. Opt-in explícito, **no** viene con `ROLE_SUPPORT`.

Ambos se incluyen en `OFFICIAL_BACKOFFICE_PERMISSION_CATALOG`. `ROLE_ADMIN` mantiene acceso vía matcher explícito.

### Endpoints admin (todos bajo `/api/admin/support/`)

| Verbo | Path | Permiso | Códigos |
|---|---|---|---|
| GET | `/conversations` (filtros `status`, `assignedAgentId=me\|unassigned\|<id>`, `page`, `size`) | CHAT_HANDLE | 200 |
| GET | `/conversations/{id}` (conversación + hilo completo) | CHAT_HANDLE | 200 · 404 |
| GET | `/pending-count` (`pendingUnassigned`, `myAssigned`, `otherAssigned`) | CHAT_HANDLE | 200 |
| POST | `/conversations/{id}/claim` body `{profileId}` | CHAT_HANDLE | 200 · 400 · 403 · 404 · 409 |
| POST | `/conversations/{id}/release` | CHAT_HANDLE | 200 · 403 · 404 · 409 |
| POST | `/conversations/{id}/message` body `{content}` | CHAT_HANDLE | 200 · 400 · 403 · 404 · 409 |
| POST | `/conversations/{id}/resolve` | CHAT_HANDLE | 200 · 403 · 404 |
| GET | `/profiles/mine` (con `activeConversations`) | CHAT_HANDLE | 200 |
| GET | `/profiles` | PROFILE_MANAGE | 200 |
| POST | `/profiles` body `{displayName, category}` | PROFILE_MANAGE | 200 · 400 · 409 |
| PATCH | `/profiles/{id}` body `{displayName?, category?, active?}` | PROFILE_MANAGE | 200 · 400 · 404 · 409 |
| POST | `/profiles/{profileId}/grants` body `{userId}` | PROFILE_MANAGE | 200 · 400 · 404 |
| DELETE | `/profiles/{profileId}/grants/{userId}` | PROFILE_MANAGE | 204 · 404 |

### Mensaje SYSTEM al claim

Al éxito del `claim`, se persiste un mensaje `sender='SYSTEM'` con texto "Tu caso ha sido asignado a {displayName} del equipo de soporte. Te responderá en breve." (o su equivalente EN si `user.uiLocale` empieza por `en`). I18n hardcoded en `SupportHumanHandlingService.buildAssignmentMessage` porque el backend no dispone de `MessageSource` genérico hoy (verificado en pre-análisis: `EmailCopyRenderer`/`EmailLocaleResolver` son específicos del sistema Graph email, no reutilizables). Cuando se introduzca infra i18n backend, migrar aquí.

## Alternativas descartadas

### `backoffice_agent_profile.user_id NULLABLE`

Rechazada por ambigüedad semántica: `NULL` no distingue "profile huérfana" de "profile compartida por diseño". La tabla puente `backoffice_agent_profile_grant` modela explícitamente la relación N:N y permite:
- Un mismo user con grants a varias profiles.
- Una profile compartida por varios users (turno rotativo — Decisión B del pre-análisis).
- Revoke soft (active=false) sin cascade sobre conversaciones vivas.

### `HUMAN_HANDLING` sustituye a `ESCALATED`

Rechazada. Son fases distintas: `ESCALATED` = "el bot ya no puede seguir, alguien tiene que mirar esto"; `HUMAN_HANDLING` = "un agente concreto lo está mirando ahora". Colapsar ambos rompería el badge `pendingUnassigned` y la métrica "cuánto tarda en atenderse un escalado".

### `agent_display_name` duplicado en `support_messages`

Rechazada. El display_name se obtiene por join con `backoffice_agent_profile` cuando se necesita. Duplicar la string introduciría desincronización silenciosa si el operador renombra la profile. La estabilidad histórica se garantiza con "no reusar display_names" (regla operativa, no de schema).

### `SupportRateLimitService` recibe `conversation` como parámetro

Rechazada. El requisito del brief ("rate-limit no cuenta en HUMAN_HANDLING") se cumple naturalmente por reorden: el guard temprano en `SupportBotService` cortocircuita antes de `shouldRateLimit`. Añadir el parámetro sería acoplamiento innecesario para satisfacer el requisito.

### CRUD de profiles con permiso `PERM_SUPPORT_CHAT_HANDLE`

Rechazada. Crear identidades de servicio es una decisión de negocio (nombres, categorías, aprobación). Se separa en `PERM_SUPPORT_PROFILE_MANAGE`, opt-in explícito. `ROLE_SUPPORT` de baseline puede atender casos pero no crear profiles.

## Consecuencias

Positivas:
- Panel humano operable sin bloqueos de arquitectura. Race conditions cubiertas por UPDATE atómicos.
- Trazabilidad completa: `sent_by_user_id` para auditoría interna, `sent_by_profile_id` para el histórico "quién firmó bajo qué máscara".
- Doble guard del bot (temprano + race post-LLM) blinda contra respuestas del bot en conversaciones bajo claim.
- Sin cambios en el frontend (B.3.2/B.3.3 futuros) ni en `KnowledgeBaseService`, `SupportBotRouterService` ni BdC.

Negativas / coste:
- Migración V15 con 6 ALTER TABLE + 2 CREATE TABLE + varios CHECK/INDEX. Larga pero atómica.
- Coste del race post-LLM: los tokens API ya consumidos por Claude se pierden si el claim gana durante los ~5-8s. Log `race lost` deja constancia. Raro por diseño (los admins ven listado con `updatedAt`, un caso "activo" es visible; el ratio de race será <1% del volumen).

## Deudas diferidas (no bloqueantes para B.3.1)

Ver entrada correspondiente en `docs/04-operations/known-debt.md` (2026-07-08).

- **Job diario de expiración `ESCALATED > 48h`**. Sin agentes conectados, un caso escalado a las 03:00 puede quedarse indefinidamente en `ESCALATED`. Un job debería moverlo a `ABANDONED` (o `EXPIRED` nuevo) con auto-mensaje "tu caso quedó sin atender, por favor vuelve a escribir".
- **Browser Notification API** para el agente logueado en el panel admin. Alternativa al email descartada por el operador. Es opt-in vía `Notification.permission`, sin infra push server. Se implementará en B.3.2.
- **Playbook DPO** para responder a solicitudes GDPR art. 15 ("¿quién me atendió?"): política canónica es devolver `display_name` de la profile, **jamás** el user real. Con B (profiles compartidas) esto es obligatorio, no recomendable. Documento vive en el corpus legal, no en repo.
- **Retención de conversaciones `RESOLVED`**: sin política definida. Recomendación: 24 meses y luego anonimizar `user_id → NULL` conservando el hilo por métricas. Coordinar con el DPO junto con la deuda de retención del chat de favoritos (#15).
- **Historial de asignaciones** (transferencias entre agents): B.3.4 opcional. Tabla satélite `support_conversation_assignment_history` para reconstruir línea temporal.
- **Endpoint `transfer`** para pasar caso entre agents. B.3.4 opcional.

## Trazabilidad

- Análisis de coherencia previo: sesión operativa 2026-07-07 (respuesta al operador con 13 puntos + Cambios adicionales al plan).
- Verificación de contexto factual pre-implementación (7 hallazgos + 2 matices menores): sesión operativa 2026-07-08 previa al commit.
- Estado runtime tras deploy pendiente: los 3 entornos requieren aplicar V15 y desplegar el JAR. Comandos operativos en el commit message.
