# prod-access-normalizer

Normaliza logs nginx + CloudFront a un fichero diario JSONL canónico
para el [classifier](../prod-access-classifier/). Réplica del modelo
[audit-access-normalizer](../audit-access-normalizer/).

## Inputs

- nginx access log: `/var/log/nginx/api.sharemechat.access.log`.
- CloudFront S3 logs: `s3://sharemechat-cf-logs-prod/` (prefijos
  `product/` y `admin/`).

## Output

`/var/log/sharemechat-prod-access-normalizer/{YYYY-MM-DD}.events.jsonl`.

## Extracción de IP

Para nginx (`normalize_access.py` → `normalize_nginx_line`):
```python
"ip": first_ip_from_xff(xff) or remote_addr
```

Tras el fix CDN-aware del 2026-06-07
([ADR-032](../../docs/06-decisions/adr-032-cloudfront-aware-perimeter-real-ip.md)),
el access log nginx **NO incluye XFF** (combined default sin XFF), así
que el `xff` viene vacío y siempre se usa `$remote_addr`. Con el módulo
`real_ip` activo en nginx, `$remote_addr` ya es la IP REAL del cliente
final cuando viene de CloudFront, y es la IP del peer cuando viene
directo (WS, scanners). El normalizer atribuye correctamente.

## Schedule

systemd timer cada ~5 min
(`/etc/systemd/system/sharemechat-prod-access-normalizer.timer`).

## Archivos

| Repo | Ruta viva |
|---|---|
| `bin/normalize-prod-access.sh` | `/opt/sharemechat-prod-access-normalizer/bin/normalize-prod-access.sh` |
| `lib/normalize_access.py` | `/opt/sharemechat-prod-access-normalizer/lib/normalize_access.py` |
| `config/config.env.example` | `/etc/sharemechat-prod-access-normalizer/config.env` |
| `systemd/*.service` | `/etc/systemd/system/` |
| `systemd/*.timer` | `/etc/systemd/system/` |
