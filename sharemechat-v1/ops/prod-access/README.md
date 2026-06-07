# prod-access — pipeline de seguridad perimetral PROD

Pipeline en tres componentes que clasifica el tráfico al EC2 PROD y
mantiene una lista de bloqueo dinámica. Réplica del modelo AUDIT/TEST
ya existentes (`audit-access*`, `test-access*`), adaptado a PROD y con
extensiones específicas del entorno productivo.

## Componentes

| Componente | Repo | Ruta viva | Frecuencia |
|---|---|---|---|
| **normalizer** | [`../prod-access-normalizer/`](../prod-access-normalizer/) | `/opt/sharemechat-prod-access-normalizer/` | timer cada ~5 min |
| **classifier** | [`../prod-access-classifier/`](../prod-access-classifier/) | `/opt/sharemechat-prod-access-classifier/` | tras normalizer |
| **blocker** | [`../prod-access-blocker/`](../prod-access-blocker/) | `/opt/sharemechat-prod-access-blocker/` | timer diario 05:30 UTC, Carril A real (`DRY_RUN=0`) |

(El cuarto componente `reporter` que existe en AUDIT/TEST aún no está
desplegado en PROD; se añadirá cuando se necesite el resumen diario.)

## Inputs / outputs

- **Inputs**: logs nginx (`/var/log/nginx/api.sharemechat.access.log`) +
  logs CloudFront (`s3://sharemechat-cf-logs-prod/`).
- **Output del blocker**: `/etc/nginx/deny-prod-ips.conf` (auto-generado,
  ver [`../prod-nginx/`](../prod-nginx/)).

## Cambios estructurales recientes

Ver [ADR-032](../../docs/06-decisions/adr-032-cloudfront-aware-perimeter-real-ip.md)
para el rediseño del 2026-06-07: real_ip CDN-aware en nginx para que el
pipeline opere sobre la IP REAL del cliente y no sobre la edge de
CloudFront + guard explícito en el blocker que rechaza banear IPs en
rangos `CLOUDFRONT_ORIGIN_FACING`.
