# AUDIT Access Normalizer

Componente operativo independiente para normalizar accesos de `AUDIT` fuera de la aplicacion Java.

## Alcance

- lee logs raw de CloudFront desde S3
- lee el `access.log` local de Nginx del host
- genera salida canonica diaria en JSON Lines (`JSONL`)
- persiste estado minimo para no reprocesar siempre todo
- se ejecuta como `systemd service + systemd timer`

No hace:

- alertas
- dashboards
- base de datos
- cambios en Java, frontend o routing funcional

## Estructura operativa propuesta en EC2

- codigo: `/opt/sharemechat-audit-access-normalizer`
- configuracion: `/etc/sharemechat-audit-access-normalizer/config.env`
- estado: `/var/lib/sharemechat-audit-access-normalizer`
- salida JSONL: `/var/log/sharemechat-audit-access-normalizer`

## Formato canonico por evento

Campos minimos:

- `ts`
- `source`
- `channel`
- `ip`
- `host`
- `method`
- `route`
- `status`
- `ua`

Campos opcionales cuando esten disponibles:

- `query`
- `referer`
- `xff`
- `raw_source`
- `notes`

## Clasificacion de `channel`

- `ADMIN`
  - `host=admin.audit.sharemechat.com`
  - o rutas `/api/admin/*`
- `FRONTEND`
  - resto de accesos de frontend
- `API`
  - rutas `/api/*` no admin
- `REALTIME`
  - `/match`
  - `/messages`

## Estado minimo persistente

Se guarda en `STATE_ROOT`:

- `state/state.json`
  - ultimo objeto CloudFront procesado por prefijo
  - inode y offset actual del `access.log` de Nginx
- `state/processed/cloudfront/*.json`
  - marcador por objeto S3 ya normalizado
- `state/processed/nginx/*.json`
  - marcador por tramo ya procesado del `access.log`

## Idempotencia

La idempotencia se apoya en dos mecanismos:

- estado incremental para no releer todo en cada ejecucion
- marcadores por fuente procesada para evitar duplicados por reejecucion de la misma ventana

La salida final diaria se reconstruye desde chunks ya normalizados, por lo que una reejecucion no debe duplicar eventos ya confirmados.

Ademas, el fichero diario final queda ordenado por `ts` ascendente.

## Limite conocido

El repositorio no documenta el formato exacto del `access.log` real de Nginx del host. El parser incluido soporta:

- `combined` estandar
- variante `vhost combined` con `host` como primer campo

Si el formato real del `access.log` del host AUDIT difiere de esos dos patrones, ese dato debe ajustarse durante la instalacion operativa antes de habilitar el timer.

## Instalacion minima en EC2

1. Copiar el componente al host:
```bash
sudo mkdir -p /opt/sharemechat-audit-access-normalizer
sudo rsync -a ops/audit-access-normalizer/ /opt/sharemechat-audit-access-normalizer/
```

2. Crear configuracion:
```bash
sudo mkdir -p /etc/sharemechat-audit-access-normalizer
sudo cp /opt/sharemechat-audit-access-normalizer/config/config.env.example /etc/sharemechat-audit-access-normalizer/config.env
sudo chmod 640 /etc/sharemechat-audit-access-normalizer/config.env
```

3. Crear directorios de trabajo y salida:

```bash
sudo mkdir -p /var/lib/sharemechat-audit-access-normalizer/state
sudo mkdir -p /var/lib/sharemechat-audit-access-normalizer/tmp
sudo mkdir -p /var/lib/sharemechat-audit-access-normalizer/chunks
sudo mkdir -p /var/log/sharemechat-audit-access-normalizer
```

4. Instalar units de systemd:
```bash
sudo cp /opt/sharemechat-audit-access-normalizer/systemd/sharemechat-audit-access-normalizer.service /etc/systemd/system/
sudo cp /opt/sharemechat-audit-access-normalizer/systemd/sharemechat-audit-access-normalizer.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

5. Validar ejecucion manual:
```bash
sudo /opt/sharemechat-audit-access-normalizer/bin/normalize-audit-access.sh --config /etc/sharemechat-audit-access-normalizer/config.env
```

6. Activar automatizacion:
```bash
sudo systemctl enable --now sharemechat-audit-access-normalizer.timer
sudo systemctl list-timers | grep sharemechat-audit-access-normalizer
```

## Comprobaciones operativas minimas

- existencia de JSONL diarios en `OUTPUT_ROOT`
- avance de `state/state.json`
- presencia de marcadores en `state/processed/`
- `journalctl -u sharemechat-audit-access-normalizer.service`

## Ejemplo de salida JSONL

```text
{"ts":"2026-04-17T20:35:00Z","source":"cloudfront","channel":"FRONTEND","ip":"198.51.100.10","host":"audit.sharemechat.com","method":"GET","route":"/","status":"200","ua":"Mozilla/5.0","raw_source":"s3://sharemechat-cf-logs-audit/cloudfront/audit/example.log.gz"}
{"ts":"2026-04-17T20:36:12Z","source":"nginx","channel":"API","ip":"198.51.100.10","method":"GET","route":"/api/users/me","status":"200","ua":"Mozilla/5.0","xff":"198.51.100.10, 203.0.113.5","raw_source":"/var/log/nginx/access.log","notes":"host_not_present_in_nginx_access_log"}
```
