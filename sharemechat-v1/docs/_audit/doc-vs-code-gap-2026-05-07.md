# Auditoría doc-vs-code — 2026-05-07

## Resumen ejecutivo

La documentación de SharemeChat está mayoritariamente alineada con el código y refleja con bastante fidelidad el estado real del sistema. La cobertura de las áreas estructurales (auth, realtime, billing, Product Operational Mode, BFPM, KYC, storage, country gate, CMS, auth-risk) es sólida y los ADRs reflejan decisiones tomadas. Los hallazgos relevantes se concentran en (a) ADRs marcados como "Propuesta" cuya implementación ya está validada en entornos, (b) una desviación en `shareme-context-overview.md` sobre el cierre de registro server-side, (c) algunas áreas funcionales sin home claro (jobs programados, moderación) y (d) detalle sensible de infraestructura cloud y de IPs públicas filtrado en `incident-notes.md` y en `test.md`. No se observan drifts conceptuales graves entre arquitectura documentada y código.

Conteo: **0 DRIFT · 2 GAP · 3 STALE · 2 OVER-DOC**.

## Metodología

- Documentos leídos: 38 (todos los `.md` en `docs/`, incluidos los 13 ADRs, los 7 templates/contexto y `documentation-governance.md`).
- ADRs revisados: 13 (`adr-001` a `adr-013`).
- Áreas funcionales evaluadas: ~22 (auth + JWT cookie filter, consent + age-gate, realtime matching, realtime messages, WebRTC/TURN, KYC Veriff + manual, billing CCBill placeholder, balance/payouts/gifts/BFPM, accounting audit, moderation, favoritos + bloqueos, model contract + onboarding, backoffice + permisos, country blacklist, auth-risk, storage local + S3 + proxy, i18n shared, CMS interno + runs IA, jobs programados, frontend dual surface, emails Graph/SMTP, properties por entorno).
- Criterio aplicado: regla de evidencia + mapa rápido del governance, sesgo a parquedad. No se levantan diferencias triviales de naming ni ausencia de inventario exhaustivo de endpoints; sólo drift conceptual real, áreas con peso significativo sin home, doc obsoleta o detalle sensible no saneado.

## Hallazgos

### DRIFT — 0 hallazgos

No se han identificado drifts conceptuales relevantes entre la doc y el código bajo el criterio de evidencia y de no-inventario fijado por el governance. Las áreas donde la doc afirma comportamientos concretos (auth-risk con HMAC + Redis namespace por entorno, doble ACK media, `billable_start`/`confirmed_at`, CountryAccessService aplicada en registro/login/refresh/admin login, Product Operational Mode con whitelist `/api/admin/**` + filtro REST + interceptor WS, ADR-007 baseline en cinco endpoints REST, packs `P10/P20/P40` con BFPM, accounting audit con cuatro checks BFPM en `ACCOUNTING_AUDIT/DEFAULT`) se han verificado contra controllers, servicios, propiedades y entidades sin encontrar contradicciones operativas.

### GAP — 2 hallazgos

#### G1 — Jobs programados sin home arquitectónico

- Área: jobs programados (retención de eventos, retención de mensajes, forfeit de cliente, home featured, snapshot diario de tiers de modelo).
- Evidencia en código: [RetentionJob.java](sharemechat-v1/src/main/java/com/sharemechat/jobs/RetentionJob.java), [MessageRetentionJob.java](sharemechat-v1/src/main/java/com/sharemechat/jobs/MessageRetentionJob.java), [ClientForfeitJob.java](sharemechat-v1/src/main/java/com/sharemechat/jobs/ClientForfeitJob.java), [HomeFeaturedJob.java](sharemechat-v1/src/main/java/com/sharemechat/jobs/HomeFeaturedJob.java), [ModelTierSnapshotJob.java](sharemechat-v1/src/main/java/com/sharemechat/jobs/ModelTierSnapshotJob.java) (5 jobs `@Scheduled` activos). Las tablas `home_featured_models` y `model_tier_daily_snapshots` están listadas en [data-model-overview.md](sharemechat-v1/docs/02-architecture/data-model-overview.md), pero ningún documento de `02-architecture/` describe los jobs como área funcional ni explica cadencia/responsabilidad. CLAUDE.md sí los espera ("jobs programados (retention, forfeit, home featured, tier snapshots)").
- Home propuesto según governance: añadir una sección breve en [backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md) (capítulo "Jobs programados") con cadencia lógica y propósito; o, alternativamente, un nuevo runbook/operación corto en `04-operations/`. No exige nuevo ADR.
- ¿ADR retroactivo? no. No hay evidencia de decisión estructural pendiente; son piezas operativas estables.
- Severidad: media.

#### G2 — Moderación sin home funcional concreto

- Área: moderación (reportes de abuso entre usuarios, revisión administrativa).
- Evidencia en código: [ModerationReport.java](sharemechat-v1/src/main/java/com/sharemechat/entity/ModerationReport.java) (tabla `moderation_reports`), [ModerationReportService.java](sharemechat-v1/src/main/java/com/sharemechat/service/ModerationReportService.java), [ModerationReportController.java](sharemechat-v1/src/main/java/com/sharemechat/controller/ModerationReportController.java), [AdminController.java](sharemechat-v1/src/main/java/com/sharemechat/controller/AdminController.java) (`/api/admin/moderation/reports*`), [AdminModerationPanel.jsx](sharemechat-v1/frontend/src/pages/admin/AdminModerationPanel.jsx). En docs hay sólo menciones de una palabra ("moderacion") en [backend-architecture.md:19](sharemechat-v1/docs/02-architecture/backend-architecture.md:19) y [frontend-architecture.md:24](sharemechat-v1/docs/02-architecture/frontend-architecture.md:24), y la tabla `moderation_reports` no aparece en [data-model-overview.md](sharemechat-v1/docs/02-architecture/data-model-overview.md).
- Home propuesto según governance: incorporar `moderation_reports` en [data-model-overview.md](sharemechat-v1/docs/02-architecture/data-model-overview.md) y un párrafo de flujo (creación de report ↔ revisión backoffice ↔ resultado) en [backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md) o en [admin-operations.md](sharemechat-v1/docs/05-backoffice/admin-operations.md).
- ¿ADR retroactivo? no.
- Severidad: media.

### STALE — 3 hallazgos

#### S1 — ADR-004 marcado "Propuesta" pero ya implementado y validado

- Documento: [adr-004-turn-ice-strategy-for-cross-network-webrtc.md](sharemechat-v1/docs/06-decisions/adr-004-turn-ice-strategy-for-cross-network-webrtc.md).
- Qué afirma que ya no aplica: el campo "Estado" sigue diciendo "Propuesta", y la sección "Pendiente tras esta decision" describe trabajo futuro sobre contrato backend ICE, sustitución de TURN público estático y observabilidad de relay.
- Evidencia: el contrato backend ICE existe en [WebRtcConfigController.java](sharemechat-v1/src/main/java/com/sharemechat/controller/WebRtcConfigController.java) y [WebRtcProperties.java](sharemechat-v1/src/main/java/com/sharemechat/config/WebRtcProperties.java); el frontend lo consume vía [webrtcConfig.js](sharemechat-v1/frontend/src/realtime/webrtcConfig.js); la fase TURN propio está validada en AUDIT y TEST con `candidateType=relay` y selected pair `relay (TURN)` (ver [audit.md](sharemechat-v1/docs/03-environments/audit.md) y [incident-notes.md](sharemechat-v1/docs/04-operations/incident-notes.md) §"WebRTC roto en TEST por cableado de properties y host TURN apagado").
- Acción sugerida: cambiar estado a "Aceptada e implementada" (alineado con [ADR-005](sharemechat-v1/docs/06-decisions/adr-005-turn-deployment-strategy-by-environment.md)) y mover el bloque "Pendiente" a "Pendiente residual" o eliminarlo si los puntos ya están cubiertos.
- Severidad: media.

#### S2 — ADR-005 marcado "Propuesta" pero TURN mínimo ya operativo en AUDIT y TEST

- Documento: [adr-005-turn-deployment-strategy-by-environment.md](sharemechat-v1/docs/06-decisions/adr-005-turn-deployment-strategy-by-environment.md).
- Qué afirma que ya no aplica: estado "Propuesta", aunque el despliegue mínimo TURN ya está cerrado a nivel operativo en AUDIT (gestión por systemd, certificado válido, evidencia frontend de relay) y replicado en TEST (ver [audit-environment-plan.md](sharemechat-v1/docs/07-roadmap/audit-environment-plan.md) §"Cierre de fase en AUDIT" e [incident-notes.md](sharemechat-v1/docs/04-operations/incident-notes.md) §"WebRTC roto en TEST...").
- Evidencia: [audit.md](sharemechat-v1/docs/03-environments/audit.md) §"TURN minimo operativo" y [test-levelling-plan.md](sharemechat-v1/docs/07-roadmap/test-levelling-plan.md) Fase 3.
- Acción sugerida: cambiar estado a "Aceptada e implementada en AUDIT y TEST; PRO inicial pendiente".
- Severidad: media.

#### S3 — `shareme-context-overview.md` describe el cierre de registro como sólo de UI

- Documento: [shareme-context-overview.md](sharemechat-v1/docs/00-context/shareme-context-overview.md).
- Qué afirma que ya no aplica: en §"4. Entornos / TEST" dice "Registro publico deshabilitado a nivel UI (no a nivel backend)" y en §"7. Problemas abiertos importantes" mantiene "Registro publico deshabilitado solo a nivel UI: backend sigue aceptando registro si se llama directamente al endpoint (deuda de gating real por entorno)".
- Evidencia: [ADR-009](sharemechat-v1/docs/06-decisions/adr-009-product-operational-mode.md) y [runbooks.md](sharemechat-v1/docs/04-operations/runbooks.md) §"Runbook de Product Operational Mode" documentan que `PRODUCT_REGISTRATION_CLIENT_ENABLED=false` y `PRODUCT_REGISTRATION_MODEL_ENABLED=false` cierran server-side `POST /api/users/register/client` y `POST /api/users/register/model` con 503 `REGISTRATION_CLOSED`, validado con tráfico real en TEST y AUDIT. El código respalda el cierre vía [ProductOperationalModeFilter.java](sharemechat-v1/src/main/java/com/sharemechat/security/ProductOperationalModeFilter.java) y [ProductOperationalProperties.java](sharemechat-v1/src/main/java/com/sharemechat/config/ProductOperationalProperties.java).
- Acción sugerida: actualizar las dos frases citadas para reflejar que el cierre de registro es server-side mediante Product Operational Mode (modo `OPEN` + flags de registro a `false`); retirar la entrada del listado de "Problemas abiertos".
- Severidad: alta — el documento se reutiliza como contexto para asistentes externos y para pitches, y la afirmación errónea distorsiona la postura real de seguridad.

### OVER-DOC — 2 hallazgos

#### O1 — `incident-notes.md` filtra IDs de CloudFront, EIP y deny list de IPs públicas

- Documento: [incident-notes.md](sharemechat-v1/docs/04-operations/incident-notes.md).
- Tipo de exposición: IDs cloud (distribuciones CloudFront), IP elástica, lista de IPs públicas de terceros usada como ejemplo de deny list.
- Cita o referencia: §"WebSocket /messages inestable en TEST por AllowedMethods restringidos en CloudFront" expone "distribucion: `[REDACTED-CF-ID-TEST]`", "CloudFront TEST (`[REDACTED-CF-ID-TEST]`) behavior `/messages*`" y "CloudFront AUDIT (`[REDACTED-CF-ID-AUDIT]`)"; §"WebRTC roto en TEST por cableado de properties y host TURN apagado" expone "EC2... `[REDACTED-EC2-NAME]`, EIP `[REDACTED-EIP]`"; §"Pipeline desacoplado..." ⇒ deny list real con cuatro IPs `[REDACTED]/32` y referencia a `[REDACTED-IP]/32` clasificada como MALICIOSA.
- Acción sugerida según regla de saneado: sustituir por nombres lógicos ("distribución pública del entorno TEST", "distribución pública del entorno AUDIT", "EIP del servidor TURN del entorno TEST", "deny list operativa del pipeline perimetral"). Mantener la incidencia narrativa intacta; sólo retirar los identificadores concretos. La traza exacta de IPs y CF-IDs vive en la fuente operativa fuera del repo.
- Severidad: alta.

#### O2 — `test.md` expone bucket S3 concreto del entorno

- Documento: [test.md](sharemechat-v1/docs/03-environments/test.md).
- Tipo de exposición: nombre exacto de bucket S3 del entorno.
- Cita o referencia: §"CMS (Content Management) — Fase 2" indica "bucket: `[REDACTED-S3-BUCKET-CONTENT-TEST]`" y "región: `eu-central-1`".
- Acción sugerida según regla de saneado: sustituir por "bucket privado de contenido del entorno TEST" y mantener la región sólo si aporta valor lógico (la región sí es razonable; el bucket no). El mismo patrón aparece en S3 para uploads privados, ya saneado correctamente en [audit.md](sharemechat-v1/docs/03-environments/audit.md) — replicar ese criterio aquí.
- Severidad: media.

## Áreas verificadas sin hallazgos

Esta lista evita que el lector piense que se han pasado por alto.

- auth + JWT en cookies: doc en [backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md) y [roles-and-flows.md](sharemechat-v1/docs/01-business/roles-and-flows.md) coincide con [CookieJwtAuthenticationFilter.java](sharemechat-v1/src/main/java/com/sharemechat/security/CookieJwtAuthenticationFilter.java) y [AuthController.java](sharemechat-v1/src/main/java/com/sharemechat/controller/AuthController.java) ✓
- realtime matching y messages (ADR-002 + [realtime-architecture.md](sharemechat-v1/docs/02-architecture/realtime-architecture.md)) ✓
- doble ACK media + `billable_start`/`confirmed_at` ([backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md), [realtime-architecture.md](sharemechat-v1/docs/02-architecture/realtime-architecture.md), [runbooks.md](sharemechat-v1/docs/04-operations/runbooks.md)) ✓
- Auth-risk Fase 1 + Fase 2 ([ADR-008](sharemechat-v1/docs/06-decisions/adr-008-auth-risk-progressive-response.md), [backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md), [runbooks.md](sharemechat-v1/docs/04-operations/runbooks.md)) ✓
- Country gate parcial en cinco endpoints REST ([ADR-007](sharemechat-v1/docs/06-decisions/adr-007-country-blacklist-phase1-backend-primary.md)) coincide con `assertAllowed()` en `AuthController`, `AdminAuthController` y `UserController` ✓
- Product Operational Mode ([ADR-009](sharemechat-v1/docs/06-decisions/adr-009-product-operational-mode.md), [backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md), [runbooks.md](sharemechat-v1/docs/04-operations/runbooks.md), [test.md](sharemechat-v1/docs/03-environments/test.md), [audit.md](sharemechat-v1/docs/03-environments/audit.md)) ✓
- Storage local + S3 + proxy backend ([ADR-003](sharemechat-v1/docs/06-decisions/adr-003-local-uploads-vs-s3.md), [integrations-overview.md](sharemechat-v1/docs/02-architecture/integrations-overview.md), [backend-architecture.md](sharemechat-v1/docs/02-architecture/backend-architecture.md)) ✓
- Pricing + BFPM ([ADR-011](sharemechat-v1/docs/06-decisions/adr-011-pricing-simplification-and-minimum-threshold.md) + [ADR-012](sharemechat-v1/docs/06-decisions/adr-012-bfpm-platform-funded-bonus.md), [current-phase.md](sharemechat-v1/docs/07-roadmap/current-phase.md)) ✓
- CMS Fase 2 + FULL_ARTICLE ([ADR-010](sharemechat-v1/docs/06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md) + [ADR-013](sharemechat-v1/docs/06-decisions/adr-013-full-article-run-phase3b.md), [test.md](sharemechat-v1/docs/03-environments/test.md)) ✓
- Accounting audit + checks BFPM (cubierto desde [ADR-012](sharemechat-v1/docs/06-decisions/adr-012-bfpm-platform-funded-bonus.md), aunque sin doc dedicada del scheduler — aceptable por el alcance actual) ✓
- KYC Veriff disponible/desactivado por defecto ([integrations-overview.md](sharemechat-v1/docs/02-architecture/integrations-overview.md)) coincide con `kyc.veriff.enabled=false` en [application.properties](sharemechat-v1/src/main/resources/application.properties) ✓
- Backoffice + permisos + audit log ([ADR-001](sharemechat-v1/docs/06-decisions/adr-001-dual-surface-react.md), [permissions-model.md](sharemechat-v1/docs/05-backoffice/permissions-model.md), [admin-operations.md](sharemechat-v1/docs/05-backoffice/admin-operations.md)) ✓
- I18n compartido producto/admin ([ADR-006](sharemechat-v1/docs/06-decisions/adr-006-shared-i18n-strategy-product-backoffice.md)) coincide con [i18n/index.js](sharemechat-v1/frontend/src/i18n/index.js) y locales ES/EN ✓
- Frontend dual surface + acoplamiento a TEST ya documentado como riesgo en [frontend-architecture.md](sharemechat-v1/docs/02-architecture/frontend-architecture.md) y [known-risks.md](sharemechat-v1/docs/04-operations/known-risks.md) ✓
- Pipeline perimetral AUDIT (normalizer/classifier/reporter/blocker) coincide con [ops/](sharemechat-v1/ops/) y con la sección correspondiente de [incident-notes.md](sharemechat-v1/docs/04-operations/incident-notes.md) ✓

## Recomendaciones de orden de actuación

Sin imponer plan, prioridad sugerida por impacto:

1. **S3** — corregir `shareme-context-overview.md`. Es el documento más expuesto (se reutiliza fuera del repo) y la afirmación sobre el cierre de registro contradice una capa de seguridad ya validada. Trabajo de ~10 minutos.
2. **O1** — sanear `incident-notes.md` retirando los IDs de CloudFront, la EIP del TURN de TEST y la deny list de IPs de terceros. Mantener la narrativa intacta; sustituir por nombres lógicos.
3. **O2** — sanear el bloque CMS de `test.md` retirando el bucket S3 concreto.
4. **S1 + S2** — actualizar el estado de [ADR-004](sharemechat-v1/docs/06-decisions/adr-004-turn-ice-strategy-for-cross-network-webrtc.md) y [ADR-005](sharemechat-v1/docs/06-decisions/adr-005-turn-deployment-strategy-by-environment.md) a "Aceptada e implementada" con la matización correspondiente para PRO. Cambio puramente declarativo.
5. **G1 + G2** — añadir una sección breve de jobs programados en `backend-architecture.md` y dar home a moderación (ampliar `data-model-overview.md` y un párrafo en `admin-operations.md`).

## Notas del auditor

- He aplicado el criterio de evidencia con sesgo a parquedad: descarté como drift varias diferencias menores que el governance excluye explícitamente, en especial diferencias de naming entre tablas reales (`kyc_provider_config` singular, `unsubscribe` singular) y la doc (`kyc_provider_configs`, `unsubscribes` en [data-model-overview.md](sharemechat-v1/docs/02-architecture/data-model-overview.md)). Si en una iteración futura se quiere precisión total, ese ajuste es trivial; no se levanta como hallazgo aquí.
- La página `/blog` pública en frontend ([Blog.jsx](sharemechat-v1/frontend/src/pages/blog/Blog.jsx) + [BlogContent.jsx](sharemechat-v1/frontend/src/pages/blog/BlogContent.jsx)) es un placeholder estático que **no consume** el CMS interno; por eso no se ha clasificado como drift frente a "sin publicación pública" de [test.md](sharemechat-v1/docs/03-environments/test.md). Si en alguna iteración futura `/blog` empezara a consumir `content_articles`, eso sí sería drift y debería reabrirse.
- No he evaluado completamente el alineamiento entre el i18n catalogado en `es.json`/`en.json` (1801 líneas cada uno) y el código que consume las claves; queda fuera del alcance documental.
- Las propiedades `application.properties` y `application-audit.properties` contienen hostnames completos de RDS (`db1-sharemechat-test-v2....rds.amazonaws.com`, `db1-sharemechat-audit....rds.amazonaws.com`). La regla de saneado del governance se refiere a `docs/`, no a configuración versionada de la app, por lo que no se levanta como OVER-DOC formal; aun así conviene revisar si esos endpoints deberían resolverse vía variable de entorno (`${DB_URL}`) en lugar de literal hardcodeado, especialmente de cara a PRO. Esto pertenece más a un frente de hardening de configuración que a una auditoría documental, y se deja sólo como observación al margen.
- No he tocado ningún archivo del repo salvo este informe y la creación de `docs/_audit/`.
