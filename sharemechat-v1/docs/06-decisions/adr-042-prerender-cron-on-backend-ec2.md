# ADR-042 — Pre-render automático del blog vía cron en EC2 prod-backend

**Status**: Aceptada e implementada (2026-06-25).
**Frente origen**: Cierre de la deuda del 24-jun del frente SEO (ADR-019 → ADR-020 → frente pre-render del 23-jun): artículos publicados POST-deploy quedaban sin HTML pre-renderizado hasta el siguiente despliegue, sirviendo el shell SPA + mensaje "No se pudo cargar el artículo" en GSC.

## Contexto

El frente SEO cerrado el 23-jun-2026 estableció el pre-render selectivo del
blog como paso `[4.5/N]` de `deploy-frontend.ps1`. Funciona pero deja un gap
operativo: cada artículo publicado en el CMS desde el panel admin queda sin
pre-render hasta el siguiente deploy del frontend product.

El 24-jun el operador publicó `alternativas-omegle-2026` (ES + EN) y la URL
`https://sharemechat.com/blog/es/alternativas-omegle-2026` servía el shell
SPA (`content-length: 3613 B`, title del shell, `x-cache: Error from
cloudfront` indicando que el CER 403→200 estaba cubriendo) en lugar del
HTML del artículo. Google Search Console ve esto y no puede indexar el
contenido correctamente.

Lo que no cambia:
- `render.js` (Puppeteer headless contra `sharemechat.com`) sigue siendo la
  unidad de render.
- `prerender-blog-prod.ps1` y su integración en `deploy-frontend.ps1` paso
  4.5/N siguen activos para regenerar todo el catálogo en cada deploy.
- CER 403→`/index.html`+200 en la distribución CloudFront `E2FWNC80D4QDJC`
  sigue siendo la red de seguridad cuando un HTML no existe aún.

Lo que falta: un mecanismo que **detecte y rellene el gap automáticamente,
sin depender de ejecutar un deploy**.

## Opciones consideradas

### G1 — Hook backend: ApplicationEvent + listener + worker en el JVM

Modificar `ContentArticleService.transitionState`: tras `state=PUBLISHED`,
publicar `ArticlePublishedEvent`; un `@TransactionalEventListener(phase=AFTER_COMMIT)`
encola; `@Scheduled` worker lanza Puppeteer vía `ProcessBuilder`. Estado del
trabajo en BD (migración Flyway V11 nueva).

**Pros**:
- Latencia mínima entre publicación y pre-render (<5 s).
- Estado en BD permite query SQL del status y reintentos finos.
- Reutiliza credenciales IAM ya configuradas.

**Contras**:
- Acopla un concern SEO al backend Java y al schema BD.
- El JVM gana ~500 MB de footprint Puppeteer/Chromium en su host.
- Si Puppeteer cuelga o leakea, el JVM (path crítico: facturación, match)
  está en el mismo host.
- Migración V11 + ~150 líneas Java + setup EC2 + cambio IAM = 1-2 días.

### G2 — Lambda + EventBridge invocada desde backend

`@TransactionalEventListener(AFTER_COMMIT)` publica mensaje en EventBridge.
Lambda nueva (Node 18 + `@sparticuz/chromium` layer ~70 MB) ejecuta el
render + S3 PUT + CF invalidate.

**Pros**:
- Aislamiento total del backend Java.
- Escalado automático.
- Coste despreciable (pay-per-use, ~10 invocaciones/semana × <10 s).
- Worker stateless e idempotente.

**Contras**:
- **Infra nueva**: el operador opera Lambda hoy = 0. Documentación,
  runbooks, monitoring, alertas — todo desde cero.
- Cold start Puppeteer en Lambda ~4-8 s la primera vez post-deploy.
- Cableado de mensajería (SNS/SQS/EventBridge) añade superficie de fallo.
- Necesita pipeline de deploy nuevo (SAM/CDK/Terraform — el repo no usa
  IaC hoy).
- ~2-3 días.

### G3 — Cron polling en EC2 prod-backend (ELEGIDA)

Script bash en `/opt/sharemechat/prerender-blog/sync-blog-prerender.sh`
ejecutado por systemd timer cada 15 min:
1. Lista slugs publicados via `GET /api/public/content/articles?locale={es,en}&size=200`.
2. Lista HTMLs en `s3://sharemechat-frontend-prod/blog/{es,en}/`.
3. Diff → slugs faltantes (típico: 0).
4. Si hay diff: invoca `node render.js` para listings + slugs faltantes,
   sube a S3, invalida CloudFront paths exactos.

Cero código Java, cero migración BD. El estado vive implícito en S3.

**Pros**:
- **Cero cambios al backend Java**. Patrón ya familiar (mismo runtime
  shell + `node render.js` que el deploy script).
- Idempotente, auto-curativo: cada pasada deja el estado coherente. Si
  una falla, la siguiente repara.
- Reintentos triviales (el cron mismo es el reintento).
- Reutiliza patrón `systemd timer` ya usado en otros 6 jobs cron del EC2
  (`sharemechat-prod-access-normalizer.timer`, `sharemechat-cf-cidrs-refresh.timer`,
  etc.).
- Implementación 0.5-1 día.

**Contras**:
- **Latencia entre publicación y aparición SEO-friendly**: hasta 15 min
  (frecuencia del polling). Aceptable: Google tarda horas en re-crawlear
  de todas formas.
- Polling desperdicia ciclos cuando no hay nada que hacer. Negligible:
  pasada "sin diff" tarda ~2 s.
- Comparte host con JVM backend. Riesgo OOM mitigado con swap 2 GB
  (`/etc/fstab`) y `Nice=10` en el service unit.
- Si el catálogo crece a >100 artículos, el polling requiere optimización
  (no re-listar todo cada vez).

## Decisión

**Elegida G3 — cron polling en EC2 prod-backend**.

Razones:
1. **Inversión mínima**: 0.5-1 día vs 1-3 días de G1/G2.
2. **Aislamiento conceptual sin aislamiento físico**: el script bash es
   código operativo, no producto. El backend Java queda intocado, el
   contrato CMS no cambia.
3. **Reutiliza patrón existente**: systemd timers ya son la herramienta
   estándar para tareas cron en este EC2.
4. **Auto-curativo**: la propiedad más valiosa. Si el cron falla 1 vez,
   la siguiente pasada lo arregla sin intervención humana.
5. **Compatible con upgrade futuro**: si el patrón crece (catálogo >100
   artículos, publicaciones >3/semana), migrar a G2 (Lambda) es un cambio
   contenido al disparador, no al render.

Riesgos aceptados:
- Compartir host con JVM (mitigación: swap 2 GB + alarma CWA sobre
  `CPUCreditBalance` < 100 + `Nice=10`).
- Latencia hasta 15 min entre publicación y aparición en SEO (mitigación:
  Google tarda horas en re-crawlear; el CER 403→200 cubre la ventana para
  visitantes humanos via JS, aunque NO para Googlebot sin JS).

## Implementación

### Componentes desplegados (2026-06-25)

**IAM policy nueva** (`SharemechatFrontendProdBlogPrerender`, inline, en rol
`sharemechat-ec2-prod-role`):
- `s3:PutObject/DeleteObject/GetObject/HeadObject` sobre `arn:aws:s3:::sharemechat-frontend-prod/blog/*`.
- `s3:ListBucket` sobre `sharemechat-frontend-prod` con `s3:prefix in ["blog/*","blog"]`.
- `cloudfront:CreateInvalidation` sobre `arn:aws:cloudfront::430118829334:distribution/E2FWNC80D4QDJC`.

**EC2 prod-backend** (t3.medium, 2 vCPU, 4 GB RAM, 20 GB disco):
- Swap 2 GB activado (`/swapfile`, `vm.swappiness=10`, persistido en
  `/etc/fstab` y `/etc/sysctl.d/99-sharemechat-swap.conf`).
- Alarma CloudWatch `sharemechat-prod-backend-CPUCreditBalance-low`
  (threshold < 100 burst credits, 3 períodos × 5 min).
- Node 18.20.8 + npm 10.8.2 (`dnf install nodejs npm` en AL2023).
- Libs sistema Chromium: `alsa-lib`, `at-spi2-atk`, `at-spi2-core`, `atk`,
  `cups-libs`, `gtk3`, `libdrm`, `libxkbcommon`, `mesa-libgbm`, `nspr`,
  `nss`, `xorg-x11-server-Xvfb` + transitivas de `gtk3`.
- `/opt/sharemechat/prerender-blog/{render.js, package.json, sync-blog-prerender.sh, node_modules/}`.
- Chromium 22.x en `~/.cache/puppeteer/` (~563 MB).
- Total instalación: ~605 MB sobre los 17 GB libres pre-existentes.

**systemd**:
- `sharemechat-prerender.service` (oneshot, `User=ec2-user`, `Nice=10`,
  `TimeoutStartSec=600`).
- `sharemechat-prerender.timer` (`OnBootSec=5min`, `OnUnitActiveSec=15min`,
  `AccuracySec=1min`, `Persistent=true`).

**Logs**:
- `/var/log/sharemechat-prerender/sync-YYYYMMDD.log`.
- Logrotate diario, 14 días, compresión.
- Lock file en `/var/log/sharemechat-prerender/.lock` (ownership ec2-user).

### Resultados E2E (GATE 5)

- Pasada con diff (1 ES + 1 EN nuevo): 43 s wall-clock, 36 s render,
  4 HTMLs subidos (2 listings + 2 detalles), 4 paths exactos invalidados
  en CF, swap nunca activado, load avg 0.17 post-test.
- Pasada sin diff: 2 s wall-clock, 0 uploads, 0 invalidaciones.
- HTML servido por CF tras invalidación (~60 s propagación):
  3613 B → 41894 B; title del shell → title del artículo; cache `Error`
  (CER fallback) → `Miss` (cache nuevo, próximas servirá `Hit`).

## Consecuencias

### Operativas
- Latencia entre publicación y aparición SEO: 0-15 min (media ~7 min).
- Operador debe esperar la pasada del cron antes de "Solicitar indexación"
  en Google Search Console.
- El cron consume burst credits T3: ~5 pasadas/día con render (~3 min CPU
  total/día). Capa muy por debajo del baseline t3.medium (20% CPU = 4.8 h
  CPU/día gratis).
- Pueden coexistir 2 pasadas: si una tarda >15 min, el flock impide
  ejecución solapada y la siguiente sale limpia.

### Sobre el contrato del `render.js`
El `render.js` del repo (en `sharemechat-v1/ops/scripts/prerender-blog/`)
ahora tiene **dos consumidores**:
1. `prerender-blog-prod.ps1` invocado desde `deploy-frontend.ps1` paso 4.5/N
   (build-time, full catalog).
2. `sync-blog-prerender.sh` invocado por el cron en EC2 (run-time, sólo
   slugs faltantes).

Ambos usan el mismo formato de config (`outDir`, `hostname`, `urls` como
array de strings con paths relativos, `shellTitle`). Cualquier cambio
incompatible al contrato rompe los dos flujos. La copia del `render.js` al
EC2 es manual via `scp` (no symlink, no git clone) — ver README.

### Sobre el catálogo público
El SPA cliente funcionalmente NO depende del pre-render. Cualquier usuario
con JS habilitado (incluido Googlebot moderno, que ejecuta JS) recibe el
shell, hidrata, fetchea `/api/public/content/articles/{slug}?locale=es` y
renderiza correctamente. El pre-render es **solo** para scrapers/bots que
inspeccionan HTML inicial sin JS (GSC "Probar URL publicada", FB, X,
WhatsApp, etc.) y para mejorar señales SEO iniciales.

## Cuándo escalar fuera del backend

Triggers que justifican migrar a G2 (Lambda):
- Cadencia editorial >3 artículos/semana sostenida.
- Pasadas del cron consistentemente >120 s.
- Alarma `CPUCreditBalance-low` disparando >1 vez/semana.
- Catálogo >100 artículos publicados (lista del API empieza a ser pesada).
- Necesidad de pre-render en <1 min tras publicación (caso uso: noticias
  de actualidad time-sensitive).

Triggers que justifican migrar a G1 (hook backend):
- Necesidad de auditoría per-publicación del estado del pre-render en BD.
- Latencia <30 s requerida.

Hasta esos triggers, G3 es la opción más coherente con el patrón actual.

## Referencias

- Análisis de viabilidad: [`docs/04-operations/prerender-cron-implementation-2026-06-25.md`](../04-operations/prerender-cron-implementation-2026-06-25.md).
- Frentes SEO anteriores: [Prompt 1 commit `c5b4cc9`](../../ops/cloudfront-functions/redirect-spa-prod.js),
  [Prompt 2 commit `6306f7e`](../../ops/scripts/prerender-blog/render.js),
  [Prompt 3 cierre commit `9c4aba5`](04-operations/seo-prompt3-implementation-2026-06-23.md).
- Script + units: [`ops/scripts/prerender-blog-cron/`](../../ops/scripts/prerender-blog-cron/).
- README operativo: [`ops/scripts/prerender-blog-cron/README.md`](../../ops/scripts/prerender-blog-cron/README.md).
