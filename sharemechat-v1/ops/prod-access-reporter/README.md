# PROD Access Reporter

Componente operativo independiente para construir un resumen diario corto a partir de la salida del clasificador de accesos de `PROD`.

## Alcance

- lee el summary diario del clasificador
- resume el volumen total de IPs analizadas
- resume el conteo por clasificacion
- lista los hallazgos no normales mas relevantes
- muestra el reporte por terminal
- persiste el reporte a fichero de texto
- persiste una version resumida en JSON

## No hace

- cambios en Java, frontend o logica funcional de SharemeChat
- automatizacion con `systemd` en esta iteracion
- Microsoft Graph o integraciones externas distintas de SMTP
- recalcular scoring o reclasificar actividad

## Relacion con el clasificador

Esta herramienta depende de la salida del componente `ops/prod-access-classifier/`, pero sigue siendo una pieza operativa separada.

- no lee logs raw
- no consume directamente el normalizador
- no modifica la salida del clasificador
- solo resume el fichero diario `YYYY-MM-DD.summary.jsonl`

## Estructura operativa propuesta

- codigo: `/opt/sharemechat-prod-access-reporter`
- configuracion: `/etc/sharemechat-prod-access-reporter/config.env`
- salida: `/var/log/sharemechat-prod-access-reporter`
- entrada del clasificador: `/var/log/sharemechat-prod-access-classifier`

## Entrada esperada

El reporter consume como entrada principal:

- `CLASSIFIER_OUTPUT_ROOT/YYYY-MM-DD.summary.jsonl`

Y referencia como fuentes operativas:

- `CLASSIFIER_OUTPUT_ROOT/YYYY-MM-DD.table.txt`
- `CLASSIFIER_OUTPUT_ROOT/YYYY-MM-DD.summary.jsonl`

## Salida esperada

Se genera como minimo:

- `OUTPUT_ROOT/YYYY-MM-DD.report.txt`
- `OUTPUT_ROOT/YYYY-MM-DD.report.json`

Si se usa `--send-email`, el reporter mantiene esa persistencia local y ademas envia el reporte por SMTP.

## Contenido del reporte

El reporte incluye:

- fecha
- total de IPs analizadas
- numero de IPs por clasificacion
- lista de hallazgos relevantes no normales
- referencia a los ficheros fuente del clasificador

Cada hallazgo relevante incluye:

- `ip`
- `classification`
- `score`
- `main_reason`
- `recommended_action`

## Envio manual por email

El envio por email es opcional y solo se activa cuando se ejecuta el reporter con `--send-email`.

Comportamiento:

- sin `--send-email`, el reporter genera y muestra el reporte como hasta ahora
- con `--send-email`, ademas construye y envia un email por SMTP
- el asunto del email es `PROD access summary - YYYY-MM-DD`
- el cuerpo del email es el mismo contenido de `YYYY-MM-DD.report.txt`
- adjunta `YYYY-MM-DD.report.txt`
- adjunta `YYYY-MM-DD.report.json`

Si falta configuracion SMTP al usar `--send-email`, el reporter falla con un mensaje claro.

Si el envio SMTP falla, el reporter falla con mensaje claro y exit code no exitoso.

## Recomendacion operativa

En esta iteracion, la recomendacion es ejecucion manual.

Secuencia operativa sugerida:

1. ejecutar el clasificador del dia
2. ejecutar el reporter del mismo dia
3. revisar `YYYY-MM-DD.report.txt`
4. usar ese texto como base para envio manual posterior por email si hace falta

No se recomienda automatizar todavia esta pieza hasta validar que el formato y el contenido del reporte diario son utiles para operacion real.

## Instalacion manual

### 1. Copiar el componente

```bash
sudo mkdir -p /opt/sharemechat-prod-access-reporter
sudo rsync -a ops/prod-access-reporter/ /opt/sharemechat-prod-access-reporter/
```

### 2. Dar permisos de ejecucion

```bash
sudo chmod 755 /opt/sharemechat-prod-access-reporter/bin/report-prod-access.sh
sudo chmod 755 /opt/sharemechat-prod-access-reporter/lib/report_access.py
```

### 3. Crear configuracion

```bash
sudo mkdir -p /etc/sharemechat-prod-access-reporter
sudo cp /opt/sharemechat-prod-access-reporter/config/config.env.example /etc/sharemechat-prod-access-reporter/config.env
sudo chmod 640 /etc/sharemechat-prod-access-reporter/config.env
```

### 4. Revisar configuracion

- `CLASSIFIER_OUTPUT_ROOT`
- `OUTPUT_ROOT`
- `PYTHON_BIN` si `python3` no esta en ruta estandar
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_STARTTLS`
- `SMTP_TIMEOUT_SECONDS`
- `EMAIL_FROM`
- `EMAIL_TO`

### 5. Crear directorio de salida

```bash
sudo mkdir -p /var/log/sharemechat-prod-access-reporter
```

### 6. Ejecutar manualmente

```bash
sudo /opt/sharemechat-prod-access-reporter/bin/report-prod-access.sh --config /etc/sharemechat-prod-access-reporter/config.env --date 2026-04-18
```

### 7. Ejecutar manualmente con envio por email

```bash
sudo /opt/sharemechat-prod-access-reporter/bin/report-prod-access.sh --config /etc/sharemechat-prod-access-reporter/config.env --date 2026-04-18 --send-email
```

### 8. Verificar salida

```bash
sudo cat /var/log/sharemechat-prod-access-reporter/2026-04-18.report.txt
sudo cat /var/log/sharemechat-prod-access-reporter/2026-04-18.report.json
```

## Ejemplo de salida por terminal

```text
PROD access summary - 2026-04-18

IPs analizadas: 7

CRITICA: 2
MALICIOSA: 0
SOSPECHOSA: 1
NORMAL: 4

Hallazgos principales:
- 141.98.11.181 | CRITICA | score=233 | wordpress_scan+wlwmanifest_scan | actuar
- 62.60.130.227 | CRITICA | score=233 | wordpress_scan+wlwmanifest_scan | actuar
- 155.2.226.162 | SOSPECHOSA | score=25 | many_routes_12+multi_host | observar

Fuentes:
- /var/log/sharemechat-prod-access-classifier/2026-04-18.table.txt
- /var/log/sharemechat-prod-access-classifier/2026-04-18.summary.jsonl
```

## Ejemplo de salida JSON

```json
{
  "date": "2026-04-18",
  "ips_analyzed": 7,
  "classification_counts": {
    "CRITICA": 2,
    "MALICIOSA": 0,
    "SOSPECHOSA": 1,
    "NORMAL": 4
  },
  "relevant_findings": [
    {
      "ip": "141.98.11.181",
      "classification": "CRITICA",
      "score": 233,
      "main_reason": "wordpress_scan+wlwmanifest_scan",
      "recommended_action": "actuar"
    }
  ],
  "sources": {
    "classifier_table": "/var/log/sharemechat-prod-access-classifier/2026-04-18.table.txt",
    "classifier_summary": "/var/log/sharemechat-prod-access-classifier/2026-04-18.summary.jsonl"
  }
}
```
