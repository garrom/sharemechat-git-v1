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

Dos frentes en curso en paralelo. El Frente 1 (Chat Soporte LLM · Panel humano) es la sub-fase iniciada tras cerrar Fase 1.D del refactor Agente IA (ADR-044) y ejecutada durante las últimas sesiones operativas. El Frente 2 (Gobierno económico pre-PSP) sigue vivo con su siguiente paso identificado (BFPM Fase 4B-b) como prerrequisito de la integración PSP real; no está pausado.

---

## Frente 1: Chat Soporte LLM — Panel humano (ADR-046)

Objetivo:
cerrar la superficie humana del Agente IA para que las conversaciones escaladas por el bot puedan atenderse por el equipo desde el backoffice admin, sin bloquear al bot en el resto de casos.

Base estructural: [ADR-046](../06-decisions/adr-046-panel-soporte-humano.md), aceptado 2026-07-08. Modelo de identidad de servicio desacoplada del user real (`backoffice_agent_profile` + `backoffice_agent_profile_grant` como N:N), doble columna assignment en `support_conversations` (`assigned_agent_id` auditoría + `assigned_profile_id` pública) con CHECK bi-columna, ciclo de vida ampliado con `HUMAN_HANDLING`, doble guard del bot (temprano + race post-LLM), permisos `PERM_SUPPORT_CHAT_HANDLE` / `PERM_SUPPORT_PROFILE_MANAGE`, 13 endpoints admin bajo `/api/admin/support/`.

Secuencia actual:

1. **Fase B.3.1 — backend + migración V15 + tests** — HECHO
   - Migración V15 con 2 CREATE TABLE + 6 ALTER TABLE + CHECK bi-columna. Corregida en el mismo día para respetar la restricción MySQL 8 (CHECK sobre columna con FK con acción referencial): las FKs de assignment pasan a `RESTRICT` implícito, el CHECK bi-columna se conserva.
   - Entidades / repositorios / servicios (`BackofficeAgentProfileService`, `BackofficeAgentProfileGrantService`, `SupportHumanHandlingService`) + `SupportBotService` con doble guard.
   - `SupportAdminController` con 12 endpoints admin. Permisos `PERM_SUPPORT_CHAT_HANDLE` (baseline `ROLE_SUPPORT`) y `PERM_SUPPORT_PROFILE_MANAGE` (opt-in explícito).
   - Tests: 519 total repo tras el cierre.
   - **Desplegado en TEST** con commits `287f8c2` + `acb290a` (JAR `71ccb203…` posterior tras B.3.2). AUDIT y PROD sin tocar. Migración V15 pendiente de replicar a esos dos entornos cuando el operador decida el corte.

2. **Fase B.3.2 — frontend admin: AdminSupportPanel + hooks + CRUD profiles + i18n** — HECHO
   - Container `AdminSupportPanel` con sub-tabs internas `Conversaciones` / `Profiles` (no rutas separadas) gobernadas por las capabilities `canViewSupport` (⇔ `PERM_SUPPORT_CHAT_HANDLE`) y `canManageSupportProfiles` (⇔ `PERM_SUPPORT_PROFILE_MANAGE`).
   - Hooks nuevos `useSupportPendingCount` y `useConversationPolling` con guard `document.hidden`. Extensión aditiva de `AdminLayout` con soporte opcional de `badge` en items del sidebar (`9+` a partir de 10).
   - Vistas: master-detail de conversaciones con filtros/paginación, thread completo con optimistic updates al enviar mensaje, toolbar contextual (claim/release/message/resolve) según status y ownership; tabla CRUD de profiles con expandible inline por fila para grants; modales autocontenidos para create/edit profile, add grant y claim.
   - i18n admin.support ES+EN con ~60 claves.
   - **Desplegado en TEST** con commit `794193d` (bundle admin `main.bebe34ed.js`, `b6e4437c…`). AUDIT y PROD sin tocar.
   - **Hueco detectado en deploy y cerrado el mismo día**: el sub-tab Profiles expandía grants pero el backend no exponía `GET /profiles/{profileId}/grants`. Cerrado en commit `d8d5b90` (endpoint nuevo + batch fetch de emails + 3 tests MockMvc; total repo 526 tests). Desplegado en TEST junto con B.3.2.
   - **Deuda #D-14 (Browser Notification API)**: originalmente prevista para B.3.2 según ADR-046. Diferida — no incluida en el alcance final entregado.

3. **Fase B.3.3 — surface product (renderizado del switch bot→humano en el cliente)** — PENDIENTE (opcional)
   - No forma parte del alcance mínimo del frente B.3. El backend ya devuelve `humanHandling:true` cuando la conversación está bajo claim, pero el frontend cliente (`SupportChat.jsx` de la surface product) hoy no rinde de forma diferenciada ese estado ni el mensaje SYSTEM del claim. Ajuste de UX menor; se decidirá si se hace en una sesión propia post-B.3.2.

4. **Replicación de la Fase B.3 a AUDIT y a PROD** — PENDIENTE
   - Requiere aplicar V15 en RDS AUDIT y RDS PROD (vía túnel bastion + `mysqlsh`) y desplegar el JAR `71ccb203…` + bundle admin `main.bebe34ed.js` en cada entorno. Coordinar con el resto de frentes activos según prioridad del operador.

Deudas registradas (todas en `docs/04-operations/known-debt.md` entrada 2026-07-08 y en ADR-046 sección "Deudas diferidas"): #D-13 job expiración `ESCALATED > 48h`, #D-14 Browser Notification API para agents, #D-15 playbook DPO GDPR art. 15 sobre conversaciones humanas (obligatorio pre-go-live PROD).

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