# Backend deploy backlog 2026-06-22

> Análisis read-only de los 104 commits acumulados entre el backend desplegado en PROD (`b0fa773`, hace 11 días) y `origin/main` actual (`6cebf90`). Pensado como baseline antes de planificar el deploy de backend que destrabe el deploy frontend del Prompt 2 SEO.
>
> **Sin ejecuciones destructivas**. Una sola ejecución autorizada (`mvn test` sobre HEAD, tarea 3.5 del prompt).
>
> Nota de path: el prompt indicaba `docs/03-operations/`; el repo usa `docs/04-operations/` (operaciones), así que lo escribo aquí para no romper la convención existente.

## 1. Resumen ejecutivo

| Hecho | Valor |
|---|---|
| Backend PROD actual | `b0fa773` (2026-06-11, hace 11 días) |
| `origin/main` actual | `6cebf90` (2026-06-21) |
| Commits acumulados | **104** (no merges, 10 días reales del 11 al 21 de junio) |
| Ficheros tocados | 173 (`+20991 / −928`) |
| `pom.xml` | **SIN CAMBIOS** — cero bump de dependencias mayores |
| Migraciones BD | **3 nuevas** (V8, V9, V10), todas safe-online |
| Tests en HEAD | **250 OK / 0 fallos / 0 skipped** (BUILD SUCCESS, ~10s) |
| Frentes principales | Didit (KYC, **crítico para deploy**), Stream moderation/Sightengine (**inerte por flag y datos**), Auth (email gate global), SEO/blog (frontend-only), Social (docs+scripts), Ops manifests/SEO emails |

**Veredicto preliminar: REQUIERE-PREPARACIÓN, no bloqueado.** El código compila, los tests pasan, todas las migraciones son safe-online, el código nuevo de Didit y Sightengine cae a MOCK por defecto (`enabled=false` en `application.properties` + secrets vacíos), Sightengine es inerte en PROD por ausencia de datos en las tablas nuevas. La preparación requerida vive **fuera del repo**:

1. **Panel del vendor Didit en PROD**: workspace separado del sandbox, DPA firmado, workflow IDs creados, webhook destino apuntando a `https://sharemechat.com/api/kyc/didit/webhook`. Documentado en `runbooks/didit-setup.md`.
2. **`/opt/sharemechat/config.env` y `/opt/sharemechat/secrets.env` en EC2 PROD**: añadir 7 env vars Didit (no sensitive en config.env, sensitive en secrets.env). Detalle en § 3.3 + § 9.
3. Opcionalmente: añadir env vars Sightengine también (4-5 keys), pero **no son bloqueantes** porque `enabled=false` por defecto deja al adapter en MOCK; el seed del provider config en V10 ya lo deja en `active_mode='MOCK'`. Se puede desplegar primero, configurar Sightengine después.

**El deploy del JAR backend en PROD es seguro incluso sin configurar el panel Didit todavía** (modo MOCK por defecto). La razón para coordinar con el panel ANTES es operativa: queremos que el primer modelo que pase por la nueva integración en PROD vea el flujo real, no un mock.

---

## 2. Inventario de los 104 commits

### 2.1 Estadísticas

Diff agregado entre `b0fa773..6cebf90`:

```
173 files changed, 20991 insertions(+), 928 deletions(-)
```

Desglose por tipo de fichero:

| Tipo | Cantidad |
|---|---:|
| `.java` producción (no tests) | 69 |
| `.java` tests | 19 |
| Frontend (`frontend/**`) | 23 |
| `docs/` | 32 |
| Config (`application*.properties`, etc.) | 9 |
| Scripts (`*.ps1`, `*.sh`) | 5 |
| Ops otros (`ops/**` no scripts) | 12 |
| Otros | 4 |
| `pom.xml` | **0** (cero cambios de dependencias) |

### 2.2 Agrupación por frente

| Frente | Aprox. commits | Descripción |
|---|---:|---|
| **A) Didit / KYC modelo + cliente + email gate** | ~37 | Integración completa del vendor Didit + filter global EmailVerifiedFilter + cliente KYC para gating de pagos + webhook + UI gates en frontend |
| **B) Stream moderation / Sightengine (Paquete 1 — scaffolding inerte)** | 4 | Schema BD, DTOs, services, controllers admin, webhook stub, job degradation. Todo en MOCK |
| **C) SEO / blog frontend** | 7 | Fixes og:image, snapshot regen, deploy-state updates tras paso 4 SEO |
| **D) Social (Reddit + X + skills Cowork)** | 17 | Pipeline social, ADR-038-041, scripts, sync-skills, documentación. **Cero backend Java** |
| **E) Docs business / ADRs negocio** | ~9 | Estrategia SEO, modelo financiero, tiers, unit-economics, ADR-035-037 |
| **F) Ops/manifests (deploy-state refresh)** | ~22 | Commits "ops(manifest): refresh ..." intercalados tras cada feature significativa. Cero código funcional |
| **G) Ops perimeter (VEREDICTO, AUDIT scheduler, prod-access-reporter)** | 8 | F1/F2 del frente perimeter, no afecta backend Spring |
| **H) Hot-fixes Veriff (legacy)** | 3 | bff22d9, dc5a233, ce0b4fd — country gating + map status webhook |

### 2.3 Listado completo agrupado por fecha (104 entradas)

```
2026-06-11
  e0732c7 chore(ops): update prod deploy-state after paso 4 SEO deploy
  eb3afd7 fix(seo): blog og:image uses 1200x630 card (keep logo192 only for JSON-LD publisher.logo)
  94d4f8d chore(ops): update prod deploy-state after blog og:image fix deploy
  ec5e5c2 fix(seo): base index.html og:image uses 1200x630 png card for non-JS social scrapers
  1676ef8 chore(ops): update prod deploy-state after blog og:image fix deploy
  1f42e03 docs(snapshots): regenerate PROD state snapshot after SEO paso 4 + og:image deploys
  42ca78a docs(business): alinear referencias PSP CCBill->Segpay en business-model y product-overview
  f726cca docs(business): migrar perfil de sociedad, estado contable y pricing desde company-docs
  bff22d9 feat(kyc): apply country gating to Veriff session start

2026-06-12
  dc5a233 fix(kyc): include person fields only when non-empty in Veriff create-session payload
  b5b3d63 chore(ops): update test deploy-state manifest after step 5 redeploy
  21e3d24 docs(business): anadir unit-economics como marco parametrico, comision PSP pendiente Segpay
  7c54881 docs(social): registrar creacion oficial de r/SharemeChat (sub propio, +18, marca)
  0f30280 tools: anadir sync-skills-to-cowork para mantener Cowork alineado con repo
  b5a59d3 docs(social): cerrar ciclo 1 del pipeline (primer post en X) - aporte +1, sin promo

2026-06-13
  056b7e9 feat(ops): add VEREDICTO header block to prod-access-classifier
  72d3a46 feat(ops): AUDIT weekend scheduler — artefactos y bitacora, schedules en DISABLED
  ce0b4fd fix(kyc): map Veriff decision webhook code to internal kyc_status correctly
  b3154b9 chore(ops): update test deploy-state manifest after step 6 redeploy
  acb4da8 import: prod-access-reporter (no functional changes; closes drift)
  6408330 chore: mark prod-access-reporter/bin/report-prod-access.sh executable
  a40fc0e feat(ops): add VEREDICTO header to prod-access-reporter email body
  53c3036 docs(kyc): close veriff backend e2e validation in TEST (rejected + approved real)
  38a6eb7 feat(ops): add -AssumeYesNonCritical flag to update-manifest-backend.ps1
  7a0c5cc fix(users): update updated_at column on entity changes
  a062074 docs(adr): supersede ADR-029 with ADR-035 (vendor consolidation on Didit)
  d0c3539 feat(kyc): scaffold Didit client for model KYC flow with MOCK mode and replay protection

2026-06-14
  4948f61 ops(manifest): refresh test backend manifest to d0c3539 (paso 2 Didit scaffold)
  e10aa96 chore(test): close didit model kyc frontend end-to-end + clean test db evidence
  61f20a9 fix(ops): widen VEREDICTO public-route whitelist and restrict success to 200/201
  50f4770 refactor(kyc): rename model_kyc_sessions to kyc_sessions and align Java naming
  f404461 ops(manifest): refresh test backend manifest to 50f4770 (refactor V8 kyc_sessions)
  70ca63e feat(kyc): implement didit client age verification flow with shared webhook
  a1a1927 ops(manifest): refresh test backend manifest to 70ca63e (didit client v9)
  8456660 fix(kyc): allow USER+FORM_CLIENT (not CLIENT role) to start didit client kyc
  46f7949 ops(manifest): refresh test backend manifest to 8456660 (didit client matcher fix)
  7e84d02 fix(frontend): align /client-kyc route with backend USER+FORM_CLIENT permission
  6d679f1 ops(manifest): refresh test frontend_product manifest to 7e84d02 (client-kyc route fix)
  055b026 fix(kyc): allow both USER+FORM_CLIENT and CLIENT to start didit client kyc
  2edc787 ops(manifest): refresh test backend manifest to 055b026 (hot-fix #3 hasAnyRole)
  59364d5 fix(kyc): correct didit age estimation path to liveness_checks[0] in adaptive workflow
  663b25e ops(manifest): refresh test backend manifest to 59364d5 (hot-fix #4 age path)
  b88615f chore(test): close didit client kyc frontend end-to-end + clean test db evidence
  2d885cb feat(kyc): add client kyc gate for add-balance and first transactions
  ee5d641 feat(auth): add global email-verified filter, gate all user actions
  18a5c97 feat(frontend): wire email-not-verified modal globally, add persistent banner
  f64cb64 ops(manifest): refresh test backend manifest to 18a5c97 (email gate + UserDTO clientKycStatus + age verification gate)
  0a73627 ops(manifest): refresh test frontend_product manifest to f64cb64 (email gate frontend)
  8b47ab0 feat(frontend): gate add-balance and first-payment flows on client kyc, add processing page with polling
  e28bc79 ops(manifest): refresh test frontend_product manifest to 8b47ab0 (client kyc gate + processing page)
  32628d8 revert(frontend): remove duplicate email-not-verified banner, keep modal and original card warning
  a401cf3 ops(manifest): refresh test frontend_product manifest to 32628d8
  ae1d9cd revert(frontend): remove email-not-verified modal bridge, keep only inline error on failed endpoints
  7f931ce ops(manifest): refresh test frontend_product manifest to ae1d9cd
  28a50a3 fix(frontend): move email-pending-verification notice into Activar camara card
  4b85ed9 ops(manifest): refresh test frontend_product manifest to 28a50a3
  a08bf07 fix(frontend): handle 403 EMAIL_NOT_VERIFIED in VideoChatRandomUser teaser card with neutral message
  4874728 ops(manifest): refresh test frontend_product manifest to a08bf07

2026-06-15
  23b02d6 chore(test): close email gate + client kyc gate frentes end-to-end + clean smoke evidence only

2026-06-16
  d8329b4 docs(governance): formalize coding and operations conventions in CLAUDE.md
  8f98df7 docs(social): cerrar ciclo 2 del pipeline (segundo aporte en X) - aporte +1

2026-06-17
  ebbc420 fix(ops): VEREDICTO F1 — degrade ROJO 1 to nota when channel is FRONTEND/ADMIN
  bc78034 docs(moderation): record architectural stance for AI streaming moderation pipeline (ADR-036)
  5e5f81d docs(business): registrar estrategia SEO/trafico organico + tracking mensual de KPIs
  bb7918f docs(business): registrar sistema de tiers y economia de modelos + rellenar valor del tope diario gratis
  aed0c5f docs(business): registrar modelo financiero (Parte 2 del analisis SEO) + cross-refs
  6296cbb docs(business): actualizar modelo financiero anadiendo coste Sightengine
  8841c18 docs(moderation): record Sightengine as primary visual moderation vendor with phased plan strategy (ADR-037)

2026-06-18
  3f33498 feat(stream-moderation): P1.1 schema bootstrap + domain skeleton (ADR-036, ADR-037)
  cd021e9 docs(business): rellenar snapshot parcial del mes 0 (jun 2026) en tracking SEO
  dbb5274 feat(social): implementar social-thread-finder.ps1 con RSS publico + ADR-038
  da6542b fix(social): hot-fix social-thread-finder rate limit
  9042712 feat(social): implementar modo thread_comment + skills + ADR-039
  036fec2 fix(social): quitar tags XML/HTML del campo description en frontmatter de skills
  61d78c3 docs(social): ADR-040 pivote target subs adult-ecosystem
  df2a755 feat(social): schema bump ledger v0.3 + 4 subs target validados
  210c519 feat(social): script thread-finder con 4 subs target + boost keywords
  232639e feat(social): skills actualizadas con eje target_audience + hot-fix code fence
  ae11eae docs(social): README + project-log FASE 2D-2 cerrada
  45c26fa fix(social): frontmatter YAML en sharemechat-voice + acortar descriptions
  64b09f8 fix(ops): auto-detect de CoworkSkillsDir en sync-skills-to-cowork.ps1

2026-06-19
  0fc1ed8 feat(social): pipeline thread_comment sin pausa humana + ADR-041
  8a4055c chore(social): cierre FASE 2C real + ledger post-validacion + deuda minimos no validados
  772219a feat(stream-moderation): P1.2 vendor-agnostic contract + MOCK adapter + action service
  6768d43 feat(stream-moderation): P1.3 admin endpoints + webhook stub + admin panel
  3537c25 feat(kyc): expose diditEnabled in model-onboarding config endpoints, default mode to DIDIT
  0010f58 feat(frontend): wire didit kyc page for model registration, hide veriff from admin select
  6d330f5 ops(manifest): refresh test backend manifest to 0010f58 (didit model flow paso 1+2)
  664a2b3 ops(manifest): refresh test frontend_product manifest to 6d330f5
  6ee8ee5 fix(kyc): separate didit callback urls for model/client, add model processing page (closes P11)
  1446c8f ops(manifest): refresh test backend manifest to 6ee8ee5 (didit callback split)
  6343fb9 ops(manifest): refresh test frontend_product manifest to 1446c8f

2026-06-20
  8cc3517 ops(manifest): refresh test frontend_admin manifest to 6343fb9 (catch-up 15 dias drift)
  d84997d ops(deploy): make -Surface optional in deploy-frontend.ps1 with default 'both'
  74125b9 fix(frontend): ramify model dashboard by verification state + admin promote-to-model
  1e4cf94 chore(test): close didit model integration frente end-to-end, project-log update
  fb8744e feat(matching): gate websocket client matching by client_kyc_status, close with CLIENT_KYC_REQUIRED
  8acab56 feat(frontend): gate camera activation by client_kyc_status, handle ws close-code 4030
  c8e0f00 chore(test): close gate kyc videochat trial sub-frente
  3680f2f feat(kyc): harden didit webhook idempotency with defensive catch, event_id null hashing
  5419c80 chore(test): close didit webhook idempotency frente (P1)

2026-06-21
  e49a6a1 feat(admin+kyc): didit in audit + p15 emails + model dashboard ux refresh + repeat review action
  7cfac4a chore(test): nivelar TEST a HEAD del megafrente audit (e49a6a1) + cierre P21 en TEST
  6cebf90 feat(stream-moderation): P1.4 tests + close Paquete 1 (ADR-036, ADR-037)
```

---

## 3. Frente Didit — análisis detallado

### 3.1 Código nuevo

**Java producción** (modificados [M], nuevos [A], renombrados [R067], borrados [D]):

```
A  config/DiditProperties.java                              (@ConfigurationProperties prefix=kyc.didit)
M  controller/KycConfigController.java                      (expone diditEnabled)
M  controller/KycProviderController.java                    (4 endpoints didit nuevos)
M  controller/ModelKycController.java                       (entrypoint + me + crear + delete + ramify)
A  dto/DiditCreateSessionResult.java
A  dto/LatestKycSessionDTO.java
M  dto/UserDTO.java                                         (+ clientKycStatus)
R067 entity/ModelKycSession.java → entity/KycSession.java   (rename, alineado con V8)
A  exception/ClientKycRequiredException.java
A  repository/KycSessionRepository.java
D  repository/ModelKycSessionRepository.java                (sustituida)
A  security/EmailVerifiedFilter.java                        (filter global)
A  service/ClientKycGate.java                               (gate de transactions)
A  service/DiditClient.java                                 (interfaz)
A  service/DiditClientImpl.java                             (implementación HTTP)
M  service/KycProviderConfigService.java
A  service/KycSessionService.java                           (orquestador, procesa webhooks)
D  service/ModelKycSessionService.java                      (sustituida)
M  service/VeriffClient.java
M  service/VeriffClientImpl.java
M  service/ProductOperationalModeService.java               (whitelist didit webhooks en PRELAUNCH)
```

**Package nuevo**: `com.sharemechat.kyc.*` NO — la convención del proyecto es flat: `controller/`, `service/`, `repository/`, `dto/`, `entity/`. Didit vive en esos packages compartidos con Veriff.

**Frontend nuevo**:
- `pages/subpages/ClientKycDiditPage.jsx`, `ClientKycProcessingPage.jsx`
- `pages/subpages/ModelKycDiditPage.jsx`, `ModelKycDiditProcessingPage.jsx`
- `utils/clientKycGate.js`
- `components/EmailNotVerifiedModalBridge.jsx` [D] (eliminado en revert ae1d9cd)

**Tests** (7 nuevos):
- `controller/KycProviderControllerLatestSessionTest.java`
- `security/EmailVerifiedFilterTest.java`
- `service/ClientKycGateTest.java`
- `service/CountryAccessServiceModelKycTest.java`
- `service/DiditClientImplTest.java`
- `service/KycProviderConfigServiceTest.java`
- `service/KycSessionServiceDiditTest.java`
- `service/KycSessionServiceMappingTest.java`
- `service/KycSessionServiceProcessWebhookTest.java`
- `service/VeriffClientImplTest.java` [M]

### 3.2 Migraciones BD

| Migración | Tipo | Operaciones | Tabla afectada | Bloqueante en PROD | Hash |
|---|---|---|---|---|---|
| `V8__rename_model_kyc_sessions_to_kyc_sessions.sql` | DDL | `RENAME TABLE model_kyc_sessions TO kyc_sessions` | `model_kyc_sessions` | **No** — metadata change atómico en MySQL/Aurora, instantáneo | 50f4770 |
| `V9__add_client_kyc_fields.sql` | DDL + DML no-op | 4× `ALTER TABLE ADD COLUMN` (DEFAULTS), 1× `UPDATE WHERE provider IN (...)` (no-op en PROD: no hay filas DIDIT aún), 1× `CREATE INDEX` | `kyc_sessions`, `users` | **No** — `ADD COLUMN` con DEFAULT es instantáneo en MySQL 8.0+/Aurora InnoDB; CREATE INDEX online sobre tablas pequeñas | 70ca63e |
| `V10__add_stream_moderation_schema.sql` | DDL + INSERT seed | 5× `CREATE TABLE` (stream_moderation_*), 1× `INSERT` seed `provider_config` | tablas nuevas | **No** — tablas nuevas vacías, cero impacto en tráfico existente | 3f33498 |

**Veredicto migraciones**: las 3 son **safe-online** en RDS Aurora MySQL. Cero ventana de mantenimiento requerida. Tiempo de ejecución estimado: < 5 segundos las 3 juntas.

### 3.3 Propiedades requeridas en `.env` / properties

Backend usa `@ConfigurationProperties(prefix = "kyc.didit")` en [`DiditProperties.java`](sharemechat-v1/src/main/java/com/sharemechat/config/DiditProperties.java). El binding relajado de Spring mapea env vars `KYC_DIDIT_*` a esas properties.

| Clave property | Tipo | En `application.properties` (default) | En `application-test.properties` | En `application-audit.properties` | En `application-prod.properties` |
|---|---|---|---|---|---|
| `kyc.didit.enabled` | flag | `false` | (heredado) | (heredado) | (heredado) |
| `kyc.didit.base-url` | URL | `https://verification.didit.me` | (heredado) | (heredado) | (heredado) |
| `kyc.didit.callback-url` | URL | (vacío) | `https://test.sharemechat.com/api/kyc/didit/webhook` | `https://audit.sharemechat.com/api/kyc/didit/webhook` | `https://sharemechat.com/api/kyc/didit/webhook` |
| `kyc.didit.model-callback-url` | URL | (vacío, fallback a callback-url) | (heredado) | (heredado) | (heredado) |
| `kyc.didit.client-callback-url` | URL | (vacío, fallback a callback-url) | (heredado) | (heredado) | (heredado) |
| `kyc.didit.api-key` | **secret** | (vacío) | (vía `KYC_DIDIT_API_KEY` en EC2) | (vía env EC2) | **PENDIENTE PROD .env** |
| `kyc.didit.api-secret` | **secret** | (vacío) | (vía env EC2) | (vía env EC2) | **PENDIENTE PROD .env** |
| `kyc.didit.model-workflow-id` | ID UUID | (vacío) | (vía `KYC_DIDIT_MODEL_WORKFLOW_ID` en EC2) | (vía env EC2) | **PENDIENTE PROD .env** |
| `kyc.didit.client-workflow-id` | ID UUID | (vacío) | (vía `KYC_DIDIT_CLIENT_WORKFLOW_ID` en EC2) | (vía env EC2) | **PENDIENTE PROD .env** |
| `kyc.didit.vendor-data-prefix` | string | `smc` | (heredado) | (heredado) | (heredado) |

**Comportamiento si las env vars secrets están vacías** (= deploy a PROD sin configurar Didit): `DiditClientImpl` cae a MOCK (devuelve `didt_mock_<uuid>` sin llamar a la API real). **Cero daño**. Comportamiento idéntico al Veriff actual cuando `kyc.veriff.api-key` está vacío.

Adicionalmente Sightengine añade su propio bloque, pero como **no es crítico para deploy**:

| Clave property | Default base | PROD pendiente |
|---|---|---|
| `moderation.sightengine.enabled` | `false` | sin tocar (queda en false) |
| `moderation.sightengine.base-url` | `https://api.sightengine.com` | (heredado) |
| `moderation.sightengine.callback-url` | (vacío) | `https://sharemechat.com/api/webhooks/moderation/sightengine` (YA presente en `application-prod.properties`) |
| `moderation.sightengine.api-user` | (vacío) | opcional (modo MOCK por defecto) |
| `moderation.sightengine.api-secret` | (vacío) | opcional |
| `moderation.sightengine.workflow-id` | (vacío) | opcional |
| `moderation.sightengine.webhook-secret` | (vacío) | opcional |
| `moderation.sampling.cadence-seconds` | `15` | (heredado) |
| `moderation.failure.degraded-threshold-minutes` | `2` | (heredado) |
| `moderation.failure.cut-threshold-minutes` | `5` | (heredado) |

### 3.4 Webhooks y endpoints públicos

| Path | Método | Auth | Validación | Fichero |
|---|---|---|---|---|
| `/api/kyc/didit/model/start` | POST | `hasRole("USER")` | session-scoped, body parseado por DTO | `KycProviderController:129` |
| `/api/kyc/didit/client/start` | POST | `hasAnyRole("USER", "CLIENT")` (commit 055b026) | session-scoped | `KycProviderController:149` |
| `/api/kyc/didit/webhook` | POST | **permitAll** | HMAC-SHA256 sobre raw body con `kyc.didit.api-secret` (= `secret_shared_key` del destino webhook en Didit) | `KycProviderController:176` |
| `/api/kyc/sessions/me/latest` | GET | autenticado | — | `KycProviderController:43` |
| `/api/webhooks/moderation/{vendor}` | POST | **permitAll** | HMAC vendor-específico (Sightengine "Standard" mode) | `StreamModerationWebhookController:57` |
| `/api/admin/stream-moderation/*` (10 endpoints) | GET/POST | `hasRole("ADMIN")` | — | `StreamModerationAdminController` |

### 3.5 Configuración pendiente en el panel del vendor Didit para PROD

Esto NO se puede ejecutar desde el repo; queda **constancia explícita** de lo que el operador debe verificar en `https://app.didit.me` (panel admin Didit) ANTES del deploy del JAR a PROD para que el flujo real funcione. Si el panel no está configurado pero el JAR se despliega, el flujo cae a MOCK (no rompe nada, pero modelos nuevas verán flujo mockeado en lugar de KYC real — no deseable).

Detalle completo en [`runbooks/didit-setup.md`](sharemechat-v1/docs/04-operations/runbooks/didit-setup.md). Resumen:

- **Workspace producción separado del sandbox** (TEST y AUDIT comparten sandbox; PROD requiere workspace PROD propio + DPA firmado con Didit, contacto `hello@didit.me`).
- **API key del workspace PROD** (cabecera `x-api-key` en POST `/v3/session/`). Distinta de la del sandbox.
- **Secret shared key del destino webhook PROD** (cabecera HMAC-SHA256 de webhooks ENTRANTES; distinta del api-key y scoped por destino).
- **Workflow ID modelo** (KYC documental: Document + Selfie + Liveness).
- **Workflow ID cliente** (Adaptive Age Verification con step-up documental).
- **Destino webhook PROD** apuntando a `https://sharemechat.com/api/kyc/didit/webhook` (URL ya configurada en `application-prod.properties` línea 32, con commit ee5d641).

Los workflow IDs y las callback URLs pueden ser **distintas para modelo y cliente**. Hoy el código soporta ambos casos (`model-callback-url`, `client-callback-url`).

### 3.6 Smoke test / E2E para validar post-deploy

**No hay smoke test E2E automatizado** para Didit. Búsqueda en `ops/scripts/` por `didit` → cero resultados. La validación E2E se hace **manualmente** según el runbook `didit-setup.md` § 4-6 (flujo de modelo + flujo de cliente real con cuenta de prueba que pase un documento real, sea aprobado por Didit y vuelva al sistema vía webhook).

**[PENDIENTE]**: crear `ops/scripts/smoke-didit-prod.sh` o equivalente que al menos verifique:
- Endpoint `/api/kyc/didit/webhook` responde 401/403 ante body sin firma válida (no 500).
- Endpoint `/api/kyc/didit/model/start` responde 401 sin auth (no 500 ni 503).
- Tabla `kyc_sessions` tiene columna `session_type` (la migración V9 corrió).

Tests Java (sustituyen parcialmente): 250 tests en HEAD que pasan al 100%, incluyendo 7 nuevos de Didit. No es E2E pero cubre el comportamiento interno del cliente Didit y del procesador de webhooks.

---

## 4. Frente Sightengine — verificación de estado inerte

**Veredicto: SÍ, INERTE en PROD si se despliega**, con argumentos:

### 4.1 Sin endpoint público que dispare moderación

No hay endpoint público que un cliente externo pueda llamar para disparar moderación en vivo. Los endpoints son admin (`/api/admin/stream-moderation/*`, hasRole ADMIN) o webhook entrante del vendor (`/api/webhooks/moderation/*`, permitAll pero validación HMAC).

### 4.2 Scheduler existe pero es no-op en PROD

Hay UN `@Scheduled` introducido en este lote:

```java
// StreamModerationDegradationJob.java:38
@Scheduled(cron = "0 * * * * *")
public void cutDegradedSessions() {
    int cut = sessionService.cutDegradedSessions(failureProperties.getCutThresholdMinutes());
    if (cut > 0) { log.info(...); }
}
```

Este job se ejecuta **cada minuto en PROD si lo desplegamos**. Lógica: identifica sesiones en estado `DEGRADED` cuyo `degraded_since` supera el threshold de corte (5 min default) y las cierra.

**En PROD, tras el deploy, `stream_moderation_sessions` está VACÍA** (la migración V10 solo inserta seed en `stream_moderation_provider_config`, no en `_sessions`). Por tanto `cutDegradedSessions` devuelve 0 cada minuto y no hace nada visible (ni siquiera log). Cero llamadas a vendor externo. Cero impacto.

Para que se cree una fila en `stream_moderation_sessions` haría falta que el código capturara frames de un stream activo y llamara al vendor — pero eso requiere `active_mode != 'MOCK'`, `enabled=true`, credenciales reales y un stream WebRTC activo siendo muestreado por captura cliente-side. Nada de eso existe en PROD hoy. **Cadena bloqueada en el primer eslabón**.

### 4.3 Sin listener WebRTC / WebSocket conectado al flujo

Búsqueda manual: no hay `@MessageMapping`, `@EventListener` ni adapter al flujo WebRTC actual desde el package `streammoderation/`. La captura de frames (cliente-side, según ADR-036) no está implementada todavía (es Paquete 2+).

### 4.4 Feature flag `moderation.sightengine.enabled=false` por defecto

```
application.properties:415  moderation.sightengine.enabled=false
```

No se sobreescribe en ningún `application-{test,audit,prod}.properties`. Por tanto en PROD `enabled=false`. El cliente Sightengine cae a MOCK incluso si las credenciales estuvieran configuradas.

### 4.5 Adapter activo es `MockModerationClient`

V10 inserta seed `('STREAM_VISUAL_MODERATION', 'MOCK', TRUE, ...)` en `stream_moderation_provider_config`. El service `StreamModerationProviderConfigService` consulta ese registro al inicio y enruta a `MockModerationClient` (no a `SightengineClient`, que ni existe todavía en este paquete P1; el adapter Sightengine se introduce en P2 según ADR-037).

### 4.6 Webhook entrante de Sightengine: stub controlado

El controller `StreamModerationWebhookController` acepta `POST /api/webhooks/moderation/{vendor}` pero el endpoint:
- Verifica HMAC con `moderation.sightengine.webhook-secret` (vacío en PROD → cualquier petición falla validación con log `[STREAM-MOD] webhook secret not configured vendor=SIGHTENGINE`).
- Si la firma fuera válida (escenario hipotético), el código actual es **stub**: persiste el evento crudo y loga "P1.3 stub, parser pending P2 adapter". No actúa sobre streams.

### 4.7 Conclusión

Aunque el código compile y registre componentes Spring, **NO se ejecuta lógica de moderación real en PROD**. El sistema queda en un estado "scaffolding desplegado, esperando configuración deliberada en P2/P3 para activarse". Coherente con [ADR-037](sharemechat-v1/docs/06-decisions/adr-037-moderation-visual-vendor-sightengine.md) (plan A vendor visual con fases).

**El despliegue NO requiere acción operativa adicional para Sightengine**. Se puede configurar más adelante sin urgencia.

---

## 5. Otros frentes detectados

### 5.1 Segpay / PSP

**Cero commits backend**. Los únicos resultados al filtrar por `segpay|psp|payout|payment` son docs/business: `42ca78a` (alinear referencias CCBill→Segpay en business-model) y `21e3d24` (unit-economics con comisión PSP pendiente Segpay). Sin endpoint, sin migración, sin codigo. No afecta deploy.

### 5.2 Reddit / X / social

**Cero commits backend Java**. Todo el frente social vive en `docs/social/`, `docs/cms/skills/`, `ops/scripts/social-thread-finder.ps1`, `ops/scripts/sync-skills-to-cowork.ps1` y la cadena de ADRs 038-041. Sin impacto en deploy.

### 5.3 Auth flows (email gate)

**Frente acoplado al frente Didit cliente**. Commits:
- `ee5d641 feat(auth): add global email-verified filter, gate all user actions`
- `18a5c97 feat(frontend): wire email-not-verified modal globally`
- `32628d8`, `ae1d9cd`, `28a50a3`, `a08bf07` reverts + ajustes UX inline

**Impacto**: añade `security/EmailVerifiedFilter.java` (nuevo). Cualquier petición autenticada de un user con `emailVerified=false` recibe 403 `EMAIL_NOT_VERIFIED` desde el filter. Frontend tiene `getApiErrorReason()` y muestra mensajes contextuales en lugar de UI rota.

Riesgo de deploy: **media-baja**. Si en PROD hay users con `emailVerified=false` (probablemente la mayoría, dado que el sistema es nuevo y el operador verifica manualmente), tras el deploy todos verán 403 al intentar cualquier acción. Mitigación: el frontend nuevo ya maneja el 403. **Pero el frontend NO se ha desplegado todavía**, por lo que tras desplegar SOLO el backend, los usuarios con email no verificado verán pantallas con errores genéricos hasta el deploy del frontend. Esto es coherente con la secuencia "backend antes que frontend" que el drift check exige.

[propuesta] Comprobar antes del deploy cuántos users tienen `emailVerified=false` en PROD. Si son pocos (< 10), enviar verification emails antes del deploy. Si son muchos, comunicar antes.

### 5.4 Blog / CMS / SEO backend

**Cero commits backend Java**. Los 5 commits SEO (`eb3afd7`, `94d4f8d`, `ec5e5c2`, `1676ef8`, `1f42e03`) son solo frontend (og:image en `BlogContent.jsx`, `BlogArticleView.jsx`, `index.html`) + `ops/deploy-state` updates. Backend `SitemapController` intacto. No afecta deploy.

### 5.5 Seguridad / vulnerabilidades / CVE

**Cero commits**. Búsqueda por `security|vuln|cve|rate.?limit` (excluyendo los `security/EmailVerifiedFilter.java` ya cubierto en § 5.3) → solo aparece `feat(auth): add global email-verified filter`. Sin parches de seguridad ni rate-limit nuevos.

### 5.6 Dependencias / Java version / pom.xml

**`pom.xml` NO MODIFICADO**. `git diff b0fa773..6cebf90 -- "**/pom.xml"` retorna vacío. Cero bump de Spring Boot, Java, MySQL connector, etc. Cero riesgo de incompatibilidad por bibliotecas.

### 5.7 Configuración perimeter / VEREDICTO

Commits `056b7e9`, `61f20a9`, `ebbc420`, `a40fc0e`, `acb4da8`, `6408330`: mejoras al perimeter pipeline (`prod-access-classifier`, `prod-access-reporter`, F1 channel-aware degrade). Todo vive en `ops/prod-access-*` o `ops/scripts/`, NO en backend Spring. No afecta deploy del JAR.

### 5.8 AUDIT weekend scheduler

`72d3a46`: artefactos del scheduler de fin de semana para AUDIT (cron Lambda que apaga/enciende EC2 los fines de semana). Vive en `ops/audit-scheduler/`. No afecta backend Spring ni PROD.

### 5.9 Ops manifests

22+ commits "ops(manifest): refresh ..." actualizan ficheros bajo `ops/deploy-state/`. Es housekeeping post-deploy. No afecta funcionalidad.

---

## 6. Cambios en APIs públicas que el frontend consume

### 6.1 DTOs públicos tocados

```
A  dto/LatestKycSessionDTO.java                              [nuevo, retrocompatible]
M  dto/UserDTO.java                                          [+1 campo: clientKycStatus]
A  streammoderation/dto/StreamModerationConfigDTO.java       [nuevo, solo admin]
A  streammoderation/dto/StreamModerationEventDTO.java        [nuevo, solo admin]
A  streammoderation/dto/StreamModerationReviewDetailDTO.java [nuevo, solo admin]
A  streammoderation/dto/StreamModerationReviewListItemDTO.java [nuevo, solo admin]
A  streammoderation/dto/StreamModerationSessionDetailDTO.java [nuevo, solo admin]
A  streammoderation/dto/StreamModerationSessionListItemDTO.java [nuevo, solo admin]
A  streammoderation/dto/StreamModerationStatsDTO.java        [nuevo, solo admin]
```

**`UserDTO` diff resumido**:

```java
+    private String clientKycStatus;          // V9
+    public String getClientKycStatus() { ... }
+    public void setClientKycStatus(...) { ... }
```

**Único cambio**: añadido campo `clientKycStatus` (String) y su getter/setter. Resto del DTO intacto.

### 6.2 `ProductOperationalModeService` cambios

Añade 2 paths a la whitelist de webhooks que se permiten incluso en `PRODUCT_ACCESS_MODE=PRELAUNCH`:

```java
+ if (path.equals("/api/kyc/didit/webhook")) return true;
+ if (path.equals("/api/kyc/didit/client/start")) return true;
```

### 6.3 Veredicto de compatibilidad backwards

**Backend nuevo + frontend viejo (`b0fa773`)**: **SEGURO**. El frontend viejo no lee `clientKycStatus` (lo ignora). El frontend viejo no llama a `/api/kyc/didit/*` (no existe en el bundle viejo). Los nuevos endpoints son inertes desde el punto de vista del frontend viejo. El email gate es transversal: cualquier acción autenticada de user con `emailVerified=false` recibe 403, lo cual el frontend viejo no maneja con mensaje contextual (verá un error genérico, pero no rompe). Aceptable durante la ventana corta hasta el deploy del frontend.

**Frontend nuevo + backend viejo (`b0fa773`)**: **ROMPE**. El frontend nuevo asume `clientKycStatus` en `UserDTO` para gatear `add-balance` y `first-payment`. Si recibe `null`, su `clientKycGate.js` lo trata como "no aprobado" y bloquea el flujo en pantallas que ya no existen en el backend viejo. Pero esto es exactamente lo que el drift check protege: **NO desplegar frontend antes que backend**.

**Secuencia segura del deploy compuesto**:
1. Migrar BD (V8, V9, V10).
2. Desplegar JAR backend (`6cebf90`).
3. Smoke backend.
4. Desplegar frontend (con marker SEO del Prompt 2 + bundles nuevos).
5. Smoke frontend completo.
6. Pre-render del blog (paso 4.5/N del Prompt 2 — habilitado por el drift check pasando).

---

## 7. ADRs introducidos / modificados

| ADR | Estado | Título | Resumen |
|---|---|---|---|
| ADR-029 | [MOD] | Age and identity verification architecture | Supersedido parcial por ADR-035 |
| ADR-035 | [NUEVO] | Age and identity verification vendor consolidation on Didit | Vendor único Plan A. Veriff dormido como contingencia |
| ADR-036 | [NUEVO] | Moderation pipeline architectural stance | Captura cliente-side + fail-closed-soft + multi-vendor capable |
| ADR-037 | [NUEVO] | Moderation visual vendor Sightengine | Plan A vendor visual con fases P1-P4 |
| ADR-038 | [NUEVO] | Social Reddit warmup RSS not OAuth | Cero impacto backend (social) |
| ADR-039 | [NUEVO] | Pipeline social modo thread_comment | Cero impacto backend (social) |
| ADR-040 | [NUEVO] | Pivote target subs social-ops adult-ecosystem | Cero impacto backend (social) |
| ADR-041 | [NUEVO] | Social pipeline sin pausa humana | Cero impacto backend (social) |

ADRs SEO (042 si existiera) NO se han creado. Los hot-fixes SEO de este lote (og:image fixes) son sub-pasadas dentro de los ADRs 020/022 existentes.

---

## 8. Estado de tests + compilación en HEAD (6cebf90)

Ejecutado en esta sesión (única ejecución de `mvn test` autorizada por el prompt):

```
[INFO] Results:
[INFO] Tests run: 250, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time:  10.492 s
```

**Veredicto**: HEAD compila limpio. **250 tests pasan al 100%**. Cero failures, cero errors, cero skipped. Ningún test cae por bugs de Didit, Sightengine, EmailGate, etc. El código está **deployable desde el punto de vista de compilación + tests**.

Logs durante los tests muestran warnings esperables (políticas de seguridad activas, mocks de webhooks con secrets vacíos, etc.); ninguno indica regresión.

---

## 9. Checklist humana ANTES del deploy a PROD

Cosas que el OPERADOR (no la IA) debe verificar/configurar fuera del repo:

### Backups y snapshots
- [ ] Snapshot RDS Aurora PROD ANTES de ejecutar las 3 migraciones (rollback en caso fatal).
- [ ] Backup del JAR actual en `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar` → `.jar.bak-2026-06-22-pre-didit-deploy` (rollback rápido).

### Panel Didit PROD (paso 2 del runbook `didit-setup.md`)
- [ ] Workspace PROD creado en `https://app.didit.me` (NO el sandbox).
- [ ] DPA firmado con Didit (contacto `hello@didit.me`).
- [ ] **API key del workspace PROD** capturada (cadena alfanumérica, `x-api-key` para POST `/v3/session/`).
- [ ] **Workflow ID modelo** PROD creado (Document + Selfie + Liveness) y UUID anotado.
- [ ] **Workflow ID cliente** PROD creado (Adaptive Age Verification) y UUID anotado.
- [ ] **Destino webhook PROD** creado apuntando a `https://sharemechat.com/api/kyc/didit/webhook`.
- [ ] **Secret shared key del destino webhook** PROD capturado (cadena distinta del api-key).
- [ ] (Opcional) Lista de IPs de Didit añadida al WAF/security group si la consola lo expone.

### EC2 PROD `/opt/sharemechat/config.env` (NO sensitive)
- [ ] `KYC_DIDIT_BASE_URL=https://verification.didit.me` presente (probablemente ya por default).
- [ ] `KYC_DIDIT_MODEL_CALLBACK_URL=https://sharemechat.com/api/kyc/didit/webhook` (override por flujo si se quiere distinto).
- [ ] `KYC_DIDIT_CLIENT_CALLBACK_URL=https://sharemechat.com/api/kyc/didit/webhook` (idem).
- [ ] `KYC_DIDIT_MODEL_WORKFLOW_ID=<uuid PROD modelo>` (NO el del sandbox).
- [ ] `KYC_DIDIT_CLIENT_WORKFLOW_ID=<uuid PROD cliente>` (NO el del sandbox).

### EC2 PROD `/opt/sharemechat/secrets.env` (perms 0600 root:root, sensitive)
- [ ] `KYC_DIDIT_API_KEY=<api key del workspace PROD>` (NO la del sandbox).
- [ ] `KYC_DIDIT_API_SECRET=<secret_shared_key del destino webhook PROD>`.
- [ ] `chmod 0600` y `chown root:root` en el fichero confirmado tras editar.

### Sistema operativo
- [ ] `systemctl daemon-reload` y `systemctl restart sharemechat-prod.service` planeado en el orden correcto del deploy.

### Comunicación / observación
- [ ] Revisar nº de users con `emailVerified=false` en PROD; comunicar si > 10 (§ 5.3).
- [ ] Lista de testers humanos disponibles para validación E2E post-deploy (1 modelo real + 1 cliente real con documento real).

### Opcional / no bloqueante
- [ ] (Sightengine) si se quiere activar más adelante: workspace, workflow consolidado, api-user + api-secret + webhook-secret → posteriores. **No bloqueante para este deploy**.

---

## 10. Plan de deploy propuesto

Asumiendo checklist § 9 al 100%. Tiempos estimados realistas:

| Paso | Acción | Comando / referencia | Tiempo |
|---|---|---|---|
| 1 | Confirmar checklist § 9 al 100% | (humano) | n/a |
| 2 | Snapshot RDS Aurora PROD pre-deploy | `aws rds create-db-cluster-snapshot --db-cluster-identifier <prod> --db-cluster-snapshot-identifier sharemechat-prod-pre-didit-$(date +%Y%m%d-%H%M)` | 5-15 min |
| 3 | Tunnel a RDS PROD | `ops/scripts/tunnel-rds.ps1 prod` | 1 min |
| 4 | Verificar versión Flyway actual y migraciones pendientes | `mysqlsh ... 'SELECT version, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;'` | 1 min |
| 5 | SCP del JAR HEAD a EC2 PROD + backup del JAR actual | `scp target/sharemechat-v1-0.0.1-SNAPSHOT.jar prod-backend:/home/ec2-user/sharemechat-v1/.../sharemechat-v1-0.0.1-SNAPSHOT.jar.new` + `mv` con backup `.bak-<fecha>` | 3-5 min |
| 6 | Editar `/opt/sharemechat/config.env` y `/opt/sharemechat/secrets.env` (paso 3.2 del runbook didit-setup) | SSH manual, paste con heredoc para no dejar trazas | 5 min |
| 7 | `systemctl daemon-reload` (no esperado pero defensivo) | `sudo systemctl daemon-reload` | <1s |
| 8 | Reiniciar backend → Flyway aplica V8, V9, V10 al arrancar | `sudo systemctl restart sharemechat-prod.service` | 30-60s |
| 9 | Smoke health backend | `curl -fsS https://sharemechat.com/api/users/me -H "Authorization: Bearer ..." || curl -fsS https://sharemechat.com/actuator/health` (según endpoint disponible) | 1 min |
| 10 | Verificar migraciones aplicadas | `SELECT version, installed_on FROM flyway_schema_history WHERE version IN ('8','9','10')` (las 3 deben aparecer) | 1 min |
| 11 | Smoke endpoints Didit (sin call real al vendor) | `curl -sI https://sharemechat.com/api/kyc/didit/webhook -X POST` debe responder 4xx no 5xx; `curl -sI https://sharemechat.com/api/kyc/didit/model/start -X POST` debe responder 401 no 5xx | 2 min |
| 12 | Smoke perimeter (CER funcionando) | `curl -sI https://sharemechat.com/blog/es` debe seguir devolviendo 200 (shell SPA, vía CER) | 1 min |
| 13 | Update manifest backend | `ops/scripts/update-manifest-backend.ps1 -Environment prod` | 30s |
| 14 | Git commit + push del manifest | `git add ops/deploy-state/prod.yaml && git commit && git push` | 1 min |
| 15 | Validación E2E Didit modelo real (humano con documento) | Runbook didit-setup §4-5 | 10-15 min |
| 16 | Validación E2E Didit cliente real (humano con documento) | Runbook didit-setup §6 | 10-15 min |
| 17 | Re-intentar deploy frontend del Prompt 2 SEO | `ops/scripts/deploy-frontend.ps1 prod product -AssumeYesNonCritical` (drift check debe pasar ahora) | 6-10 min |
| 18 | Verificación SEO post pre-render (curl + GSC URL Inspection) | Como en Prompt 2 PARTE C4 | 5 min |

**Total estimado**: 60-90 minutos de operación supervisada + 5-15 minutos de snapshot RDS asíncrono.

---

## 11. Riesgos detectados que requieren decisión explícita del operador

### R1 — Email gate global afecta a TODOS los users con `emailVerified=false`
- **Severidad**: media.
- Tras el deploy, cualquier user con `emailVerified=false` recibe 403 al intentar cualquier acción autenticada.
- Frontend nuevo lo maneja gracefully, **pero el frontend nuevo aún no estará desplegado** en el momento del deploy backend.
- **Decisión**: verificar nº de afectados; si pocos, enviar verification emails antes; si muchos, comunicar y/o coordinar deploy backend+frontend muy cercano en el tiempo.

### R2 — Secuencia obligatoria backend → frontend (no se puede invertir)
- **Severidad**: alta si se invierte.
- `UserDTO.clientKycStatus` (nuevo) y los endpoints `/api/kyc/didit/*` (nuevos) son requeridos por el frontend nuevo.
- **Decisión**: respetar la secuencia. El drift check del deploy frontend bloqueará si se invierte, así que está protegido por design.

### R3 — Configuración Didit PROD incompleta al momento del deploy
- **Severidad**: media-baja (no rompe, degrada).
- Si el panel Didit PROD no está listo, el backend cae a MOCK silenciosamente. Modelos nuevas que pasen por KYC verán flujo mockeado en lugar de Didit real.
- **Decisión**: confirmar checklist § 9 al 100% antes del deploy. Si Didit panel no está listo, **NO desplegar todavía**: esperar a tener todo.

### R4 — Migraciones V8/V9/V10 en RDS Aurora PROD
- **Severidad**: baja (todas son safe-online).
- V8 RENAME: instantáneo. V9 ADD COLUMN con DEFAULT: instantáneo en MySQL 8/Aurora. V10 CREATE TABLE: cero impacto en tráfico.
- **Decisión**: no requiere ventana de mantenimiento. Confirmar.

### R5 — Sightengine despliega scaffolding inerte
- **Severidad**: prácticamente cero.
- 19 clases Java + 5 tablas BD + 1 job @Scheduled. Todo en MOCK por flag + por seed BD + por datos vacíos.
- **Decisión**: aceptable. Si el operador prefiere posponer Sightengine hasta su frente P2 dedicado, no es trivial dropear esos commits (mezclados con otros frentes). Más limpio aceptar el scaffolding inerte y configurarlo en P2.

### R6 — `pom.xml` sin cambios pero JAR distinto
- **Severidad**: prácticamente cero.
- Cero bump de dependencias. Mismo Spring Boot, mismo connector MySQL, mismo Java target. JAR del HEAD es estructuralmente compatible con el de hace 11 días.

### R7 — Backend desplegado hace 11 días: posible deuda operativa fuera de este análisis
- **Severidad**: a investigar.
- ¿Por qué el backend lleva 11 días sin desplegar? ¿Hay deuda operativa (snapshots desfasados, monitoring roto, etc.) que se ha acumulado en esa ventana?
- **Decisión**: el operador puede querer revisar `docs/04-operations/known-debt.md` y `docs/_snapshots/state-prod-*` antes del deploy para no perderse otra deuda ortogonal.

---

## 12. Rollback plan si el deploy falla

### Rollback del JAR backend
```
ssh prod-backend
cd /home/ec2-user/sharemechat-v1
mv sharemechat-v1-0.0.1-SNAPSHOT.jar sharemechat-v1-0.0.1-SNAPSHOT.jar.failed
mv sharemechat-v1-0.0.1-SNAPSHOT.jar.bak-2026-06-22-pre-didit-deploy sharemechat-v1-0.0.1-SNAPSHOT.jar
sudo systemctl restart sharemechat-prod.service
```
Tiempo: 1-2 min. Restaura backend al commit `b0fa773`.

### Rollback de migraciones BD (NO necesario para V8/V9/V10)
Las 3 migraciones son **aditivas**: V8 rename, V9 add columns + index, V10 create tables. **NO se pueden ejecutar contra el JAR viejo `b0fa773`**: el JAR viejo no conoce las tablas/columnas nuevas pero **tampoco las lee**. Por tanto el JAR viejo funciona correctamente con el schema nuevo aplicado (forward-compatible: las migraciones son lo que el JAR viejo "no sabe que existe").

Si el JAR viejo arrancara mal por alguna razón inesperada (poco probable), opciones:

**Opción A — aceptar las columnas/tablas nuevas en PROD aunque el JAR viejo no las use**: cero impacto operacional. Las próximas iteraciones de deploy las usarán cuando se vuelva a `6cebf90`+.

**Opción B — revert manual de las migraciones** (solo si imprescindible):
```sql
-- V10 reverse (DROP TABLE en orden inverso por FK):
DROP TABLE stream_moderation_attendance;
DROP TABLE stream_moderation_reviews;
DROP TABLE stream_moderation_events;
DROP TABLE stream_moderation_sessions;
DROP TABLE stream_moderation_provider_config;
-- V9 reverse:
ALTER TABLE kyc_sessions DROP INDEX idx_kyc_sessions_user_session_type;
ALTER TABLE users DROP COLUMN client_kyc_estimated_age;
ALTER TABLE users DROP COLUMN client_kyc_decided_at;
ALTER TABLE users DROP COLUMN client_kyc_status;
ALTER TABLE kyc_sessions DROP COLUMN age_estimation_threshold;
ALTER TABLE kyc_sessions DROP COLUMN confidence_score;
ALTER TABLE kyc_sessions DROP COLUMN estimated_age_decimal;
ALTER TABLE kyc_sessions DROP COLUMN session_type;
-- V8 reverse:
RENAME TABLE kyc_sessions TO model_kyc_sessions;
-- Limpiar flyway_schema_history:
DELETE FROM flyway_schema_history WHERE version IN ('10','9','8');
```

**Opción C — restaurar snapshot RDS** (último recurso si la BD quedó en estado inconsistente):
```
aws rds restore-db-cluster-from-snapshot --db-cluster-identifier sharemechat-prod-restored --snapshot-identifier sharemechat-prod-pre-didit-<timestamp>
```
Tiempo: 30-60 min. **Pérdida de cualquier escritura ocurrida entre snapshot y restore**. Solo si los datos son irrecuperables.

### Rollback de `/opt/sharemechat/config.env` y `secrets.env`
Si los ficheros se editaron y rompieron algo:
```
ssh prod-backend
sudo cp /opt/sharemechat/config.env /opt/sharemechat/config.env.failed
sudo cp /opt/sharemechat/secrets.env /opt/sharemechat/secrets.env.failed
# Quitar las líneas KYC_DIDIT_* añadidas (vim/manual o restore desde backup previo)
sudo systemctl restart sharemechat-prod.service
```
Si no se hizo backup explícito de los `.env` previos antes de editar, restaurar de memoria o desde commit Git previo del config (si está versionado).

### Rollback del manifest deploy-state
```
git checkout ops/deploy-state/prod.yaml
git push
```
o revert del commit que actualizó el manifest.

### Coordinación
- Si el rollback es solo del JAR (Opción A migraciones), el sistema queda estable en 2-3 min. Reintentar deploy con problema arreglado en una ventana posterior.
- Si el rollback exige snapshot restore (Opción C), comunicar interrupción de servicio prolongada.

---

## Cierre

El deploy backend a PROD para destrabar el frontend SEO del Prompt 2 está **técnicamente preparado**: código compila, tests pasan al 100%, migraciones son safe-online, código nuevo cae a MOCK por defecto. La única preparación pendiente es **operativa fuera del repo**: configurar el panel del vendor Didit para PROD + añadir 5-7 env vars al EC2 PROD. Tiempo de operación: 60-90 minutos supervisados, sin ventana de mantenimiento BD requerida.

Sightengine desplegado como scaffolding inerte por design; no es bloqueante. Se activa en su frente P2 dedicado en el futuro.

Una vez completado este deploy backend + verificación, el deploy frontend del Prompt 2 SEO se reintenta y pasa el drift check naturalmente, completando la cadena bloqueada.
