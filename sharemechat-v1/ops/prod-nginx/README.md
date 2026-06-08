# nginx PROD — perímetro CDN-aware

Snapshots versionados de la configuración nginx viva en el EC2 PROD
(`api.sharemechat.com`, EIP `3.77.59.1`). Estos ficheros se mantienen
en el repo para reproducibilidad y disaster recovery; el contenido vivo
está en el EC2 PROD.

Fuente original de verdad: el EC2 PROD. **Si edita en producción, también
edite aquí y commitee** para mantener paridad.

## Ficheros

| Repo | Ruta viva en EC2 PROD | Función |
|---|---|---|
| `conf.d/api.sharemechat.com.conf` | `/etc/nginx/conf.d/api.sharemechat.com.conf` | Server `api.sharemechat.com:80,443`. `location /api/`, `^~ /api/auth/`, `^~ /api/users/register/`, `^~ /api/admin/auth/` (con `limit_req zone=auth burst=20 nodelay`), `/match`, `/messages`, `= /sitemap.xml`, `= /robots.txt`. Incluye CIDRs CF (`include /etc/nginx/cloudfront-origin-facing.conf`) + `real_ip_header X-Forwarded-For` + `real_ip_recursive on`. Define `limit_req_zone $binary_remote_addr zone=auth:10m rate=30r/m;` para los 3 locations abusables (H6 Lote 1). En todos los locations proxypaseados, sobrescribe `X-Real-IP` y `X-Forwarded-For` con `$remote_addr` (cierra spoofing). |
| `cloudfront-origin-facing.conf` | `/etc/nginx/cloudfront-origin-facing.conf` | CIDRs `CLOUDFRONT_ORIGIN_FACING` publicados por AWS, traducidos a líneas `set_real_ip_from <CIDR>;`. **Regenerado mensualmente por timer** (ver `cf-refresh/`). Snapshot. |
| `deny-prod-ips.conf` | `/etc/nginx/deny-prod-ips.conf` | Auto-generado por el `prod-access-blocker` (Carril A). Lista actual de IPs baneadas. Snapshot. |
| `deny-prod-ips.manual.conf` | `/etc/nginx/deny-prod-ips.manual.conf` | Bloqueos manuales del operador (vacío hoy). Preservado por el blocker. Snapshot. |
| `cf-refresh/refresh-cf-origin-facing.sh` | `/usr/local/sbin/refresh-cf-origin-facing.sh` | Descarga `https://ip-ranges.amazonaws.com/ip-ranges.json`, filtra `CLOUDFRONT_ORIGIN_FACING`, reescribe `/etc/nginx/cloudfront-origin-facing.conf`, `nginx -t` y reload si OK. Idempotente: si no hay cambios respecto al fichero vivo, no toca nada. |
| `cf-refresh/systemd/sharemechat-cf-cidrs-refresh.{service,timer}` | `/etc/systemd/system/` | Timer mensual (`OnCalendar=*-*-01 03:00:00 UTC`, `RandomizedDelaySec=30m`) que ejecuta el refresh. |

## Reglas operativas

- **`deny-prod-ips.conf` está auto-generado**: solo edítelo a través del blocker
  (modificar `manual.conf` para añadir manualmente; el blocker preserva esas
  entradas).
- **`cloudfront-origin-facing.conf` está auto-generado**: editar a mano es
  inútil; el timer mensual lo sobrescribe. Si se quiere fijar manualmente
  (no recomendado), deshabilitar el timer.
- **`api.sharemechat.com.conf`**: cualquier edición a mano debe replicarse
  aquí y commitearse para mantener paridad.

## Cambios estructurales recientes

Ver [ADR-032](../../docs/06-decisions/adr-032-cloudfront-aware-perimeter-real-ip.md)
para el rediseño del 2026-06-07 (real_ip CDN-aware + sobreescritura XFF +
limpieza falso positivo + timer mensual).

### 2026-06-08 — `limit_req` por IP en `/api/auth/`, `/api/users/register/`, `/api/admin/auth/` (H6 Lote 1)

Hardening defensivo de la auditoría 2026-06-08 (ver `docs/project-log.md`).
Añadido `limit_req_zone $binary_remote_addr zone=auth:10m rate=30r/m;` al
inicio del `.conf` y tres bloques `location ^~` específicos con
`limit_req zone=auth burst=20 nodelay;` aplicado SOLO a los tres prefijos
abusables. El `location /api/` genérico queda **SIN** `limit_req` (para
no estrangular crawlers en `/api/public/content/**` ni otros endpoints
públicos legítimos). Backup del .conf previo conservado en EC2 como
`/etc/nginx/conf.d/api.sharemechat.com.conf.bak-h6-20260608-*`.

Validado en PROD: burst `POST /api/auth/login` desde una IP → 429 tras
agotar burst; `GET /api/public/content/articles?locale=es ×5` → 200 ×5
sin throttling; `GET /sitemap.xml ×5` → 200 ×5 sin throttling.

### 2026-06-08 — locations `/sitemap.xml` y `/robots.txt` proxypaseados al backend

Añadidos dos bloques `location = /sitemap.xml` y `location = /robots.txt`
en `api.sharemechat.com.conf` justo antes del catch-all `location /` final.
Ambos proxypasean a `http://localhost:8080/<path>` con el patrón de
cabeceras del perímetro ADR-032 (`X-Real-IP = X-Forwarded-For =
$remote_addr`, **NO** `$proxy_add_x_forwarded_for`).

Motivo: el `SitemapController.java` del backend ya servía `/sitemap.xml`
dinámico con un `<url>` por (artículo, locale) + hreflang + `image:loc`,
y CloudFront `E2FWNC80D4QDJC` tenía behavior PathPattern=/sitemap.xml ->
api-prod-backend cableado, pero **nginx no tenía location para esos
paths** y devolvía 404 nativo antes de llegar al Spring Boot.

`/sitemap.xml` y `/robots.txt` son `permitAll` en `SecurityConfig`
(ADR-016 D9: GET y HEAD), no entran en el gate PRELAUNCH (no son
product paths), y no invocan `CountryAccessService` — accesibles a
Googlebot desde **cualquier IP**.

Backup del .conf previo conservado en EC2 como
`/etc/nginx/conf.d/api.sharemechat.com.conf.bak-sitemap-20260608-*`
(timestamp UTC del momento del cambio).
