# AUDIT Access Blocker

Componente operativo externo que, a partir del summary diario del clasificador, propone y (opcionalmente) aplica un bloqueo controlado en nginx para AUDIT. No pertenece a la aplicacion Java ni al frontend.

Soporta dos modos de operacion, seleccionados via `DRY_RUN` en `config.env`:

**DRY_RUN=1** (modo seguro, default):

- NO escribe `/etc/nginx/deny-audit-ips.conf`
- NO ejecuta `nginx -t` ni `systemctl reload nginx`
- SOLO genera propuesta de deny list, diff razonado y estado persistente

**DRY_RUN=0** (modo real controlado, solo Carril A):

- aplica bloqueo real en nginx **exclusivamente** para IPs de Carril A
- Carril B y Carril C continuan siendo solo propuesta advisory
- **preserva bloqueos manuales**: lee `deny-audit-ips.manual.conf` (si existe) y lo incluye intacto en el fichero live; las IPs ya presentes en manual no se duplican; el fichero manual nunca se modifica
- ejecuta doble `nginx -t` (preflight + postflight) con rollback automatico si falla
- hace backup con timestamp del fichero anterior antes de reemplazar
- ejecuta `systemctl reload nginx` solo si ambos `nginx -t` pasan
- en caso de fallo en reload: restaura backup y fuerza reload previo

## Estado real en AUDIT

A fecha de hoy este componente ya queda:

- implementado en el repositorio bajo `ops/audit-access-blocker/`
- desplegado en EC2 AUDIT en `/opt/sharemechat-audit-access-blocker`
- configurado en:
  - `/etc/sharemechat-audit-access-blocker/config.env` (`DRY_RUN=0`)
  - `/etc/sharemechat-audit-access-blocker/allowlist.conf`
- instalado en systemd con:
  - `sharemechat-audit-access-blocker.service`
  - `sharemechat-audit-access-blocker.timer`
- activo en **modo REAL controlado (Carril A)**, con ejecucion diaria a `05:30 UTC`
- generando salidas en `/var/log/sharemechat-audit-access-blocker/`
- manteniendo estado persistente real en `/var/lib/sharemechat-audit-access-blocker/ips.json`
- escribiendo `/etc/nginx/deny-audit-ips.conf` con IPs de Carril A (bloqueo efectivo)

En modo REAL controlado (`DRY_RUN=0`) el comportamiento activo es:

- **Carril A**: bloqueo real en nginx con TTL de 30 dias, backup automatico y rollback en caso de fallo
- **Carril B**: solo propuesta advisory, no toca nginx
- **Carril C**: solo observacion en diff

## Responsabilidad

- leer el `summary.jsonl` diario del clasificador
- aplicar una politica de decision en tres carriles (A, B, C)
- respetar una allowlist por IP y CIDR
- mantener estado persistente por IP (historial hostil + bloqueo propuesto)
- generar propuesta de deny list para revision humana
- generar diff / resumen de decisiones
- generar snapshot diario del estado persistente

## Entrada

Ruta operativa esperada:

- `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.summary.jsonl`

Del summary se consumen los campos:

- `ip`
- `classification`
- `score`
- `main_reason`
- `features.hostile_ioc_count`
- `evidence.hostile_hits` (IOCs en rutas hostiles)
- `evidence.matched_rule_labels` (UA scanners, overrides)

## Salida

Ruta operativa en EC2:

- `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.deny-audit-ips.proposed.conf`
- `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.blocker-diff.txt`
- `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.ips.json`

Y el estado persistente acumulado:

- `/var/lib/sharemechat-audit-access-blocker/ips.json`

El fichero `.proposed.conf` usa sintaxis similar a nginx (`deny <IP>;`) para facilitar revision visual, pero nunca se carga automaticamente.

## Politica de decision

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

Carril C cubre explicitamente casos como IPs ruidosas de scrapers residenciales que escalan por volumen/rutas sensibles pero nunca disparan un IOC hostil concreto. Tambien cubre primeras apariciones de IOC hostil que todavia no tienen repeticion suficiente para Carril B.

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

Esta estrategia garantiza que una IP como `129.212.226.182` con `main_reason=xmlrpc_scan+many_routes_6` tenga `xmlrpc_scan` correctamente registrado en `hostile_days[]` del estado persistente, incluso si `evidence.hostile_hits` esta vacio o ausente.

### Allowlist

La allowlist admite IPs (IPv4) y rangos CIDR. Cualquier IP que coincida queda marcada como `skip_allowlisted` y nunca aparece en la propuesta de deny list, aunque cumpla A o B. La allowlist se carga desde:

- `ALLOWLIST_IPS` en `config.env` (coma separadas)
- `ALLOWLIST_FILE` apuntando a un fichero con una entrada por linea

Formato del fichero:

```text
203.0.113.10     # oficina central
198.51.100.0/24  # proveedor uptime
```

## Estado persistente

El componente mantiene `ips.json` con, por cada IP observada:

- `first_seen`, `last_seen`
- `hostile_days[]` (historial de dias con IOC hostil + severidad, recortado a ~60 dias)
- `block` con carril, TTL, `opened_at`, `expires_at`, razones

Cada run:

1. carga el estado anterior
2. purga bloqueos expirados y recorta historial antiguo
3. integra la evidencia del dia
4. decide carriles
5. persiste el estado actualizado
6. genera ademas un snapshot diario en `OUTPUT_ROOT/YYYY-MM-DD.ips.json`

### Nota sobre estado persistente tras cambios de logica

Si la logica de extraccion de IOC cambia (por ejemplo, `extract_hostile_iocs` se mejora para detectar mas fuentes), el estado persistente previo puede contener entradas `hostile_days[]` con `hostile_iocs=[]` para dias donde ahora se detectarian IOCs. Esto es esperado y no es un error.

Consecuencia practica: el Carril B puede no activarse correctamente para IPs que tenian IOCs pero cuyo historial fue acumulado con la logica anterior. En ese caso la accion correcta es resetear el estado:

```bash
sudo mv /var/lib/sharemechat-audit-access-blocker/ips.json \
        /var/lib/sharemechat-audit-access-blocker/ips.json.bak_$(date -u +%Y%m%d%H%M%S)
```

El componente crea un estado vacio en el siguiente run. El coste es perder la ventana historica de Carril B para IPs existentes; la ventana se reconstruye en 7 dias de actividad real.

## Estructura operativa en EC2

- codigo: `/opt/sharemechat-audit-access-blocker`
- configuracion: `/etc/sharemechat-audit-access-blocker/config.env`
- allowlist: `/etc/sharemechat-audit-access-blocker/allowlist.conf`
- estado persistente: `/var/lib/sharemechat-audit-access-blocker/ips.json`
- salidas: `/var/log/sharemechat-audit-access-blocker/`

## Configuracion

Fichero:

- `/etc/sharemechat-audit-access-blocker/config.env`

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
- `DRY_RUN` (`1` = dry-run, `0` = real solo Carril A)
- `NGINX_DENY_FILE` (solo relevante cuando `DRY_RUN=0`)
- `NGINX_MANUAL_DENY_FILE` (ruta del fichero de bloqueos manuales; solo lectura; no falla si no existe)

Ejemplo canonico: [`config/config.env.example`](config/config.env.example).

## Ejecucion manual

Para una fecha explicita:

```bash
sudo /opt/sharemechat-audit-access-blocker/bin/block-audit-access.sh \
  --config /etc/sharemechat-audit-access-blocker/config.env \
  --date 2026-04-22
```

Para el dia anterior en UTC:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo /opt/sharemechat-audit-access-blocker/bin/block-audit-access.sh \
  --config /etc/sharemechat-audit-access-blocker/config.env \
  --date "$DAY"
```

## Automatizacion con systemd

En EC2 se ejecuta diariamente despues del flujo de clasificacion:

- `sharemechat-audit-access-blocker.timer`
- `sharemechat-audit-access-blocker.service`

Ambas units versionadas en `systemd/`. El timer trabaja sobre el dia anterior en UTC. La service arranca despues de `sharemechat-audit-access-classifier.service`.

En AUDIT este despliegue ya esta instalado y activo en systemd. La ventana operativa programada queda a las `05:30 UTC` y el run sin `--date` trabaja por defecto sobre el dia anterior en UTC.

## Validacion operativa ya realizada

Dry-run manual validado para `2026-04-22`:

- resultado stdout:
  - `ips=3`
  - `carril_A=0`
  - `carril_B=0`
  - `carril_C=3`
  - `allowlisted=0`

Dry-run manual validado para `2026-04-18`:

- resultado stdout:
  - `ips=14`
  - `carril_A=4`
  - `carril_B=0`
  - `carril_C=10`
  - `allowlisted=0`
- proposed deny list generada con:
  - `141.98.11.181`
  - `35.180.134.18`
  - `62.60.130.227`
  - `85.11.167.38`

Caso clave validado tras refinamiento (`129.212.226.182`):

- `classification=MALICIOSA`, `score=78`, `main_reason=xmlrpc_scan+many_routes_6`
- `extract_hostile_iocs()` detecta correctamente `xmlrpc_scan` via Fuente 4 (parseo de `main_reason`)
- resultado final: `carril=C`, `action=observe`
- `reasons`:
  - `IOC hostil aislado sin repeticion ni criterio Carril A`
  - `iocs_today=xmlrpc_scan`
- `xmlrpc_scan` queda registrado en `hostile_days[]` del estado persistente
- si reaparece en >=2 dias dentro de la ventana con severidad MALICIOSA/CRITICA, activara Carril B

Confirmaciones de la validacion:

- deteccion IOC correcta: si
- no falso positivo (primera aparicion aislada queda en C): si
- logica A/B/C intacta: si
- estado persistente resetado tras el cambio de logica (comportamiento esperado): si

## Comprobaciones operativas minimas

- existe `YYYY-MM-DD.deny-audit-ips.proposed.conf`
- existe `YYYY-MM-DD.blocker-diff.txt`
- existe `YYYY-MM-DD.ips.json`
- el contador `Carril A` del diff es coherente con las IOCs observadas
- el estado persistente `STATE_FILE` crece de forma controlada

## Flujo de bloqueo real (DRY_RUN=0)

```
summary.jsonl del clasificador
        |
        v
evaluar carriles A/B/C
        |
        v
[Carril A] -> apply_carril_a_to_nginx()
               |
               1. nginx -t PREFLIGHT (config actual)
               |  --> falla: abort sin tocar nada
               |
               2. escribir <deny_file>.new con IPs Carril A
               |
               3. backup: <deny_file>.bak_<timestamp>
               |
               4. reemplazo atomico: .new -> <deny_file>
               |
               5. nginx -t POSTFLIGHT (con nuevo contenido)
               |  --> falla: rollback desde backup + abort
               |
               6. systemctl reload nginx
               |  --> falla: rollback desde backup + reload previo + abort
               |
               OK: bloqueo activo
        |
[Carril B] -> solo propuesta en proposed.conf (no toca nginx)
[Carril C] -> solo registro en diff
```

## Fallos esperables y comportamiento

| Situacion | Comportamiento |
|-----------|---------------|
| falta `summary.jsonl` | falla antes de tocar nginx; sin cambios |
| `DRY_RUN` != "0" ni "1" | wrapper bash aborta con exit 2 |
| `DRY_RUN=0` sin `NGINX_DENY_FILE` | Python aborta con mensaje claro |
| `nginx -t` preflight falla | abort sin tocar deny list (nginx ya estaba roto) |
| `nginx -t` postflight falla | rollback automatico desde backup |
| `systemctl reload` falla | rollback + intento de reload con config anterior |
| `allowlist.conf` con tokens invalidos | se ignoran sin abortar |

## Modo REAL (Carril A activado)

**Estado:** activo en EC2 AUDIT desde `2026-04-24`. `DRY_RUN=0` en `/etc/sharemechat-audit-access-blocker/config.env`.

### Activacion manual ejecutada

Fecha de validacion: `2026-04-18` (primer run real sobre datos historicos para verificar el flujo completo antes de dejar el timer en produccion).

Comando ejecutado:

```bash
sudo /opt/sharemechat-audit-access-blocker/bin/block-audit-access.sh \
  --config /etc/sharemechat-audit-access-blocker/config.env \
  --date 2026-04-18
```

Salida confirmada:

```
[blocker REAL carril_A] 2026-04-18 ips=14 carril_A=4 carril_B=0 carril_C=10 \
  allowlisted=0 nginx_test_before=ok nginx_test_after=ok ips_bloqueadas=4 reload=ok
```

Contenido de `/etc/nginx/deny-audit-ips.conf` tras la ejecucion:

```nginx
# Auto-generado por audit-access-blocker - Carril A - 2026-04-18
deny 141.98.11.181;
deny 35.180.134.18;
deny 62.60.130.227;
deny 85.11.167.38;
```

### Garantias del flujo real

1. **preflight** `nginx -t` con la config actual antes de tocar nada → fallo aborta sin cambios
2. Escritura de `.new` con IPs de Carril A (deduplicadas contra fichero manual si existe)
3. Backup del fichero anterior con timestamp (`deny-audit-ips.conf.bak_<timestamp>`)
4. Reemplazo atomico: `.new` → fichero live
5. **postflight** `nginx -t` con el contenido nuevo → fallo dispara rollback automatico desde backup
6. `systemctl reload nginx` → fallo dispara rollback + reload con config anterior

### Fichero de bloqueos manuales

`/etc/nginx/deny-audit-ips.manual.conf`: si existe, sus entradas se preservan al inicio del fichero live por encima del bloque auto-generado. Las IPs presentes en el fichero manual no se duplican en el bloque de Carril A. Este fichero nunca es modificado por el componente.

## Checklist antes de pasar a DRY_RUN=0

**Completado el 2026-04-24 en EC2 AUDIT.**

1. ✓ Dry-run activo y sin anomalias durante >=14 dias
2. ✓ Allowlist operativa revisada y actualizada (IPs de operacion, VPN, uptime checks)
3. ✓ Verificar que `/etc/nginx/deny-audit-ips.conf` existe y contiene la include esperada en el config de nginx (`nginx -t` debe pasar en estado actual)
4. ✓ Ejecutar una vez manualmente con `DRY_RUN=0` y revisar diff, journalctl y contenido del fichero live
5. ✓ Confirmar en journalctl que `nginx_test_before=ok`, `nginx_test_after=ok`, `reload=ok`
6. ✓ Timer automatico activo con `DRY_RUN=0`

## Pendiente para fases posteriores

- mecanismo de desbloqueo manual por IP (override en estado + borrado de la deny list live)
- alerta por email si la propuesta diaria de Carril A supera un umbral
- metricas: tiempo medio de bloqueo, rotacion, tasa de falsos positivos
- extension de bloqueo real a Carril B (decision separada, fuera de este cambio)
- equivalente para TEST cuando se decida activar bloqueo real en TEST

## Relacion con el sistema completo

Este componente es la cuarta etapa del pipeline de auditoria de accesos:

1. `audit-access-normalizer`
2. `audit-access-classifier`
3. `audit-access-reporter`
4. `audit-access-blocker` (DRY-RUN o real controlado Carril A segun config)

La vision end-to-end vive en [ops/audit-access/README.md](../audit-access/README.md).
