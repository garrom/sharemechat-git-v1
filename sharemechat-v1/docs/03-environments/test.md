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

## CMS (Content Management) — Fase 1

CMS interno de SharemeChat (ver [ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md)) operativo en TEST en su Fase 1 — esqueleto editorial mínimo, sin IA, sin publicación pública, sin workflow editorial completo.

Backend:

- endpoints `GET/POST/PATCH/DELETE /api/admin/content/articles`, `GET/PUT /api/admin/content/articles/{id}/body`
- tabla principal: `content_articles`
- tablas creadas pero sin uso en Fase 1: `content_article_versions`, `content_generation_runs`, `content_review_events`
- migración Flyway `V20260501__content_phase1_schema.sql`

S3:

- bucket: `sharemechat-content-private-test`
- región: `eu-central-1`
- acceso: privado, exclusivamente desde backend; sin CloudFront, sin OAC, sin URLs firmadas
- key layout: `content/articles/{id}/draft.md`
- SSE-S3 (AES256) aplicada en cada `PutObjectRequest`

Seguridad:

- permisos backoffice: `CONTENT.VIEW`, `CONTENT.EDIT`, `CONTENT.REVIEW`, `CONTENT.PUBLISH`
- rol backoffice `EDITOR` creado (sin usuarios reales asignados en Fase 1)
- acceso al panel cubierto por la regla genérica `/api/admin/**` de `SecurityConfig` (`ROLE_ADMIN` o `BO_ROLE_ADMIN`)

Frontend backoffice:

- panel `Content CMS` accesible desde el dashboard admin con permiso `CONTENT.VIEW` o rol `ADMIN`
- vista lista paginada con filtros por estado, locale y categoría
- editor de artículo con metadata (slug, locale, title, category, brief, keywords) y textarea markdown para el cuerpo

Limitaciones Fase 1:

- solo el estado `IDEA` es alcanzable; el resto del workflow (`OUTLINE_READY` → `PUBLISHED` → `RETRACTED`) está modelado en BD pero no operable
- sin publicación pública; el blog estático en `blog-test.sharemechat.com` no se construye en esta fase
- sin generación IA ni `content_generation_runs`
- sin segregación generador↔aprobador ni eventos de revisión
- sin versionado activo en `content_article_versions`

Validación realizada con tráfico real en TEST:

- creación de artículos en estado `IDEA` correcta (201, persistido en `content_articles`)
- normalización de keywords aceptando `null`/vacío, lista separada por comas y array JSON; salida canónica como array JSON `["a","b","c"]` con trim, lowercase y dedupe
- subida de body markdown a S3 `sharemechat-content-private-test` correcta; `body_s3_key` y `body_content_hash` (SHA-256) persistidos en `content_articles`
- read-back del body desde S3 correcto (round-trip idéntico)
- borrado solo permitido en estado `IDEA` (409 en cualquier otro)
