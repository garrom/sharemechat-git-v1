# TEST Access Blocker

Componente operativo externo que, a partir del summary diario del clasificador de TEST, propone y (opcionalmente) aplica un bloqueo controlado en nginx para TEST. No pertenece a la aplicacion Java ni al frontend.

Soporta dos modos de operacion, seleccionados via `DRY_RUN` en `config.env`:

**DRY_RUN=1** (modo seguro, default en TEST — activo en esta fase):

- NO escribe `/etc/nginx/deny-test-ips.conf`
- NO ejecuta `nginx -t` ni `systemctl reload nginx`
- SOLO genera propuesta de deny list, diff razonado y estado persistente

**DRY_RUN=0** (modo real controlado, solo Carril A — preparado, NO activado en TEST todavia):

- aplica bloqueo real en nginx **exclusivamente** para IPs de Carril A
- Carril B y Carril C continuan siendo solo propuesta advisory
- **preserva bloqueos manuales**: lee `deny-test-ips.manual.conf` (si existe) y lo incluye intacto en el fichero live; las IPs ya presentes en manual no se duplican; el fichero manual nunca se modifica
- ejecuta doble `nginx -t` (preflight + postflight) con rollback automatico si falla
- hace backup con timestamp del fichero anterior antes de reemplazar
- ejecuta `systemctl reload nginx` solo si ambos `nginx -t` pasan
- en caso de fallo en reload: restaura backup y fuerza reload previo

El modo real en TEST se activara cuando se complete el checklist de activacion (ver seccion correspondiente). **En TEST `DRY_RUN` permanece en `1` hasta ese momento.**

## Estado real en TEST

A fecha de hoy este componente ya queda:

- implementado en el repositorio bajo `ops/test-access-blocker/`
- desplegado en EC2 TEST en `/opt/sharemechat-test-access-blocker`
- configurado en:
  - `/etc/sharemechat-test-access-blocker/config.env` (`DRY_RUN=1`)
  - `/etc/sharemechat-test-access-blocker/allowlist.conf`
- instalado en systemd con:
  - `sharemechat-test-access-blocker.service`
  - `sharemechat-test-access-blocker.timer`
- activo en **modo DRY-RUN**, con ejecucion diaria a `05:45 UTC`
- generando salidas reales en `/var/log/sharemechat-test-access-blocker/`
- manteniendo estado persistente real en `/var/lib/sharemechat-test-access-blocker/ips.json`

Este estado NO implica bloqueo real. En TEST sigue siendo cierto que:

- NO escribe `/etc/nginx/deny-test-ips.conf`
- NO ejecuta `nginx -t`
- NO hace `systemctl reload nginx`
- NO bloquea trafico real

El componente esta completamente preparado para modo real (Carril A), pero NO se activa en TEST en esta fase. TEST actua como entorno de observacion validada antes de cualquier activacion de bloqueo real.

## Relacion con AUDIT

La politica y la logica son identicas a `ops/audit-access-blocker/`. Este componente replica el mismo patron adaptando unicamente:

- nombres de binarios (`block-test-access.sh`)
- rutas operativas (`/opt/sharemechat-test-access-blocker`, etc.)
- rutas de entrada (`/var/log/sharemechat-test-access-classifier/`)
- units systemd (`sharemechat-test-access-blocker.*`)
- ventana horaria del timer (`05:45 UTC` en TEST vs `05:30 UTC` en AUDIT para no solapar)
- comentarios y documentacion de allowlist (tipicamente mas amplia en TEST)

No hay reglas distintas, ni umbrales distintos, ni carriles distintos. Misma politica A/B/C.

## Responsabilidad

- leer el `summary.jsonl` diario del clasificador de TEST
- aplicar la politica de decision en tres carriles (A, B, C) heredada de AUDIT
- respetar una allowlist por IP y CIDR
- mantener estado persistente por IP (historial hostil + bloqueo propuesto)
- generar propuesta de deny list para revision humana
- generar diff / resumen de decisiones
- generar snapshot diario del estado persistente

## Entrada

Ruta operativa esperada en EC2 TEST:

- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`

Del summary se consumen los campos:

- `ip`
- `classification`
- `score`
- `main_reason`
- `features.hostile_ioc_count`
- `evidence.hostile_hits` (IOCs en rutas hostiles)
- `evidence.matched_rule_labels` (UA scanners, overrides)

## Salida

Ruta operativa en EC2 TEST:

- `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.deny-test-ips.proposed.conf`
- `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.blocker-diff.txt`
- `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.ips.json`

Y el estado persistente acumulado:

- `/var/lib/sharemechat-test-access-blocker/ips.json`

El fichero `.proposed.conf` usa sintaxis similar a nginx (`deny <IP>;`) para facilitar revision visual, pero nunca se carga automaticamente.

## Politica de decision

Identica a AUDIT. Resumen:

### Carril A - bloqueo propuesto con TTL largo (30 dias por defecto)

Se activa si la IP cumple al menos una de estas condiciones en el dia:

- IOC de UA scanner con firma conocida: `ua_sqlmap`, `ua_masscan`, `ua_zgrab`, `ua_nikto`, `ua_nmap`
- IOC `shell_probe` (ejecucion remota tipica)
- override `hostile_plus_admin_sensitive` activo (IOC hostil + ruta admin sensible)
- `classification=CRITICA` AND `hostile_ioc_count >= 1` sobre el conjunto de rutas hostiles
- 2 o mas rutas hostiles distintas probadas el mismo dia

### Carril B - bloqueo propuesto con TTL medio (14 dias por defecto)

Se activa si la IP cumple todas estas condiciones sobre la ventana deslizante (7 dias por defecto):

- IOC hostil de ruta repetido en al menos 2 dias distintos de la ventana
- al menos un dia de la ventana con `classification` `MALICIOSA` o `CRITICA`

El carril A tiene prioridad sobre el carril B. Una IP ya bloqueada en A no se degrada a B.

### Carril C - observar, no bloquear

Resto de casos, incluyendo:

- `NORMAL` / `SOSPECHOSA` sin IOC hostil
- picos de volumen sin IOC hostil reproducible
- `MALICIOSA` / `CRITICA` motivadas por volumen, rutas sensibles o comportamiento sin IOC hostil en ruta hostil repetido
- IOC hostil aislado (primera aparicion, sin repeticion que active Carril B)

Los `reasons` en el diff reflejan la causa concreta:

| Situacion en Carril C | Mensaje en diff |
|----------------------|----------------|
| IOC hostil presente pero aislado | `"IOC hostil aislado sin repeticion ni criterio Carril A"` + `"iocs_today=<label>"` |
| MALICIOSA/CRITICA por volumen/sensibles, sin IOC hostil de ruta | `"clasificacion=MALICIOSA sin IOC hostil en ruta hostil; score=...; main_reason=..."` |
| NORMAL/SOSPECHOSA sin IOC | `"no IOC hostil relevante"` |

### Extraccion de IOC hostil

`extract_hostile_iocs()` consulta cuatro fuentes en orden, sin duplicar:

1. `evidence.hostile_hits` — campo canonico; contiene los IOCs de rutas hostiles acumulados por el clasificador.
2. `evidence.matched_rule_labels` — cubre UA scanners y IOC de ruta que aparecen solo en las etiquetas de reglas.
3. `matched_rules` del row principal — fallback si `evidence` esta ausente o incompleto.
4. `main_reason` — parseo por token con `re.split`; cubre casos como `xmlrpc_scan+many_routes_6` donde el IOC va prefijado al reason de volumen.

Los tokens de volumen (`many_routes_*`, `request_burst_*`, `multi_host`, `query_heavy`) NO se extraen como IOC hostil.

### Allowlist

Soporta IPs (IPv4) y rangos CIDR. En TEST la allowlist tiende a ser mas amplia que en AUDIT por la existencia de trafico legitimo de pruebas manuales, testers y QA. Aun asi debe mantenerse minima y auditada; cada entrada con su comentario.

## Estado persistente

Igual que AUDIT: `ips.json` con `first_seen`, `last_seen`, `hostile_days[]` (ventana de ~60 dias tras prune) y `block` con carril, TTL, `opened_at`, `expires_at` y razones. El run diario: carga estado, purga bloqueos expirados, integra evidencia del dia, decide carriles, persiste y genera snapshot.

## Estructura operativa prevista en EC2 TEST

- codigo: `/opt/sharemechat-test-access-blocker`
- configuracion: `/etc/sharemechat-test-access-blocker/config.env`
- allowlist: `/etc/sharemechat-test-access-blocker/allowlist.conf`
- estado persistente: `/var/lib/sharemechat-test-access-blocker/ips.json`
- salidas: `/var/log/sharemechat-test-access-blocker/`

## Configuracion

Fichero:

- `/etc/sharemechat-test-access-blocker/config.env`

Minimo esperado:

- `PYTHON_BIN`
- `WORK_ROOT`
- `OUTPUT_ROOT`
- `CLASSIFIER_OUTPUT_ROOT`
- `STATE_FILE`
- `ALLOWLIST_FILE` / `ALLOWLIST_IPS`
- `CARRIL_A_TTL_DAYS`
- `CARRIL_B_TTL_DAYS`
- `CARRIL_B_WINDOW_DAYS`
- `DRY_RUN` (`1` = dry-run, `0` = real solo Carril A — mantener `1` hasta completar checklist)
- `NGINX_DENY_FILE` (solo relevante cuando `DRY_RUN=0`)
- `NGINX_MANUAL_DENY_FILE` (ruta del fichero de bloqueos manuales; solo lectura; no falla si no existe)

Ejemplo canonico: [`config/config.env.example`](config/config.env.example).

## Ejecucion manual (cuando se despliegue)

Para una fecha explicita:

```bash
sudo /opt/sharemechat-test-access-blocker/bin/block-test-access.sh \
  --config /etc/sharemechat-test-access-blocker/config.env \
  --date 2026-04-22
```

Para el dia anterior en UTC:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo /opt/sharemechat-test-access-blocker/bin/block-test-access.sh \
  --config /etc/sharemechat-test-access-blocker/config.env \
  --date "$DAY"
```

## Automatizacion con systemd

Units versionadas bajo `systemd/`:

- `sharemechat-test-access-blocker.service`
- `sharemechat-test-access-blocker.timer` (ventana `05:45 UTC` diaria)

La service arranca despues de `sharemechat-test-access-classifier.service`. No esta instalada todavia en EC2 TEST.

## Checklist antes de desplegar en TEST (DRY_RUN=1)

- copia de `lib/`, `bin/`, `config/`, `systemd/` a `/opt/sharemechat-test-access-blocker/`
- creacion de `/etc/sharemechat-test-access-blocker/config.env` y `allowlist.conf` a partir de los `.example`
- creacion de `/var/lib/sharemechat-test-access-blocker/` y `/var/log/sharemechat-test-access-blocker/`
- ejecucion manual de validacion sobre un dia con `summary.jsonl` disponible
- `systemctl daemon-reload` y `enable --now` del timer
- confirmar que `DRY_RUN=1` esta vigente en el config.env live

## Checklist antes de pasar a DRY_RUN=0 en TEST

1. Componente desplegado y DRY-RUN activo sin anomalias durante >=14 dias
2. Allowlist operativa revisada y actualizada (testers internos, QA manual, VPN, uptime checks; mas amplia que AUDIT)
3. Verificar que `/etc/nginx/deny-test-ips.conf` existe y contiene la include esperada en el config de nginx (`nginx -t` debe pasar en estado actual)
4. Ejecutar una vez manualmente con `DRY_RUN=0` y revisar diff, journalctl y contenido del fichero live
5. Confirmar en journalctl que `nginx_test_before=ok`, `nginx_test_after=ok`, `reload=ok`
6. Solo despues activar el timer automatico con `DRY_RUN=0`

## Relacion con el pipeline de TEST

Este componente es la cuarta etapa del pipeline de auditoria de accesos de TEST:

1. `test-access-normalizer`
2. `test-access-classifier`
3. `test-access-reporter`
4. `test-access-blocker` (DRY-RUN en esta fase)

Vision end-to-end del area: [ops/test-access/README.md](../test-access/README.md).
