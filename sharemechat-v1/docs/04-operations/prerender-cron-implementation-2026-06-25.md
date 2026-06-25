# Implementación del cron de pre-render del blog en EC2 prod-backend

**Fecha**: 2026-06-25
**Operador**: alain@LAPTOP-8UEIKVUT
**Entorno tocado**: PROD (EC2 backend + IAM + S3 frontend prod + CloudFront E2FWNC80D4QDJC).
**Scope**: automatizar el pre-render del blog para artículos publicados POST-deploy. Cron systemd cada 15 min en el EC2 backend.
**Cierra**: deuda del 24-jun documentada como gap operativo del frente SEO cerrado el 23-jun.

Decisión arquitectónica: [ADR-042](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md).
Runbook operativo: [`ops/scripts/prerender-blog-cron/README.md`](../../ops/scripts/prerender-blog-cron/README.md).

---

## Resumen ejecutivo

Estado pre-implementación (síntoma reproducido 24-jun):
- Artículo `alternativas-omegle-2026` publicado en CMS, presente en API pública.
- `https://sharemechat.com/blog/es/alternativas-omegle-2026` servía: HTTP 200, 3613 B (shell SPA), title `1-to-1 Video Chat with Verified Models | SharemeChat`, `x-cache: Error from cloudfront` (CER 403→200 cubriendo).
- Google Search Console: HTML inspeccionado = shell, no contenido. No indexable.

Estado post-implementación (2026-06-25 23:08 UTC):
- Pasada manual del cron detecta 2 slugs faltantes (ES + EN), renderiza 4 URLs (2 listings + 2 detalles) en 43 s, sube a S3, invalida CF.
- Misma URL ahora: HTTP 200, **41894 B**, title `Alternativas a Omegle 2026: comparativa honesta | SharemeChat`, JSON-LD `BlogPosting` + `BreadcrumbList`, hreflang ES/EN/x-default. `x-cache: Miss` (cache nuevo).
- Cron timer activo cada 15 min. Próximas pasadas auto-curan cualquier publicación nueva sin intervención.

---

## Decisiones tomadas pre-ejecución

1. **Opción G3** (cron polling en EC2 prod-backend) elegida sobre G1 (hook backend) y G2 (Lambda). Tradeoffs documentados en ADR-042. Reasoning corto: menor inversión, aislamiento conceptual sin acoplamiento al backend Java, reutiliza patrón de systemd timers ya activo en el EC2.
2. **Frecuencia 15 min**: equilibrio entre latencia (publicas y verificas en GSC en <15 min) y consumo de burst credits T3.
3. **Mecanismo de detección**: diff entre listado S3 (`aws s3 ls blog/*`) y listado API pública (`/api/public/content/articles?locale={es,en}`). Cero código Java, cero columna BD. Auto-curativo.
4. **Optimización del render**: cuando hay diff, re-renderizar SOLO los slugs faltantes + las 2 URLs de listing (es/en, porque su JSON-LD incluye la lista completa de artículos). No la colección completa.
5. **Instalación Node + Chromium** en `/opt/sharemechat/prerender-blog/` (path nuevo, NO mezclar con `sharemechat-v1/`).
6. **Lock con flock** para evitar solapamientos.
7. **Path canónico S3**: `blog/<locale>/<slug>/index.html` para detalles, `blog/<locale>/index.html` para listings. Igual que el deploy.
8. **Invalidación CloudFront** solo las URLs concretas que cambiaron (no `/blog/*`). Reduce coste y radio de cache stale.
9. **Render.js mantenido intacto en el repo** ([opción C de mi propuesta inicial](../06-decisions/adr-042-prerender-cron-on-backend-ec2.md)): el cron usa el mismo formato de config (`outDir`, `hostname`, `urls` como array de strings con paths relativos, `shellTitle`) que el deploy. Cero código JS nuevo. Copia del `render.js` al EC2 vía `scp` directo (no symlink, no git clone).

---

## Ejecución por gates

### GATE 1 — Preparación IAM

Policy inline `SharemechatFrontendProdBlogPrerender` añadida al rol
`sharemechat-ec2-prod-role` con perfil `sharemechat-provisioner`:

| Action | Resource |
|---|---|
| `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject`, `s3:HeadObject` | `arn:aws:s3:::sharemechat-frontend-prod/blog/*` |
| `s3:ListBucket` con condition `s3:prefix in ["blog/*","blog"]` | `arn:aws:s3:::sharemechat-frontend-prod` |
| `cloudfront:CreateInvalidation` | `arn:aws:cloudfront::430118829334:distribution/E2FWNC80D4QDJC` |

Total inline policies del rol: 5 (4 anteriores + 1 nueva, 729 bytes JSON original).

Validación en vivo desde el EC2 con instance profile:
- `aws s3 cp /tmp/.iam-test.txt s3://sharemechat-frontend-prod/blog/.iam-test-<ts>.txt` → 200 OK, 20 B.
- `aws s3 ls` confirma upload.
- `aws s3 rm` limpia.
- `aws cloudfront create-invalidation --distribution-id E2FWNC80D4QDJC --paths /blog/.iam-test-dummy-<ts>` → `Id=I2ZPLM3GVHJ2F6985JMDY0FVA8 Status=InProgress`.

Sin `AccessDenied`. Las 3 actions nuevas operativas.

Copia auditable de la policy en repo: [`ops/scripts/prerender-blog-cron/iam/SharemechatFrontendProdBlogPrerender.json`](../../ops/scripts/prerender-blog-cron/iam/SharemechatFrontendProdBlogPrerender.json).

### GATE 2 — Swap + alarma CloudWatch

- Swap **2 GB** en `/swapfile` (priority -2, `chmod 600 root:root`).
- Persistido en `/etc/fstab` (`/swapfile none swap sw 0 0`).
- `vm.swappiness=10` aplicado + persistido en `/etc/sysctl.d/99-sharemechat-swap.conf`.
- RAM `available` se mantiene en 2.1 GiB (el swap no se cuenta como available pero amplía la cabida bajo presión).
- Sin entrada previa de swap (no se sobrescribió nada).

Alarma CloudWatch `sharemechat-prod-backend-CPUCreditBalance-low`:
- Metric `CPUCreditBalance` (instance `i-0e0a3b5fee271592f`).
- Threshold `< 100`, `EvaluationPeriods=3 × 300 s` = 15 min sostenidos para disparar.
- Estado inicial `INSUFFICIENT_DATA` (esperado al crear).
- Sin `--alarm-actions` (no hay SNS topic configurado; se consulta en consola CloudWatch).

### GATE 3 — Instalación Node + Chromium + Puppeteer

Software instalado en EC2:
- Node `v18.20.8` + npm `10.8.2` (Amazon Linux 2023 LTS, vía `dnf install`).
- Libs sistema Chromium: `alsa-lib`, `at-spi2-atk`, `at-spi2-core`, `atk`, `cups-libs`, `gtk3`, `libdrm`, `libxkbcommon`, `nspr`, `nss`, `xorg-x11-server-Xvfb`, `mesa-libgbm-devel` (trae `mesa-libgbm` transitivo que provee `libgbm.so.1`).
- Nota: `libgbm` como paquete NO existe en AL2023 — usar `mesa-libgbm`. La lib runtime queda en `/usr/lib64/libgbm.so.1`.
- Transitivas de `gtk3`: `rtkit`, `shared-mime-info`, `sound-theme-freedesktop`, `tracker-miners`, `wireplumber`, `xdg-desktop-portal`, etc. (~varios GB en disco, no son chicas).

Puppeteer:
- `npm install --no-audit --no-fund` en `/opt/sharemechat/prerender-blog/`.
- 103 paquetes en 21 s.
- Tamaño `/opt/sharemechat/prerender-blog/` (sin Chromium): **42 MB**.
- Chromium descargado en `~/.cache/puppeteer/chrome/` + `chrome-headless-shell/`: **563 MB**.
- Total instalación pre-render: ~605 MB.
- Warning npm: `puppeteer@22.15.0: < 24.15.0 is no longer supported`. Sigue funcional, deuda menor (ver backlog).

Smoke test con URL ya pre-renderizada (sin afectar a PROD):
- URL `/blog/es/que-es-videochat-1-a-1`, config con formato OLD (`hostname` + `urls` strings + `shellTitle`).
- `time node render.js`: **18.76 s** (15 s timeout imágenes dominante; `[WARN] alguna imagen no cargo en 15s` esperado).
- HTML generado: 56291 B, title del artículo (no shell).
- Limpieza OK.

Recursos sistema post-instalación:
- Disco `/`: 7.3 GB usados / 13 GB libres (delta +3.4 GB, mayor que el directo por las transitive de gtk3).
- RAM `used`: 1.5 GiB (vs 1.4 GiB pre-instalación; +100 MB residual tras cerrar Chromium).
- RAM `available`: 2.1 GiB (intacto).
- Swap usado: 0 B.

### GATE 4 — Script cron + systemd timer

Artefactos instalados:
| Path en EC2 | Permisos | Tamaño |
|---|---|---|
| `/opt/sharemechat/prerender-blog/sync-blog-prerender.sh` | `0755 ec2-user:ec2-user` | 7742 B (versión final tras 2 fixes) |
| `/var/log/sharemechat-prerender/` | `0755 ec2-user:ec2-user` | (vacío hasta primer run) |
| `/etc/logrotate.d/sharemechat-prerender` | `0644 root:root` | 159 B |
| `/etc/systemd/system/sharemechat-prerender.service` | `0644 root:root` | 320 B |
| `/etc/systemd/system/sharemechat-prerender.timer` | `0644 root:root` | 224 B |

Logrotate: rotación diaria, 14 archivos, comprimido, `delaycompress`, `missingok`. Dry-run `logrotate -d` valida sintaxis OK.

systemd service: `Type=oneshot`, `User=ec2-user`, `WorkingDirectory=/opt/sharemechat/prerender-blog`, `TimeoutStartSec=600`, `Nice=10`, journal stdout+stderr.

systemd timer: `OnBootSec=5min`, `OnUnitActiveSec=15min`, `AccuracySec=1min`, `Persistent=true` (sobrevive a apagados).

#### Bug #1 cazado en GATE 4 — LOCK_FILE

Al hacer `systemctl enable --now`, primer disparo del service falló con:
```
/opt/sharemechat/prerender-blog/sync-blog-prerender.sh: line 35:
/var/lock/sharemechat-prerender.lock: Permission denied
```
**Causa**: `/var/lock` es root:root (755). El service corre como `ec2-user` y no puede crear ficheros ahí.

**Fix**: `LOCK_FILE` movido de `/var/lock/sharemechat-prerender.lock` a `/var/log/sharemechat-prerender/.lock`. Mismo directorio que los logs (ownership ec2-user, persistente, agrupado).

**Contención inmediata**: `systemctl stop sharemechat-prerender.timer` para evitar el siguiente run automático, `systemctl reset-failed sharemechat-prerender.service` para limpiar state. Script corregido en repo + EC2, `bash -n` valida, timer queda STOPPED hasta cierre del GATE 5.

### GATE 5 — Testing E2E

Baseline pre-run:
- URL `alternativas-omegle-2026`: HTTP 200, 3613 B, title shell, `x-cache: Error from cloudfront`.
- S3: HTML NO existe.
- API ES: 4 slugs (incluye `alternativas-omegle-2026`).
- API EN: 4 slugs (incluye `best-omegle-alternatives-2026`, también nuevo).

Primera pasada manual (`systemctl start sharemechat-prerender.service`):
- Wall-clock: 23:08:08 → 23:08:51 UTC = **43 s**.
- Exit 0 / SUCCESS.
- URLs renderizadas: 4 (2 listings + 2 detalles nuevos).
- Duración Puppeteer: 36 s.
- HTMLs subidos a S3: 4, sin sospechosos.
- Invalidación CF: `IE44GNTPTA51WETL7O8QR39168`, 4 paths exactos sin wildcards.

Verificación post-run:
| Item | Antes | Después |
|---|---|---|
| CF `content-length` | 3613 B | **41894 B** |
| CF `title` | shell | "Alternativas a Omegle 2026: comparativa honesta \| SharemeChat" |
| CF `x-cache` | `Error from cloudfront` (CER) | `Miss from cloudfront` (cache nuevo) |
| CF `cache-control` | `no-cache, no-store, must-revalidate` (CER) | `public, max-age=300` |
| `BreadcrumbList` JSON-LD | n/a (era shell) | ✅ presente |
| `hreflang` | n/a | ✅ es / en / x-default |
| Match S3 ↔ CF | n/a | ✅ ambos 41894 B byte-a-byte |

Propagación invalidación CF: <60 s (curl ya servía el nuevo inmediatamente tras el run).

#### Bug #2 cazado en GATE 5 — count_nonblank

Segunda pasada (esperada "Sin diff") falló con:
```
line 66: 0
0: syntax error in expression (error token is "0")
line 68: TOTAL_MISSING: unbound variable
```
**Causa**: patrón `MISSING_ES_COUNT=$(echo "$MISSING_ES" | grep -c . || echo 0)`. Cuando `$MISSING_ES` está vacío (caso normal sin diff): `grep -c .` devuelve `0` con exit 1, `|| echo 0` añade un segundo "0" → variable recibe `"0\n0"` → aritmética posterior rompe con `set -e + pipefail`. La primera pasada no expuso el bug porque siempre había diff. El bug solo se manifiesta en el caso idempotente (vasta mayoría del tiempo en producción).

**Fix**: helper `count_nonblank()` que silencia el grep correctamente y devuelve un único número:
```bash
count_nonblank() {
    local count
    count=$(printf '%s\n' "$1" | grep -c '^.' 2>/dev/null) || count=0
    echo "$count"
}
```
Aplicado a las 4 ocurrencias del patrón vulnerable (`ES_COUNT`, `EN_COUNT`, `MISSING_ES_COUNT`, `MISSING_EN_COUNT`). Script corregido en repo + EC2, `bash -n` valida, tamaño nuevo 7742 B.

Segunda pasada post-fix:
```
[2026-06-24T23:12:04Z] ===== Inicio sync-blog-prerender =====
[2026-06-24T23:12:04Z] Consultando API publica...
[2026-06-24T23:12:04Z] API publica: ES=4 slugs, EN=4 slugs
[2026-06-24T23:12:04Z] Listando S3...
[2026-06-24T23:12:06Z] Sin diff. Nada que hacer. Duracion: 2s
```
Exit 0, 2 s, sin Puppeteer, sin uploads, sin invalidación. Idempotencia confirmada.

Carga sistema durante y tras testing:
- `uptime`: load average 0.17 / 0.06 / 0.03 (~8.5% sobre 2 vCPU, absorbible).
- RAM `used` / `available`: 1.4 GiB / 2.1 GiB (sin cambio neto; Chromium liberó RAM al cerrar).
- Swap usado: **0 B** (no se activó durante el render).

Timer reactivado al final del GATE 5:
- `systemctl status sharemechat-prerender.timer`: `Active: active (waiting)`.
- Próximo trigger automático: 2026-06-24 23:27:31 UTC (15 min tras reactivación).

### GATE 6 — Cierre

Este informe, ADR-042, README operativo, copia auditable de los 4 artefactos (script, systemd units, logrotate, IAM policy) en el repo bajo `ops/scripts/prerender-blog-cron/`. Entrada al `project-log.md`. Commits agrupados.

---

## Estado final desplegado

**EC2 prod-backend** (i-0e0a3b5fee271592f, t3.medium, eu-central-1a):
- Swap 2 GB activo.
- Node 18 + Puppeteer 22.15.0 + Chromium en `~/.cache/puppeteer/` (~605 MB total).
- systemd timer `sharemechat-prerender.timer` active (waiting), próximo trigger cada 15 min.
- IAM rol con policy nueva para S3 frontend-prod + CF invalidations.
- Alarma CWA `CPUCreditBalance < 100` armada.

**S3 frontend-prod**:
- `blog/es/` 5 HTMLs (4 detalles + 1 listing): que-es-videochat-1-a-1, elegir-videochat-seguro, foto-perfil-videochat (los 3 del 23-jun) + **alternativas-omegle-2026** (nuevo) + index del listing.
- `blog/en/` simétrico con `best-omegle-alternatives-2026` como nuevo.

**CloudFront E2FWNC80D4QDJC**:
- Sirve HTMLs pre-renderizados directamente desde S3 (cache hits tras la invalidación).
- CER 403→`/index.html` 200 sigue activo como red de seguridad.

---

## Backlog post-cierre

### Deudas técnicas registradas

1. **Bump puppeteer 22 → 24** en `sharemechat-v1/ops/scripts/prerender-blog/package.json`.
   - Versión actual `^22.0.0` (resuelve 22.15.0) marcada deprecated por npm desde 2026-06: `puppeteer@22.15.0: < 24.15.0 is no longer supported`.
   - Subir a `^24.0.0` y re-validar.
   - Afecta tanto al cron del EC2 como al pre-render del `deploy-frontend.ps1`.
   - Esfuerzo estimado: 30 min (bump + smoke en local + scp al EC2 + smoke en EC2).

2. **Revisar/borrar snapshot RDS `pre-deploy-didit-mock-20260623`**.
   - Creado el 23-jun-2026 antes del deploy backend de Didit MOCK como red de seguridad.
   - Plan original: borrar tras 48-72 h. Ya pasadas con margen (>40 h tras la ventana).
   - Comando: `aws rds delete-db-snapshot --db-snapshot-identifier pre-deploy-didit-mock-20260623 --profile sharemechat-provisioner --region eu-central-1`.
   - Verificar antes que no haya habido issues con el backend que justifiquen mantenerlo.

3. **Cron NO maneja artículos RETRACTED**.
   - Si un artículo se retracta (state PUBLISHED → RETRACTED), el HTML sigue en S3.
   - El cron no lo detecta como diff (el slug ya NO está en API, pero sigue en S3 — el diff actual es "API ⊄ S3", no "S3 ⊄ API").
   - Iteración futura: añadir reverse-diff (slugs en S3 que NO están en API) + `aws s3 rm` para esos + invalidar.
   - Por ahora, retracción manual: borrar el HTML del S3 a mano.

4. **Cron NO detecta cambios de metadata**.
   - Si un artículo PUBLISHED se edita (cambio de title, brief, hero, body), el cron NO re-renderiza.
   - Workaround manual: `aws s3 rm s3://sharemechat-frontend-prod/blog/<locale>/<slug>/index.html` para forzar re-detección en la siguiente pasada del cron.
   - Iteración futura: comparar `updatedAt` del API vs `LastModified` del objeto S3.

5. **Alarma CWA sobre logs del cron**.
   - Detectar 3 pasadas FAILED consecutivas como señal de intervención manual.
   - Implementación posible: CloudWatch Logs Subscription Filter sobre `/var/log/sharemechat-prerender/sync-*.log` con pattern `ERROR|FAIL|exit [^0]`, métrica custom, alarma sobre threshold ≥ 3 en 1h.
   - Por ahora, solo el operador inspeccionando logs manualmente puede detectar fallos sostenidos.

### Bugs corregidos durante el frente (registrados aquí para histórico)

- **LOCK_FILE en `/var/lock`** (Permission denied) → movido a `/var/log/sharemechat-prerender/.lock` (GATE 4).
- **Patrón `grep -c . || echo 0`** (syntax error en aritmética cuando input vacío) → reemplazado por helper `count_nonblank()` (GATE 5).

Ambos están corregidos en el script desplegado en el EC2 y en la copia auditable del repo.

---

## Cadena de commits del frente

Pendiente (se aplicarán al cerrar GATE 6):
- `feat(ops): cron pre-render blog automatico en EC2 prod-backend (G3)` — artefactos del cron (script, systemd units, logrotate, IAM policy).
- `docs(ops): cierre frente automatizacion pre-render (ADR-042 + informe + project-log)`.

---

## Validación final por el operador

Pasos sugeridos para confirmar el cierre:

1. **Google Search Console**:
   - Inspeccionar URL `https://sharemechat.com/blog/es/alternativas-omegle-2026`.
   - "Probar URL publicada" → verificar que el HTML capturado contiene el title del artículo y BreadcrumbList JSON-LD, no el shell.
   - "Solicitar indexación".

2. **Esperar próxima pasada del timer** (~15 min tras el GATE 5):
   - `sudo systemctl list-timers | grep sharemechat`.
   - Tras el trigger, verificar log: debe ser "Sin diff. Nada que hacer." (2 s).

3. **Publicar un nuevo artículo de prueba** desde el CMS y esperar a la siguiente pasada:
   - La URL del nuevo artículo debe servir el HTML pre-renderizado en <30 min tras publicar.

4. **Tras 7 días estables**: revisar `CPUCreditBalance` en CloudWatch para confirmar que el patrón no agota los burst credits.
