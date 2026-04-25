# TEST Access Classifier

Componente operativo externo para clasificar actividad observada en `TEST` a partir del JSONL diario generado por el normalizador. No forma parte de SharemeChat ni modifica logica funcional.

## Responsabilidad

- leer un JSONL diario normalizado
- agrupar actividad por IP
- extraer features por IP
- aplicar scoring determinista basado en reglas explicitas
- clasificar cada IP en `NORMAL`, `SOSPECHOSA`, `MALICIOSA` o `CRITICA`
- generar una tabla legible y un summary JSONL enriquecido

## Entrada

Ruta operativa esperada:

- `/var/log/sharemechat-test-access-normalizer/YYYY-MM-DD.jsonl`

## Salida

Ruta operativa en EC2:

- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.table.txt`
- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`

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
- ratios de estados anomalos
- overrides de severidad minima
- señales de coherencia con flujo legitimo

Las reglas son identicas a las de `audit-access-classifier`. No hay umbrales distintos ni politica diferente entre entornos.

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

- codigo: `/opt/sharemechat-test-access-classifier`
- configuracion: `/etc/sharemechat-test-access-classifier/config.env`
- trabajo interno: `/var/lib/sharemechat-test-access-classifier`
- salida: `/var/log/sharemechat-test-access-classifier`
- entrada normalizada: `/var/log/sharemechat-test-access-normalizer`

## Ejecucion manual

Para una fecha explicita:

```bash
sudo /opt/sharemechat-test-access-classifier/bin/classify-test-access.sh --config /etc/sharemechat-test-access-classifier/config.env --date 2026-04-23
```

## Automatizacion

Las units systemd del clasificador (`sharemechat-test-access-classifier.service` y `.timer`) son operativas en EC2 TEST pero no estan versionadas en este directorio del repositorio.

En EC2 TEST existe ademas una automatizacion operativa diaria del sistema completo que ejecuta clasificador y reporter sobre el dia anterior en UTC.

## Comprobaciones operativas minimas

- existe `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.table.txt`
- existe `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`
- la tabla es legible por terminal
- el summary JSONL contiene `classification`, `score`, `main_reason` y `recommended_action`
- `journalctl -u sharemechat-test-access-classifier.service`

## Limites conocidos

- la clasificacion es deliberadamente determinista y no usa ML
- no bloquea trafico ni cambia infraestructura
- la utilidad del scoring depende de la calidad del JSONL de entrada y de ajustes operativos de allowlist
- en TEST el trafico incluye testers internos, QA manual y trafico sintetico; la allowlist debe mantenerse mas amplia que en AUDIT y con comentarios que justifiquen cada entrada

## Relacion con el sistema completo

Este componente es la segunda etapa del pipeline de auditoria de accesos de TEST:

1. `test-access-normalizer`
2. `test-access-classifier`
3. `test-access-reporter`
4. `test-access-blocker` (DRY-RUN activo)

La vision end-to-end y la operacion diaria completa viven en [ops/test-access/README.md](../test-access/README.md).
