# Entorno AUDIT

## Proposito

AUDIT se plantea como un entorno aislado para revision, validacion y preparacion de auditorias sin interferir con TEST.

## Hosts canónicos

Decisión documentada en [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md). Resumen para AUDIT:

- Producto público: `https://audit.sharemechat.com` (apex sin www)
- Variante con www: `https://www.audit.sharemechat.com` → 301 al apex
- Backoffice: `https://admin.audit.sharemechat.com`
- API y realtime: bajo el host del producto, paths `/api/...`, `/messages`, `/match`
- Blog: subdirectorio `https://audit.sharemechat.com/blog/<slug>` (operativo solo si en algún momento AUDIT publica blog; hoy AUDIT no es entorno editorial)
- Activos legales: `https://assets.sharemechat.com/legal/...` (compartido)
- Cookie domain: `.audit.sharemechat.com`

## Aporte util consolidado del material previo

La documentacion previa permite sostener que AUDIT:

- replica la topologia logica de TEST
- dispone de superficie publica, superficie admin, backend y assets dedicados
- tiene profile de aplicacion propio
- utiliza base de datos separada
- se preparo con saneado funcional de datos para evitar arrastrar actividad operativa de TEST

## Estado documentable

AUDIT debe entenderse como entorno construido y funcional a nivel base, con estos hitos ya absorbidos a nivel logico:

- aislamiento de aplicacion y datos
- base de datos preparada como entorno limpio
- despliegue previsto para frontend, backend y validacion end-to-end
- despliegue TURN minimo ya implementado a nivel de infraestructura para validacion funcional y diagnostico

## Saneado aplicado

Se elimina del corpus principal el detalle de:

- identificadores de distribuciones y certificados
- buckets concretos
- endpoints exactos de base de datos
- direcciones IP publicas
- security groups y subnets especificas

## Riesgos y dudas

- la documentacion previa detectaba diferencias de fallback SPA entre TEST y AUDIT en la capa edge
- el realtime del entorno depende de Redis como componente operativo adicional al backend HTTP y WebSocket
- la validacion de uploads privados en AUDIT ya opera sobre S3 privado, pero el mismo nivel de activacion y validacion todavia puede seguir pendiente en otros entornos

Estos puntos deben revisarse cuando se actualice especificamente la documentacion y validacion tecnica del entorno AUDIT.

## Trazabilidad minima de accesos

AUDIT ya dispone de trazabilidad minima operativa de accesos sin cambios adicionales de arquitectura de aplicacion.

El estado documentable de esta mejora queda asi:

- la capa publica registra accesos de las superficies `audit` y `admin.audit`
- el vhost API/realtime del backend aporta trazabilidad complementaria para `/api`, `/match` y `/messages`
- la IP real del cliente puede correlacionarse en backend mediante cabeceras reenviadas por la cadena de proxies
- esta mejora aumenta la observabilidad operativa del entorno, pero no debe leerse como un sistema completo de seguridad, antiabuso o monitorizacion avanzada

## Storage privado activo

AUDIT ya opera con proveedor S3 privado para uploads sensibles sin cambios adicionales de arquitectura en frontend ni en backend.

La activacion funcional ha requerido en el despliegue del backend, como minimo:

- `APP_STORAGE_TYPE=s3`
- `APP_STORAGE_S3_BUCKET`
- `APP_STORAGE_S3_REGION`

Configuracion opcional segun el entorno real:

- `APP_STORAGE_S3_KEY_PREFIX`
- `APP_STORAGE_S3_ENDPOINT`
- `APP_STORAGE_S3_PATH_STYLE_ACCESS`
- `APP_STORAGE_S3_SERVER_SIDE_ENCRYPTION`

La aplicacion usa credenciales AWS estandar del host mediante `DefaultCredentialsProvider`, por lo que no necesita secretos hardcodeados en codigo ni en properties versionadas. La validacion operativa de AUDIT confirmo que este punto exige un instance profile operativo en la maquina del backend.

La validacion funcional de AUDIT ya ha confirmado:

- subida correcta de documentos a traves del backend
- lectura del media solo a traves de `/api/storage/content`
- acceso autenticado segun la matriz de roles ya documentada
- ausencia de dependencia operativa de `/usr/share/nginx/html/uploads`

El legacy asociado a referencias historicas `/uploads/...` ya ha quedado eliminado en AUDIT:

- limpieza completa de referencias persistidas antiguas
- eliminacion del filesystem local legado como fuente activa de estos uploads
- operacion efectiva del entorno exclusivamente sobre S3 privado y proxy backend

El error posterior de validacion de fichero ya pertenece a otra linea de trabajo y no a la activacion de infraestructura S3.

## Límite HTTP de subida

La subida de media grande en AUDIT depende tambien del limite efectivo de la capa HTTP publica y de Nginx.

Con los limites backend actualmente versionados:

- `spring.servlet.multipart.max-file-size=50MB`
- `spring.servlet.multipart.max-request-size=60MB`

la configuracion operativa de Nginx debe quedar alineada para no rechazar antes de tiempo peticiones multipart validas para backend. El ajuste minimo documentado para este entorno es fijar `client_max_body_size` en `60M`.

En una iteracion posterior se realizo una nivelacion controlada del vhost API de AUDIT respecto a TEST, sin tocar el `nginx.conf` base ni arrastrar bloques legacy no necesarios. Quedaron alineados en ese vhost:

- headers forward relevantes para `/api`, `/match` y `/messages`
- timeouts largos de `/messages`
- headers razonables de hardening a nivel server
- cierre explicito de rutas no previstas con `404`

La comparacion del resto de configuracion Nginx fuera de ese vhost sigue dependiendo de extraer y revisar los ficheros reales de entorno, porque no estan versionados en el repositorio principal.

## Realtime operativo

AUDIT ya ha validado funcionamiento completo de realtime tras nivelar la publicacion de WebSocket y completar la dependencia de Redis en la maquina del backend.

Para este entorno, Redis debe considerarse dependencia obligatoria del matching y de la coordinacion realtime, con servicio activo en localhost sobre el puerto esperado por la aplicacion.

## TURN minimo operativo

AUDIT ya dispone de una implementacion minima de TURN fuera del repositorio principal, ejecutada como despliegue operativo del entorno y alineada con la estrategia por entorno ya documentada.

El estado documentable de esta fase es:

- una unica instancia TURN para el entorno
- sin alta disponibilidad
- orientada a validacion funcional y diagnostico
- relay publicado sin depender de un camino operativo de media basado en NAT gestionado para esta fase minima

La evidencia operativa ya obtenida en el propio servidor TURN confirma actividad funcional de relay a nivel de protocolo:

- `ALLOCATE` procesado con exito
- `CREATE_PERMISSION` procesado con exito
- `CHANNEL_BIND` procesado con exito

La validacion tecnica principal de esta fase ya queda confirmada tambien desde la aplicacion:

- backend AUDIT consumiendo configuracion TURN por entorno
- `/api/webrtc/config` operativo
- frontend consumiendo configuracion ICE servida por backend
- evidencia frontend de `candidateType=relay`
- evidencia frontend de `ICE selected pair: relay (TURN)`
- evidencia frontend de `iceConnectionState=connected`
- evidencia frontend de `connectionState=connected`

La validacion funcional end-to-end de AUDIT ya confirma ademas:

- sesiones RANDOM confirmadas
- streaming visible
- gifts RANDOM operativos sobre sesiones confirmadas

La base operativa estable de TURN en AUDIT queda ademas cerrada con estos criterios ya validados:

- el arranque deja de hacerse con comandos manuales ad hoc y pasa a estar gestionado por un servicio persistente de systemd del entorno
- el servicio queda habilitado para arrancar automaticamente tras reinicio completo de la maquina
- la validacion operativa posterior al reboot confirma que el servicio vuelve en estado `active (running)` sin intervencion manual
- la configuracion runtime estable ya no depende del certificado de ejemplo de coturn y usa certificado valido del entorno
- la validacion final no se limita al proceso levantado: la aplicacion confirma uso real de relay TURN con candidatos `relay`, selected pair `relay (TURN)` y reproduccion remota funcional

Con ello, la fase minima de TURN en AUDIT puede darse por cerrada a nivel operativo del entorno.

El siguiente paso natural no es reabrir arquitectura en AUDIT, sino replicar de forma controlada el mismo patron en TEST manteniendo la misma logica de aplicacion.

## Product Operational Mode (operativo, alcance parcial)

La capa Product Operational Mode (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)) está activa en AUDIT con configuración aplicada en `/opt/sharemechat/.env`:

- `PRODUCT_ACCESS_MODE=OPEN`
- `PRODUCT_REGISTRATION_CLIENT_ENABLED=false`
- `PRODUCT_REGISTRATION_MODEL_ENABLED=false`
- `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`

Arranque del backend mediante `sharemechat-audit.service` (systemd). Logs `[PRODUCT-MODE]` persistentes en `journald`, verificables con `sudo journalctl -u sharemechat-audit -f`.

Resultado verificado con tráfico real:

- `POST https://audit.sharemechat.com/api/users/register/client` → 503 `REGISTRATION_CLOSED`
- `POST https://audit.sharemechat.com/api/users/register/model` → 503 `REGISTRATION_CLOSED`
- login de usuarios existentes opera con normalidad; `AuthRiskService` activo con `env=audit`
- sin regresión observada sobre matching, sesiones realtime, gifts ni resto de flujos de producto

La simulación económica directa queda cerrada por defecto para evitar acreditación de saldo sin PSP y contaminación de datos de revisión externa. Si se ejercita revisión CCBill en AUDIT, debe hacerse sobre el flujo PSP correspondiente, no mediante endpoints directos de simulación salvo decisión operativa puntual.

Detalle operativo y procedimiento en [runbooks.md](../04-operations/runbooks.md).

## Schema CMS bilingüe v2 (preparado, sin contenido)

Tras el cierre del frente 10.A (nivelación AUDIT a TEST, paquete 10.A.3), AUDIT cuenta con el mismo schema CMS bilingüe que TEST según [ADR-025](../06-decisions/adr-025-flyway-introduction-and-cms-v2-schema.md):

- Flyway adoptado como herramienta de migración de schema. `flyway_schema_history` con dos filas: baseline `V1` (aplicado manualmente vía SQL, marca el schema preexistente como "ya en versión 1, no apliques V1") y `V2` (aplicado automáticamente por Spring Boot al arrancar, crea las 6 tablas `content_*`).
- 6 tablas del modelo bilingüe creadas: `content_articles` (artículo lógico, locale-invariante), `content_article_translations` (cara per-idioma, UNIQUE por `(article_id, locale)` y por `(slug, locale)`), `content_article_versions` (snapshot del artículo lógico en una transición `DRAFT → IN_REVIEW`), `content_article_translation_versions` (snapshot per-idioma en esa versión), `content_generation_runs` (runs IA) y `content_review_events` (auditoría editorial).
- Bucket S3 privado dedicado al CMS: `sharemechat-content-private-audit` (`eu-central-1`, PAB total, SSE-S3 AES256 + BucketKey, sin política de bucket; acceso vía IAM role `sharemechat-ec2-audit-role` con policy inline `SharemechatContentPrivateAuditRW` que cubre `s3:GetObject/PutObject/DeleteObject` sobre objetos y `s3:ListBucket` sobre el bucket).
- Variables del `.env` del backend AUDIT ampliadas con las tres keys del CMS bilingüe:
  - `APP_STORAGE_S3_CONTENT_PRIVATE_BUCKET=sharemechat-content-private-audit`
  - `APP_STORAGE_S3_CONTENT_PRIVATE_KEY_PREFIX=content`
  - `APP_STORAGE_S3_CONTENT_REGION=eu-central-1`

AUDIT no es entorno editorial: el CMS queda **operativo pero sin contenido cargado**. Las tablas existen vacías. Los endpoints `/api/admin/content/**` (admin) y `/api/public/content/articles*` (público) responden correctamente; `GET /api/public/content/articles?locale=es` devuelve `200 application/json` con lista vacía. Reservado para que cuando se quiera publicar contenido específicamente en AUDIT (revisión externa, validación PSP) la infraestructura ya esté lista sin requerir nuevo paquete.

## CloudFront alineado con TEST (post 10.A.2)

La distribución frontend público AUDIT (`audit.sharemechat.com`) tiene los dos fixes aplicados en el paquete 10.A.2:

- Behavior `/.well-known/acme-challenge/*` con cache policy `Managed-CachingDisabled` (idéntico al patrón canónico ACME post-corrección de TEST en 10.A.0). Hoy AUDIT no usa Certbot vía CloudFront (`audit.sharemechat.com` se cubre con ACM de validación DNS; `api.audit.sharemechat.com` se renueva por nginx directo sin pasar por edge), pero el behavior queda limpio para uso futuro.
- `CustomErrorResponses` vacío (`Quantity=0`). El SPA-fallback queda gestionado por la CloudFront Function `redirect-spa-audit` asociada al `viewer-request` del `DefaultCacheBehavior`, sin enmascaramiento de 403/404 del backend. Detalle en [incident-notes.md](../04-operations/incident-notes.md) sección "Fix CloudFront AUDIT 2026-05-21 (paquete 10.A.2)".

## Red de seguridad de mantenimiento (overlay SPA, paquete 10.A.3.pre)

El frontend desplegado en AUDIT (build idéntico al de TEST) incluye `MaintenanceProvider` con un overlay full-screen bilingüe que se activa automáticamente cuando el interceptor HTTP detecta 502/503/504 o `Content-Type: text/html` en una respuesta API. El overlay bloquea toda interacción del usuario y monta un poll cada 30 s a `/api/users/me`; cuando el backend vuelve a responder JSON, el overlay desaparece solo.

Ventajas operativas observadas durante el cierre de 10.A.3:

- ventana de mantenimiento del backend AUDIT (parada → JAR nuevo → Flyway baseline + V2 → arranque) **77 segundos totales** (`systemctl stop` a `Started SharemechatV1Application in 29.955 seconds` desde el log)
- el frontend desplegado antes de parar el backend mostraba la SPA normal con backend arriba, sin overlay falso
- el bucket `sharemechat-maintenance` con HTML estático en `/audit/index.html` queda como red secundaria preparada (no asignada a ningún OriginGroup en la distribución, por las limitaciones AWS documentadas en el paquete 10.A.3.pre)

## Cierre frente 10.A — Nivelación AUDIT completada

Estado del entorno post-paquete 10.A.3:

- **Backend**: `sharemechat-audit.service` corre el JAR `sharemechat-v1-0.0.1-SNAPSHOT.jar` del **2026-05-22** con todo el código de los paquetes 6-9 del rediseño CMS bilingüe (ADR-022 a ADR-026). JAR antiguo del 2026-05-02 conservado como `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.10A3` para rollback rápido durante el periodo de observación.
- **Backup BD pre-cambio**: `s3://sharemechat-backups/audit/audit-backup-2026-05-20-2119.sql.gz` (SHA256 `79f84a85f97446f010b64a514ec71f27c7b122f6ced5b4228fbe3ad5b6b491f8`).
- **Backup `.env`**: `/opt/sharemechat/.env.bak.10A3.2026-05-22` en la EC2 AUDIT.
- **Schema BD**: 50 tablas totales (43 originales no-CMS + 6 `content_*` nuevas + `flyway_schema_history`). MySQL 8.4.7. Hibernate `ddl-auto=validate` pasa sin errores.

El siguiente paso del roadmap natural es PROD: replicar el patrón AUDIT validado, esta vez sin la nivelación incremental (PROD se monta desde cero con Flyway aplicando `V1__baseline.sql` + `V2__cms_v2_schema.sql` en orden, sin baseline manual).
