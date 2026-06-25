# Pre-render cron del blog en EC2 prod-backend

Cron que detecta artículos publicados en el CMS sin HTML pre-renderizado en
S3 (`sharemechat-frontend-prod/blog/`) y los renderiza con Puppeteer cada
15 minutos. Auto-curativo, idempotente.

Decisión arquitectónica: [ADR-042](../../../docs/06-decisions/adr-042-prerender-cron-on-backend-ec2.md).
Informe del frente: [`docs/04-operations/prerender-cron-implementation-2026-06-25.md`](../../../docs/04-operations/prerender-cron-implementation-2026-06-25.md).

## Layout en el repo

```
ops/scripts/prerender-blog-cron/
├── README.md                                    (este fichero)
├── sync-blog-prerender.sh                       (copia auditable; el ejecutado vive en el EC2)
├── logrotate.d/sharemechat-prerender            (config logrotate, instalado en /etc/logrotate.d/)
├── systemd/sharemechat-prerender.service        (unit oneshot)
├── systemd/sharemechat-prerender.timer          (timer cada 15 min)
└── iam/SharemechatFrontendProdBlogPrerender.json (policy inline del rol EC2)
```

## Layout en el EC2 prod-backend (donde corre)

```
/opt/sharemechat/prerender-blog/
├── render.js                                    (COPIA de sharemechat-v1/ops/scripts/prerender-blog/render.js, NO symlink)
├── package.json                                 (COPIA de sharemechat-v1/ops/scripts/prerender-blog/package.json, NO symlink)
├── node_modules/                                (42 MB, generado por npm install)
└── sync-blog-prerender.sh                       (COPIA del script de este directorio)

~/.cache/puppeteer/                              (563 MB, Chromium descargado por puppeteer)

/var/log/sharemechat-prerender/
├── sync-YYYYMMDD.log                            (log diario; rotación 14 días)
└── .lock                                        (flock para evitar solapamientos)

/etc/logrotate.d/sharemechat-prerender           (rotación diaria)
/etc/systemd/system/sharemechat-prerender.service
/etc/systemd/system/sharemechat-prerender.timer
```

## Operaciones rutinarias

### Pausar el cron temporalmente

```bash
sudo systemctl stop sharemechat-prerender.timer
```
Esto **NO** desactiva el timer al boot (`enabled` se mantiene). Para reanudar:
```bash
sudo systemctl start sharemechat-prerender.timer
```

Para desactivar permanentemente (no se rearma al boot):
```bash
sudo systemctl disable --now sharemechat-prerender.timer
```

### Disparar una pasada manual (sin esperar al timer)

```bash
sudo systemctl start sharemechat-prerender.service
```
Es `Type=oneshot`. Si ya hay otra pasada activa, el flock dentro del script la deja salir limpia ("Otra ejecucion en curso").

### Ver logs

```bash
tail -f /var/log/sharemechat-prerender/sync-$(date +%Y%m%d).log
```

Logs anteriores rotan con `.1`, `.2.gz`, ... hasta 14 días. Output del systemd
unit también va a journal:
```bash
sudo journalctl -u sharemechat-prerender.service -n 50 --no-pager
sudo journalctl -u sharemechat-prerender.service --since "1 hour ago"
```

### Estado del timer y próxima ejecución

```bash
sudo systemctl status sharemechat-prerender.timer
sudo systemctl list-timers | grep sharemechat
```

### Forzar re-render de un artículo concreto

El cron solo procesa lo que está en API pero NO en S3. Para forzar re-render
manual de un slug ya pre-renderizado (caso: cambio de metadata, fix tipográfico):

```bash
# 1. Borrar el HTML de S3
aws s3 rm s3://sharemechat-frontend-prod/blog/es/<slug>/index.html

# 2. Disparar el cron (detectará el slug como faltante)
sudo systemctl start sharemechat-prerender.service
```

### Refrescar `render.js` y `package.json` desde el repo

`render.js` en el EC2 es **COPIA** (no symlink, no git clone). Si el repo
actualiza alguno de los dos ficheros, hay que re-sincronizar manualmente:

```bash
# Desde la maquina del operador (con repo clonado)
scp sharemechat-v1/ops/scripts/prerender-blog/render.js \
    prod-backend:/tmp/render.js
scp sharemechat-v1/ops/scripts/prerender-blog/package.json \
    prod-backend:/tmp/package.json

# En el EC2
ssh prod-backend
sudo mv /tmp/render.js /opt/sharemechat/prerender-blog/render.js
sudo mv /tmp/package.json /opt/sharemechat/prerender-blog/package.json
sudo chown ec2-user:ec2-user /opt/sharemechat/prerender-blog/{render.js,package.json}

# Si package.json cambio: reinstalar dependencias
cd /opt/sharemechat/prerender-blog
npm install --no-audit --no-fund

# Smoke con una URL conocida
mkdir -p /tmp/smoke
cat > /tmp/smoke/config.json <<EOF
{
  "outDir": "/tmp/smoke",
  "hostname": "https://sharemechat.com",
  "urls": ["/blog/es/que-es-videochat-1-a-1"],
  "shellTitle": "1-to-1 Video Chat with Verified Models | SharemeChat"
}
EOF
node render.js --config /tmp/smoke/config.json
rm -rf /tmp/smoke
```

**Advertencia**: el `render.js` también lo usa `deploy-frontend.ps1` paso 4.5/N
(en la máquina del operador, no en el EC2). Cualquier cambio incompatible al
contrato del config rompe ambos flujos. El contrato del config está documentado
en la cabecera de `sync-blog-prerender.sh`.

### Refrescar `sync-blog-prerender.sh` desde el repo

```bash
scp sharemechat-v1/ops/scripts/prerender-blog-cron/sync-blog-prerender.sh \
    prod-backend:/tmp/sync-blog-prerender.sh
ssh prod-backend "sudo mv /tmp/sync-blog-prerender.sh /opt/sharemechat/prerender-blog/sync-blog-prerender.sh && \
                  sudo chmod +x /opt/sharemechat/prerender-blog/sync-blog-prerender.sh && \
                  sudo chown ec2-user:ec2-user /opt/sharemechat/prerender-blog/sync-blog-prerender.sh && \
                  bash -n /opt/sharemechat/prerender-blog/sync-blog-prerender.sh"
```

Igual con systemd units y logrotate config: copias desde el repo al EC2 con
`sudo mv` a `/etc/systemd/system/` o `/etc/logrotate.d/` + `sudo systemctl
daemon-reload` cuando se toquen units.

## Verificación manual del comportamiento

Para validar que el cron sigue funcionando:

```bash
# 1. Comprobar que el timer está activo
sudo systemctl is-active sharemechat-prerender.timer
# Esperado: active

# 2. Comprobar última ejecución del service
sudo systemctl status sharemechat-prerender.service | head -10
# Esperado: Active: inactive (dead) ... code=exited, status=0/SUCCESS

# 3. Comprobar coherencia S3 vs API publica
ES_API=$(curl -fsS "https://sharemechat.com/api/public/content/articles?locale=es&size=200" | python3 -c "import sys,json; print('\n'.join(i['slug'] for i in json.load(sys.stdin)['items']))" | sort)
ES_S3=$(aws s3 ls s3://sharemechat-frontend-prod/blog/es/ --recursive | grep '/index.html$' | awk '{print $4}' | sed -E "s|blog/es/||;s|/index.html||" | grep -v '^$' | sort)
diff <(echo "$ES_API") <(echo "$ES_S3")
# Esperado: sin output (los conjuntos coinciden)
```

## Troubleshooting

### Síntoma: `Permission denied` al crear lock file

Causa histórica: lock estaba en `/var/lock/` (root:root) y el service corre
como `ec2-user`. **Resuelto en GATE 4 del 2026-06-25**: lock movido a
`/var/log/sharemechat-prerender/.lock` (ownership ec2-user). Si vuelve a
aparecer, verificar que `/var/log/sharemechat-prerender/` existe con ownership
correcto:

```bash
ls -ld /var/log/sharemechat-prerender/
# Esperado: drwxr-xr-x. ec2-user ec2-user
```

### Síntoma: `syntax error in expression (error token is "0")` + `TOTAL_MISSING: unbound variable`

Causa histórica: patrón `grep -c . || echo 0` que producía `0\n0` cuando el
input era vacío, rompiendo aritmética posterior con `set -e + pipefail`.
**Resuelto en GATE 5 del 2026-06-25**: introducida helper `count_nonblank()`.
Solo se manifestaba en pasadas sin diff. Si reaparece, comprobar que el script
contiene la helper:

```bash
grep -n "count_nonblank" /opt/sharemechat/prerender-blog/sync-blog-prerender.sh
```

### Síntoma: render.js aborta con `Config invalido: outDir, hostname, urls (...) son obligatorios`

Causa: el script `sync-blog-prerender.sh` está pasando un config en formato
distinto al esperado por `render.js`. Contrato actual (versión repo 22.15.0):
- `outDir` (string, obligatorio)
- `hostname` (string, obligatorio, base URL absoluta)
- `urls` (array de strings, paths relativos como `"/blog/es/<slug>"`)
- `shellTitle` (string, obligatorio, title del shell SPA para fallback)

Timeouts del render.js son **hardcoded** (no configurables). Si necesitan
ajuste, modificar el render.js del repo y refrescar la copia del EC2.

### Síntoma: pre-render tarda más de 60 s por URL

Inspeccionar logs:
- `[WARN] /<url> - alguna imagen no cargo en 15s, capturando igualmente`
  → CDN/hero image lenta. El render espera 15 s y continúa. Aceptable hasta
  ~3 imágenes por URL × 15 s.
- Si tarda >5 min por URL: revisar carga del EC2 (`uptime`, `free -h`),
  burst credits T3 (CloudWatch `CPUCreditBalance`), o cambios drásticos en
  el SPA.

### Síntoma: la alarma `sharemechat-prod-backend-CPUCreditBalance-low` dispara

T3 burst credits agotándose. Diagnostico:
```bash
aws cloudwatch get-metric-statistics \
  --metric-name CPUCreditBalance \
  --namespace AWS/EC2 \
  --dimensions Name=InstanceId,Value=i-0e0a3b5fee271592f \
  --start-time $(date -u -d "1 hour ago" +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 --statistics Average --region eu-central-1
```

Si el patrón es sostenido: considerar upgrade del instance type a t3.large
(ver ADR-042 sección "Cuándo escalar fuera del backend").

### Síntoma: una pasada falla pero la siguiente recupera

Diseño esperado del cron. El script no necesita reintentos propios: cada
pasada del timer reconcilia. Confirmar:
```bash
grep -E "ERROR|FAIL|exit [^0]" /var/log/sharemechat-prerender/sync-*.log | tail
```
Si hay 3 pasadas FAILED consecutivas, intervenir manualmente (ver backlog
del informe sobre alarma específica).

## Recursos consumidos

Aproximados, medidos en GATE 5 (2026-06-25):

| Recurso | Idle | Pasada sin diff | Pasada con 1 artículo nuevo |
|---|---|---|---|
| Wall-clock | n/a | ~2 s | ~43 s (36 s render Puppeteer) |
| CPU (pico) | 0% | ~5% (1 vCPU al 10% durante 2 s) | ~50% (1 vCPU al 100% durante render) |
| RAM extra durante run | 0 MB | ~50 MB (bash + curl + python) | ~400 MB (Chromium headless) |
| Swap | 0 B | 0 B | 0 B (no se activa, RAM suficiente) |
| Disco extra | 0 MB | 0 MB | <5 MB temporal en `/tmp/prerender-cron.XXX/` (limpiado) |
| Invalidaciones CloudFront | 0 | 0 | 1 (4 paths típicos) |

A 96 pasadas/día (cada 15 min) con ~5 publicaciones reales/semana:
- ~91 pasadas/día "sin diff" (~2 s = 0.0006% CPU).
- ~5 pasadas/día "con diff" (~43 s × 5 ÷ 96 = ~2 s media).
- Coste invalidaciones CF: ~5 invalidaciones × 4 paths/sem = ~20 paths/sem, muy debajo del free tier (1000/mes).
