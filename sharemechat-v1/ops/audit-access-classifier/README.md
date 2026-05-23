# AUDIT Access Classifier

Componente operativo externo para clasificar actividad observada en `AUDIT` a partir del JSONL diario generado por el normalizador. No forma parte de SharemeChat ni modifica logica funcional.

## Responsabilidad

- leer un JSONL diario normalizado
- agrupar actividad por IP
- extraer features por IP
- aplicar scoring determinista basado en reglas explicitas
- clasificar cada IP en `NORMAL`, `SOSPECHOSA`, `MALICIOSA` o `CRITICA`
- generar una tabla legible y un summary JSONL enriquecido

## Entrada

Ruta operativa esperada:

- `/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl`

## Salida

Ruta operativa en EC2:

- `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.table.txt`
- `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.summary.jsonl`

## Estructura logica interna

El clasificador separa cuatro capas deterministas:

- extraccion de features por IP
- scoring basado en reglas
- clasificacion final
- accion recomendada

La estructura deja preparado un punto futuro para una segunda opinion adicional basada en IA, sin romper el motor actual ni sustituir la explicabilidad operativa.

## Features por IP

El clasificador calcula como minimo:

- `requests`
- `distinct_routes`
- `hosts`
- `channels`
- distribucion de `status`
- distribucion de `method`
- distribucion de `ua`
- `hostile_hits`
- `sensitive_hits`
- `admin_requests`
- `query_present`
- ratios por status
- `dominant_ua`
- flags de coherencia
- ventana temporal `first_ts` / `last_ts`
- marca `allowlisted`

## Reglas de clasificacion

El motor es explicable y auditable. Usa combinacion de:

- IOC hostiles por ruta
- IOC hostiles por `user-agent`
- señales sensibles de aplicacion
- volumen e insistencia
- ratios de estados anómalos
- overrides de severidad minima
- señales de coherencia con flujo legitimo

## Clasificaciones

- `NORMAL`
- `SOSPECHOSA`
- `MALICIOSA`
- `CRITICA`

## Salida enriquecida

Cada linea de `YYYY-MM-DD.summary.jsonl` incluye como minimo:

- `date`
- `ip`
- `classification`
- `score`
- `requests`
- `distinct_routes`
- `hosts`
- `channels`
- `main_reason`
- `recommended_action`
- `features`
- `matched_rules`
- `evidence`

## Estructura operativa en EC2

- codigo: `/opt/sharemechat-audit-access-classifier`
- configuracion: `/etc/sharemechat-audit-access-classifier/config.env`
- trabajo interno: `/var/lib/sharemechat-audit-access-classifier`
- salida: `/var/log/sharemechat-audit-access-classifier`
- entrada normalizada: `/var/log/sharemechat-audit-access-normalizer`

## Ejecucion manual

Para una fecha explicita:

```bash
sudo /opt/sharemechat-audit-access-classifier/bin/classify-audit-access.sh --config /etc/sharemechat-audit-access-classifier/config.env --date 2026-04-18
```

## Allowlist operativa (paquete 10.B.4)

Variable `ALLOWLIST_IPS` del `config.env`:

- formato CSV de IPs literales, ej: `ALLOWLIST_IPS=90.175.201.51,203.0.113.42`
- vacia por defecto (comportamiento del classifier identico al de antes del paquete)
- propagada al binario Python via `--allowlist-ips`

Alternativa: variable `ALLOWLIST_FILE` apuntando a un fichero con una IP por linea (`#` introduce comentarios). Util para listas largas o mantenidas fuera del `.env`.

Comportamiento (short-circuit):

- toda IP listada en `ALLOWLIST_IPS` queda **excluida del scoring**
- se clasifica como `NORMAL` con `score=0`, `recommended_action=ninguna`, `main_reason=allowlisted_ip`
- ninguna regla hostile/sensitive/volume/status/behavior/coherence se aplica
- las `min_classification` de reglas con floor (ej. shell_probe, sqlmap UA) NO escalan la clasificacion
- el `features` completo se conserva en el `summary.jsonl` (requests, distinct_routes, ua, etc.) para que la actividad siga siendo auditable retrospectivamente

Caso de uso operativo (motivacion del paquete 10.B.4): la IP del administrador del proyecto puede provocar score >=100 al validar manualmente el frontend admin durante un despliegue (muchas rutas distintas, racha de peticiones, ratios anomalos de 401/404). Sin allowlist, ese trafico legitimo caeria en CRITICA y, en AUDIT (blocker Carril A real), el operador acabaria bloqueado de su propio entorno.

Caso de IP dinamica (ISP domestico): si la IP del operador cambia y deja de coincidir con `ALLOWLIST_IPS`, la siguiente ejecucion la clasifica normalmente. El operador actualiza la variable cuando detecta el cambio. No hay sincronizacion automatica.

Caso PROD futuro: cuando el operador trabaje desde IPs variables (movil, cafeteria, VPN), conviene complementar la allowlist con un mecanismo de header HTTP secreto que el normalizer pueda usar para marcar lineas de log como operativas antes de pasarlas al classifier. Ese mecanismo no esta implementado todavia; queda para un paquete posterior si se necesita.

## Automatizacion

El repositorio incluye:

- `sharemechat-audit-access-classifier.service`
- `sharemechat-audit-access-classifier.timer`

Ademas, en EC2 existe una automatizacion operativa diaria del sistema completo que ejecuta clasificador y reporter sobre el dia anterior en UTC mediante `sharemechat-audit-daily-report.timer`.

## Comprobaciones operativas minimas

- existe `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.table.txt`
- existe `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.summary.jsonl`
- la tabla es legible por terminal
- el summary JSONL contiene `classification`, `score`, `main_reason` y `recommended_action`
- `journalctl -u sharemechat-audit-access-classifier.service`

## Limites conocidos

- la clasificacion es deliberadamente determinista y no usa ML
- no bloquea trafico ni cambia infraestructura
- la utilidad del scoring depende de la calidad del JSONL de entrada y de ajustes operativos de allowlist

## Relacion con el sistema completo

Este componente es la segunda etapa del pipeline de auditoria de accesos:

1. `audit-access-normalizer`
2. `audit-access-classifier`
3. `audit-access-reporter`

La vision end-to-end y la operacion diaria completa viven en [ops/audit-access/README.md](/C:/Users/alain/Desktop/ALAIN_Escritorio/INFORMATICA/EMPRENDIMIENTO/sharemechat-git-v1/sharemechat-v1/ops/audit-access/README.md).
