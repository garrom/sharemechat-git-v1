# Entorno TEST

## Proposito

TEST actua como entorno principal de trabajo y validacion funcional del producto.

## Lo que esta claramente soportado

- frontend de producto
- frontend de backoffice
- backend Spring Boot
- MySQL
- Redis
- realtime por `/match` y `/messages`
- assets legales externos
- uploads privados servidos por backend

## Configuracion versionada relevante

El codigo versionado apunta de forma explicita a dominios de test para:

- cookies de autenticacion
- verificacion de email
- reset de password
- callback KYC
- separacion entre superficie de producto y admin

El storage de uploads privados ya es configurable por proveedor:

- local
- S3 privado

La activacion efectiva depende de variables de entorno y no queda fijada de forma dura en este documento.

## Observaciones

- TEST es la principal fuente de verdad funcional del repositorio
- varias rutas y constantes frontend siguen acopladas a este entorno
- la documentacion previa indicaba que la topologia edge y buckets privados de frontend ya estaban operativos, pero ese detalle se ha saneado aqui
- conviene mantener explicitamente alineado el limite HTTP de subida de la capa publica con los limites multipart versionados en backend para evitar divergencias futuras con AUDIT

## Storage privado activo

TEST ya opera con proveedor S3 privado para uploads sensibles.

La validacion funcional confirma:

- la abstraccion `StorageService` ya soporta proveedor local y proveedor S3
- la seleccion de proveedor depende de configuracion por entorno
- el acceso a contenido privado sigue pasando por `/api/storage/content`
- la politica de acceso al proxy privado ya esta resuelta en codigo y no depende del entorno
- la subida de documentos funciona y los objetos se almacenan en el storage privado esperado

La activacion real ha requerido en el entorno, como minimo:

- `APP_STORAGE_TYPE=s3`
- `APP_STORAGE_S3_BUCKET`
- `APP_STORAGE_S3_REGION`

Y que el host del backend disponga de credenciales AWS resolubles en runtime mediante el mecanismo estandar del proveedor, sin secretos hardcodeados en el codigo ni en properties versionadas.

El legacy asociado a referencias historicas `/uploads/...` ya ha quedado eliminado en TEST:

- limpieza completa de referencias persistidas antiguas
- eliminacion del filesystem local legado como fuente activa de estos uploads
- operacion efectiva del entorno exclusivamente sobre S3 privado y proxy backend

Se mantuvo backup previo del material legado como medida de seguridad operativa.

## Product Operational Mode (operativo, alcance parcial)

La capa Product Operational Mode (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)) está activa en TEST con configuración:

- `PRODUCT_ACCESS_MODE=OPEN`
- `PRODUCT_REGISTRATION_CLIENT_ENABLED=false`
- `PRODUCT_REGISTRATION_MODEL_ENABLED=false`
- `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED` configurable segun necesidad operativa

Resultado verificado con tráfico real:

- las cuentas existentes operan con normalidad (login, matching, sesiones, gifts) sin regresión
- los endpoints `POST /api/users/register/client` y `POST /api/users/register/model` responden 503 `REGISTRATION_CLOSED` server-side aunque se acceda directamente fuera del frontend
- TEST puede usar `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=true` para simulación interna controlada
- con `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`, se validó que `POST /api/transactions/first` y `POST /api/transactions/add-balance` responden 503 `SIMULATION_DISABLED`
- `POST /api/transactions/payout` no queda afectado por la flag de simulación directa

Detalle operativo y procedimiento en [runbooks.md](../04-operations/runbooks.md).

## CMS (Content Management) — Fase 4A

CMS interno de SharemeChat (ver [ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md), [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md) y [ADR-013](../06-decisions/adr-013-full-article-run-phase3b.md) superseded) operativo en TEST en su Fase 4A — workflow editorial completo hasta `PUBLISHED`, runs IA Claude Cowork con `FULL_ARTICLE_ORCHESTRATED` como flujo principal (pipeline editorial delegado en seis skills personales versionadas en `docs/cms/skills/`) y publicación pública dinámica vía API JSON consumida por el SPA público. Aún sin generación de HTML estático, sin sitemap, sin retracción operativa.

Workflow editorial activo:

```text
IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED
                              ↑                ↓        ↓
                              └────────────────┘────────┘  (rechazo o reapertura)
```

- estados alcanzables operativamente: `IDEA`, `OUTLINE_READY`, `DRAFT_GENERATED`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`
- estados modelados pero **no operables** en Fase 4A (difieren a Fase 4B): `SCHEDULED`, `RETRACTED`
- edición de metadata y body solo permitida en `IDEA`, `OUTLINE_READY`, `DRAFT_GENERATED`; el resto bloquea con 409
- estados terminales (`PUBLISHED`, `RETRACTED`): bloqueo absoluto de edición; **ADMIN no bypassa** (Fase 4A hardening). Para corregir, reabrir vía transición explícita
- ADMIN sigue bypaseando segregación generador↔aprobador y guardia de edición en estados intermedios (`IN_REVIEW`, `APPROVED`)
- transición `APPROVED → PUBLISHED` exige permiso `CONTENT.PUBLISH` (que ADMIN tiene por defecto vía `role_permissions`)
- reapertura `APPROVED → DRAFT_GENERATED` permitida; al reenviar a revisión se crea una nueva versión
- preview privada admin disponible en cualquier estado vía `GET /api/admin/content/articles/{id}/preview` sin alterar el artículo

Backend:

- endpoints admin Fases 1+2:
  - `GET/POST/PATCH/DELETE /api/admin/content/articles`
  - `GET/PUT /api/admin/content/articles/{id}/body`
  - `POST /api/admin/content/articles/{id}/transition`
  - `GET  /api/admin/content/articles/{id}/versions`
  - `GET  /api/admin/content/articles/{id}/versions/{versionNumber}/body`
  - `GET  /api/admin/content/articles/{id}/events`
- endpoints admin runs IA (Fase 3A):
  - `POST /api/admin/content/articles/{id}/runs` (crea run y devuelve prompt expandido)
  - `POST /api/admin/content/articles/{articleId}/runs/{runId}/output` (ingestión + validación)
  - `GET  /api/admin/content/articles/{id}/runs`
  - `GET  /api/admin/content/runs/{runId}`
- endpoint admin preview privada (Fase 4A hardening):
  - `GET  /api/admin/content/articles/{id}/preview` — render Markdown→HTML server-side sin publicar; reusa `MarkdownRendererService`
- endpoints públicos sin auth (Fase 4A):
  - `GET /api/public/content/articles?locale=&category=&page=&size=` (solo `state=PUBLISHED`)
  - `GET /api/public/content/articles/{slug}` (solo `state=PUBLISHED`; devuelve `htmlBody` ya sanitizado)
- runs IA tipos soportados: `FULL_ARTICLE_ORCHESTRATED` (flujo principal recomendado, validación reforzada, pipeline delegado en skills personales `cms-research-seo` → `cms-draft-writer` → `cms-editorial-polish` → `cms-brand-legal-review` → `cms-json-builder`, con `sharemechat-voice` transversal), `RESEARCH`, `OUTLINE`, `DRAFT`, `REVIEW`, `SEO` (todos como herramientas avanzadas). El run type antiguo `FULL_ARTICLE` (ADR-013) ya no se acepta; los runs históricos con ese tipo se conservan como traza auditable
- tablas operativas: `content_articles`, `content_article_versions`, `content_review_events`, `content_generation_runs`
- migración Flyway `V20260501__content_phase1_schema.sql` sin cambios; Fases 2/3/4A reutilizan el schema completo
- dependencias Maven añadidas en Fase 4A: `flexmark-all` (Markdown→HTML) + `jsoup` (sanitización allowlist)

Versionado:

- `content/articles/{id}/draft.md` — borrador mutable, sobreescrito en cada `PUT /body`
- `content/articles/{id}/v{n}.md` — snapshots inmutables; **se crean exclusivamente** en la transición `DRAFT_GENERATED → IN_REVIEW`
- `current_version_id` en `content_articles` apunta a la última versión sometida; permanece intacto en aprobación y reapertura
- al reenviar a revisión tras reapertura se crea v(n+1)

Eventos auditados (`content_review_events`):

- `EDIT_APPLIED` — guardado de metadata o body (`payload_json` con `target` y `fields`/`bytes`)
- `OUTLINE_APPROVED` — `IDEA → OUTLINE_READY`
- `DRAFT_REQUESTED` — cualquier transición a `DRAFT_GENERATED` (incluida reapertura desde `APPROVED`)
- `REVIEW_APPROVED` — `IN_REVIEW → APPROVED`, con `version_id` y `comment` opcional
- `REVIEW_REJECTED` — `IN_REVIEW → DRAFT_GENERATED`, con `version_id` y `reason`
- la transición `DRAFT_GENERATED → IN_REVIEW` no genera evento por sí misma; el rastro auditable es la fila nueva en `content_article_versions`
- `PUBLISHED`, `RETRACTED`, `SCHEDULED` y `DISCLOSURE_OVERRIDE` siguen modelados en el `CHECK` pero no se emiten en Fase 2

S3:

- bucket: bucket privado de contenido del entorno TEST
- región: `eu-central-1`
- acceso: privado, exclusivamente desde backend; sin CloudFront, sin OAC, sin URLs firmadas
- key layout:
  - `content/articles/{id}/draft.md` (mutable)
  - `content/articles/{id}/v{n}.md` (inmutables)
- SSE-S3 (AES256) aplicada en cada `PutObjectRequest`, incluida la copia a versión

Seguridad:

- permisos backoffice usados: `CONTENT.VIEW`, `CONTENT.EDIT`, `CONTENT.REVIEW`, `CONTENT.PUBLISH`
- `CONTENT.PUBLISH` activo en Fase 4A: requerido para `APPROVED → PUBLISHED`. ADMIN lo tiene por defecto vía `role_permissions`
- rol backoffice `EDITOR` creado, sin usuarios reales asignados
- acceso a `/api/admin/**` cubierto por la regla genérica de `SecurityConfig` (`ROLE_ADMIN` o `BO_ROLE_ADMIN`); el flag ADMIN se detecta inspeccionando authorities
- `/api/public/content/**` con `permitAll` solo en métodos `GET`

Frontend backoffice:

- panel `Content CMS` y editor mantienen el layout original
- editor con barra dinámica de transiciones según estado y permisos
- inputs de metadata y body se deshabilitan en estados no editables; en estados terminales (`PUBLISHED`, `RETRACTED`) **el bloqueo es absoluto, también para ADMIN**
- bloque de historial con dos columnas: versiones (con botón "Ver cuerpo" que carga el markdown inmutable de v{n}) y timeline de eventos
- panel "Asistente IA" con un único botón principal "Generar artículo completo" (run type `FULL_ARTICLE_ORCHESTRATED`); `RESEARCH` y `REVIEW` accesibles bajo disclosure "Mostrar opciones avanzadas"; `OUTLINE`/`DRAFT`/`SEO` no se ofrecen como botones aunque el backend los siga aceptando y los runs históricos (incluido el antiguo `FULL_ARTICLE`) se rendericen en la tabla
- botón "Vista previa" en el editor abre un modal admin que muestra el artículo renderizado con los mismos estilos del blog público, sin publicar ni alterar estado

Frontend público:

- `/blog`: listado de artículos en `state=PUBLISHED` consumido vía `GET /api/public/content/articles`
- `/blog/:slug`: detalle de artículo con `htmlBody` sanitizado (allowlist jsoup), inyectado vía `dangerouslySetInnerHTML`. Incluye metadata SEO básica (title, brief, category, fecha) y disclosure IA si `disclosureRequired=true`

Limitaciones Fase 4A:

- sin generación de HTML estático en S3+CloudFront (Fase 4B)
- sin sitemap, sin robots, sin JSON-LD (Fase 4B)
- sin transición operativa `PUBLISHED → RETRACTED` ni endpoint compuesto `publish-now` (Fase 4B)
- sin programación (`SCHEDULED`) ni disclosure override

Validación realizada con tráfico real en TEST:

- ciclo completo `IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED` correcto sobre el artículo `id=4`, slug `videochat-seguro-guia`
- generación IA con `FULL_ARTICLE_ORCHESTRATED` validada, validación reforzada aplicada (≥5 fuentes, ≥4 secciones outline, ≥800 chars draft, `seo_title`/`meta_description` no vacíos, `self_check_passed=true`, heurísticas Markdown literal); el pipeline editorial se ejecutó en Claude Cowork delegando en las seis skills personales descritas en [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md)
- creación de versión `v1.md` en S3 al someter a revisión, con `body_content_hash` SHA-256 persistido en `content_article_versions` y `current_version_id` actualizado
- reapertura `APPROVED → DRAFT_GENERATED` y nuevo ciclo generan `v{n+1}.md` con hash distinto
- transición `APPROVED → PUBLISHED` operativa, `published_at` fijado, evento `PUBLISHED` emitido en `content_review_events`
- artículo accesible públicamente sin auth en `https://test.sharemechat.com/blog` (listado) y `https://test.sharemechat.com/blog/videochat-seguro-guia` (detalle con HTML sanitizado)
- preview privada admin disponible en cualquier estado, sin alterar el artículo
- bloqueo de edición tras `PUBLISHED` confirmado a nivel UI (inputs y botones deshabilitados) y backend (`PUT/PATCH` devuelve 409 incluso para ADMIN)
- consistencia BD↔S3 verificada: `body_s3_key` de cada versión apunta a un objeto existente y descargable vía `GET /versions/{n}/body`
