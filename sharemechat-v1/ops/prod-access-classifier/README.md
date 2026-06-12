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

### Veredicto operativo (cabecera, adición 2026-06-12)

Cada `.table.txt` arranca con una línea `VEREDICTO: [V|A|R] ...` que resume si el día requiere o no acción del operador. El `.summary.jsonl` arranca con una línea adicional `{"type": "verdict", ...}` con los mismos datos en estructura. Las filas existentes (una por IP) no cambian. Niveles:

- **VERDE — SIN ACCIÓN**: nada que revisar. Por defecto. Aunque haya muchas IPs MALICIOSA/CRITICA, si todos los sondeos acabaron en 404 y no hay anomalías agregadas, el día es verde.
- **AMARILLO — REVISAR**: solo dos condiciones, ambas pensadas para ser raras:
  1. **Pico de IPs CRITICA**: `> 3×` la media de los últimos 7 días Y `≥ 15` en absoluto. Combinar el multiplicador con un floor evita disparar AMARILLO en días tranquilos con poca línea base.
  2. **`2xx` en endpoint `/api/*` protegido** desde una IP no-allowlisted, entendiendo "protegido" como cualquier ruta `/api/*` que no esté en `/api/public/*` ni sea `sitemap.xml`/`robots.txt`. Un `200` ahí es fuga real (endpoint protegido devolviendo cuerpo a tráfico no autenticado y no autorizado). **Los `2xx` del frontend NO disparan** porque nginx hace SPA fallback (`try_files $uri /index.html`) y devuelve `200 + index.html` para cualquier ruta extensionless, incluidas rutas que no existen — eso no es fuga, es la cáscara del SPA. Por la misma razón whitelistar rutas SPA no funciona (un scanner pide rutas aleatorias que también dan 200 y no estarían en la lista).
- **ROJO — ACTÚA**: una IP no-allowlisted obtuvo `2xx` en una ruta sensible (`.env`, `.git`, `.aws`, `actuator`, `wp-admin`, `wp-login`, `xmlrpc.php`, `cgi-bin`, `vendor`, `phpmyadmin`, `config`, etc.); o éxito de auth-abuse (login exitoso tras `>=5` fallos previos misma IP; `>100` POST a `/api/auth/*` o `/api/users/register/*` desde una IP); o señal de DoS (`>200k` eventos totales en el día, o una IP individual `>5000` requests).

### Nota informativa dentro del bloque VERDE

Cuando una IP no-allowlisted sondea rutas `/api/*` no-pública-conocida y todas fallan (401/404), el veredicto sigue siendo VERDE — es la autenticación funcionando, no es accionable. El dato se conserva como **nota informativa** en `verdict.notes[]` del `.summary.jsonl` y como línea `(nota) ...` debajo del veredicto en el `.table.txt`. Umbral por defecto: una IP con `≥ 10` sondeos.

### Restricción al éxito real

Solo `2xx` cuenta como éxito; los `3xx` (redirects de nginx, p.ej. SPA fallback o HTTPS canónica) NO se consideran éxito real del atacante. Umbrales y rutas sensibles documentados como constantes `VERDICT_*` al final de `lib/classify_access.py`.

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
