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

## CMS (Content Management) — Fase 2

CMS interno de SharemeChat (ver [ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md)) operativo en TEST en su Fase 2 — workflow editorial, versionado y eventos. Sigue sin IA y sin publicación pública.

Workflow editorial activo:

```text
IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED
                              ↑                ↓
                              └────────────────┘  (rechazo o reapertura desde APPROVED)
```

- estados alcanzables en Fase 2: `IDEA`, `OUTLINE_READY`, `DRAFT_GENERATED`, `IN_REVIEW`, `APPROVED`
- estados modelados pero **no operables** en Fase 2 (reservados para Fase 4): `SCHEDULED`, `PUBLISHED`, `RETRACTED`
- edición de metadata y body solo permitida en `IDEA`, `OUTLINE_READY`, `DRAFT_GENERATED`; el resto bloquea con 409
- ADMIN bypassa segregación generador↔aprobador y guardia de edición, pero **no** salta el workflow ni activa estados de Fase 4
- reapertura `APPROVED → DRAFT_GENERATED` permitida; al reenviar a revisión se crea una nueva versión

Backend:

- endpoints existentes Fase 1: `GET/POST/PATCH/DELETE /api/admin/content/articles`, `GET/PUT /api/admin/content/articles/{id}/body`
- endpoints nuevos Fase 2:
  - `POST /api/admin/content/articles/{id}/transition`
  - `GET  /api/admin/content/articles/{id}/versions`
  - `GET  /api/admin/content/articles/{id}/versions/{versionNumber}/body`
  - `GET  /api/admin/content/articles/{id}/events`
- tablas operativas: `content_articles`, `content_article_versions`, `content_review_events`
- tabla `content_generation_runs` sigue creada pero sin uso (Fase 3)
- migración Flyway `V20260501__content_phase1_schema.sql` sin cambios; Fase 2 reutiliza el schema completo

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

- bucket: `sharemechat-content-private-test`
- región: `eu-central-1`
- acceso: privado, exclusivamente desde backend; sin CloudFront, sin OAC, sin URLs firmadas
- key layout:
  - `content/articles/{id}/draft.md` (mutable)
  - `content/articles/{id}/v{n}.md` (inmutables)
- SSE-S3 (AES256) aplicada en cada `PutObjectRequest`, incluida la copia a versión

Seguridad:

- permisos backoffice usados en Fase 2: `CONTENT.VIEW`, `CONTENT.EDIT`, `CONTENT.REVIEW`
- `CONTENT.PUBLISH` reservado, sin uso operativo todavía (Fase 4)
- rol backoffice `EDITOR` creado, sin usuarios reales asignados
- acceso al panel cubierto por la regla genérica `/api/admin/**` de `SecurityConfig` (`ROLE_ADMIN` o `BO_ROLE_ADMIN`); el flag ADMIN se detecta inspeccionando authorities para aplicar bypass de segregación

Frontend backoffice:

- panel `Content CMS` y editor mantienen el layout de Fase 1
- editor añade barra dinámica de transiciones según estado actual y permisos del usuario
- inputs de metadata y body se deshabilitan en estados no editables; ADMIN salta la deshabilitación
- nuevo bloque de historial dentro del editor con dos columnas: versiones (con botón "Ver cuerpo" que carga el markdown inmutable de v{n}) y timeline de eventos
- placeholder de keywords actualizado a formato natural separado por comas

Limitaciones Fase 2 (sin cambios respecto a Fase 1):

- sin generación IA ni runs de modelo
- sin publicación pública; `blog-test.sharemechat.com` no se construye
- sin programación, sin retirada, sin disclosure override

Validación realizada con tráfico real en TEST:

- ciclo completo `IDEA → OUTLINE_READY → DRAFT_GENERATED → IN_REVIEW → APPROVED` correcto
- creación de versión `v1.md` en S3 al someter a revisión, con `body_content_hash` SHA-256 persistido en `content_article_versions` y `current_version_id` actualizado
- reapertura `APPROVED → DRAFT_GENERATED` y nuevo ciclo hasta `APPROVED` generan `v2.md` con hash distinto
- bloqueo de edición en estados no editables devuelve 409 con mensaje claro
- eventos `EDIT_APPLIED`, `OUTLINE_APPROVED`, `DRAFT_REQUESTED`, `REVIEW_APPROVED` y `REVIEW_REJECTED` insertados con `actor_user_id`, `version_id` cuando aplica y `payload_json` legible
- consistencia BD↔S3 verificada: `body_s3_key` de cada versión apunta a un objeto existente y descargable vía `GET /versions/{n}/body`
