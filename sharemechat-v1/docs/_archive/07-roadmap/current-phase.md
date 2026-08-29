# Fase actual

> ⚠️ **Este doc es NARRATIVA de los frentes, NO la fuente de verdad de su ESTADO.**
> El estado (hecho/pendiente) y la prioridad viven **solo** en
> [`backlog-priorizado.md`](backlog-priorizado.md), verificados contra código
> (ver `documentation-governance.md` → "Regla de ESTADO y PRIORIDAD").
> Lo que aquí ponga como "pendiente/hecho" **puede estar desfasado** — manda el backlog.
> _Reconciliación de estado 2026-08-15 (verificada contra código: migraciones + paquetes Java):
> varios frentes que las secciones de abajo aún narran como "pendientes" o "cero implementación"
> están **HECHOS** — Tickets (ADR-054, V41), KYC modelo, Operational Mode, anti-fraude,
> replicación PROD (nivelado a main `fed5e01`, V47-V51, 2026-08-11), **Sistema Master/Studio
> (ADR-056, V42-V46, activo en TEST+AUDIT+PROD desde 2026-08-04, solo falta el rail Paxum real)**,
> y **ADR-052 técnico** (purga afiliadas V38 + reparto nuevo `model_pricing_tiers` V39, ya
> extendido por ADR-056). Las cabeceras "Estado" de los Frentes 3, 4 y 5 y sus sub-fases se
> han anotado en consecuencia más abajo. Manda el backlog._

## Fase activa general

SharemeChat está en **Fase 0 — Cierre de riesgos pre-PRO** del roadmap hacia GO LIVE.

Objetivo de esta fase:
cerrar riesgos estructurales antes de abrir PROD, especialmente en economía, acceso por entorno, PSP, KYC, compliance y configuración real por entorno.

El roadmap general vive en [go-live-roadmap.md](go-live-roadmap.md).
El backlog técnico vive en [pending-hardening.md](pending-hardening.md).
Este documento es el panel corto de estado y prioridad viva.

---

## Frentes operativos activos

Cinco frentes en curso en paralelo. El Frente 1 (Chat Soporte LLM · Panel humano) es la sub-fase iniciada tras cerrar Fase 1.D del refactor Agente IA (ADR-044) y ejecutada durante las últimas sesiones operativas. El Frente 2 (Gobierno económico pre-PSP) sigue vivo con su siguiente paso identificado (BFPM Fase 4B-b) como prerrequisito de la integración PSP real; no está pausado. El Frente 3 (Materialización ADR-052: rediseño estructural del reparto + retirada del programa de afiliadas) arranca tras cerrar la Fase B documental el 2026-07-24 y encadena en 3 sub-frentes técnicos (purga afiliadas → refactor sistema tramos + rango de precio + Estatus Pro → T&C legal). El Frente 4 (Sistema de tickets de incidencias, ADR-054) aterriza tras cerrar ADR-053 el 2026-07-27 y el cambio de estrategia hacia PSP tarjeta como método principal, que hace estructural tener sistema de trazabilidad de incidencias y compensaciones antes de captación masiva. El Frente 5 (Sistema Master/Studio, ADR-056) es el más reciente: aterriza tras 6 meses de captación fallida de modelos individuales y pivote estratégico hacia captación de estudios de webcam (especialmente colombianos), aportando rol MASTER con reparto económico dual y multi-rail payouts.

---

## Frente 1: Chat Soporte LLM — Panel humano (ADR-046)

Estado: **CERRADO en TEST, AUDIT y PROD** (PROD vía el nivelado general a main `fed5e01`, 2026-08-11; ver punto 7).

Objetivo:
cerrar la superficie humana del Agente IA para que las conversaciones escaladas por el bot puedan atenderse por el equipo desde el backoffice admin, sin bloquear al bot en el resto de casos.

Base estructural: [ADR-046](../06-decisions/adr-046-panel-soporte-humano.md), aceptado 2026-07-08. Modelo de identidad de servicio desacoplada del user real (`backoffice_agent_profile` + `backoffice_agent_profile_grant` como N:N), doble columna assignment en `support_conversations` (`assigned_agent_id` auditoría + `assigned_profile_id` pública) con CHECK bi-columna, ciclo de vida ampliado con `HUMAN_HANDLING`, doble guard del bot (temprano + race post-LLM), permisos `PERM_SUPPORT_CHAT_HANDLE` / `PERM_SUPPORT_PROFILE_MANAGE`, 13 endpoints admin bajo `/api/admin/support/`.

Secuencia actual:

1. **Fase B.3.1 — backend + migración V15 + tests** — HECHO
   - Migración V15 con 2 CREATE TABLE + 6 ALTER TABLE + CHECK bi-columna. Corregida en el mismo día para respetar la restricción MySQL 8 (CHECK sobre columna con FK con acción referencial): las FKs de assignment pasan a `RESTRICT` implícito, el CHECK bi-columna se conserva.
   - Entidades / repositorios / servicios (`BackofficeAgentProfileService`, `BackofficeAgentProfileGrantService`, `SupportHumanHandlingService`) + `SupportBotService` con doble guard.
   - `SupportAdminController` con 13 endpoints admin (12 originales + `GET /profiles/{profileId}/grants` cerrado en el mismo bloque de B.3.2). Permisos `PERM_SUPPORT_CHAT_HANDLE` (baseline `ROLE_SUPPORT`) y `PERM_SUPPORT_PROFILE_MANAGE` (opt-in explícito).
   - Tests: 519 → 526 tras cierre del hueco de grants.
   - **Desplegado en TEST** con commits `287f8c2` + `acb290a` (JAR `71ccb203…` posterior tras B.3.2).

2. **Fase B.3.2 — frontend admin: AdminSupportPanel + hooks + CRUD profiles + i18n** — HECHO
   - Container `AdminSupportPanel` con sub-tabs internas `Conversaciones` / `Profiles` (no rutas separadas) gobernadas por las capabilities `canViewSupport` (⇔ `PERM_SUPPORT_CHAT_HANDLE`) y `canManageSupportProfiles` (⇔ `PERM_SUPPORT_PROFILE_MANAGE`).
   - Hooks nuevos `useSupportPendingCount` y `useConversationPolling` con guard `document.hidden`. Extensión aditiva de `AdminLayout` con soporte opcional de `badge` en items del sidebar (`9+` a partir de 10).
   - Vistas: master-detail de conversaciones con filtros/paginación, thread completo con optimistic updates al enviar mensaje, toolbar contextual (claim/release/message/resolve) según status y ownership; tabla CRUD de profiles con expandible inline por fila para grants; modales autocontenidos para create/edit profile, add grant y claim.
   - i18n admin.support ES+EN con ~60 claves.
   - **Desplegado en TEST** con commit `794193d` (bundle admin `main.bebe34ed.js`, `b6e4437c…`).
   - **Hueco detectado en deploy y cerrado el mismo día**: el sub-tab Profiles expandía grants pero el backend no exponía `GET /profiles/{profileId}/grants`. Cerrado en commit `d8d5b90` (endpoint nuevo + batch fetch de emails + 3 tests MockMvc; total repo 526 tests). Desplegado en TEST junto con B.3.2.
   - **Deuda #D-14 (Browser Notification API)**: originalmente prevista para B.3.2 según ADR-046. Diferida — no incluida en el alcance final entregado.

3. **Fase B.3.3 — surface product (renderizado del switch bot→humano en el cliente)** — HECHO (2026-07-08/09)
   - Commit `cfb7110` con `SupportChat.jsx` del cliente adaptado: cuando el backend devuelve `humanHandling:true`, la burbuja muestra al peer humano con estilo diferenciado (avatar, inicial, timestamp) y el input pasa a polling contra `HUMAN_HANDLING` para detectar la respuesta del agente. Fix `min-width` de las burbujas incluido.
   - Tres bugs post-deploy detectados y cerrados el mismo día (`b903fd6`): HTTP 400 inicial en el primer envío, mensajes duplicados por race del polling, ancho de burbuja no coherente en algunos anchos de ventana.
   - Bundle product `main.4bfba…` → sucesivas iteraciones. Cerrado con `98e7ded` regularizando manifests TEST.

4. **Frente lateral estilos chat P2P/soporte (Fase 1 + Fase 1.1)** — HECHO (2026-07-08/09)
   - `30850f8` Fase 1: mejoras visuales de las burbujas del chat P2P y del chat de soporte con el Agente IA, más nickname visible en la firma de mensajes propios.
   - `0e6be4d` Fase 1.1: avatar del peer + inicial + timestamp con estilo P2P unificado, y unificación del verde suave para los mensajes propios en ambas superficies.
   - `20572ac` fix del avatar peer a gris claro suave con inicial legible.
   - Regularización de manifests admin+product TEST en `627ba52`, `186f6dd`, `0c1b66a`.

5. **Fase 2 chat P2P: catálogo de emojis filtrado por rol + validación server-side del gift** — HECHO (2026-07-09)
   - Commit `c4f58ce`: endpoint nuevo `GET /api/products/emojis/available` (`ProductEmojiController`), servicio `EmojiCatalogService.getAvailableForRole(role)` mapeando `tier=QUICK → FREE_EMOJI` y `tier=PREMIUM → PAID_GIFT`. Refuerzo server-side en `MessagesWsHandlerSupport.handleMsgGift`: MODEL→CLIENT solo con FREE_EMOJI, CLIENT-CLIENT y MODEL-MODEL rechazados. Endpoint legacy `GET /api/gifts` sigue vivo por retrocompat con `renderGiftVisual` y `normalizeGiftMessage`.
   - Bundle admin `main.e497623e.js` (`85b8d631…`) y product `main.7ef36d6c.js` (`4e4974b81b…`). Regularización de manifests TEST en `b112415`.

6. **Replicación de la Fase B.3 (+ Fases 1/1.1/2/avatar) a AUDIT** — HECHO (2026-07-09)
   - AUDIT nivelado de `074cb69` a `c4f58ce`. JAR reutilizado sin recompilar (mismo `sha256=05d52c29…` que el JAR de TEST). V15 aplicada limpiamente por Flyway en el primer arranque (`execution time 00:00.754s`).
   - Base de Conocimiento del Agente IA nivelada: 3 UPDATE sobre `support_bot_prompts` (`comportamiento-agente-ia` v1→v2, `empresa-y-contacto` v1→v2, `producto-general` v1→v3) con `content` bit-a-bit igual al de TEST (MD5 verificado). Backup preventivo en tabla `support_bot_prompts_backup_20260709_audit_nivelacion` (14 filas). Restart del backend para forzar re-hidratación del `KnowledgeBaseService`.
   - Frontend admin bundle `main.e497623e.js` y product bundle `main.7ef36d6c.js` desplegados con `deploy-frontend.ps1 -Environment audit`. Compilación determinista: `bundle_sha256` idéntico al de TEST en ambas superficies.
   - `CLAUDE_API_KEY` añadida a `/opt/sharemechat/secrets.env` de AUDIT (reutilización de la key de TEST vía pipeline SSH atómico) tras detectar `Claude API 401 authentication_error` en el journal cuando el operador validó el chat con el Agente IA desde el navegador.
   - Manifest `ops/deploy-state/audit.yaml` regularizado (backend a mano por decoupling entre HEAD del repo y commit del JAR; frontends por el script en su paso `[5.5/N]`).
   - Detalle completo en `docs/project-log.md` entrada 2026-07-09 "Nivelación AUDIT completa" y en snapshot `docs/_archive/_snapshots/state-audit-2026-07-09.yaml`.

7. **Replicación de la Fase B.3 a PROD** — HECHO (vía el nivelado general de PROD a main `fed5e01`, V47-V51, 2026-08-11)
   - El Chat Soporte LLM + panel humano (ADR-046) y las Fases 1/1.1/2/avatar llegaron a PROD dentro del nivelado global (no como replicación aislada). PROD quedó a la altura de `main`. Verificar `CLAUDE_API_KEY` en `/opt/sharemechat/secrets.env` de PROD sigue en el backlog como gap de credenciales (ver P1 "Verificar gaps PROD post-nivelado"); el código y el schema ya están.

Deudas registradas del frente (todas en `docs/04-operations/known-debt.md`): #D-13 job expiración `ESCALATED > 48h`, #D-14 Browser Notification API para agents, #D-15 playbook DPO GDPR art. 15 sobre conversaciones humanas (obligatorio pre-go-live PROD).

---

## Frente 2: Gobierno económico pre-PSP

Objetivo:
cerrar la base económica interna antes de integrar el PSP real y antes de cualquier circulación de dinero real. _(Objetivo original del frente; el PSP cripto NOWPayments ya está en PROD — ver punto 7.)_

Secuencia actual:

1. **Gobierno por entorno de endpoints económicos directos** — HECHO
   - `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` implementado.
   - `/api/transactions/first` y `/api/transactions/add-balance` gobernados.
   - Validado en TEST.
   - AUDIT/PROD deben mantener la flag en `false` salvo decisión explícita.

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
   - No mezclar con la integración del PSP real.

7. **Integración PSP real** — REPLANTEADO (la referencia a CCBill quedó obsoleta)
   - **Cripto (NOWPayments)**: implementado y **en PROD** (webhook con firma HMAC-512 + idempotencia + lock; `/api/billing/nowpayments/checkout`). Frente vivo del backlog = mejoras UX de pago (lidera operador).
   - **Tarjeta**: el proveedor pasó a **CardBilling (grupo Verotel)**, ya negociado → NO bloqueado por terceros; falta construir el adapter (registry `PaymentProvider` extensible listo). Prioridad y fecha las fija el operador (ver backlog "Gated por decisión de lanzamiento").
   - CCBill quedó descartado como proveedor (pivote ADR-047 y posterior); las menciones a "CcbillService"/"/billing/ccbill" en las fases de arriba son históricas.

---

## Frente 3: Materialización ADR-052 — rediseño reparto + retirada afiliadas

Estado: **Técnicamente MATERIALIZADO** (verificado contra código 2026-08-15). La purga de afiliadas (V38) y el reparto nuevo `model_pricing_tiers` (V39) están en código y desplegados; el sistema de tramos fue además **extendido por ADR-056** (régimen dual INDIVIDUAL/MASTER, V42+). Único sub-frente vivo: el **T&C/contrato de modelo v5** (sub-frente 4, legal). Las marcas "PENDIENTE" de los sub-frentes 2 y 3 de abajo quedan obsoletas.

Objetivo:
materializar el rediseño estructural del reparto modelo/plataforma (75-79% escalonado por facturación) y del rango de precio autoservicio decidido en [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), y retirar el programa de afiliadas (código + schema + docs) que quedó superseded por ese mismo ADR.

Base estructural: [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), aceptado 2026-07-24, con 12 decisiones (D1..D12) que reordenan el ciclo económico. Contexto operativo del pivote de reclutamiento en [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md) (soft launch cripto). Retirada de [ADR-049](../06-decisions/adr-049-programa-afiliadas-modelos.md) programa de afiliadas ya marcada SUPERSEDED.

Secuencia planificada (4 sub-frentes, orden 1→2→3, 4 en paralelo a 3):

1. **Sub-frente 1: Fase B documental** — HECHO (2026-07-24)
   - Reescritura completa de [`../01-business/sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md), [`../01-business/pricing.md`](../01-business/pricing.md), [`../01-business/unit-economics.md`](../01-business/unit-economics.md).
   - Actualización parcial de [`../01-business/business-model.md`](../01-business/business-model.md), [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md), [`../01-business/model-profile-strategy.md`](../01-business/model-profile-strategy.md).
   - Actualización del plan de captación [`plan-captacion-trafico-2026-q3.md`](docs/_archive/07-roadmap/plan-captacion-trafico-2026-q3.md) marcando palanca P3 (programa de afiliados) como RETIRADA con re-cálculo de horas y métricas.
   - `affiliate-program.md` movido a `_deprecated/registro.md` con stub de retirada en el fichero original.
   - Cabeceras de ADRs anteriores actualizadas: ADR-049 SUPERSEDED por ADR-052, ADR-043 §1 y §4 parcialmente superseded por ADR-052.
   - Actualización de deudas conocidas en [`../04-operations/known-debt.md`](../04-operations/known-debt.md) (cancelación de deudas #D-18/19/20/21/22/23 del ADR-049 + añadir deuda nueva de rediseño packs premium).
   - Actualización de [`../04-operations/known-risks.md`](../04-operations/known-risks.md) con nuevo riesgo "margen tarjeta delgado sensible a chargebacks".
   - Recalibración del [`../01-business/financiero/modelo-financiero.md`](../01-business/financiero/modelo-financiero.md) marcada como deuda declarada (xlsx binario no se toca en esta iteración).

2. **Sub-frente 2: Purga técnica afiliadas** — HECHO (`V38__drop_affiliate_program.sql` en código; sin paquete `affiliate` vivo en el backend)
   - Migration `V38__drop_affiliate_program.sql`: drop tablas `affiliate_codes`, `affiliate_commissions`, `affiliate_click_events`, `affiliate_link_tokens`; drop columnas `clients.referrer_model_user_id`, `users.referral_code_owner`, `users.first_stream_charge_at`.
   - Purga de código: `AffiliateCommissionService`, `AffiliateAttributionService`, `AffiliateBonusService`, `AffiliateCodeService`, `AffiliateHashService`, `AffiliateLinkTokenService`, entidades, controllers, endpoints REST, DTOs, tests unitarios.
   - Frontend product: retirada de `/model/affiliate`, landing `/i/:token`, banner referral en registro cliente.
   - Aislado y autoncontenido; no depende del sistema nuevo. Deja el repo limpio antes del refactor grande.

3. **Sub-frente 3: Implementación técnica del reparto nuevo** — HECHO (`V39__model_pricing_tiers_v1.sql` + `ModelTierService`/`ModelPricingTier` en código; tramos T1-T4, `chosen_rate_eur_per_min`, Estatus Pro y recorte de tarifa cubiertos por tests de integración — ADR-059). Extendido después por ADR-056 (régimen dual, V42+).
   - Migration `V39__model_pricing_tiers_v1.sql`: crea `model_pricing_tiers` con 4 filas (T1/T2/T3/T4), añade columnas al snapshot diario, añade `users.chosen_rate_eur_per_min` y `users.pro_accepts_trial`.
   - Refactor `ModelTierService` + `ModelTierSnapshotJob` a operar sobre facturación bruta rolling 30d y `model_pricing_tiers` en vez de sobre minutos facturados.
   - Nuevo `PricingService` que expone tramo, %reparto, rango, tarifa vigente por modelo.
   - Nuevos endpoints: `PUT /api/models/me/pricing`, `PUT /api/models/me/pro-status`, `GET /api/models/me/economics`.
   - Refactor motor de facturación: leer `users.chosen_rate_eur_per_min` al arranque de sesión en vez de `billing.rate-per-minute`.
   - Refactor `UserTrialService`: primer minuto trial paga €0,07 plano de property.
   - Cambios properties: deprecar `billing.rate-per-minute`, añadir `billing.pricing.rate-max-eur-per-min=9.00`, `billing.pro-status.min-billed-gross-eur-30d=1500`, `billing.trial.first-minute-earning-eur-per-min=0.07`.
   - Frontend product: nuevo panel `/model/economics` con dashboard de tramo, %reparto, rango, selector de tarifa, toggle Pro, historial descuentos con evidencia y reclamación.
   - Frontend product: precio visible en tarjeta de modelo (home) y `/m/:slug`.
   - Frontend admin: nuevo panel admin de descuentos con gestión de reclamaciones.

4. **Sub-frente 4: T&C y contrato de modelo v5** — PENDIENTE (paralelo a Sub-frente 3)
   - Materializar en T&C y contrato de modelo la política de descuentos de [ADR-052 §D7](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md): umbral chargebacks ~5%, descuentos automáticos con consentimiento, derecho a disputa, transparencia panel modelo.
   - Coordinación con asesoría legal externa adult-experienced.
   - **Bloqueante** para exponer D9 (descuentos automáticos) sin exposición legal.
   - Alineado con la deuda residual R5 "Model Collaboration Agreement v5" ya declarada en [`../04-operations/known-debt.md`](../04-operations/known-debt.md).

Deudas registradas del frente:
- Rediseño packs premium (fricción rango 1-9 €/min con packs 10/20/40 €) — registrada en `known-debt.md`.
- Recalibración `modelo-financiero.md` + xlsx tras nuevo reparto — registrada en `known-debt.md`.
- Deudas ADR-049 (#D-18 a #D-23) canceladas por retirada del programa.

---

## Frente 4: Sistema de Tickets de Incidencias (ADR-054)

Estado: **IMPLEMENTADO y en los 3 entornos** (verificado 2026-08-15: `V41__add_support_tickets.sql` + `SupportTicket`/`TicketService` en código; `manualRefundToClient` con `transactions.ticket_id` cubierto por tests de integración — ADR-059). El sistema fue además rediseñado (as-built 2026-08-07): canales chat casual (bot) / ticket (solo humanos) separados, endpoint scoped `POST /conversations/{id}/message` sin bot, 10 categorías, `AUTO_INCREMENT` de tickets con offset 10001, prompt del bot editable en BD. Las marcas "PENDIENTE" de las fases T1-T6 de abajo quedan obsoletas (describen el plan, ya realizado).

Objetivo:
separar la gestión de **incidencias** (problemas reales con posible compensación económica) de las **consultas** (dudas resueltas por el bot LLM), y construir el sistema de trazabilidad + verificación + compensación antes de que el frente PSP tarjeta traiga reclamaciones masivas inevitables.

Base estructural: [ADR-054](../06-decisions/adr-054-sistema-tickets-incidencias.md), 8 decisiones (D1..D8) que definen ticket como dominio propio con conversación linkada, apertura por formulario explícito + detección heurística con confirmación, verificación automática por categoría contra fuentes internas (`stream_sessions`, `payment_sessions`, `moderation_evidence`, etc), compensación via reuso completo de `manualRefundToClient` con nueva columna `transactions.ticket_id`, y flujo admin extendiendo `AdminSupportPanel` con sub-tab Incidencias.

Reutilización estructural del ADR-046 (chat soporte + panel humano) para el canal de comunicación agente ↔ cliente sobre el ticket, y reutilización estructural del panel financiero admin actual (`AdminFinancePanel.jsx` + `TransactionService.manualRefundToClient`, verificados como **real y funcional, NO mock**) para la compensación económica. Zero refactor del ledger contable.

Secuencia técnica planificada (6 fases, cada una desplegable):

1. **Fase T1 — backend base** — PENDIENTE
   - Migration V41 con tabla `support_tickets` + columna `transactions.ticket_id` FK + FKs a `support_conversations`, `stream_sessions`, `payment_sessions`.
   - Entity `SupportTicket` + `SupportTicketRepository`.
   - `TicketService` (CRUD + gestión estados + antifraude D7).
   - `TicketVerificationService` con checks para al menos 2 categorías iniciales (`STREAM_INTERRUPTED` + `PAYMENT_NOT_CREDITED`); las otras 2 (`MODERATION_FALSE_POSITIVE` + `ACCOUNT_ISSUE`) siguen la misma pauta y se completan en fase iterativa.
   - Extensión `TransactionRequestDTO` con campo `ticketId` opcional + validación bidireccional en `manualRefundToClient` (si `ticketId` presente, verificar ticket existe + estado `RESOLVED_COMPENSATED_PENDING_CREDIT` + pertenece al `userId`).
   - Tests unitarios de cada servicio (patrón `SupportBotServiceTest`).

2. **Fase T2 — controllers y endpoints** — PENDIENTE
   - `TicketController` cliente bajo `/api/tickets/`: POST crear ticket, GET listado propio, GET detalle, POST añadir mensaje al hilo.
   - `AdminTicketController` (o extensión `SupportAdminController`) bajo `/api/admin/tickets/`: GET listado con filtros por categoría/estado/edad, GET detalle, POST verify (D3), PATCH status, POST resolve (que valida transición + orquesta compensación si aplica).
   - Tests MockMvc.

3. **Fase T3 — detección heurística del bot** — PENDIENTE
   - Extensión `SupportBotService` con pre-clasificación por keywords/patrones por categoría; si señal fuerte, respuesta del bot con oferta "¿Abrir ticket?" + botón de confirmación en `SupportChat.jsx`.
   - Cero apertura automática sin confirmación explícita (D2 b2).

4. **Fase T4 — frontend cliente** — PENDIENTE
   - Sección "Mis incidencias" en dashboard cliente (ruta propia o extensión de la sección Soporte).
   - Formulario apertura con selector de categoría + descripción + timestamp aproximado.
   - Listado con estado y filtros.
   - Drill-down con `SupportChat.jsx` reutilizado + badge de contexto ticket.
   - i18n `support.tickets.*` ES+EN.

5. **Fase T5 — frontend admin** — PENDIENTE
   - Nueva sub-tab "Incidencias" en `AdminSupportPanel.jsx` (junto a Conversaciones + Profiles).
   - Listado maestro con filtros por categoría/estado/edad + badge `high_history_flag`.
   - Detalle drill-down con panel de verificación automática (JSON formateado + señal global) + botón "Compensar X€" (llama al endpoint refund existente con `ticketId`) + botón "Rechazar con motivo" + hilo de mensajes.
   - Nuevo permiso `PERM_SUPPORT_TICKETS_HANDLE` con baseline `ROLE_SUPPORT` (patrón ADR-046).
   - i18n `admin.tickets.*` ES+EN.

6. **Fase T6 — nivelación TEST + AUDIT + PROD** — PENDIENTE
   - Sigue el patrón del paso 7 del Frente 1 (ADR-046): V41 aplicada por Flyway al arranque de cada entorno, JAR único desplegado con `deploy-frontend.ps1` + `update-manifest-backend.ps1`.

Deudas registradas del frente (todas en `docs/04-operations/known-debt.md` cuando se abra la fase T1):
- #D-45 auto-approve/auto-reject con umbrales por categoría (evolución futura tras 3 meses de datos).
- #D-46 tabla de compensación máxima recomendada por categoría (informativa, no bloqueante).
- #D-47 notificación WS + email al cliente cuando agente responde/cambia estado.
- #D-48 reporting admin de tickets (categoría/estado/tasa compensación/coste mensual).
- #D-49 anticipar chargebacks preventivos cuando aterrice PSP tarjeta (auto-abrir ticket + compensación pre-chargeback).
- #D-50 playbook operativo agente humano para tickets (redacción tras 20-30 gestiones reales).

---

## Frente 5: Sistema Master/Studio (ADR-056)

Estado: **ACTIVO en TEST + AUDIT + PROD desde 2026-08-04** (verificado 2026-08-15: `V42`-`V46` en código; endpoints `/api/masters/**`). Registro, dashboard (tabs), reparto dual INDIVIDUAL/MASTER, invitación de modelos, splits, payout Master y suspensión: HECHOS y cubiertos por tests de integración (ADR-059). **Único pendiente real: el rail de payout Paxum real** (hoy `NoopPayoutAdapter` manual, despriorizado por el operador — ver backlog P5). Las marcas "PENDIENTE" de las fases S6-S8 de abajo se actualizan en cada una; el "Cero implementación técnica todavía" original era el estado del día de aceptación del ADR, ya superado por el propio cuerpo de este frente.

Objetivo:
introducir rol MASTER (estudios de webcam) como entidad de dominio propia, con reparto económico dual (INDIVIDUAL vs MASTER) y payouts multi-rail (Paxum → Yoursafe → cripto). Pivote estratégico tras 6 meses de captación fallida de modelos individuales — el problema no es económico (SharemeChat ofrece 2× lo que da LiveJasmin al broadcaster individual) sino de acceso (llegar a modelos independientes genera desconfianza). Los estudios colombianos aportan 5-15 modelos ya entrenadas por captación, resolviendo el problema.

Base estructural: [ADR-056](../06-decisions/adr-056-sistema-master-studio.md), 12 decisiones D1-D12 sobre reparto (motor unificado con detección Master, umbrales L1/L3/L5/L7 LiveJasmin equivalente EUR, régimen dual INDIVIDUAL 50-60% / MASTER 50-70%), roles y KYC (Master persona física + contrato dedicado + cláusula AML modelo v6), visibilidad (Master NO ve PII de sus modelos alineado con LJ + GDPR), opacidad interna (modelo bajo Master no ve ledger crudo), suspensión Master (liberación como individuales), payouts multi-rail (Paxum prioritario).

Reemplaza parcialmente ADR-052 §D1 (%reparto) y §D5 (umbrales tramos). Resto ADR-052 vigente.

Secuencia técnica planificada (8 fases, cada una desplegable):

1. **Fase S1 — backend base** — COMPLETADA 2026-07-29 (`394b907`)
   - Migration V42 aplicada TEST (10 bloques SQL). Nota operativa: el nombre real del UNIQUE index en `model_pricing_tiers` es `uq_mpt_code_effective` (no el que dio ADR-056); cerrada vigencia previa T1-T4 y sembradas 8 filas dual (4 INDIVIDUAL + 4 MASTER) con umbrales L1/L3/L5/L7 en EUR.
   - Entities + repositorios (módulos `master/` y `payout/`, patrón simétrico a `support/psp/streammoderation/content` con sub-packages `config/controller/dto/entity/repository/service`) + `Constants.Roles.MASTER` + `UserTypes.FORM_MASTER` + `KycSessionTypes.MASTER`.
   - Refactor `ModelPricingTierRepository` con parámetro `targetType`; sobrecargas legacy delegan a `'INDIVIDUAL'` para no romper callers preexistentes.

2. **Fase S2 — KYC + contrato Master** — COMPLETADA 2026-07-29 (`4300f80`)
   - `MasterContractService` + `MasterContractManifestService` idempotentes (patrón simétrico modelo con verificación SHA-256 contra S3).
   - Draft contrato `sharemechat-v1/docs/01-business/master-contract-v1-draft.md` (redactado entre operador y Claude, sin abogado externo por decisión explícita del operador — mismo patrón versionado que modelo v4). PDF pendiente de generar antes de aceptación real en PROD.
   - Extensión `KycSessionService.startDiditMasterSession` + property `kyc.didit.master-workflow-id` (workflow ID Didit dedicado para persona física Master).
   - Endpoints `POST /api/masters/register` + `GET|POST /api/masters/me/contract` + `POST /api/masters/me/kyc/didit`.

3. **Fase S3 — motor reparto extendido** — COMPLETADA 2026-07-29 (`8ccd05e`)
   - `ModelTierService.resolveEffectiveTierForPayout(modelId)` detecta `master_user_id` y delega en `resolveEffectiveTierForMasterPayout(masterUserId)`, que resuelve por bruto agregado 30d de todas las modelos activas del Master.
   - Query dedicada `TransactionRepository.sumStreamChargeGrossForMasterWindow` (subquery sobre `Model.masterUserId`).
   - `StreamService.endSession` y `UserTrialService.closeTrialStreamAndSettle` atribuyen `STREAM_EARNING` / `TRIAL_EARNING` al Master cuando aplica, con `attributed_model_user_id` set apuntando a la modelo real.
   - Tests exhaustivos: 4 escenarios (INDIVIDUAL T1, INDIVIDUAL T4, MASTER agregado T2, MASTER agregado T4) verificando que la modelo bajo Master no cobra directamente y que `attributed_model_user_id` queda registrado.

4. **Fase S4 — endpoints Master gestión modelos** — COMPLETADA 2026-07-29 (`ed6f9b9`)
   - `POST /api/masters/me/models` (`MasterModelInvitationService`): valida email/nickname, crea `User` con `password_temporary=1` y placeholder aleatorio (nadie conoce la password inicial), crea fila `Model` con `master_user_id`, emite token via `EmailVerificationService.issueVerification(..., "MASTER_MODEL_INVITATION")`. Idempotente sobre email existente del mismo Master (reemite token); rechaza si el email pertenece a otro Master o a otro user individual.
   - `GET /api/masters/me/models` + `GET /{id}` + `PATCH /{id}/active` + `PATCH /{id}/internal-share` (`MasterModelManagementService`, guard ownership por `master_user_id`, proyección `MasterModelViewDTO` sin PII cumpliendo D9).
   - Endpoint público `POST /api/masters/models/activate/{token}` — la modelo genera su propia password (min 10 chars, sin espacios). Marca `password_temporary=false` + `first_password_change_at=now`, exige `password_temporary=true` previo (defensa contra reuso).
   - Tests unitarios + MockMvc: happy path invite, idempotencia mismo Master, rechazo otro Master, rechazo nickname duplicado, activate happy, rechazo reuse, rechazo password corta.

5. **Fase S5 — frontend Master** — EN CURSO
   - **S5.a — dashboard Master post-login `/master`** — PARCIAL COMPLETADO 2026-07-31: shell + tab Overview + tab Modelos con modales invitar/editar. Pendiente tabs Historial/Payout (S5.a.8, siguiente sesión). Detalle:
     - **S5.a.1-6, 9, 10** — Constants Roles.MASTER + `resolveHomeUrl` a `/master` + Route protegida + backend endpoints `/api/masters/me`, `/me/overview`, `/me/transactions`, `POST /me/payout` (bajo `MasterOverviewService` + `MasterPayoutService` + query `TransactionRepository.findMasterTransactionsFiltered`) + frontend cliente `masterApi.js` + `NavbarMaster.jsx` (5 tabs, sin Blog tras iteración operador) + `DashboardMaster.jsx` SPA con `activeTab` + tab Overview funcional (4 KPI cards + 3 banners condicionales email/KYC/contrato + actividad reciente 5 últimos movimientos) + i18n `masterDashboard.*` ES+EN + build + deploy TEST + smoke.
     - **S5.a fix login MASTER** — `AuthController.login:136` rechazaba role=MASTER (allowlist USER/CLIENT/MODEL). Añadido MASTER.
     - **S5.a decisión auto-promoción** (Opción 1 sobre 3): `MasterService.registerMaster` asigna directamente `role=MASTER + user_type=FORM_MASTER` (antes era USER+FORM_MASTER "pendiente de promoción admin"). Justificación: Master no tiene gate PRELAUNCH aplicable; el KYC + contrato pendientes se enforcean via banners UI y validaciones en endpoint payout. Si en futuro se quiere reintroducir revisión admin previa, ver javadoc de `MasterService.registerMaster`.
     - **S5.a Opción Z email verification** — el usuario Master puede loguearse sin haber verificado email. `EmailVerifiedFilter` whitelistea lectura Master (GET `/api/masters/me/**`) y onboarding (POST `/me/contract/accept`, `/me/kyc/didit`), pero bloquea escritura (invitar modelo, PATCH activate/split, POST payout) con 403 EMAIL_NOT_VERIFIED. Banner rojo con botón "Reenviar email de verificación" en dashboard (llama a `POST /api/email-verification/resend`).
     - **S5.a fix KYC guard** — `KycSessionService.startDiditMasterSession:340` rechazaba role=MASTER (exigía USER+FORM_MASTER). Ampliado a ambos por compatibilidad si el diseño cambia.
     - **S5.a fix KYC session reuse** — Didit sandbox devuelve mismo `provider_session_id` en llamadas repetidas al mismo user hasta que la sesión pasa a estado terminal. `startDiditMasterSession` intentaba insertar duplicado → 500 constraint violation → maintenance overlay. Fix: reutilizar sesión PENDING existente antes de llamar Didit.
     - **S5.a fix webhook workflow mismatch** — `assertWorkflowIdMatchesSessionType` rechazaba webhooks Master con workflow=modelo (fallback esperado si `masterWorkflowId` está blank). Fix: aceptar `isModelWf + MASTER + masterUsesModelFallback`. Confirmado end-to-end con webhook real de Didit procesado OK (userId=105 en TEST).
     - **S5.a fix defensive contract manifest** — `MasterOverviewService.getOverview` reventaba con 500 cuando el manifest S3 no existía. Envolvido en `safeIsContractAccepted` que traga excepciones y retorna `false`.
     - **S5.a páginas onboarding dedicadas**:
       - `MasterContractPage.jsx` (`/master-contract`, RequireRole=MASTER): carga manifest via `GET /me/contract` + botón "Abrir PDF" (gate obligatorio: checkbox y botón "Firmar" bloqueados hasta abrirlo) + POST `/me/contract/accept` + redirect al dashboard.
       - `MasterKycDiditPage.jsx` (`/master-kyc-didit`, RequireRole=MASTER): consentimiento GDPR completo (Art. 9.2.a RGPD, patrón simétrico a Model KYC) con link a `/legal?tab=privacy` + botón "Iniciar verificación" → POST `/me/kyc/didit` → redirect a URL Didit devuelta.
       - `MasterKycDiditProcessingPage.jsx` (`/master-kyc-didit/processing`, RequireRole=MASTER): página intermedia tras redirect Didit, polling `/me/overview` cada 3s hasta 60s. Al detectar `verificationStatus=APPROVED` redirige a `/master`.
     - **S5.a ops**: `master_contract.pdf` publicado en S3 TEST (`assets-sharemechat-test1/legal/master_contract.pdf` + manifest, version `master_contract_v1_2026-07-31`, sha256 `490864CE...`, generado desde `docs/01-business/master-contract-v1-draft.md` con `markdown-pdf` Python — deuda REGISTRADA: es BORRADOR, revisar antes de PROD). Env var `KYC_DIDIT_MASTER_CALLBACK_URL=https://test.sharemechat.com/master-kyc-didit/processing` añadida a `/opt/sharemechat/config.env` de EC2 TEST + restart servicio. Sin ese env var el redirect browser tras Didit vuelve al webhook endpoint API → `/unauthorized`. **Pendiente PROD/AUDIT**: publicar el env var equivalente antes del deploy del frontend Master a esos entornos.
     - **S5.a UX polish tras iteración operador**: modal registro Master con `max-height: calc(100vh - 48px) + overflow-y: auto` en `StyledForm` para formularios largos (aplica a todos los subviews Login). Contexto persistente en `LoginModalContent` (tab "Regístrate" desde modal Master vuelve a Master, no a selector cliente/modelo). Título modal: "Registro Master" (retirado "(Estudio)"). Intro modal reescrito: "Alta como Master en SharemeChat. Persona física, sin necesidad de empresa." Botones dashboard Master (tab Blog retirado por rompimiento UX; icon Perfil disabled visualmente hasta que exista `/perfil-master`).
     - **S5.a.7 tab Modelos** (2026-07-31): `MasterModelosPanel.jsx` en `frontend/src/components/master/` — tabla sin PII (columnas: nickname, estado activa/inactiva, KYC badge, horas emitidas, tarifa €/min, % pactado, acciones) + modal "Invitar modelo" (email + nickname) → `POST /me/models` + modal "Editar %" (input 0-100 + notes) → `PATCH /me/models/{id}/internal-share` + toggle activate/deactivate con `confirm()` → `PATCH /me/models/{id}/active`. Integrado en `DashboardMaster.jsx` reemplazando placeholder. i18n `masterDashboard.modelos.*` ES+EN. Backend S4 pre-existente sin cambios.
   - **S5.b — captación pública Master (Opción A landing dedicada)** — COMPLETADA 2026-07-29. Basado en análisis UX previo (LiveJasmin sector-estándar: `/become-a-studio` separado del registro de modelos independientes para evitar canibalización).
   - **S5.b — captación pública Master (Opción A landing dedicada)** — COMPLETADA 2026-07-29. Basado en análisis UX previo (LiveJasmin sector-estándar: `/become-a-studio` separado del registro de modelos independientes para evitar canibalización).
     - `MasterLanding.jsx` en `/for-studios` con SEO bilingüe ES/EN, hero + cómo funciona en 3 pasos + tabla económica Master vs Individual con umbrales L1/L3/L5/L7 + comparativa contra LiveJasmin + FAQ + CTA final. Estilos inline patrón `Safety.jsx`. `PublicNavbar` + `Footer` estándar.
     - `RegisterMasterModalContent.jsx` alineado con `RegisterMasterRequestDTO`: email + password (≥10, sin espacios) + nickname + dateOfBirth + confirAdult + acceptedTerm + uiLocale; opcional `companyName/companyRegistrationNumber/companyCountry` (ISO alpha-2). Integrado en `LoginModalContent` como vista `register-master`, invocable via `openLoginModal({ initialView: 'register-master' })`.
     - `MasterModelActivationPage.jsx` en `/master/invite/activate/:token` (path param + fallback `?token=`) que consume `POST /api/masters/models/activate/{token}`.
     - Enlace footer "For studios" (desktop + móvil) + 3er CTA "Traigo un estudio / I bring a studio" en `BlogContent.CTABox`.
     - i18n `forStudios.*`, `auth.registerMaster.*`, `auth.masterActivation.*`, `seo.forStudios.*` en ES+EN + `blog:cta.registerMaster` ES+EN.
     - **S5.b.7 rediseño alineado con sector opaco** (2026-07-29): tras análisis crítico se retiró tabla T1-T4 con % + umbrales EUR, comparativa nominal vs LiveJasmin y FAQ sensibles (PII, suspensión). Sustituido por bullets cualitativos y FAQ neutra. Alineado con LiveJasmin/Stripchat/BongaCams (ninguno publica cifras en su landing pública).
     - **S5.b.8 pulido texto por texto + navbar fix** (2026-07-30): rewrite completo de los 11 textos de la landing (hero.title/subtitle, howItWorks 3 pasos, benefits reducido a 3 items sin duplicar step 3, FAQ 3 preguntas, ctaFinal.title/subtitle). Aplicado feedback estable: tono no-posesivo con modelos ("administra modelos bajo cuenta Master" en vez de "trae tus modelos"), voz institucional B2B ("la plataforma X" > "tú haces X"), conceptual no procedimental, evitar anglicismos en ES (retiro/comisiones/cumplimiento normativo/canales en vez de payout/fees/compliance/rails). `MasterLanding.jsx` navbar fix: props `onGoVideochat/onGoFavorites/onLogin/onBuy` cableados a `openLoginModal` (visitante no logado); `onGoBlog` navega a `/blog`; brand click a `/`.

6. **Fase S6 — payouts multi-rail** — PARCIAL (infra HECHA; rail real diferido)
   - Tabla `payout_methods` (`V45__add_payout_methods.sql`) + CRUD + `payout_method_id` en el flujo de payout: HECHO.
   - `PaxumPayoutAdapter` real: **diferido** — hoy `NoopPayoutAdapter` (transferencia manual). Despriorizado por el operador (backlog P5).
   - Yoursafe + cripto payouts diferidos (deudas #D-52, #D-53).

7. **Fase S7 — frontend admin Masters + suspensión** — HECHO
   - `AdminMastersPanel` (listado + drill-down) + suspensión de Master (D11, `V46__add_master_suspension.sql`, `MasterSuspensionService` cubierto por tests de integración): en código y desplegado.

8. **Fase S8 — nivelación TEST → AUDIT → PROD** — HECHO (2026-08-04)
   - TEST + AUDIT + PROD nivelados (migraciones V42-V46 aplicadas en PROD, endpoints `/api/masters/**` respondiendo). Modo operativo de PROD sigue `PRELAUNCH`.

Deudas registradas del frente (todas en `docs/04-operations/known-debt.md` cuando se abra la fase S1):
- #D-52 adapter `YoursafePayoutAdapter` (S6 diferido).
- #D-53 adapter `NowPaymentsPayoutAdapter` cripto payouts (S6 diferido).
- #D-54 retropoblar `target_type='INDIVIDUAL'` en snapshots pre-V42.
- #D-55 extensión Master a modelos internacionales fuera de Colombia.
- #D-56 sistema tickets extendido a Masters (aliada #D-51 del ADR-054).
- #D-57 recomendación de tarifa del Master a sus modelos.
- #D-58 onboarding Master con vídeo tutorial + checklist guiado.
- #D-59 reporting fiscal por Master.
- #D-60 rate limit creación modelos por Master (antifraude).

---

## Ya cerrado con consistencia

- Producto y backoffice sobre base común.
- Realtime dividido por `/match` y `/messages`.
- Trazabilidad económica y de streams.
- Product Operational Mode operativo para cierre de registro y simulación económica directa.
- Auth-risk Fase 1 y Fase 2 validadas en TEST y AUDIT.
- Pipeline perimetral AUDIT operativo.
- Billing de streams con doble ACK media y `billable_start` validado en TEST.
- CMS Fase 4A ([ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md), [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md), [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md), [ADR-013](../06-decisions/adr-013-full-article-run-phase3b.md) superseded) COMPLETADO en TEST: workflow editorial completo hasta `PUBLISHED`, versionado inmutable en `content_article_versions`, eventos en `content_review_events`, runs IA Claude Cowork manual structured con `FULL_ARTICLE_ORCHESTRATED` como flujo principal recomendado (pipeline delegado en seis skills personales versionadas en `docs/_archive/cms/skills/`; RESEARCH/REVIEW mantenidos como herramientas avanzadas; OUTLINE/DRAFT/SEO siguen disponibles a nivel backend), publicación pública dinámica vía API JSON consumida por el SPA público (`/blog` y `/blog/:slug`), render Markdown→HTML server-side con flexmark + sanitización jsoup, preview privada admin sobre el mismo render, bloqueo absoluto de edición en estados terminales (`PUBLISHED`/`RETRACTED`) sin bypass ADMIN, y SEO mínimo para indexación (sitemap dinámico `/sitemap.xml`, `/robots.txt`, meta tags Open Graph + Twitter Card y JSON-LD `Article` inyectados en el `<head>` del SPA). Sin generación estática todavía, sin retracción operativa. Detalle en [test.md](../03-environments/test.md) y en [cms-seo-overview.md](../02-architecture/cms-seo-overview.md).

---

## Pendiente vivo fuera del frente activo

Estos puntos siguen pendientes, pero **no son el siguiente paso inmediato** salvo decisión explícita:

- Validar modos restrictivos completos de Product Operational Mode: `PRELAUNCH`, `MAINTENANCE`, `CLOSED`.
- Tratamiento frontend de códigos `PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE`, `REGISTRATION_CLOSED`, `SIMULATION_DISABLED`.
- Parametrización real de PROD.
- PSP tarjeta real (CardBilling/Verotel): pendiente de decisión de lanzamiento del operador, no bloqueado por terceros (CCBill descartado). Cripto NOWPayments ya en PROD.
- KYC externo end-to-end.
- Compliance entre REST y WebSocket.
- i18n producto/backoffice.
- Contrato funcional de errores REST/WebSocket/frontend.
- Extender auth-risk a login admin, refresh y forgot/reset password.
- Persistencia de logs en TEST cuando deje de arrancar manualmente.
- CMS Frente 3 cerrado (workflow simplificado + retracción operativa, ADR-016): cuatro estados operables `DRAFT → IN_REVIEW → PUBLISHED → RETRACTED`, sin segregación generador↔aprobador, retracción con `410 Gone` + tombstone JSON + header `X-Robots-Tag: noindex` y meta `robots=noindex` en SPA, `HEAD /sitemap.xml` y `/robots.txt` autorizado además de `GET`. Próximos frentes diferidos sin fecha: publicación estática a S3+CloudFront, `heroImageUrl`/`og:image`, `SCHEDULED` operativo, endpoint compuesto `publish-now`. Cada uno abrirá su propio ADR cuando exista justificación de volumen o caso de uso. Fase 3 (IA discreta) ya completada; Fase 3B con `FULL_ARTICLE_ORCHESTRATED` ([ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md), supersede de ADR-013) cerrada; Fase 4A (publicación dinámica vía API) cerrada y extendida con SEO mínimo (sitemap, robots, meta tags y JSON-LD — ver [cms-seo-overview.md](../02-architecture/cms-seo-overview.md)).