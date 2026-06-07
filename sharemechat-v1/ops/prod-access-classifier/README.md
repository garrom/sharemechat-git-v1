# prod-access-classifier

Clasifica eventos normalizados en `SOSPECHOSA / MALICIOSA / CRÍTICA`
agrupados por IP, aplicando reglas de patrón (hostile routes, hostile
UAs, sensitive routes) + reglas de volumen, status y coherencia.

Réplica del modelo [audit-access-classifier](../audit-access-classifier/).

## Input

`/var/log/sharemechat-prod-access-normalizer/{YYYY-MM-DD}.events.jsonl`.

## Output

- `/var/log/sharemechat-prod-access-classifier/{YYYY-MM-DD}.summary.jsonl`
- `/var/log/sharemechat-prod-access-classifier/{YYYY-MM-DD}.table.txt`

## Allowlist

Configurada en `config.env`:
- `ALLOWLIST_IPS=90.175.201.51` (IP del operador).

IPs allowlisted devuelven `main_reason=allowlisted_ip` con score=0.

## Schedule

systemd, encadenado tras el normalizer.

## Reglas (extracto)

| Regla | main_reason | Score base | Floor |
|---|---|---|---|
| `/bin/sh` | `shell_probe` | 95 | CRÍTICA |
| `/.env` | `dotenv_probe` | 70 | — |
| `/vendor/phpunit/` | `phpunit_probe` | 75 | — |
| UA `zgrab` | `ua_zgrab` | 75 | MALICIOSA |
| UA `sqlmap` | `ua_sqlmap` | 85 | CRÍTICA |
| UA `masscan` | `ua_masscan` | 85 | CRÍTICA |
| status 5xx ≥ 3 | `server_errors` | +12 | — |
| high 404 ratio | `high_404_ratio` | +25 | — |

Floor según score: SOSPECHOSA <40 <MALICIOSA <70 <CRÍTICA.
Acción `actuar` para CRÍTICA, propuesta al [blocker](../prod-access-blocker/).

## Archivos

| Repo | Ruta viva |
|---|---|
| `bin/classify-prod-access.sh` | `/opt/sharemechat-prod-access-classifier/bin/classify-prod-access.sh` |
| `lib/classify_access.py` | `/opt/sharemechat-prod-access-classifier/lib/classify_access.py` |
| `config/config.env.example` | `/etc/sharemechat-prod-access-classifier/config.env` |
| `systemd/*.service` | `/etc/systemd/system/` |
| `systemd/*.timer` | `/etc/systemd/system/` |

## Cambios estructurales

Ver [ADR-032](../../docs/06-decisions/adr-032-cloudfront-aware-perimeter-real-ip.md):
tras el fix CDN-aware de nginx (2026-06-07), los eventos atribuidos al
nginx access log usan la IP real del cliente final (no la edge CF). Esto
hace que el classifier evalúe correctamente comportamiento por IP real
en lugar de agregar artificialmente todo el tráfico CF a un puñado de
edges.
