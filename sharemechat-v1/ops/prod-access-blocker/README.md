# prod-access-blocker

Blocker del pipeline de seguridad PROD. Lee la salida del
[classifier](../prod-access-classifier/) (resumen diario JSONL) y
mantiene `/etc/nginx/deny-prod-ips.conf` con las IPs marcadas como
`actuar`. Carril A real (`DRY_RUN=0`): escribe el fichero, ejecuta
`nginx -t` pre/post y `nginx -s reload` si OK.

## CloudFront guard (extensión específica de PROD, 2026-06-07)

A diferencia de AUDIT/TEST, este blocker **rechaza incondicionalmente
banear cualquier IP que caiga en los rangos
`CLOUDFRONT_ORIGIN_FACING`** publicados por AWS.

- Implementación: función `merge_cloudfront_cidrs()` en
  [`lib/block_access.py`](lib/block_access.py) que parsea los CIDRs de
  `set_real_ip_from <CIDR>;` desde
  `/etc/nginx/cloudfront-origin-facing.conf` (la misma fuente única de
  verdad que nginx usa para `real_ip`) y los inyecta en la allowlist
  como redes CIDR con comentario `cloudfront_origin_facing`.
- Se invoca en `run_blocker` justo después de cargar la allowlist
  manual.
- Logging al ejecutar:
  `loaded 45 CloudFront origin-facing CIDRs into allowlist`.
- Aunque el classifier sugiera banear una edge IP por confusión,
  el blocker la descarta con acción `skip_allowlisted`.

Motivación: ver
[ADR-032](../../docs/06-decisions/adr-032-cloudfront-aware-perimeter-real-ip.md).

## Carriles

| Carril | TTL | Acción |
|---|---|---|
| A | 30 días | **Real**: escribe deny + reload |
| B | 14 días, ventana 7 días | Advisory (solo propuesta) |
| C | n/a | Advisory (observación) |

## Inputs / outputs

- Input: `/var/log/sharemechat-prod-access-classifier/{YYYY-MM-DD}.summary.jsonl`
- Estado persistente: `/var/lib/sharemechat-prod-access-blocker/ips.json`
- Output Carril A: `/etc/nginx/deny-prod-ips.conf`
- Output advisory: `/var/log/sharemechat-prod-access-blocker/`
- Allowlist (3 fuentes):
  1. `ALLOWLIST_IPS` (env CSV)
  2. `ALLOWLIST_FILE` (un CIDR por línea)
  3. **CIDRs CloudFront** (cargados desde `cloudfront-origin-facing.conf`, fix 2026-06-07)

## Archivos

| Repo | Ruta viva | Función |
|---|---|---|
| `bin/block-prod-access.sh` | `/opt/sharemechat-prod-access-blocker/bin/block-prod-access.sh` | Wrapper bash que lee config, lockfile, delega a `lib/block_access.py`. |
| `lib/block_access.py` | `/opt/sharemechat-prod-access-blocker/lib/block_access.py` | Lógica de decisión, Allowlist, escritura del deny, `merge_cloudfront_cidrs()`. |
| `config/config.env.example` | `/etc/sharemechat-prod-access-blocker/config.env` | Plantilla; copiar y editar al desplegar (NO commitear los valores reales). |
| `systemd/*.service` | `/etc/systemd/system/` | Unit oneshot. |
| `systemd/*.timer` | `/etc/systemd/system/` | Diario 05:30 UTC. |
