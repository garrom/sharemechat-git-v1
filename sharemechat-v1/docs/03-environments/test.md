# Entorno TEST

## Proposito

TEST actua como entorno principal de trabajo y validacion funcional del producto.

## Hosts canónicos

Decisión documentada en [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md). Resumen para TEST:

- Producto público: `https://test.sharemechat.com` (apex sin www)
- Variante con www: `https://www.test.sharemechat.com` → 301 al apex
- Backoffice: `https://admin.test.sharemechat.com`
- API y realtime: bajo el host del producto, paths `/api/...`, `/messages`, `/match`
- Blog: subdirectorio `https://test.sharemechat.com/blog/<slug>`
- Activos legales: `https://assets.sharemechat.com/legal/...` (compartido)
- Cookie domain: `.test.sharemechat.com`

## Topología real (capturada por state-inventory)

Vista derivada del snapshot más reciente de TEST. Refleja la topología lógica observada en AWS y en la EC2 backend en el momento de la captura.

### CloudFront — Distribuciones

| logical_name | alias | dominios | status | cache behaviors | función edge |
|---|---|---|---|---|---|
| `frontend_public` | Frontend público producto TEST | `test.sharemechat.com`, `www.test.sharemechat.com` | Deployed | 8 | `redirect-spa-test` (viewer-request) |
| `backoffice_admin` | Backoffice admin TEST | `admin.test.sharemechat.com` | Deployed | 1 | — |
| `assets_canonical` | Assets TEST canónico | `assets.test.sharemechat.com` | Deployed | 0 | — |
| `assets_legacy` | Assets TEST legacy (sin alias DNS) | (sin alias) | Deployed | 0 | — |

El recuento de cache behaviors no incluye el default behavior. La distribución `frontend_public` concentra todo el routing edge del producto: SPA estática como default, paths `/api/*`, `/match*`, `/messages*`, `/uploads/*`, `/assets/*`, `/.well-known/acme-challenge/*`, `/sitemap.xml` y `/robots.txt` redirigidos al origen `api-test-backend`, y custom error response `404 → /index.html` (200) para soportar el routing client-side.

### S3 — Buckets

| logical_name | alias | served_by_distribution |
|---|---|---|
| `frontend_product` | Bucket SPA producto TEST | `frontend_public` |
| `frontend_admin` | Bucket SPA admin TEST | `backoffice_admin` |
| `assets` | Bucket assets TEST | `assets_canonical` (también referenciado por `assets_legacy`) |
| `content_private` | Bucket Markdown crudo de artículos (privado, no servido por CloudFront) | — |
| `storage` | Bucket storage TEST (uploads) | — |

Todos los buckets están en `eu-central-1`. `content_private` y `storage` no se exponen vía CloudFront y solo se acceden desde el backend.

### Servicios systemd en la EC2 backend

- `coturn-test.service` — active
- `nginx.service` — active
- `redis6.service` — active
- `sharemechat-test-access-blocker.service` — failed (DRY-RUN según descripción de la unidad)
- `sharemechat-test-access-classifier.service` — not-found (unidad no instalada)
- `sharemechat-test-access-normalizer.service` — inactive
- `sharemechat-test-daily-report.service` — inactive

El JAR del backend (`sharemechat-v1-0.0.1-SNAPSHOT.jar`) corre bajo la unit `sharemechat-test.service` (systemd, `Restart=on-failure`, arranque automático tras reboot). La unit ejecuta directamente `java -Dspring.profiles.active=test -jar /home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar` como usuario `ec2-user` con `EnvironmentFile=/opt/sharemechat/config.env` + `EnvironmentFile=/opt/sharemechat/secrets.env` (mismo patrón que AUDIT/PROD). Un deploy consiste en `scp` del JAR nuevo + `sudo systemctl restart sharemechat-test.service`. nginx proxyea `/api/`, `/match`, `/messages`, `/sitemap.xml` y `/robots.txt` a `http://localhost:8080`; cualquier otra ruta retorna `404` directamente desde nginx. `client_max_body_size` configurado a `60M`.

### Notas de topología

- `assets_legacy` es una distribución fantasma: aparece como `Status=Deployed` pero `Enabled=false` en AWS, sin alias DNS, y comparte el bucket `assets` con `assets_canonical`. El esquema v2 del snapshot no expone el flag `enabled`, así que ese matiz solo queda registrado en el campo `notes` del propio snapshot.
- El bucket `assets` está servido por dos distribuciones distintas (la canónica y la legacy fantasma); cualquier intervención sobre ese bucket debe contemplar el doble origen aunque solo una de las distribuciones esté operativa.
- Las unidades systemd de la familia `sharemechat-test-access-*` están en estados no-active (failed / not-found / inactive); funcionalmente la cadena de access logging/normalización no está corriendo en TEST en este momento de captura.

> Datos derivados del snapshot `state-test-2026-05-09-1659.yaml`. La fuente de verdad fáctica es el snapshot; esta sección es derivada por conveniencia narrativa.

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

## CMS (Content Management) — Fase 4A + Frente 3 (workflow simplificado)

CMS interno de SharemeChat (ver [ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md), [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md), [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md), [ADR-016](../06-decisions/adr-016-content-workflow-simplification-and-retraction.md) y [ADR-013](../06-decisions/adr-013-full-article-run-phase3b.md) superseded) operativo en TEST — workflow editorial simplificado a cuatro estados (ADR-016), runs IA Claude Cowork con `FULL_ARTICLE_ORCHESTRATED` como flujo principal (pipeline editorial delegado en seis skills personales versionadas en `docs/cms/skills/`), publicación pública dinámica vía API JSON consumida por el SPA público, SEO mínimo para indexación (sitemap dinámico, robots.txt, meta tags Open Graph + Twitter Card y JSON-LD `Article`) y retracción operativa con `410 Gone` + tombstone JSON. Detalle de la capa SEO en [cms-seo-overview.md](../02-architecture/cms-seo-overview.md). Sin generación de HTML estático todavía, sin `SCHEDULED` operativo.

### Workflow editorial vigente (post-ADR-016)

```text
DRAFT ──> IN_REVIEW ──> PUBLISHED ──> RETRACTED
  ▲           │
  └───────────┘   (devolver a borrador)
```

Tabla de transiciones implementadas:

| Origen | Destino | Permiso | Evento emitido | Side-effects |
|---|---|---|---|---|
| `DRAFT` | `IN_REVIEW` | `CONTENT.EDIT` | (sin evento; rastro = nueva fila en `content_article_versions`) | Crea `v{n}.md` inmutable en S3 + actualiza `current_version_id` |
| `IN_REVIEW` | `DRAFT` | `CONTENT.EDIT` | `DRAFT_REQUESTED` | — |
| `IN_REVIEW` | `PUBLISHED` | `CONTENT.PUBLISH` | `PUBLISHED` | Fija `published_at = now()` |
| `PUBLISHED` | `RETRACTED` | `CONTENT.PUBLISH` | `RETRACTED` | Fija `retracted_at = now()`. **NO toca S3** (tombstone) |

- estados alcanzables operativamente: `DRAFT`, `IN_REVIEW`, `PUBLISHED`, `RETRACTED`
- estado modelado en el `CHECK` de BD pero **no operable** (diferido sin fecha): `SCHEDULED`
- edición de metadata y body solo permitida en `DRAFT`; el resto bloquea con 409
- estados terminales (`PUBLISHED`, `RETRACTED`): bloqueo absoluto de edición; **ADMIN no bypassa**. Para corregir un `RETRACTED` no hay reapertura: se cierra como tombstone y se crea un artículo nuevo si fuera necesario
- sin segregación generador↔aprobador (operación 1-persona; ADR-016 D2)
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
- endpoints públicos sin auth (Fase 4A + ADR-016):
  - `GET /api/public/content/articles?locale=&category=&page=&size=` (solo `state=PUBLISHED`)
  - `GET /api/public/content/articles/{slug}`:
    - `state=PUBLISHED` → 200 con `htmlBody` ya sanitizado, incluye `updatedAt` para `dateModified` JSON-LD
    - `state=RETRACTED` → **410 Gone** con body JSON `{error:"retracted", slug, retracted_at}` y header `X-Robots-Tag: noindex`
    - cualquier otro estado o slug inexistente → 404
- endpoints SEO sin auth (Frente 2 sobre Fase 4A) — operativos end-to-end (CloudFront → nginx → Spring Boot):
  - `GET /sitemap.xml` — sitemap dinámico con la home del blog y todos los `state=PUBLISHED`; URLs absolutas resueltas por `app.public.base-url`; `Cache-Control: public, max-age=3600`
  - `GET /robots.txt` — texto plano con `Allow: /blog`, `Disallow` en zonas privadas, y `Sitemap:` apuntando al sitemap absoluto del entorno; `Cache-Control: public, max-age=86400`
  - capa edge: dos `CacheBehaviors` `/sitemap.xml` y `/robots.txt` en la distribución CloudFront TEST (origen `api-test-backend`, `Managed-CachingDisabled`, `AllowedMethods=[GET, HEAD]`, sin `FunctionAssociations`)
  - capa nginx: dos `location = /sitemap.xml` y `location = /robots.txt` en `/etc/nginx/conf.d/api.test.sharemechat.com.conf` con `proxy_pass http://localhost:8080` y `proxy_hide_header` para los headers de seguridad emitidos por Spring Boot
  - detalle de la reaplicación coordinada en [incident-notes.md](../04-operations/incident-notes.md) sección "Routing /sitemap.xml y /robots.txt en CloudFront TEST"
- runs IA tipos soportados: `FULL_ARTICLE_ORCHESTRATED` (flujo principal recomendado, validación reforzada, pipeline delegado en skills personales `cms-research-seo` → `cms-draft-writer` → `cms-editorial-polish` → `cms-brand-legal-review` → `cms-json-builder`, con `sharemechat-voice` transversal), `RESEARCH`, `OUTLINE`, `DRAFT`, `REVIEW`, `SEO` (todos como herramientas avanzadas). El run type antiguo `FULL_ARTICLE` (ADR-013) ya no se acepta; los runs históricos con ese tipo se conservan como traza auditable
- tablas operativas (modelo bilingüe post-[ADR-025](../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md)): `content_articles`, `content_article_translations`, `content_article_versions`, `content_article_translation_versions`, `content_review_events`, `content_generation_runs`
- migraciones de schema CMS:
  - schema vivo en `src/main/resources/db/migration/V2__cms_v2_schema.sql` tras [ADR-025](../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md), aplicado por Flyway una vez ejecutado el baseline manual (ver [runbook](../04-operations/runbooks/cms-v2-flyway-introduction.md))
  - `V3__brief_per_locale.sql` aplicada en TEST el 2026-05-23 09:11 UTC ([ADR-027](../06-decisions/adr-027-brief-per-locale.md), paquete 10.A.11 fase 1): reubica el campo `brief` de `content_articles` a `content_article_translations` con backfill al locale ES. La columna `content_articles.brief` queda eliminada y `content_article_translations.brief TEXT NULL` queda añadida tras `meta_description`. La aplicación a AUDIT queda para sesión aparte
  - ficheros pre-Flyway archivados en `docs/_archive/db-manual-pre-flyway/` (`V20260501__content_phase1_schema.sql` schema inicial y `V20260508__content_workflow_simplification.sql` [ADR-016](../06-decisions/adr-016-content-workflow-simplification-and-retraction.md) simplificación a cuatro estados). Estos ficheros **no se aplican** sobre ningún entorno actual; son referencia histórica
- dependencias Maven añadidas en Fase 4A: `flexmark-all` (Markdown→HTML) + `jsoup` (sanitización allowlist). [ADR-025](../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md) añade `flyway-core` y `flyway-mysql` para gestión de schema versionada

Versionado:

- `content/articles/{id}/draft.md` — borrador mutable, sobreescrito en cada `PUT /body`
- `content/articles/{id}/v{n}.md` — snapshots inmutables; **se crean exclusivamente** en la transición `DRAFT → IN_REVIEW`
- `current_version_id` en `content_articles` apunta a la última versión sometida; permanece intacto al devolver a borrador desde `IN_REVIEW`
- al reenviar a revisión tras devolver a borrador se crea v(n+1)
- en retracción (`PUBLISHED → RETRACTED`) **no se borra** el body S3 ni las versiones: el artículo queda como tombstone

Eventos auditados (`content_review_events`, `CHECK` reescrito por ADR-016):

- `EDIT_APPLIED` — guardado de metadata o body, y aplicación de draft IA (`payload_json` con `target` y `fields`/`bytes`/`run_id`/`run_type` según el caso)
- `DRAFT_REQUESTED` — devolver a borrador desde `IN_REVIEW` (`payload_json` con `from` y opcional `reason`)
- `PUBLISHED` — `IN_REVIEW → PUBLISHED`, con `version_id` y `comment` opcional
- `RETRACTED` — `PUBLISHED → RETRACTED`, con `version_id` y `reason`/`comment` opcionales
- la transición `DRAFT → IN_REVIEW` no genera evento por sí misma; el rastro auditable es la fila nueva en `content_article_versions`
- `SCHEDULED` y `DISCLOSURE_OVERRIDE` siguen en el `CHECK` pero ningún path de código los emite todavía
- `OUTLINE_APPROVED`, `REVIEW_APPROVED` y `REVIEW_REJECTED` **eliminados** del `CHECK` y del código (ADR-016): solo existirían sobre artículos en estados obsoletos, ya borrados por la migración

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
- `CONTENT.PUBLISH` requerido para `IN_REVIEW → PUBLISHED` y `PUBLISHED → RETRACTED` (ADR-016). ADMIN lo tiene por defecto vía `role_permissions`
- `CONTENT.REVIEW` declarado en BD pero sin uso operativo tras ADR-016 (sin segregación generador↔aprobador); se conserva para futuras escalaciones a equipo editorial
- rol backoffice `EDITOR` creado, sin usuarios reales asignados
- acceso a `/api/admin/**` cubierto por la regla genérica de `SecurityConfig` (`ROLE_ADMIN` o `BO_ROLE_ADMIN`); el flag ADMIN se detecta inspeccionando authorities
- `/api/public/content/**` con `permitAll` solo en métodos `GET`
- `/sitemap.xml` y `/robots.txt` con `permitAll` para `GET` y `HEAD` (ADR-016 D9)

Frontend backoffice:

- panel `Content CMS` y editor mantienen el layout original
- editor con barra dinámica de transiciones según estado y permisos
- inputs de metadata y body se deshabilitan en estados no editables; en estados terminales (`PUBLISHED`, `RETRACTED`) **el bloqueo es absoluto, también para ADMIN**
- bloque de historial con dos columnas: versiones (con botón "Ver cuerpo" que carga el markdown inmutable de v{n}) y timeline de eventos
- panel "Asistente IA" con un único botón principal "Generar artículo completo" (run type `FULL_ARTICLE_ORCHESTRATED`); `RESEARCH` y `REVIEW` accesibles bajo disclosure "Mostrar opciones avanzadas"; `OUTLINE`/`DRAFT`/`SEO` no se ofrecen como botones aunque el backend los siga aceptando y los runs históricos (incluido el antiguo `FULL_ARTICLE`) se rendericen en la tabla
- botón "Vista previa" en el editor abre un modal admin que muestra el artículo renderizado con los mismos estilos del blog público, sin publicar ni alterar estado

Frontend público:

- `/blog`: listado de artículos en `state=PUBLISHED` consumido vía `GET /api/public/content/articles`
- `/blog/:slug`: detalle de artículo con `htmlBody` sanitizado (allowlist jsoup), inyectado vía `dangerouslySetInnerHTML`. Incluye metadata SEO básica (title, brief, category, fecha) y disclosure IA si `disclosureRequired=true`. Si la API responde 410 (ADR-016), el SPA muestra "Este artículo ya no está disponible" e inyecta `<meta name="robots" content="noindex">` para reforzar la desindexación
- inyección SEO en `<head>` (Frente 2): `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph (`og:type=article`, `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale`), Twitter Card (`summary_large_image`) y `<script type="application/ld+json">` con `Article` schema.org (`headline`, `description`, `url`, `datePublished`, `dateModified`, `inLanguage`, autor `Equipo SharemeChat`, publisher `SharemeChat`). Implementado con manipulación directa de `document.head` desde `useEffect` en `BlogArticleView.jsx` (sin react-helmet-async para no introducir deps incompatibles con React 17). `og:image` queda preparado pero ausente hasta que exista campo `heroImageUrl`

Limitaciones vigentes (frentes diferidos sin fecha tras ADR-016):

- sin generación de HTML estático en S3+CloudFront; el blog público sigue sirviéndose dinámicamente vía API JSON
- sitemap y robots.txt dinámicos servidos por backend; cuando se evalúe la publicación estática se decidirá si pasan también a estáticos
- sin endpoint compuesto `publish-now` (atajo `DRAFT → PUBLISHED`); el ciclo en dos pasos `DRAFT → IN_REVIEW → PUBLISHED` se mantiene como flujo único
- sin programación (`SCHEDULED`) operativa: el estado sigue en el `CHECK` BD pero ningún path de código lo activa
- sin `disclosure_override` operativo (modelado pero sin emisor)
- sin `og:image` propio: el campo `heroImageUrl` aún no existe en el modelo
- sin sitemap-index: una sola URL `/sitemap.xml`; suficiente hasta acercarse a 50.000 entradas

Validación realizada con tráfico real en TEST:

- ciclo completo `IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED → PUBLISHED` correcto sobre el artículo `id=4`, slug `videochat-seguro-guia` (validación pre-ADR-016; tras la migración, el ciclo equivalente es `DRAFT → IN_REVIEW → PUBLISHED`)
- generación IA con `FULL_ARTICLE_ORCHESTRATED` validada, validación reforzada aplicada (≥5 fuentes, ≥4 secciones outline, ≥800 chars draft, `seo_title`/`meta_description` no vacíos, `self_check_passed=true`, heurísticas Markdown literal); el pipeline editorial se ejecutó en Claude Cowork delegando en las seis skills personales descritas en [ADR-014](../06-decisions/adr-014-full-article-orchestrated-pipeline.md)
- creación de versión `v1.md` en S3 al someter a revisión, con `body_content_hash` SHA-256 persistido en `content_article_versions` y `current_version_id` actualizado
- reapertura `APPROVED → DRAFT_GENERATED` y nuevo ciclo generan `v{n+1}.md` con hash distinto
- transición `APPROVED → PUBLISHED` operativa, `published_at` fijado, evento `PUBLISHED` emitido en `content_review_events`
- artículo accesible públicamente sin auth en `https://test.sharemechat.com/blog` (listado) y `https://test.sharemechat.com/blog/videochat-seguro-guia` (detalle con HTML sanitizado)
- preview privada admin disponible en cualquier estado, sin alterar el artículo
- bloqueo de edición tras `PUBLISHED` confirmado a nivel UI (inputs y botones deshabilitados) y backend (`PUT/PATCH` devuelve 409 incluso para ADMIN)
- consistencia BD↔S3 verificada: `body_s3_key` de cada versión apunta a un objeto existente y descargable vía `GET /versions/{n}/body`
