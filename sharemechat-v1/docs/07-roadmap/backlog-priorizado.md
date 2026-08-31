# Backlog priorizado — SharemeChat

> **Fuente de verdad de PRIORIDADES.** Índice único de *qué atacar y en qué orden*. Prioridad
> (1-5) + estado **verificado contra CÓDIGO FUENTE** (no docs). Si otro doc contradice esto, gana
> este y hay que actualizar el otro.
>
> **Reconciliación:** 2026-08-11, verificada contra el código por 4 pasadas (producto, economía/PSP,
> compliance/GDPR, testing/SEO). Muchos frentes que los docs listaban pendientes están **hechos**.

## Escala
| P | Significado |
|---|---|
| **P1** | Crítico/inmediato: bloquea go-live/captación, roto en PROD ahora, o fundacional de calidad. |
| **P2** | Alto: prerrequisito de apertura pública o alto impacto. |
| **P3** | Medio. **P4** Bajo. **P5** Algún día. **BLOQ** Bloqueado por terceros. |

Contexto: PROD en **PRELAUNCH**. Cuello de botella = **captación de modelos**.

---

## P1 — Crítico / fundacional
| Tarea | Estado (código) | Qué es | Evidencia |
|---|---|---|---|
| **Frente de TESTS + CI (metodología)** | 🟢 cerrado (2026-08-15) | CI (`.github/workflows/ci.yml`, `on: push`) **verde**, **3 jobs** (backend `mvnw test` + frontend `react-scripts test` + E2E Playwright/Chromium, backend mockeado). **404 unit/component + 4 E2E**; capa unit/component/integración/E2E **robusta**. Detalle en la nota ¹ (tras esta tabla). | ADR-059; `src/test/java/**` + `frontend/src/**/*.test.*` + `frontend/e2e/**`; `docs/project-log.md` 2026-08-15 |
| **Cripto (NOWPayments) — mejoras UX de pago** | 🟢 HECHO 2026-08-31 (operador) | Resuelto vía panel NOWPayments: cripto por defecto fijada a **USDC (Polygon)** (stablecoin de baja comisión y baja volatilidad), la que conviene al negocio. Sin cambio de código. | panel NOWPayments (infra, no código); `psp/` NOWPayments |
| **Verificar gaps PROD post-nivelado** | 🟢 VERIFICADO 2026-08-15 (sin gaps) | Verificado read-only vía SSH prod-backend + `aws s3 ls`: `CLAUDE_API_KEY` presente en `secrets.env`; `KYC_DIDIT_MASTER_CALLBACK_URL`=`https://sharemechat.com/master-kyc-didit/processing` presente en `config.env`; contratos en `s3://assets-sharemechat-prod/legal/` (`master_contract.pdf` 2026-08-04 + `model_contract.pdf` + manifests). Credenciales Didit (`KYC_DIDIT_API_KEY/SECRET`) también presentes. **OBSERVACIÓN**: `KYC_DIDIT_ENABLED=true` en PROD (el `false` belt-and-suspenders fue retirado de `application-prod.properties`) → Didit ON en PRELAUNCH (KYC real para onboarding Master/modelo); confirmar que es intencional. | infra (no código); SSH prod-backend + S3 |
| **Compliance: 5 políticas PSP firmadas** | 🟡 pendiente (legal) | Las 5 políticas en estado PLANIFICADO sin firma legal. Bloqueante duro de go-live. *(2257 + Records Custodian YA existen en `footer/Legal.jsx` — no re-hacer.)* | `Legal.jsx:302,1197,1271` (2257 hecho) |
| **Página pública de modelo `/m/:slug` (ADR-048)** | 🔴 no implementada (ADR **VIGENTE**) | Palanca central de captación de modelos + SEO + afiliación (ADR-048; `launch-strategy.md` §4E). **No existe la ruta `/m/` en `App.jsx`** y no estaba en ningún nivel del backlog: ADR vigente sin implementar ni archivar. Como el cuello de botella es la captación de modelos, es frente de tráfico prioritario. La construcción es un frente aparte a scopear. | ADR-048; `frontend/src/App.jsx` (sin ruta `/m/`) |
| **Reconciliar docs obsoletos** | 🟢 HECHO 2026-08-29 | Consolidación cerrada: `backlog-priorizado.md` es la **única** fuente de estado; `current-phase.md`, `pending-hardening.md` y `go-live-roadmap.md` **archivados** (stub redirector en `07-roadmap/` + contenido histórico en `_archive/07-roadmap/`), tras rescatar al backlog ~18 ítems vivos (P2–P5). | `_archive/07-roadmap/` |

> **Nota ¹ — detalle del frente de TESTS + CI.** **Backend 137**: dinero/payout, streaming, matching, trial, tramos+Pro+tarifa, Soporte bot+humano, Master completo, KYC mapeo+webhooks HMAC, Auth OAuth-linking + login federado Google, gate Product Operational Mode modo-por-rol (ADR-009: service + filter REST + WS interceptor, `resolveIsModel` fail-closed vía `UserRoleUtils.isModelOrCandidate`), webhook PSP `PspWebhookOrchestrator` (parciales cripto + crédito BFPM). **Frontend 267**: `config/http.js` `apiFetch` (mantenimiento 5xx vs gate PRELAUNCH, refresh transparente 401→retry, gates EMAIL_NOT_VERIFIED/CLIENT_KYC_REQUIRED), `SessionProvider`, registros cliente/modelo/master, `SessionHUD`, checkout polling, hooks/dominio, utils puros (`attribution`, `registerErrorMessage`, `runtimeSurface`, `backofficeAccess`, `clientKycGate`, `virtualCameraGuard`…), componentes seguridad/infra/UX (`RequireRole`, `MaintenanceProvider`, `CookieBanner`, `LocaleSwitcher`…). **E2E** (backend mockeado): `smoke` + `registro-cliente` + `login` + `checkout-primer-pago` (4 happy-paths críticos). Deuda menor: clase base común de los `IntegrationTest`. El E2E cazó el día 1 un bug de empaquetado (`process`/`buffer` sin declarar rompía el bundle con `npm ci` limpio; corregido).

## P2 — Alto
| Tarea | Estado (código) | Qué es | Evidencia |
|---|---|---|---|
| **Backfill de tests — gaps de cobertura (auditoría 2026-08-30)** | 🟡 en curso (Lotes 1-5 hechos) | Auditoría exhaustiva (5 revisores) tras el crecimiento del código: el núcleo de riesgo (dinero de salida/webhooks, gates de sesión/permiso, moderación cámara, matching backend) está cubierto y la disciplina "lo nuevo con test" se mantuvo, pero hay gaps reales sin red. **Orden**: (1) seguridad/compliance — `StorageController.canReadFile` (**IDOR** de docs KYC) ✅Lote2, `GdprExportService` (export art.15 que vacía datos en silencio), `ModelContract(Manifest)Service` ✅Lote1+2, `AuthController` (rotación/reuso refresh), `ModerationReportService` (suspend+revoca sesión) ✅Lote4, `PasswordResetService` ✅Lote2; (2) dinero de ENTRADA — `PspOrchestratorService.createCheckout` ✅Lote3, `PayoutMethodService` ✅Lote3, `PspProviderConfigService` ✅Lote1, `store()` ✅Lote1; (3) frontend `realtime/`: funciones puras `iceObserver`/`webrtcConfig` ✅Lote5; `msgSocketEngine` ✅Lote5b; pendiente `matchSocketEngine` + E2E streaming/onboarding modelo; (4) MockMvc de controllers finos. Pendiente: `GdprExportService` y `AuthController` (los 2 últimos son integración Testcontainers/MockMvc, verifica CI). | tests bajo `src/test/**`; auditoría bitácora 2026-08-30 |
| **BFPM Fase 4B-b** | 🟢 HECHO 2026-08-16 (CI verde) | Resumen admin BFPM (`GET /api/admin/audit/bfpm-summary` + tab "BFPM" del panel de auditoría) + **política de refund A** (#D-35 cerrado): el webhook PSP `REFUNDED` revierte el par BFPM por ledger real (`order=`, incluye promo); si el saldo se consumió → `REFUND_REVIEW` (revisión manual). Invariantes 4B-a intactas. Test de integración Testcontainers. Ver ADR-012. | `TransactionService.reversePackRefund`; `PspWebhookOrchestratorService.handleRefunded`; `AccountingAuditAdminController` |
| **GDPR: delete-account (art.17) + DSR self-service + aceptación versionada** | 🟡 parcial | Export art.15 admin-driven HECHO; **falta borrado de cuenta (art.17)** y DSR self-service. Versionado parcial (`ConsentEvent` append-only + `model_contract_acceptances`), falta catálogo por documento. #D-15 (DPO playbook) obligatorio pre-PROD. **Sub-frente específico**: supresión de cuenta de **modelo** = anonimizar PII en `model_contract_acceptances` conservando hecho+versión+timestamp+hash (V7 ya puso `ON DELETE RESTRICT`; falta el procedimiento). | `GdprExportService`; no hay deleteAccount; `ConsentEvent` |
| **Country-gating: WS independiente + granularidad US** | 🟡 parcial | Allowlist REST HECHA. Gaps: **el WS no se gatea por país de forma independiente** (solo transitivo vía JWT) + **sin granularidad sub-estatal US** (FSC v. Paxton). | `CountryAccessService` (solo REST, ISO-2) |
| **Endurecer superficies económicas restantes** | 🟡 parcial | Webhook NOWPayments HECHO (firma HMAC-512 + idempotencia + lock). Revisar guards de **payout review** (¿lock pesimista?) y settlement. | `PspWebhookOrchestrator`; `MasterPayoutService:95` |
| **SEO US — cluster contenido + marketing** | 🟡 parcial | Bing/GEO habilitado; blog crawleable (a href + sitemap + prerender OK). Falta **cluster US-EN + alternativeto.net + Reddit orgánico** (marketing, no código). | `BlogContent.jsx:385`; `SitemapController` |
| **Validar modos restrictivos del Operational Mode** | 🟡 pendiente | Validar operativamente PRELAUNCH/MAINTENANCE/CLOSED aplicados a login, refresh, REST y handshake WS + allowlist por userId en modo restrictivo. Prerrequisito de cierre Fase 0→1. | `ProductOperationalModeFilter`/`...WsInterceptor` |
| **Parametrización real de PROD (paridad completa)** | 🟡 pendiente | Más allá del spot-check de credenciales (P1): CORS, cookie domain, namespace Redis, paridad properties/env con AUDIT, confirmar `SIMULATION_DIRECT=false` en AUDIT/PROD. | `application-{audit,prod}.properties` + config.env |
| **Moderación IA: cerrar gaps operativos** | 🟡 parcial | Más allá de "reactivar Sightengine" (P3): attendance log de presencia en cámara, preview de `evidence_ref` en panel admin, moderación de chat (texto), workflow de quejas con SLA + trazabilidad PSP, reporting mensual + nil report, vendor CSAM dedicado (PhotoDNA/Thorn), activar Sightengine en AUDIT+PROD. | `streammoderation/`; detalle en `../_archive/07-roadmap/pending-hardening.md` Parte 4 |
| **Compliance pre-go-live: DPIA + DSA art.28 + ASACP** | 🟡 pendiente | DPIA + base jurídica del flujo biométrico (GDPR), alineación DSA art.28, valoración membresía ASACP, SLA 5 días para quejas. | detalle en `../_archive/07-roadmap/pending-hardening.md` Parte 4 |

## P3 — Medio
| Tarea | Estado | Qué es |
|---|---|---|
| **ADR-052 §D7: T&C / contrato modelo v5 (descuentos)** | 🟡 pendiente (legal) | Técnico HECHO (V38 purga afiliadas + V39 reparto nuevo, ya en código y extendido por ADR-056); queda materializar en T&C/contrato v5 la política de descuentos por chargebacks (sub-frente legal, bloqueante para exponer D9). |
| **#D-29: doc reparto 75% vs 50-60% real** | 🟡 pendiente | Doc obsoleto contamina copy fundadoras. |
| **Contratos Master v1 + Modelo v4.2 a S3 PROD + re-firma** | 🟡 pendiente | Subir PDFs/manifest + re-firma masiva. |
| **Reactivar vendor moderación (Sightengine) con cuota** | 🟢 listo, OFF | Anti-fraude cámara implementado (face-presence + frame-diff/frozen + no-face → kill). OFF por saldo free. Acción operador: plan mensual + credenciales antes de `enabled=true`. |
| **Founding Models (cohorte fundadora)** | 🔴 pendiente | Tramo 70% BD + badge `is_founder` + bypass PRELAUNCH allowlist. |
| **Contrato de códigos de error (REST/WS/front) + códigos de modo en frontend** | 🟡 pendiente | Códigos de negocio estables; dejar de usar `ex.getMessage()`/substring como copy de UI (hoy divergente REST/WS/front). Incluye UI para `PRODUCT_UNAVAILABLE`/`MAINTENANCE`/`REGISTRATION_CLOSED`/`SIMULATION_DISABLED` que el backend ya emite y el front no trata. |
| **Auth-risk: extender a login admin, refresh y forgot/reset** | 🟡 parcial | Hoy solo login de producto. Reusar `AuthRiskService`/namespace Redis en las superficies restantes + detección low-and-slow. |
| **Flyway: determinismo de migraciones (bootstrap desde cero)** | 🟡 pendiente | `V42` colisiona con `V39` si caen en el mismo segundo (`CURRENT_TIMESTAMP` en unique) → rompe montar entorno nuevo/staging/DR. CI mitigado con baseline; raíz sin resolver. Documentar riesgo + doctrina de migraciones + baseline oficial. |
| **Homogeneizar enforcement consent/compliance REST↔WS** | 🟡 pendiente | Más amplio que country-gating WS (P2): consentimiento y compliance coherentes entre REST y WebSocket. |
| **Notificación email a modelos al publicar contrato nuevo** | 🟡 pendiente | Job que detecta cambio de `currentVersion` y avisa a `acceptedEver && !acceptedCurrent`. Hoy pasivo (la modelo solo se entera al cargar el SPA). Habilitador de la re-firma masiva. |
| **Email nurture de waitlist** | 🟡 pendiente (borrador listo) | Trigger transaccional: nuevo registro cliente en PRELAUNCH → email de acceso anticipado. |
| **Age-gate: `consent_id` firmado por servidor + binding IP/TTL** | 🔴 pendiente (opcional, legal) | Integridad del **registro de consentimiento** para DSA/compliance: que el servidor emita el `consent_id` firmado (HMAC, ya hay `HmacSigner`) y que el registro exija age-gate reciente + IP coincidente. NO frena a un bot decidido (puede pedir un id válido); su valor es un log de consentimiento no falsificable. Abrir solo si legal lo pide. |

## P4 — Bajo
#D-24 packs premium · #D-26 T&C v5 (alinea ADR-052) · #D-13/#D-14 (job ESCALATED, notif API) · #D-16 (atomicidad gift WS) · #D-6/#D-1..7 (doc↔código CMS) · #12/#14/#16 GDPR (MFA, aviso saldo bajo) · **render remoto Chromium desktop** (el stage se encoge/salta en Chrome/Edge desktop; Firefox/móvil OK — plan incremental en `../_archive/07-roadmap/pending-hardening.md`) · **teclado móvil en chat ocupa toda la pantalla** (streaming y chat puro; al abrir el teclado tapa la pantalla, UX mala — pendiente tras lo importante) · **i18n: contención de hardcodes** (producto + backoffice incremental) · **centralizar catálogo de packs** (BD/endpoint dinámico) · **tabla de tramos en dashboard Master** · **CMS Frente 3 diferidos (ADR-016)** (publicación estática S3+CF, heroImageUrl/og:image, SCHEDULED, publish-now, retracción) · **equipo humano de moderación** (staff vs vendor T&S) · **plan B de PSP** (adquirente adult alternativo) · **#D-45…#D-60 (Tickets/Master)** → detalle en [`../04-operations/known-debt.md`](../04-operations/known-debt.md).

## P5 — Algún día
**Master/Studio: adapter payout real (Paxum)** — todo Master hecho salvo el rail real, hoy `NoopPayoutAdapter` manual; despriorizado por el operador · Traductor **T7** (traducir mensajes PROPIOS al idioma del peer — **no está en código**, opcional; `useMessageTranslations.js:41` salta los propios) · UX #17-21 · WAF/consolidación AWS · #15 retención chat · #D-25 xlsx · **Google login Fase 2** (Fase 1 en TEST; deploy AUDIT ~20 min; PROD gated por brand verification de Google, riesgo de rechazo para adult).

## Gated por decisión de lanzamiento del operador
| Tarea | Nota |
|---|---|
| **PSP tarjeta real (CardBilling / grupo Verotel)** | **Proveedor ya negociado** (CardBilling, grupo Verotel) → NO está bloqueado por terceros; depende de **cuándo el operador decida lanzar**. Falta construir el **adapter** (hoy solo NOWPayments cripto en código). Registry `PaymentProvider` extensible listo. Prioridad y fecha las fija el operador. |

---

## Cerrado / verificado en código (NO re-listar — corta la deriva de docs obsoletos)
- **EXIF/GPS strip en subida de imágenes** — `ImageMetadataScrubber` (Commons Imaging, lossless JPEG) en `S3/LocalStorageService.store()`. En **PROD** (566301a3, 2026-08-30), verificado **E2E** (foto real con GPS → GPS/EXIF eliminado, imagen íntegra). *Gaps abiertos: PNG/WEBP/GIF sin strip (JPEG cubre ~99% del riesgo); OWASP dependency-check no corrido (sin NVD key) — desplegado sobre verificación manual de `commons-imaging:1.0.0-alpha6` por decisión explícita del operador.*
- **Age-gate: rate-limit anti-abuso** — `ApiRateLimitService.checkConsentIp` en `/api/consent/age-gate` y `/terms` (30/5min). En **PROD** (566301a3, 2026-08-30), verificado E2E en TEST (30→429). *El age-gate es fricción + registro de consentimiento, NO barrera de contenido (esa es Didit). El `consent_id` firmado por servidor queda como P3 opcional.*
- **PROD nivelado a main** (fed5e01, V47-V51) — 2026-08-11.
- **B6 Madagascar** allowlist registro modelo (TEST+PROD) — verificado.
- **A5 Product Operational Mode** — REST (`ProductOperationalModeFilter`) + WS (`...WsInterceptor`) + frontend (`http.js`, `PreLaunchScreen`). HECHO.
- **A7 KYC modelo automatizado** — Didit webhook-driven (`KycSessionService:531`, HMAC+anti-replay), fija `verification_status` sin admin manual. HECHO. *(El "manual" es revisión de assets, otro flujo.)*
- **A9 SEO internal-linking** — FALSO positivo: `<a href>` real (`BlogContent.jsx:385`), sitemap dinámico (`SitemapController`), prerender Puppeteer. Crawleable.
- **A10 anti-fraude cámara** — Sightengine real + frame-diff/frozen/no-face → `killStreamAsAdmin`. HECHO (OFF por saldo).
- **2257 + Records Custodian** — `footer/Legal.jsx`. HECHO.
- **Gifts + efectos** (4 superficies) · **Tickets ADR-054** · **Google Sign-In** (off en PROD por flag) · **Chat Soporte LLM + panel humano ADR-046** — HECHO.
- **Master/Studio ADR-056** — registro, dashboard (tabs), split dual, invitación, suspensión HECHO (solo falta Paxum, ver P3).
- **Traductor chat P2P entrada + "ver original"** (V51) · **facturación streaming lump-sum** — HECHO.
- **ADR-052 técnico** — purga afiliadas (`V38`) + reparto nuevo `model_pricing_tiers` (`V39`), extendido por ADR-056 (régimen dual, V42+). Verificado en código 2026-08-15. *(Solo queda el T&C/contrato v5 legal, ver P3.)*

## Mantenimiento
- Al cerrar: mover a "Cerrado/verificado" con fecha + ref de código, no borrar en silencio.
- Reconciliar contra CÓDIGO (no docs) tras cada frente grande.
