# AUDIT Access Normalizer

Componente operativo externo para convertir logs de acceso reales del entorno `AUDIT` en un JSONL diario canonico. No forma parte de la aplicacion Java ni del frontend.

## Responsabilidad

- leer logs raw de CloudFront desde S3
- leer el `access.log` local de Nginx del host
- normalizar ambos orígenes a un formato comun
- persistir estado minimo para evitar reprocesado innecesario
- generar un fichero diario `YYYY-MM-DD.jsonl`

## Entradas

- logs raw de CloudFront del entorno `AUDIT`
- `access.log` local de Nginx del host de `api.audit.sharemechat.com`

## Salida

Ruta operativa en EC2:

- `/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl`

Cada linea representa un evento normalizado en JSON Lines.

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

Campos opcionales:

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

## Estado persistente

Se guarda en `STATE_ROOT`:

- `state/state.json`
  - estado de escaneo de las fuentes
  - inode y offset actual del `access.log` de Nginx
- `state/processed/cloudfront/*.json`
  - marcadores de objetos S3 ya normalizados
- `state/processed/nginx/*.json`
  - marcadores por tramo ya procesado del `access.log`

## Idempotencia

La idempotencia se apoya en dos mecanismos:

- estado incremental para no releer todo en cada ejecucion
- marcadores por fuente procesada para evitar duplicados por reejecucion de la misma ventana

La salida final diaria se reconstruye desde chunks ya normalizados, por lo que una reejecucion no debe duplicar eventos ya confirmados.

## Estructura operativa en EC2

- codigo: `/opt/sharemechat-audit-access-normalizer`
- configuracion: `/etc/sharemechat-audit-access-normalizer/config.env`
- estado: `/var/lib/sharemechat-audit-access-normalizer`
- salida: `/var/log/sharemechat-audit-access-normalizer`

## Ejecucion

### Manual

```bash
sudo /opt/sharemechat-audit-access-normalizer/bin/normalize-audit-access.sh --config /etc/sharemechat-audit-access-normalizer/config.env
```

### Automatizacion del componente

El repositorio incluye:

- `sharemechat-audit-access-normalizer.service`
- `sharemechat-audit-access-normalizer.timer`

Su funcion es mantener actualizado el JSONL diario canonico que luego consumen el clasificador y el reporter.

## Comprobaciones operativas minimas

- existe `/var/log/sharemechat-audit-access-normalizer/YYYY-MM-DD.jsonl`
- el fichero diario contiene eventos JSONL validos
- `state/state.json` avanza
- hay marcadores en `state/processed/`
- `journalctl -u sharemechat-audit-access-normalizer.service`

## Limites conocidos

- el repositorio no documenta el formato exacto del `access.log` real de Nginx del host
- el parser soporta `combined` estandar y una variante `vhost combined`
- si el formato real del `access.log` difiere, ese dato debe ajustarse en la instalacion operativa

## Relacion con el sistema completo

Este componente es la primera etapa del pipeline de auditoria de accesos:

1. `audit-access-normalizer`
2. `audit-access-classifier`
3. `audit-access-reporter`

La vision end-to-end y la operacion diaria completa viven en [ops/audit-access/README.md](/C:/Users/alain/Desktop/ALAIN_Escritorio/INFORMATICA/EMPRENDIMIENTO/sharemechat-git-v1/sharemechat-v1/ops/audit-access/README.md).
