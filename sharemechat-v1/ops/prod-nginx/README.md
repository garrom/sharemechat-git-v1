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
| `conf.d/api.sharemechat.com.conf` | `/etc/nginx/conf.d/api.sharemechat.com.conf` | Server `api.sharemechat.com:80,443`. `location /api/`, `/match`, `/messages`. Incluye CIDRs CF (`include /etc/nginx/cloudfront-origin-facing.conf`) + `real_ip_header X-Forwarded-For` + `real_ip_recursive on`. En `/api/` sobrescribe `X-Real-IP` y `X-Forwarded-For` con `$remote_addr` (cierra spoofing). |
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
