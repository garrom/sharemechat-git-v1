# TEST Access Reporter

Componente operativo externo para construir y enviar el resumen diario de accesos clasificados de `TEST`. No pertenece a la aplicacion Java ni al frontend.

## Responsabilidad

- leer el summary diario del clasificador
- generar un reporte corto en texto
- generar una version resumida en JSON
- mostrar el reporte por terminal
- persistir ambos ficheros
- enviar opcionalmente el reporte por email via SMTP

## Entrada

Ruta operativa esperada:

- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`

Fuentes asociadas de referencia:

- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.table.txt`
- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`

## Salida

Ruta operativa en EC2:

- `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.txt`
- `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.json`

## Envio por email

El envio por email es opcional en el binario y usa SMTP.

Cuando se ejecuta con `--send-email`:

- el asunto es `TEST access summary - YYYY-MM-DD`
- el cuerpo del email es el contenido de `YYYY-MM-DD.report.txt`
- se adjunta `YYYY-MM-DD.report.txt`
- se adjunta `YYYY-MM-DD.report.json`

Configuracion minima:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_STARTTLS`
- `SMTP_TIMEOUT_SECONDS`
- `EMAIL_FROM`
- `EMAIL_TO`

## Estructura operativa en EC2

- codigo: `/opt/sharemechat-test-access-reporter`
- configuracion: `/etc/sharemechat-test-access-reporter/config.env`
- salida: `/var/log/sharemechat-test-access-reporter`
- entrada del clasificador: `/var/log/sharemechat-test-access-classifier`

## Ejecucion manual

### Generar reporte sin enviar email

```bash
sudo /opt/sharemechat-test-access-reporter/bin/report-test-access.sh --config /etc/sharemechat-test-access-reporter/config.env --date 2026-04-23
```

### Generar reporte y enviar email

```bash
sudo /opt/sharemechat-test-access-reporter/bin/report-test-access.sh --config /etc/sharemechat-test-access-reporter/config.env --date 2026-04-23 --send-email
```

## Automatizacion operativa

El reporter no necesita integrarse en la aplicacion. Las units systemd del reporter (`sharemechat-test-access-reporter.service` y `.timer`) son operativas en EC2 TEST pero no estan versionadas en este directorio del repositorio.

En EC2 TEST se ejecuta como parte del flujo diario completo del sistema de auditoria de accesos:

- clasificador
- reporter
- envio por email

Ese flujo se lanza diariamente sobre el dia anterior en UTC.

## Comprobaciones operativas minimas

- existe `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.txt`
- existe `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.json`
- el contenido del `.report.txt` coincide con el cuerpo esperado del email
- el `.report.json` refleja los contadores y hallazgos principales

## Fallos esperables

- si falta configuracion SMTP al usar `--send-email`, el reporter falla con mensaje claro
- si el envio SMTP falla, el reporter devuelve exit code no exitoso
- si no existe el summary del clasificador para la fecha indicada, el reporter falla y no envia nada

## Relacion con el sistema completo

Este componente es la tercera etapa del pipeline de auditoria de accesos de TEST:

1. `test-access-normalizer`
2. `test-access-classifier`
3. `test-access-reporter`
4. `test-access-blocker` (DRY-RUN activo)

La vision end-to-end, la estrategia de fechas y la operacion diaria completa viven en [ops/test-access/README.md](../test-access/README.md).
