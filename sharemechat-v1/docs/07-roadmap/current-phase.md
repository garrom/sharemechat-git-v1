# Fase actual

## Fase activa general

SharemeChat está en **Fase 0 — Cierre de riesgos pre-PRO** del roadmap hacia GO LIVE.

Objetivo de esta fase:
cerrar riesgos estructurales antes de abrir PROD, especialmente en economía, acceso por entorno, PSP, KYC, compliance y configuración real por entorno.

El roadmap general vive en [go-live-roadmap.md](go-live-roadmap.md).
El backlog técnico vive en [pending-hardening.md](pending-hardening.md).
Este documento es el panel corto de estado y prioridad viva.

---

## Frentes operativos activos

Tres frentes en curso en paralelo. El Frente 1 (Chat Soporte LLM · Panel humano) es la sub-fase iniciada tras cerrar Fase 1.D del refactor Agente IA (ADR-044) y ejecutada durante las últimas sesiones operativas. El Frente 2 (Gobierno económico pre-PSP) sigue vivo con su siguiente paso identificado (BFPM Fase 4B-b) como prerrequisito de la integración PSP real; no está pausado. El Frente 3 (Materialización ADR-052: rediseño estructural del reparto + retirada del programa de afiliadas) arranca tras cerrar la Fase B documental el 2026-07-24 y encadena en 3 sub-frentes técnicos (purga afiliadas → refactor sistema tramos + rango de precio + Estatus Pro → T&C legal).

---

## Frente 1: Chat Soporte LLM — Panel humano (ADR-046)

Estado: **CERRADO en TEST y AUDIT** al 2026-07-09. Propagación a PROD pendiente y ligada a la decisión de corte del pivote soft launch (ADR-047).

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
   - Detalle completo en `docs/project-log.md` entrada 2026-07-09 "Nivelación AUDIT completa" y en snapshot `docs/_snapshots/state-audit-2026-07-09.yaml`.

7. **Replicación de la Fase B.3 a PROD** — PENDIENTE
   - Requiere aplicar V15 al RDS PROD vía túnel bastion + `mysqlsh`, desplegar el JAR `05d52c29…` (commit `c4f58ce`) + bundles admin (`main.e497623e.js`) y product (`main.7ef36d6c.js`), y comprobar/populan `CLAUDE_API_KEY` en `/opt/sharemechat/secrets.env` de PROD (probablemente ausente por el mismo gap que aparece en AUDIT).
   - Coordinar con el estado del pivote soft launch (ADR-047) y con el hardening PROD coming-soon vigente: los overrides `kyc.didit.enabled=false` y `moderation.sightengine.enabled=false` de `application-prod.properties` no se retiran en esta replicación; solo se propaga el frente B.3 + Fases 1/1.1/2/avatar.

Deudas registradas del frente (todas en `docs/04-operations/known-debt.md`): #D-13 job expiración `ESCALATED > 48h`, #D-14 Browser Notification API para agents, #D-15 playbook DPO GDPR art. 15 sobre conversaciones humanas (obligatorio pre-go-live PROD).

---

## Frente 2: Gobierno económico pre-PSP

Objetivo:
cerrar la base económica interna antes de integrar CCBill real y antes de cualquier circulación de dinero real.

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
   - No mezclar con integración CCBill real.

7. **Integración CCBill real y firma webhook** — BLOQUEADO
   - Pendiente de recibir manual oficial de integración de CCBill.
   - No implementar firma, contrato definitivo ni validación final por inferencia.
   - Cuando llegue el manual, se abrirá el frente PSP real.

---

## Frente 3: Materialización ADR-052 — rediseño reparto + retirada afiliadas

Estado: **Fase B documental CERRADA el 2026-07-24**. Fases técnicas subsiguientes pendientes.

Objetivo:
materializar el rediseño estructural del reparto modelo/plataforma (75-79% escalonado por facturación) y del rango de precio autoservicio decidido en [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), y retirar el programa de afiliadas (código + schema + docs) que quedó superseded por ese mismo ADR.

Base estructural: [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md), aceptado 2026-07-24, con 12 decisiones (D1..D12) que reordenan el ciclo económico. Contexto operativo del pivote de reclutamiento en [ADR-047](../06-decisions/adr-047-pivote-soft-launch-cripto-paxum.md) (soft launch cripto). Retirada de [ADR-049](../06-decisions/adr-049-programa-afiliadas-modelos.md) programa de afiliadas ya marcada SUPERSEDED.

Secuencia planificada (4 sub-frentes, orden 1→2→3, 4 en paralelo a 3):

1. **Sub-frente 1: Fase B documental** — HECHO (2026-07-24)
   - Reescritura completa de [`../01-business/sistema-tiers-modelos.md`](../01-business/sistema-tiers-modelos.md), [`../01-business/pricing.md`](../01-business/pricing.md), [`../01-business/unit-economics.md`](../01-business/unit-economics.md).
   - Actualización parcial de [`../01-business/business-model.md`](../01-business/business-model.md), [`../01-business/launch-strategy.md`](../01-business/launch-strategy.md), [`../01-business/model-profile-strategy.md`](../01-business/model-profile-strategy.md).
   - Actualización del plan de captación [`plan-captacion-trafico-2026-q3.md`](plan-captacion-trafico-2026-q3.md) marcando palanca P3 (programa de afiliados) como RETIRADA con re-cálculo de horas y métricas.
   - `affiliate-program.md` movido a `_deprecated/registro.md` con stub de retirada en el fichero original.
   - Cabeceras de ADRs anteriores actualizadas: ADR-049 SUPERSEDED por ADR-052, ADR-043 §1 y §4 parcialmente superseded por ADR-052.
   - Actualización de deudas conocidas en [`../04-operations/known-debt.md`](../04-operations/known-debt.md) (cancelación de deudas #D-18/19/20/21/22/23 del ADR-049 + añadir deuda nueva de rediseño packs premium).
   - Actualización de [`../04-operations/known-risks.md`](../04-operations/known-risks.md) con nuevo riesgo "margen tarjeta delgado sensible a chargebacks".
   - Recalibración del [`../01-business/financiero/modelo-financiero.md`](../01-business/financiero/modelo-financiero.md) marcada como deuda declarada (xlsx binario no se toca en esta iteración).

2. **Sub-frente 2: Purga técnica afiliadas** — PENDIENTE
   - Migration `V38__drop_affiliate_program.sql`: drop tablas `affiliate_codes`, `affiliate_commissions`, `affiliate_click_events`, `affiliate_link_tokens`; drop columnas `clients.referrer_model_user_id`, `users.referral_code_owner`, `users.first_stream_charge_at`.
   - Purga de código: `AffiliateCommissionService`, `AffiliateAttributionService`, `AffiliateBonusService`, `AffiliateCodeService`, `AffiliateHashService`, `AffiliateLinkTokenService`, entidades, controllers, endpoints REST, DTOs, tests unitarios.
   - Frontend product: retirada de `/model/affiliate`, landing `/i/:token`, banner referral en registro cliente.
   - Aislado y autoncontenido; no depende del sistema nuevo. Deja el repo limpio antes del refactor grande.

3. **Sub-frente 3: Implementación técnica del reparto nuevo** — PENDIENTE
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

## Ya cerrado con consistencia

- Producto y backoffice sobre base común.
- Realtime dividido por `/match` y `/messages`.
- Trazabilidad económica y de streams.
- Product Operational Mode operativo para cierre de registro y simulación económica directa.
- Auth-risk Fase 1 y Fase 2 validadas en TEST y AUDIT.
- Pipeline perimetral AUDIT operativo.
- Billing de streams con doble ACK media y `billable_start` validado en TEST.
- CMS Fase 4A ([ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md), [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md), [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md), [ADR-013](../06-decisions/adr-013-full-article-run-phase3b.md) superseded) COMPLETADO en TEST: workflow editorial completo hasta `PUBLISHED`, versionado inmutable en `content_article_versions`, eventos en `content_review_events`, runs IA Claude Cowork manual structured con `FULL_ARTICLE_ORCHESTRATED` como flujo principal recomendado (pipeline delegado en seis skills personales versionadas en `docs/cms/skills/`; RESEARCH/REVIEW mantenidos como herramientas avanzadas; OUTLINE/DRAFT/SEO siguen disponibles a nivel backend), publicación pública dinámica vía API JSON consumida por el SPA público (`/blog` y `/blog/:slug`), render Markdown→HTML server-side con flexmark + sanitización jsoup, preview privada admin sobre el mismo render, bloqueo absoluto de edición en estados terminales (`PUBLISHED`/`RETRACTED`) sin bypass ADMIN, y SEO mínimo para indexación (sitemap dinámico `/sitemap.xml`, `/robots.txt`, meta tags Open Graph + Twitter Card y JSON-LD `Article` inyectados en el `<head>` del SPA). Sin generación estática todavía, sin retracción operativa. Detalle en [test.md](../03-environments/test.md) y en [cms-seo-overview.md](../02-architecture/cms-seo-overview.md).

---

## Pendiente vivo fuera del frente activo

Estos puntos siguen pendientes, pero **no son el siguiente paso inmediato** salvo decisión explícita:

- Validar modos restrictivos completos de Product Operational Mode: `PRELAUNCH`, `MAINTENANCE`, `CLOSED`.
- Tratamiento frontend de códigos `PRODUCT_UNAVAILABLE`, `PRODUCT_MAINTENANCE`, `REGISTRATION_CLOSED`, `SIMULATION_DISABLED`.
- Parametrización real de PROD.
- PSP CCBill real, bloqueado hasta recibir manual oficial.
- KYC externo end-to-end.
- Compliance entre REST y WebSocket.
- i18n producto/backoffice.
- Contrato funcional de errores REST/WebSocket/frontend.
- Extender auth-risk a login admin, refresh y forgot/reset password.
- Persistencia de logs en TEST cuando deje de arrancar manualmente.
- CMS Frente 3 cerrado (workflow simplificado + retracción operativa, ADR-016): cuatro estados operables `DRAFT → IN_REVIEW → PUBLISHED → RETRACTED`, sin segregación generador↔aprobador, retracción con `410 Gone` + tombstone JSON + header `X-Robots-Tag: noindex` y meta `robots=noindex` en SPA, `HEAD /sitemap.xml` y `/robots.txt` autorizado además de `GET`. Próximos frentes diferidos sin fecha: publicación estática a S3+CloudFront, `heroImageUrl`/`og:image`, `SCHEDULED` operativo, endpoint compuesto `publish-now`. Cada uno abrirá su propio ADR cuando exista justificación de volumen o caso de uso. Fase 3 (IA discreta) ya completada; Fase 3B con `FULL_ARTICLE_ORCHESTRATED` ([ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md), supersede de ADR-013) cerrada; Fase 4A (publicación dinámica vía API) cerrada y extendida con SEO mínimo (sitemap, robots, meta tags y JSON-LD — ver [cms-seo-overview.md](../02-architecture/cms-seo-overview.md)).