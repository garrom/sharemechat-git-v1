# TEST Access Audit System

## Vision general

El sistema de auditoria de accesos de `TEST` es un pipeline operativo externo y desacoplado de la aplicacion SharemeChat, equivalente al existente en `AUDIT`. Su objetivo es transformar logs reales de acceso de TEST en evidencia diaria util para operacion, QA interna y preparacion de PSP.

El sistema esta compuesto por cuatro componentes independientes bajo `ops/`:

1. `test-access-normalizer`
2. `test-access-classifier`
3. `test-access-reporter`
4. `test-access-blocker` (DRY-RUN en esta fase, no desplegado todavia)

Ninguno de ellos:

- pertenece a la aplicacion Java/Spring Boot
- toca frontend
- modifica logica funcional de negocio
- depende de servicios de analitica pesada o ML

La politica de clasificacion y la politica de decision del blocker son **identicas** a las de AUDIT. Este pipeline solo cambia nombres, rutas y hostnames.

## Flujo end-to-end

1. El normalizador lee logs reales del entorno `TEST` (CloudFront + Nginx de TEST).
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
CloudFront logs TEST + Nginx access.log TEST
                |
                v
test-access-normalizer
                |
                v
/var/log/sharemechat-test-access-normalizer/YYYY-MM-DD.jsonl
                |
                v
test-access-classifier
                |
                +--> /var/log/sharemechat-test-access-classifier/YYYY-MM-DD.table.txt
                |
                +--> /var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl
                                   |
                                   v
                        test-access-reporter
                                   |
                                   +--> /var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.txt
                                   |
                                   +--> /var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.json
                                   |
                                   +--> SMTP email opcional

test-access-classifier (summary.jsonl)
                |
                v
test-access-blocker (DRY-RUN activo, desplegado en EC2 TEST)
                |
                +--> /var/log/sharemechat-test-access-blocker/YYYY-MM-DD.deny-test-ips.proposed.conf
                |
                +--> /var/log/sharemechat-test-access-blocker/YYYY-MM-DD.blocker-diff.txt
                |
                +--> /var/log/sharemechat-test-access-blocker/YYYY-MM-DD.ips.json
                |
                +--> /var/lib/sharemechat-test-access-blocker/ips.json (estado persistente)
```

## Responsabilidades por componente

### 1. test-access-normalizer

- convertir logs raw de CloudFront TEST y Nginx TEST en un JSONL canonico diario
- conservar trazabilidad minima y uniforme
- mantener estado para evitar reprocesados innecesarios

Salida principal:

- `/var/log/sharemechat-test-access-normalizer/YYYY-MM-DD.jsonl`

### 2. test-access-classifier

- agrupar actividad por IP
- extraer features por IP
- aplicar scoring determinista basado en reglas (identicas a AUDIT)
- clasificar actividad en `NORMAL`, `SOSPECHOSA`, `MALICIOSA` o `CRITICA`

Salidas principales:

- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.table.txt`
- `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`

### 3. test-access-reporter

- resumir el resultado diario del clasificador
- persistir el reporte en texto y JSON
- enviar el resumen por email cuando se solicite

Salidas principales:

- `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.txt`
- `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.json`

### 4. test-access-blocker (DRY-RUN activo, desplegado en EC2 TEST)

- consumir el summary diario del clasificador
- aplicar la politica A/B/C heredada de AUDIT
- respetar una allowlist por IP y CIDR
- mantener estado persistente por IP (historial hostil + bloqueo propuesto)
- generar una propuesta de deny list, un diff razonado y un snapshot diario del estado
- **NO tocar nginx, NO ejecutar nginx -t, NO recargar, NO bloquear trafico real** (`DRY_RUN=1`)

Estado en EC2 TEST:

- desplegado en `/opt/sharemechat-test-access-blocker`
- `DRY_RUN=1` en `/etc/sharemechat-test-access-blocker/config.env`
- timer `sharemechat-test-access-blocker.timer` activo a `05:45 UTC`
- generando salidas reales en `/var/log/sharemechat-test-access-blocker/`
- manteniendo estado persistente en `/var/lib/sharemechat-test-access-blocker/ips.json`

TEST actua como entorno de observacion validada antes de cualquier activacion de bloqueo real.

Salidas principales:

- `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.deny-test-ips.proposed.conf`
- `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.blocker-diff.txt`
- `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.ips.json`
- `/var/lib/sharemechat-test-access-blocker/ips.json` (estado persistente)

Documentacion detallada: [ops/test-access-blocker/README.md](../test-access-blocker/README.md).

## Rutas reales en EC2 TEST

### Salidas

- normalizer:
  - `/var/log/sharemechat-test-access-normalizer/YYYY-MM-DD.jsonl`
- classifier:
  - `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.table.txt`
  - `/var/log/sharemechat-test-access-classifier/YYYY-MM-DD.summary.jsonl`
- reporter:
  - `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.txt`
  - `/var/log/sharemechat-test-access-reporter/YYYY-MM-DD.report.json`
- blocker (DRY-RUN activo):
  - `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.deny-test-ips.proposed.conf`
  - `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.blocker-diff.txt`
  - `/var/log/sharemechat-test-access-blocker/YYYY-MM-DD.ips.json`
  - estado persistente: `/var/lib/sharemechat-test-access-blocker/ips.json`

### Configuracion

- clasificador:
  - `/etc/sharemechat-test-access-classifier/config.env`
- reporter:
  - `/etc/sharemechat-test-access-reporter/config.env`
- blocker:
  - `/etc/sharemechat-test-access-blocker/config.env` (`DRY_RUN=1`)
  - `/etc/sharemechat-test-access-blocker/allowlist.conf`

## Estrategia de fechas

La automatizacion diaria del sistema trabaja siempre sobre el dia anterior en UTC, igual que AUDIT.

Referencia operativa:

```bash
date -u -d "yesterday" +%F
```

Motivo:

- evita resumir un dia todavia incompleto
- desacopla el pipeline de la zona horaria local del host
- facilita auditoria diaria coherente y repetible

## Automatizacion con systemd

Estado operativo en EC2 TEST:

- timers propios del normalizador, clasificador y reporter activos
- timer del blocker `sharemechat-test-access-blocker.timer` activo a `05:45 UTC` (no solapa con el timer de AUDIT a `05:30 UTC`)
- todas las units son oneshot con dependencia logica del artefacto previo del pipeline

## Diferencias frente a AUDIT

- solo cambian nombres, paths, hostnames, units y ventana horaria del timer del blocker
- politica de clasificacion identica
- politica de decision del blocker identica (carriles A/B/C, TTLs, ventana de 7 dias)
- la allowlist de TEST tiende a ser mas amplia por la existencia de testers internos, QA manual y trafico sintetico; aun asi debe mantenerse minima y comentada

## Decisiones tecnicas heredadas de AUDIT

- pipeline desacoplado de la aplicacion Java/Spring
- JSONL como formato intermedio
- clasificacion y bloqueo deterministicos y auditables
- blocker en DRY-RUN durante un periodo minimo de validacion antes de plantear activacion real

## OPERATIONS

### Ejecucion manual (cuando se despliegue el blocker)

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

### Debug y verificacion

```bash
sudo systemctl status sharemechat-test-access-blocker.timer
sudo systemctl status sharemechat-test-access-blocker.service
sudo journalctl -u sharemechat-test-access-blocker.service -n 100 --no-pager
```

Revision de salidas:

```bash
DAY="$(date -u -d "yesterday" +%F)"
sudo ls -l /var/log/sharemechat-test-access-classifier/"$DAY".summary.jsonl
sudo ls -l /var/log/sharemechat-test-access-blocker/"$DAY".deny-test-ips.proposed.conf
sudo ls -l /var/log/sharemechat-test-access-blocker/"$DAY".blocker-diff.txt
sudo ls -l /var/log/sharemechat-test-access-blocker/"$DAY".ips.json
```

## Limitaciones actuales

- el pipeline de TEST hereda las limitaciones de AUDIT (determinista, sin SIEM, sin dashboard, sin base de datos central)
- el blocker esta desplegado y activo en DRY-RUN; la gestion de deny list en TEST sigue siendo manual mientras no se active el modo real
- no existe codigo versionado que escriba `/etc/nginx/deny-test-ips.conf` en TEST hasta que se complete el checklist de activacion
- la visibilidad sigue siendo operativa y manual, no un sistema antiabuso completo

## Siguientes pasos posibles

Sin cambiar la arquitectura base actual:

- observar las salidas del blocker durante al menos 14 dias desde el despliegue
- consolidar y revisar la allowlist con testers internos, VPN de operacion y proveedores de uptime
- evaluar el paso a bloqueo real (`DRY_RUN=0`) con un cambio explicito y versionado, siguiendo el checklist del README del componente
- añadir politicas de retencion y rotacion de reportes y snapshots
