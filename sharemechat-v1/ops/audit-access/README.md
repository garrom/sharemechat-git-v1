# AUDIT Access Audit System

## Vision general

El sistema de auditoria de accesos de `AUDIT` es un pipeline operativo externo y desacoplado de la aplicacion SharemeChat. Su objetivo es transformar logs reales de acceso en evidencia diaria util para operacion, auditoria PSP y respuesta manual.

El sistema esta compuesto por cuatro componentes independientes bajo `ops/`:

1. `audit-access-normalizer`
2. `audit-access-classifier`
3. `audit-access-reporter`
4. `audit-access-blocker` (bloqueo REAL activo en Carril A)

Ninguno de ellos:

- pertenece a la aplicacion Java/Spring Boot
- toca frontend
- modifica logica funcional de negocio
- depende de servicios de analitica pesada o ML

## Flujo end-to-end

1. El normalizador lee logs reales del entorno `AUDIT`.
2. Genera un JSONL diario canonico.
3. El clasificador consume ese JSONL diario.
4. Genera una tabla legible y un summary JSONL enriquecido.
5. El reporter consume el summary diario.
6. Genera un reporte texto y un reporte JSON.
7. Opcionalmente envia el reporte por email via SMTP.
8. El blocker (DRY-RUN) consume el mismo summary diario.
9. Propone una deny list razonada y mantiene estado persistente por IP.
10. No toca nginx ni bloquea trafico real en esta fase.

## Diagrama logico

```text
CloudFront logs + Nginx access.log
                |
                v
audit-access-normalizer
                |
                v
/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl
                |
                v
audit-access-classifier
                |
                +--> /var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.table.txt
                |
                +--> /var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.summary.jsonl
                                   |
                                   v
                        audit-access-reporter
                                   |
                                   +--> /var/log/sharemechat-audit-access-reporter/YYYY-MM-DD.report.txt
                                   |
                                   +--> /var/log/sharemechat-audit-access-reporter/YYYY-MM-DD.report.json
                                   |
                                   +--> SMTP email opcional

audit-access-classifier (summary.jsonl)
                |
                v
audit-access-blocker (DRY-RUN)
                |
                +--> /var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.deny-audit-ips.proposed.conf
                |
                +--> /var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.blocker-diff.txt
                |
                +--> /var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.ips.json
                |
                +--> /var/lib/sharemechat-audit-access-blocker/ips.json (estado persistente)
```

## Responsabilidades por componente

### 1. audit-access-normalizer

Responsabilidad:

- convertir logs raw de CloudFront y Nginx en un JSONL canonico diario
- conservar trazabilidad minima y uniforme
- mantener estado para evitar reprocesados innecesarios

Salida principal:

- `/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl`

### 2. audit-access-classifier

Responsabilidad:

- agrupar actividad por IP
- extraer features por IP
- aplicar scoring determinista basado en reglas
- clasificar actividad en `NORMAL`, `SOSPECHOSA`, `MALICIOSA` o `CRITICA`

Salidas principales:

- `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.table.txt`
- `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.summary.jsonl`

### 3. audit-access-reporter

Responsabilidad:

- resumir el resultado diario del clasificador
- generar una salida corta y operativa
- persistir el reporte en texto y JSON
- enviar el resumen por email cuando se solicite

Salidas principales:

- `/var/log/sharemechat-audit-access-reporter/YYYY-MM-DD.report.txt`
- `/var/log/sharemechat-audit-access-reporter/YYYY-MM-DD.report.json`

### 4. audit-access-blocker (bloqueo REAL activo en Carril A)

Responsabilidad:

- consumir el summary diario del clasificador
- aplicar una politica de decision en tres carriles (A, B, C)
- respetar una allowlist por IP y CIDR
- mantener estado persistente por IP (historial hostil + bloqueo propuesto)
- generar una propuesta de deny list, un diff razonado y un snapshot diario del estado
- **Carril A**: aplicar bloqueo real en nginx con preflight/postflight `nginx -t`, backup con timestamp y rollback automatico en caso de fallo
- Carril B y Carril C: solo propuesta advisory, sin tocar nginx

Salidas principales:

- `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.deny-audit-ips.proposed.conf`
- `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.blocker-diff.txt`
- `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.ips.json`
- `/var/lib/sharemechat-audit-access-blocker/ips.json` (estado persistente)

Documentacion detallada: [ops/audit-access-blocker/README.md](../audit-access-blocker/README.md).

Nota de refinamiento post-validacion: tras los primeros runs reales en DRY-RUN, el componente fue refinado en dos puntos antes de plantear la activacion real. Primero, la extraccion de IOCs hostiles se extiende a cuatro fuentes (`evidence.hostile_hits`, `evidence.matched_rule_labels`, `matched_rules` como fallback, y parseo de `main_reason` via `re.split`) para cubrir casos como `xmlrpc_scan+many_routes_6` donde el IOC va concatenado al reason de volumen y no aparecia en las fuentes canonicas. Segundo, la explicabilidad del Carril C se corrigio: cuando una IP tiene un IOC hostil presente pero aislado (primera aparicion, sin repeticion suficiente para Carril B), el diff muestra ahora `"IOC hostil aislado sin repeticion ni criterio Carril A"` con el IOC concreto, en lugar del mensaje generico de clasificacion por volumen/sensibles. Ambos cambios son solo de logica interna y no alteran los carriles A/B ni el contrato de salida.

## Rutas reales en EC2

### Salidas

- normalizer:
  - `/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl`
- classifier:
  - `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.table.txt`
  - `/var/log/sharemechat-audit-access-classifier/YYYY-MM-DD.summary.jsonl`
- reporter:
  - `/var/log/sharemechat-audit-access-reporter/YYYY-MM-DD.report.txt`
  - `/var/log/sharemechat-audit-access-reporter/YYYY-MM-DD.report.json`
- blocker (DRY-RUN):
  - `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.deny-audit-ips.proposed.conf`
  - `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.blocker-diff.txt`
  - `/var/log/sharemechat-audit-access-blocker/YYYY-MM-DD.ips.json`
  - estado persistente: `/var/lib/sharemechat-audit-access-blocker/ips.json`

### Configuracion

- clasificador:
  - `/etc/sharemechat-audit-access-classifier/config.env`
- reporter:
  - `/etc/sharemechat-audit-access-reporter/config.env`
- blocker:
  - `/etc/sharemechat-audit-access-blocker/config.env`
  - `/etc/sharemechat-audit-access-blocker/allowlist.conf`

## Estrategia de fechas

La automatizacion diaria del sistema trabaja siempre sobre el dia anterior en UTC.

Referencia operativa:

```bash
date -u -d "yesterday" +%F
```

Motivo:

- evita resumir un dia todavia incompleto
- desacopla el pipeline de la zona horaria local del host
- facilita auditoria diaria coherente y repetible

## Automatizacion con systemd

Estado operativo desplegado en EC2:

- existe `sharemechat-audit-daily-report.timer`
- ejecuta diariamente el flujo de clasificacion y reporting
- el flujo incluye:
  - clasificador
  - reporter
  - envio por email
- la fecha de trabajo es siempre `yesterday` en UTC

Ademas, el normalizador mantiene su propia automatizacion operativa para producir el JSONL diario canonico que alimenta el resto del sistema.

Estado operativo del blocker perimetral en AUDIT (**modo REAL activo desde 2026-04-24**):

- existe `sharemechat-audit-access-blocker.service`
- existe `sharemechat-audit-access-blocker.timer`
- el componente esta instalado en `/opt/sharemechat-audit-access-blocker`
- la configuracion operativa vive en:
  - `/etc/sharemechat-audit-access-blocker/config.env` (`DRY_RUN=0`)
  - `/etc/sharemechat-audit-access-blocker/allowlist.conf`
- el timer queda activo con ejecucion diaria a `05:30 UTC`
- genera salidas en:
  - `/var/log/sharemechat-audit-access-blocker/`
- mantiene estado persistente en:
  - `/var/lib/sharemechat-audit-access-blocker/ips.json`
- **escribe `/etc/nginx/deny-audit-ips.conf`** con IPs de Carril A (bloqueo efectivo)
- ejecuta `nginx -t` preflight y postflight en cada run con datos de Carril A
- ejecuta `systemctl reload nginx` si ambos tests pasan
- **bloquea trafico real** de IPs clasificadas en Carril A con TTL de 30 dias
- Carril B y Carril C siguen siendo solo propuesta advisory

## Envio por email

Canal actual:

- SMTP via Microsoft 365

Cuenta emisora operativa:

- `operations@sharemechat.com`

Alias configurado:

- `security+report@sharemechat.com`

Estado operativo confirmado:

- `SMTP AUTH` habilitado a nivel tenant
- `Security Defaults` deshabilitado
- permiso `Send As` configurado correctamente en Exchange Admin Center

Contenido del email:

- subject:
  - `AUDIT access summary - YYYY-MM-DD`
- body:
  - contenido literal de `YYYY-MM-DD.report.txt`
- adjuntos:
  - `YYYY-MM-DD.report.txt`
  - `YYYY-MM-DD.report.json`

## Decisiones tecnicas

### Por que esta desacoplado

El sistema se mantiene fuera de la aplicacion principal por varias razones:

- separa observabilidad operativa de la logica funcional
- evita meter dependencias de logging, scoring o SMTP en Java/Spring Boot
- mantiene un camino de auditoria independiente y auditable
- reduce el riesgo de regresion funcional en producto
- facilita operacion, mantenimiento y evolucion por capas

### Por que JSONL como formato intermedio

- es simple de generar y revisar
- funciona bien para pipelines lineales por fecha
- es facil de procesar con herramientas estandar
- conserva trazabilidad por evento sin base de datos

### Por que clasificacion determinista

- es barata
- es auditable
- permite explicar score, razones y accion recomendada
- es adecuada para `AUDIT` y revisiones PSP sin caja negra

## OPERATIONS

### Ejecucion manual

### 1. Clasificador

Para una fecha explicita:

```bash
sudo /opt/sharemechat-audit-access-classifier/bin/classify-audit-access.sh --config /etc/sharemechat-audit-access-classifier/config.env --date 2026-04-18
```

Para el dia anterior en UTC:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo /opt/sharemechat-audit-access-classifier/bin/classify-audit-access.sh --config /etc/sharemechat-audit-access-classifier/config.env --date "$DAY"
```

### 2. Reporter sin email

Para una fecha explicita:

```bash
sudo /opt/sharemechat-audit-access-reporter/bin/report-audit-access.sh --config /etc/sharemechat-audit-access-reporter/config.env --date 2026-04-18
```

Para el dia anterior en UTC:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo /opt/sharemechat-audit-access-reporter/bin/report-audit-access.sh --config /etc/sharemechat-audit-access-reporter/config.env --date "$DAY"
```

### 3. Reporter con envio por email

Para una fecha explicita:

```bash
sudo /opt/sharemechat-audit-access-reporter/bin/report-audit-access.sh --config /etc/sharemechat-audit-access-reporter/config.env --date 2026-04-18 --send-email
```

Para el dia anterior en UTC:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo /opt/sharemechat-audit-access-reporter/bin/report-audit-access.sh --config /etc/sharemechat-audit-access-reporter/config.env --date "$DAY" --send-email
```

### Debug y verificacion

Estado de la automatizacion diaria:

```bash
sudo systemctl status sharemechat-audit-daily-report.timer
sudo systemctl status sharemechat-audit-daily-report.service
```

Estado del normalizador:

```bash
sudo systemctl status sharemechat-audit-access-normalizer.timer
sudo systemctl status sharemechat-audit-access-normalizer.service
```

Revision de journal:

```bash
sudo journalctl -u sharemechat-audit-daily-report.service -n 100 --no-pager
sudo journalctl -u sharemechat-audit-access-normalizer.service -n 100 --no-pager
```

Revision de salidas:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo ls -l /var/log/sharemechat-audit-access-normalizer/"$DAY".jsonl
sudo ls -l /var/log/sharemechat-audit-access-classifier/"$DAY".table.txt
sudo ls -l /var/log/sharemechat-audit-access-classifier/"$DAY".summary.jsonl
sudo ls -l /var/log/sharemechat-audit-access-reporter/"$DAY".report.txt
sudo ls -l /var/log/sharemechat-audit-access-reporter/"$DAY".report.json
```

Estado del blocker en DRY-RUN:

```bash
sudo systemctl status sharemechat-audit-access-blocker.timer
sudo systemctl status sharemechat-audit-access-blocker.service
sudo journalctl -u sharemechat-audit-access-blocker.service -n 100 --no-pager
```

Revision de salidas del blocker:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo ls -l /var/log/sharemechat-audit-access-blocker/"$DAY".deny-audit-ips.proposed.conf
sudo ls -l /var/log/sharemechat-audit-access-blocker/"$DAY".blocker-diff.txt
sudo ls -l /var/log/sharemechat-audit-access-blocker/"$DAY".ips.json
sudo ls -l /var/lib/sharemechat-audit-access-blocker/ips.json
```

Revision de contenido:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo tail -n 20 /var/log/sharemechat-audit-access-classifier/"$DAY".table.txt
sudo cat /var/log/sharemechat-audit-access-reporter/"$DAY".report.txt
```

## Troubleshooting

### `summary not found`

Sintoma:

- el reporter falla indicando que no existe `YYYY-MM-DD.summary.jsonl`

Causas probables:

- el clasificador no se ejecuto
- el clasificador fallo
- la fecha usada no coincide con `yesterday` en UTC
- no existe todavia `YYYY-MM-DD.jsonl` del normalizador

Comprobaciones:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo ls -l /var/log/sharemechat-audit-access-normalizer/"$DAY".jsonl
sudo ls -l /var/log/sharemechat-audit-access-classifier/"$DAY".summary.jsonl
sudo journalctl -u sharemechat-audit-daily-report.service -n 100 --no-pager
```

### Errores SMTP `535`

Sintoma:

- autenticacion SMTP rechazada

Causas probables:

- credenciales incorrectas
- `SMTP AUTH` no habilitado realmente para la cuenta
- politica tenant o cambio posterior en Microsoft 365

Comprobaciones:

- revisar `SMTP_USERNAME` y `SMTP_PASSWORD`
- confirmar que `SMTP AUTH` sigue habilitado
- revisar journal del servicio diario y salida del reporter

### Errores SMTP `554`

Sintoma:

- el servidor acepta conexion pero rechaza el envio

Causas probables:

- remitente no autorizado
- alias no permitido en ese contexto
- restriccion de `Send As`

Comprobaciones:

- validar `EMAIL_FROM`
- confirmar que el permiso `Send As` sigue vigente
- confirmar que el alias configurado coincide con la politica de Exchange

### Problemas con `Send As`

Sintoma:

- autenticacion correcta pero el envio se rechaza al usar alias

Causas probables:

- permiso `Send As` no aplicado todavia
- permiso retirado o mal configurado
- se esta usando un `EMAIL_FROM` distinto del autorizado

Accion:

- verificar permisos en Exchange Admin Center
- reintentar con la cuenta emisora directa para aislar el problema

### Problemas con `Security Defaults`

Sintoma:

- autenticacion SMTP deja de funcionar sin cambios aparentes en el reporter

Causas probables:

- `Security Defaults` reactivado
- cambio global de politica de autenticacion en tenant

Accion:

- revisar el estado de `Security Defaults`
- confirmar que el tenant sigue permitiendo `SMTP AUTH`

### Ausencia de JSONL del dia

Sintoma:

- no existe `/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl`

Causas probables:

- el normalizador no se ejecuto
- el normalizador fallo
- no hubo acceso a fuentes de CloudFront o Nginx
- problema con estado, lock o permisos del host

Comprobaciones:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo systemctl status sharemechat-audit-access-normalizer.service
sudo journalctl -u sharemechat-audit-access-normalizer.service -n 100 --no-pager
sudo ls -l /var/log/sharemechat-audit-access-normalizer/
```

## Configuracion necesaria

### Clasificador

Fichero:

- `/etc/sharemechat-audit-access-classifier/config.env`

Minimo esperado:

- `PYTHON_BIN`
- `NORMALIZED_ROOT`
- `OUTPUT_ROOT`
- `WORK_ROOT`
- `ALLOWLIST_IPS` si aplica
- `ALLOWLIST_FILE` si aplica

### Reporter

Fichero:

- `/etc/sharemechat-audit-access-reporter/config.env`

Minimo esperado:

- `PYTHON_BIN`
- `CLASSIFIER_OUTPUT_ROOT`
- `OUTPUT_ROOT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_STARTTLS`
- `SMTP_TIMEOUT_SECONDS`
- `EMAIL_FROM`
- `EMAIL_TO`

## Limitaciones actuales

- la clasificacion es determinista y deliberadamente simple
- no hay SIEM, dashboard ni base de datos central
- la automatizacion diaria depende de artefactos previos del pipeline
- el pipeline esta orientado a resumen diario, no a respuesta en tiempo real
- la visibilidad sigue siendo operativa y manual, no un sistema completo antiabuso

## Siguientes pasos posibles

Sin cambiar la arquitectura base actual, los siguientes pasos razonables serian:

- consolidar la unit o script versionado que lanza `sharemechat-audit-daily-report`
- adjuntar tambien la tabla del clasificador si operacion lo considera util
- añadir politicas de retencion y rotacion de reportes
- incorporar export controlado a almacenamiento historico
- evaluar una segunda opinion AI-based sobre el `summary.jsonl` sin sustituir el motor determinista
- integrar una capa posterior de ticketing o escalado manual
