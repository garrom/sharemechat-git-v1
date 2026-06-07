# ADR-032: Perímetro CDN-aware en PROD — real_ip + sobreescritura XFF + guard anti-CloudFront en el blocker

## Estado

Aprobada e implementada el 2026-06-07. Snapshots de los ficheros vivos
versionados en [`ops/prod-nginx/`](../../ops/prod-nginx/) y
[`ops/prod-access-*`](../../ops/prod-access/).

## Contexto

PROD tiene tres capas de seguridad perimetral que cooperan:

1. **nginx** en el EC2 backend (`api.sharemechat.com`, EIP `3.77.59.1`)
   con un fichero `deny-prod-ips.conf` aplicado en contexto HTTP.
2. **Pipeline** `prod-access-normalizer` → `prod-access-classifier` →
   `prod-access-blocker` (3 componentes Python ejecutados por systemd
   timers). El normalizer ingiere logs nginx + CloudFront S3, el
   classifier puntúa por IP, el blocker (Carril A real,
   `DRY_RUN=0`) reescribe el `deny-prod-ips.conf` y recarga nginx.
3. **Tráfico legítimo** llega por DOS vías:
   - `sharemechat.com/api/*` → behavior CloudFront `/api/*` (origin
     `api.sharemechat.com:443`) → nginx.
   - `api.sharemechat.com:443/match` y `/messages` (WebSockets) →
     **directo** sin pasar por CloudFront (no hay behavior para esos
     paths).

Estado pre-fix (snapshot 2026-06-06):

- nginx **no tenía** `real_ip_module` configurado. `$remote_addr` era
  siempre el peer TCP. Para tráfico CF, eso era una IP edge CloudFront;
  para tráfico directo (WS, scanners), la IP real del cliente.
- El `access_log` de `api.sharemechat.com` usaba el `log_format combined`
  por defecto (9 campos, sin XFF) — así que el normalizer caía al
  fallback `remote_addr` para atribuir IP.
- El `deny` aplica sobre `$remote_addr`.
- En `location /api/`, nginx hacía
  `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` que
  acumula el XFF entrante con el `$remote_addr`. Sumado a
  `IpConfig.getClientIp` del backend (que toma la PRIMERA IP del XFF),
  esto permitía **spoofing**: cualquier petición directa con
  `X-Forwarded-For: <IP_allowlistada>` engañaba al backend para tomar
  esa IP como cliente.

### Problema observado

- El smoke de un cambio de remitente email lanzado a través de
  `sharemechat.com/api/*` (vía CDN) llegó al backend nginx desde una
  edge CF concreta del pool MAD56-P5 (`15.158.205.101`). El pipeline
  ya tenía esa edge baneada porque smokes anteriores (por la misma
  ruta CDN) habían generado patrones que el classifier marcó como
  MALICIOSA/CRÍTICA, atribuyéndolos a la edge CF (no al operador real).
- Cuando un edge CF queda en deny, una fracción aleatoria del tráfico
  CF legítimo recibe **403 desde nginx** sin llegar al backend.
- Adicionalmente, la vulnerabilidad spoofing de XFF significaba que el
  bypass de country-gate (`BYPASS_IPS=90.175.201.51`) era trivialmente
  evadible: pegar directo a `api.sharemechat.com` con
  `X-Forwarded-For: 90.175.201.51`.

## Decisión

Aplicar un perímetro **CDN-aware** end-to-end con cuatro cambios:

### 1. `real_ip_module` en nginx confiando solo en rangos CloudFront

Generar `/etc/nginx/cloudfront-origin-facing.conf` con las 45 CIDRs
publicadas por AWS en
`https://ip-ranges.amazonaws.com/ip-ranges.json` (filtro
`service=CLOUDFRONT_ORIGIN_FACING`) como líneas `set_real_ip_from <CIDR>;`.

En `server api.sharemechat.com:443`:
```nginx
include /etc/nginx/cloudfront-origin-facing.conf;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

Comportamiento:
- Cuando el peer TCP de nginx es un edge CloudFront (CIDR en la lista),
  nginx reescribe `$remote_addr` a la primera IP del XFF que
  CloudFront adjunta (= cliente real final).
- Cuando el peer no está en CIDR CF (WebSockets directos, scanners),
  el módulo no aplica y `$remote_addr` conserva la IP del peer real.
- El `deny`, el access log y el normalizer ven la **IP real** del
  cliente final en ambos casos.

### 2. Sobreescritura del XFF en `location /api/` (cierre del spoofing)

En `location /api/`:
```nginx
proxy_set_header X-Real-IP $remote_addr;          # (sin cambio)
proxy_set_header X-Forwarded-For $remote_addr;    # antes: $proxy_add_x_forwarded_for
```

`$remote_addr` post-real_ip es la IP real del cliente. nginx **descarta
el XFF entrante** y reescribe con lo que sabe que es confiable.

`location /match` y `location /messages` (WebSockets) NO se modifican:
mantienen `$proxy_add_x_forwarded_for`. Son flujos directos donde el
spoofing es menos relevante (un navegador no manda XFF arbitrario en un
WebSocket) y la decisión de tocar lo mínimo en flujos productivos
estables prevalece.

### 3. Limpieza de la deny-list

Eliminar `deny 15.158.205.101;` (única edge CF identificada en la
deny-list actual). Las otras 9 IPs son atacantes reales (varios VPS de
Azure, Rostelecom, etc., confirmado por filtrado contra
`CLOUDFRONT_ORIGIN_FACING`).

### 4. Guard anti-CloudFront en el blocker

Modificar `block_access.py` con una nueva función
`merge_cloudfront_cidrs(allowlist, path)` que parsea el mismo fichero
`cloudfront-origin-facing.conf` usado por nginx y añade los CIDRs como
redes a la `Allowlist` ya existente con comentario
`cloudfront_origin_facing`. Se invoca en `run_blocker` justo después
de cargar la allowlist manual.

Aunque el real_ip de nginx falle puntualmente y el classifier marque
una edge CF, el blocker la descarta como `skip_allowlisted` antes de
escribir el deny. Defensa en profundidad.

### 5. Refresh mensual de los CIDRs CloudFront

systemd timer `sharemechat-cf-cidrs-refresh.timer`:
`OnCalendar=*-*-01 03:00:00 UTC` + `RandomizedDelaySec=30m`. El
servicio ejecuta `refresh-cf-origin-facing.sh` que descarga
`ip-ranges.json`, filtra `CLOUDFRONT_ORIGIN_FACING`, reescribe
`/etc/nginx/cloudfront-origin-facing.conf`, hace `nginx -t` y
`nginx -s reload` si OK. Idempotente.

## Razonamiento

- **Por qué no añadir `XFF` al log_format**: el operador refinó
  explícitamente esta decisión durante la implementación. El normalizer
  prefiere `first_ip_from_xff(xff)` sobre `remote_addr` si está
  presente. Loguear el XFF crudo en el access log expondría al pipeline
  a spoofing trivial: un atacante directo con
  `X-Forwarded-For: <IP_objetivo>` mancharía las estadísticas y podría
  desplazar el ban hacia terceros. **La fuente única de verdad es
  `$remote_addr` después de real_ip**.
- **Por qué no aplicar la sobreescritura XFF también en `/match` y
  `/messages`**: minimizar riesgo en WebSockets productivos. El vector
  de spoofing es mucho más restringido en WS (un navegador real no
  envía XFF arbitrario en un upgrade), y la solución correcta para esos
  flujos es backend-side (`IpConfig` ignora XFF para conexiones WS o
  el backend usa peer IP). Se mantiene como deuda separada si se decide
  cerrar también ese vector.
- **Por qué un fichero común CIDR para nginx y blocker**: una sola
  fuente de verdad. El refresh mensual actualiza el fichero; nginx y el
  blocker ven los mismos CIDRs siempre. Sin sincronización adicional.
- **Por qué refresh mensual y no más frecuente**: AWS publica nuevos
  rangos CF unas pocas veces al mes. Mensual es suficiente; un slot
  mayor (semanal/diario) implica más carga sin beneficio operativo.

## Verificación en PROD

Ejecutado y validado el 2026-06-07:

1. `POST sharemechat.com/api/consent/age-gate` vía CF
   (IP del operador: 90.175.201.51):
   - Log nginx atribuye `90.175.201.51 ... "POST /api/consent/age-gate
     HTTP/1.1" 204` (antes habría sido la edge CF).
2. Registro real vía sharemechat.com:
   - Backend log: `REGISTER_CLIENT ... ip=90.175.201.51`.
3. Spoofing cerrado — curl directo
   `--resolve api.sharemechat.com:443:3.77.59.1` con
   `X-Forwarded-For: 1.2.3.4`:
   - Log nginx: `90.175.201.51 ... "POST /api/auth/login HTTP/2.0"`
     (el XFF spoofed se ignora).
4. WebSocket `/match` directo: log nginx `90.175.201.51 ... "GET /match
   HTTP/2.0"` (real_ip no aplica, peer no en CIDR CF).
5. Blocker dry-run: `loaded 45 CloudFront origin-facing CIDRs into
   allowlist`.
6. Timer mensual: `Next: 2026-07-01 03:03:47 UTC`.

## Consecuencias

### Positivas

- El pipeline de seguridad razona sobre la IP REAL del cliente final
  en todos los flujos (CDN o directo).
- Imposible volver a banear edges CF accidentalmente (guard explícito
  + real_ip que evita la causa raíz).
- Spoofing del XFF cerrado para `/api/*`. Mantiene la confianza en
  `BYPASS_IPS` del country-gate y similares.
- La fuente única de verdad de los CIDRs CF (un solo fichero) reduce
  drift.

### Riesgos / deuda residual

- WebSockets `/match` y `/messages` siguen usando
  `$proxy_add_x_forwarded_for`. Si en el futuro se exponen esos
  endpoints a clientes que pueden controlar XFF (no es el caso hoy con
  el navegador), revisar.
- El log nginx sigue siendo `combined` (sin XFF). El normalizer cae a
  `remote_addr` (que es la IP real post-real_ip). Si en el futuro se
  añade un log_format custom con campos extra, asegurarse de que el
  parseador del normalizer no se confunda.
- El fichero `cloudfront-origin-facing.conf` se autogenera mensualmente.
  El snapshot versionado en el repo puede quedar desactualizado entre
  refreshes; es un snapshot informativo, NO una fuente de verdad para
  el sistema.

## Referencias

- [ops/prod-nginx/README.md](../../ops/prod-nginx/README.md) —
  inventario de ficheros vivos nginx.
- [ops/prod-access-blocker/README.md](../../ops/prod-access-blocker/README.md) —
  explicación del guard anti-CloudFront.
- [ops/prod-access/README.md](../../ops/prod-access/README.md) —
  overview del pipeline.
- AWS `https://ip-ranges.amazonaws.com/ip-ranges.json` —
  fuente de los rangos CloudFront.
- nginx `ngx_http_realip_module` —
  `https://nginx.org/en/docs/http/ngx_http_realip_module.html`.
