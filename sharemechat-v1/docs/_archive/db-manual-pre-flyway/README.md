# Migraciones pre-Flyway archivadas

Este directorio agrupa los ficheros SQL que el proyecto aplicaba **manualmente** sobre TEST y AUDIT antes de adoptar Flyway como herramienta de migración (ver [ADR-025](../../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md)).

Convivían bajo `src/main/resources/db/manual/` con la convención visual `V<YYYYMMDD>__nombre.sql` heredada de Flyway, pero **sin la herramienta detrás**: el operador los ejecutaba a mano contra cada entorno con `mysql` CLI sobre el bastión RDS. La ausencia de tooling materializó al menos un caso de drift silencioso (`hero_image_url` aplicado por `ALTER TABLE` directo sin commitear `.sql`).

ADR-025 introduce Flyway con baseline manual sobre los entornos existentes. El contenido vivo de estos ficheros queda capturado en `src/main/resources/db/migration/V1__baseline.sql` (dump `--no-data` del schema de AUDIT). Estos ficheros se conservan aquí como traza histórica.

## Contenido

### Migraciones de dominio CMS (sustituidas por `V2__cms_v2_schema.sql`)

- `V20260501__content_phase1_schema.sql` — schema inicial CMS ([ADR-010](../../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md), fase 1). Crea las cuatro tablas `content_*` originales (`content_articles`, `content_article_versions`, `content_generation_runs`, `content_review_events`), los permisos `CONTENT.*` y el rol backoffice `EDITOR`. Modelo monolingüe con `parent_article_id` como auto-FK para vincular versiones por locale.
- `V20260508__content_workflow_simplification.sql` ([ADR-016](../../06-decisions/adr-016-content-workflow-simplification-and-retraction.md)) — simplifica el workflow editorial a cuatro estados (`DRAFT → IN_REVIEW → PUBLISHED → RETRACTED`). Borra artículos en estados obsoletos en cascada con sus filas dependientes y reescribe los `CHECK` de `content_articles.state` y `content_review_events.event_type`. Cambia el `DEFAULT` de `state` a `DRAFT`. Los objetos S3 (`draft.md`, `v{n}.md`, `runs/...`) no se borraron en su momento; quedan huérfanos para limpieza operativa.

### Migraciones de otros dominios (capturadas en `V1__baseline.sql`)

- `V20260401__add_billable_start_to_stream_records.sql` — añade `billable_start` a la tabla de facturación de streams.
- `V20260403__consent_events_allow_null_consent_id.sql` — relaja la constraint NOT NULL sobre `consent_id` en `consent_events`.
- `V20260406__backoffice_administration_tables.sql` — crea las tablas operativas del backoffice administrativo.
- `V20260407__backoffice_email_verification_phase1.sql` — añade `email_verification_tokens` y campos relacionados.
- `V20260410__backoffice_admin_role_add_phase1_read_permissions.sql` — permisos de lectura para ADMIN en backoffice.
- `V20260411__backoffice_canonicalize_legacy_permission_overrides.sql` — canonicaliza overrides legacy.

Estas seis migraciones no son del módulo CMS; se archivan junto a las dos CMS porque comparten el patrón "pre-Flyway aplicado a mano" y porque la carpeta `src/main/resources/db/manual/` se elimina por completo en ADR-025. Su efecto sobre la BD vive ahora en el dump capturado por `V1__baseline.sql`.

## Cosas que NO debes hacer con estos ficheros

- **No los apliques** sobre ningún entorno actual. TEST y AUDIT están en estado post-`flyway baseline -baselineVersion=1`; aplicarlos volvería a introducir definiciones que ya existen en BD y rompería con `1050 Table already exists` o equivalente.
- **No los modifiques.** Son histórico inmutable. Cualquier cambio de schema futuro entra como nueva migración Flyway (`V3__...sql`, `V4__...sql`, etc.) bajo `src/main/resources/db/migration/`.
- **No los importes desde código.** Ningún consumidor (test, build, runtime) debe referenciarlos. Si encuentras una referencia, es un olvido de la limpieza ADR-025; abre un issue.

## Para qué siguen siendo útiles

- **Auditoría histórica**: qué cambió y cuándo, antes de tener tooling de tracking.
- **Restore desde dumps antiguos**: si por cualquier motivo hay que reconstruir un entorno desde un dump pre-2026-05-16, estos ficheros documentan cómo se llegó al estado pre-Flyway.
- **Referencia para nuevas migraciones**: aprender el estilo SQL y los CHECK constraints del proyecto.

## Referencias

- [ADR-010](../../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md) — CMS interno asistido por IA.
- [ADR-016](../../06-decisions/adr-016-content-workflow-simplification-and-retraction.md) — Workflow editorial simplificado.
- [ADR-025](../../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md) — Introducción de Flyway y rediseño del schema CMS bilingüe.
- Runbook operativo: [docs/04-operations/runbooks/cms-v2-flyway-introduction.md](../../04-operations/runbooks/cms-v2-flyway-introduction.md).
