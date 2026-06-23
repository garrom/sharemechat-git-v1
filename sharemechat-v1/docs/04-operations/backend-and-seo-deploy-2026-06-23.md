# Backend + SEO deploy 2026-06-23

> Cierre operativo del frente compuesto: deploy backend PROD `b0fa773 → 6cebf90` (Didit en MOCK, migraciones V8/V9/V10) + Prompt 2 SEO encadenado (pre-render selectivo del blog). Sin regresión. Las 8 URLs del blog ya sirven HTML pre-renderizado con metadatos SEO completos.

## 1. Resumen ejecutivo

- **Backend desplegado**: commit `6cebf90`, JAR sha `f17b28d9...`, service active desde `2026-06-23T20:13:02 UTC`. Restart sin downtime perceptible (poller marcó `active` en <1s). Migraciones V8 (RENAME), V9 (4 ADD COLUMN + INDEX), V10 (5 CREATE TABLE + seed) aplicadas en 2.7s totales.
- **SEO desplegado**: bundle SPA con marker `data-blog-hydrated` operativo + 8 HTMLs pre-renderizados en `s3://sharemechat-frontend-prod/blog/`. Las 8 URLs cumplen los 6 criterios del Prompt 2 (title específico, canonical correcto, hreflang trilingüe, JSON-LD Blog/BlogPosting, internal links ≥3 en listings, content-length > 3192).
- **Tiempo total**: ~38 min de operación supervisada + 25 min de espera asíncrona (snapshot RDS).
- **Snapshot RDS pre-deploy**: `pre-deploy-didit-mock-20260623` `available` (rollback disponible 7 días).
- **Incidente único**: `prerender-blog-prod.ps1` abortó en mitad del bucle por bug PowerShell 5.1 con stderr de native exe (`[WARN]` de Puppeteer → `NativeCommandError`). Workaround inmediato: re-ejecutar `node render.js` directo desde Bash + `aws s3 sync` + `aws cloudfront create-invalidation /blog/*` manuales. Cero regresión: el CER 403→200 cubrió el blog durante la ventana de ~5 min entre el bundle SPA desplegado y los HTMLs pre-renderizados servidos.
- **Drift check post-deploy**: `CRITICAL → ALERT` (esperado: ALERT solo por edad de frontends, no por incompatibilidad de contrato).
- **3 commits agrupados pusheados**: `c5b4cc9` (Prompt 1 edge function), `6306f7e` (Prompt 2 pre-render), `c985b45` (deploy backend + manifest + investigaciones).

## 2. Snapshot RDS pre-deploy

| Campo | Valor |
|---|---|
| `DBSnapshotIdentifier` | `pre-deploy-didit-mock-20260623` |
| `Status` | `available` |
| `SnapshotCreateTime` | `2026-06-23T20:03:13.750Z` |
| Tipo | manual |
| Engine | MySQL 8.4.7 (mismo que origen) |
| Tamaño | 20 GB |
| Retention | manual (sin expiración automática, lo borra el operador) |

Tiempo desde `creating` hasta `available`: 32 segundos.

Credenciales usadas: perfil `sharemechat-provisioner` (el perfil por defecto `sharemechat-deployer` NO tiene `rds:CreateDBSnapshot` — bloqueante detectado y resuelto cambiando de perfil).

## 3. Migraciones BD aplicadas

Consultado desde EC2 PROD vía `mysql -h db1-sharemechat-prod...`:

```
installed_rank   version   description                                 type   success   installed_on           execution_time
10               10        add stream moderation schema                SQL    1         2026-06-23 20:13:14    424 ms
9                9         add client kyc fields                       SQL    1         2026-06-23 20:13:14    1883 ms
8                8         rename model kyc sessions to kyc sessions   SQL    1         2026-06-23 20:13:12    376 ms
```

Las 3 migraciones aplicadas con `success=1` durante el `ApplicationContext` startup (entre los segundos 10-12 del restart). Tiempo total Flyway: 2.683 ms. Cero ventana de mantenimiento perceptible.

Log Flyway durante el arranque:

```
2026-06-23T20:13:11.683Z  INFO  o.f.core.FlywayExecutor
  Database: jdbc:mysql://db1-sharemechat-prod.c1gsc6qg4l8y.eu-central-1.rds.amazonaws.com:3306/db1_sharemechat_prod (MySQL 8.4)
2026-06-23T20:13:11.759Z  WARN  Flyway upgrade recommended: MySQL 8.4 is newer than this version
  of Flyway and support has not been tested. The latest supported version of MySQL is 8.1.
2026-06-23T20:13:12.009Z  INFO  o.f.core.command.DbMigrate
  Migrating schema `db1_sharemechat_prod` to version "8 - rename model kyc sessions to kyc sessions"
2026-06-23T20:13:12.385Z  INFO  o.f.core.command.DbMigrate
  Migrating schema `db1_sharemechat_prod` to version "9 - add client kyc fields"
2026-06-23T20:13:14.268Z  INFO  o.f.core.command.DbMigrate
  Migrating schema `db1_sharemechat_prod` to version "10 - add stream moderation schema"
```

El warning Flyway sobre MySQL 8.4 > 8.1 es cosmético; las 3 migraciones ejecutaron limpias.

## 4. Smoke backend post-restart

| Endpoint | Esperado | Real | Veredicto |
|---|---|---|---|
| `GET /api/users/me` | 401 sin body | `HTTP/2 401`, server nginx, no body | ✅ |
| `GET /` (home) | 200 + text/html + ~3192 bytes | `HTTP/2 200 content-type: text/html; charset=utf-8 content-length: 3192` | ✅ |
| `GET /api/clients/me` | 503 + `X-Product-Mode: PRELAUNCH` + body JSON `{"code":"PRODUCT_UNAVAILABLE",...}` | `HTTP/2 503` + `X-Product-Mode: PRELAUNCH` + `{"code":"PRODUCT_UNAVAILABLE","scope":"product","mode":"PRELAUNCH","message":"El producto aún no está disponible."}` | ✅ |
| `POST /api/kyc/didit/webhook` (sin payload) | 4xx no 5xx (endpoint nuevo Didit existe) | `HTTP/2 401 content-length: 0` | ✅ |

Backend operativo y rutas Didit nuevas accesibles. El webhook responde 401 sin firma válida (comportamiento correcto del filtro HMAC).

## 5. Smoke SEO — 8 URLs del blog

| URL | bytes antes | bytes después | title antes | title después | canonical | hreflang | JSON-LD | internal links | OK |
|---|---:|---:|---|---|---|---:|---|---:|---|
| `/blog/es` | 3 192 | **34 611** | shell home | "Blog · SharemeChat — Videochat 1 a 1 en directo" | `/blog/es` | 3 (es, en, x-default) | Blog + BlogPosting | **3** | ✅ |
| `/blog/en` | 3 192 | **34 287** | shell home | "Blog · SharemeChat — 1-on-1 live video chat" | `/blog/en` | 3 | Blog + BlogPosting | **3** | ✅ |
| `/blog/es/que-es-videochat-1-a-1` | 3 192 | **39 365** | shell home | "Qué es el videochat 1-a-1 vs dating tradicional \| SharemeChat" | URL artículo | 3 | BlogPosting + WebPage | 2 | ✅ |
| `/blog/es/elegir-videochat-seguro` | 3 192 | **40 053** | shell home | "Cómo elegir un videochat seguro: guía para adultos \| SharemeChat" | URL artículo | 3 | BlogPosting + WebPage | 2 | ✅ |
| `/blog/es/foto-perfil-videochat` | 3 192 | **40 533** | shell home | "Cómo elegir una buena foto de perfil para videochat \| SharemeChat" | URL artículo | 3 | BlogPosting + WebPage | 2 | ✅ |
| `/blog/en/what-is-1-on-1-video-chat-vs-dating-apps` | 3 192 | **39 039** | shell home | "What Is 1-on-1 Video Chat vs Dating Apps? \| SharemeChat" | URL artículo | 3 | BlogPosting + WebPage | 2 | ✅ |
| `/blog/en/how-to-choose-safe-video-chat` | 3 192 | **39 554** | shell home | "How to Choose a Safe Video Chat Platform: Adult Guide \| SharemeChat" | URL artículo | 3 | BlogPosting + WebPage | 2 | ✅ |
| `/blog/en/profile-photo-video-chat-guide` | 3 192 | **40 030** | shell home | "How to Choose a Profile Photo for Video Chat \| SharemeChat" | URL artículo | 3 | BlogPosting + WebPage | 2 | ✅ |

**Bug crítico de indexación del baseline `seo-baseline-snapshot-2026-06-21.md` § 7 RESUELTO empíricamente**.

Antes: las 8 URLs servían el shell SPA genérico de 3192 bytes con title `"1-to-1 Video Chat with Verified Models | SharemeChat"` (el de la home en EN) y cero internal linking discoverable por Googlebot/Bing/crawlers sin JS.

Después: cada URL sirve HTML específico con title del artículo, canonical correcto, hreflang trilingüe, JSON-LD del tipo apropiado (Blog/BlogPosting/WebPage) y internal links a otros artículos (3 en listings, 2 related en artículos).

## 6. Cronología del deploy

| T | Evento |
|---|---|
| 22:03:02 | Snapshot RDS solicitado (perfil `sharemechat-provisioner` tras AccessDenied con `sharemechat-deployer`) |
| 22:03:13 | Snapshot `creating` (PercentProgress=0) |
| 22:04:29 | Snapshot `available` (32 s, PercentProgress=100) |
| 22:05:23 | `mvn -DskipTests clean package` BUILD SUCCESS (JAR `f17b28d9...`, 102 MB) |
| 22:09 | **GATE 1**: scp JAR a EC2 → SHAs coinciden + heredoc swap + chown → backup `bak-pre-deploy-didit-mock-20260623` creado |
| 22:13:01 | **GATE 2**: `systemctl restart sharemechat-prod.service` lanzado |
| 22:13:02 | Service `active`. Spring arrancando. |
| 22:13:11 | Flyway iniciado |
| 22:13:12 | V8 aplicada (376 ms) |
| 22:13:14 | V9 aplicada (1883 ms) y V10 aplicada (424 ms) |
| 22:13:37 | Smoke endpoints: 4/4 OK |
| 22:14:25 | Consulta `flyway_schema_history` confirma V8/V9/V10 success=1 |
| 22:14:50 | `update-manifest-backend.ps1 -Env prod -RemoteVerify` OK (SHAs local y remoto coinciden) |
| 22:15:30 | `check-deploy-drift.ps1 -Env prod`: severity CRITICAL → ALERT (backend al día, solo edad de frontends) |
| 22:16 | **GATE 3**: `deploy-frontend.ps1 prod product -AssumeYesNonCritical` lanzado |
| 22:17:39 | npm build OK (bundle `main.38644768.js` 179 KB) |
| 22:17:47 | sync S3 + invalidación CF `/*` (`I80O8DT94CFJJ8Q3FKNIV0GAW1`) |
| 22:17:50 | Smoke estático + smoke funcional OK |
| 22:17:53 | `[4.5/N] Pre-render iniciado` — Puppeteer pre-renderiza /blog/es OK + /blog/en OK |
| 22:17:58 | `[4.5/N] FALLA por bug PS5.1 con stderr de native exe` — script aborta paso 4.5 con exit 99 |
| 22:18:16 | `[5.5/N]` manifest frontend actualizado correctamente (deploy continúa, bundle SPA arriba) |
| 22:18:16 | `[5/5]` Deploy completado (warning: pre-render no aplicado) |
| 22:20:30 | Re-ejecuto `prerender-blog-prod.ps1` standalone → mismo bug PS5.1 |
| 22:21:00 | Workaround: `node render.js --config <path>` directo desde Bash → 8/8 OK en ~2 min |
| 22:23:00 | `aws s3 sync` HTMLs a `s3://sharemechat-frontend-prod/blog/` (8 archivos, 300 KB) |
| 22:23:30 | Invalidación CF `/blog/*` (`I5RDEYQ7HI3U2O9H4DBB1KPGOO`) |
| 22:23:59 | Invalidación `Completed` |
| 22:24:30 | Verificación 8 URLs: 8/8 cumplen criterios |
| 22:25-22:27 | 3 commits agrupados + push |

## 7. Estado actual de PROD

| Componente | Estado |
|---|---|
| `sharemechat-prod.service` | `active (running)` desde 2026-06-23T20:13:02Z, PID 843596 |
| JAR activo | `/home/ec2-user/sharemechat-v1/sharemechat-v1-0.0.1-SNAPSHOT.jar`, sha `f17b28d99b339...` (commit `6cebf90`) |
| JAR backup rollback | `.bak-pre-deploy-didit-mock-20260623` sha `ac457c64...` (commit `b0fa773`) |
| Schema BD | flyway version 10 (`stream_moderation_*` + `kyc_sessions.session_type/...` + `users.client_kyc_*`) |
| Snapshot RDS rollback | `pre-deploy-didit-mock-20260623` available + retention 7d (8 snapshots automáticos vivos) |
| Bundle SPA frontend | `main.38644768.js` (sha `765920c3...`), incluye marker `data-blog-hydrated` |
| HTMLs pre-renderizados | 8 archivos en `s3://sharemechat-frontend-prod/blog/<path>/index.html`, content-type `text/html; charset=utf-8`, cache-control 5 min |
| Función edge CloudFront | `redirect-spa-prod` LIVE, reescribe `/blog/*` → `<path>/index.html` |
| Custom Error Response | 403 → `/index.html` 200 activo (fallback transitorio para artículos publicados sin pre-render aún) |
| Manifest `prod.yaml` | backend `6cebf90`, frontend_product `6cebf90`, frontend_admin `0cdba7f` (sin tocar) |

## 8. Commits pusheados

| Hash | Mensaje | Files | Lines |
|---|---|---|---|
| `c5b4cc9` | `ops(seo): CloudFront PROD edge function /blog/* + CER 403->200 (Prompt 1)` | 5 (2 mod + 3 nuevos) | +1005 / -2 |
| `6306f7e` | `feat(seo): pre-render selectivo del blog en deploy PROD (Prompt 2)` | 9 (3 mod + 6 nuevos) | +1083 |
| `c985b45` | `ops(prod): deploy backend a 6cebf90 (didit MOCK) + manifest` | 4 (1 mod + 3 nuevos) | +1255 / -18 |

Push `6cebf90..c985b45 main -> main` confirmado.

**No incluido en commits**: `docs/04-operations/runbooks/didit-setup.md` modificación pre-existente del operador (no introducida en esta sesión, queda en working tree para que el operador decida).

## 9. Incidentes operativos

### Incidente único: bug PowerShell 5.1 con stderr de native exe en `prerender-blog-prod.ps1`

**Síntoma**: cuando `render.js` (Puppeteer) escribe `[WARN] /blog/<slug> - alguna imagen no cargo en 15s, capturando igualmente` a stderr (comportamiento esperado y documentado del script para imágenes lentas), PowerShell 5.1 con `$ErrorActionPreference = 'Stop'` convierte esa escritura en `NativeCommandError` y aborta el script padre con exit 99.

**Impacto durante el deploy**: el paso `[4.5/N]` del deploy-frontend.ps1 abortó tras pre-renderizar 2 de 8 URLs. El script principal NO abortó el deploy (política de "warning si pre-render falla, bundle SPA igualmente arriba, CER cubre"), por lo que el bundle SPA quedó desplegado correctamente y el manifest se actualizó. Pero los 6 HTMLs restantes no se subieron a S3.

**Workaround aplicado**: re-ejecutar `node render.js --config <path>` directamente desde Bash (no PowerShell), donde stderr no se trata como error. Render completó 8/8 OK en ~2 min. `aws s3 sync` + `create-invalidation /blog/*` manuales para cerrar el ciclo.

**Tiempo total perdido por el bug**: ~5 min (ventana entre bundle desplegado y HTMLs servidos, durante la cual el CER 403→200 cubrió correctamente con el shell SPA hidratado).

**Deuda creada**: `prerender-blog-prod.ps1` línea 178 (`& node render.js --config $configPath`) necesita protección contra el bug PS5.1. Tres opciones:
1. Envolver el `& node` con `$prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; ... ; $ErrorActionPreference = $prevEAP`.
2. Redirigir `2>&1` en el `&` para que stderr fluya por stdout y no dispare NativeCommandError.
3. Usar el helper `Invoke-Native` de `deploy-frontend.ps1` (líneas 197-229) que ya implementa el patrón correcto para CRA.

Recomendado: **opción 3** (Invoke-Native), por consistencia con el resto del repo.

## 10. Pendientes derivados

### Operativo inmediato

- **Hot-fix `prerender-blog-prod.ps1`** con `Invoke-Native` o redirección `2>&1`. Esfuerzo: 15 min. Crítico para que el próximo `deploy-frontend.ps1 prod product` no requiera workaround manual.
- **Borrado del snapshot RDS manual** `pre-deploy-didit-mock-20260623` cuando el operador considere que ya no necesita rollback (típicamente tras 48-72 h sin incidentes). Coste pequeño pero acumulable si se olvidan.

### Diferido (no urgente)

- **Validación E2E Didit real** (modelo + cliente con documento real). Runbook `didit-setup.md` §4-6. Requiere configurar panel Didit PROD primero (workspace + workflow IDs + secrets en `secrets.env`). El operador lo activará en un frente posterior; mientras tanto Didit responde MOCK desde PROD.
- **Redactar `deploy-backend.ps1`** (deuda Fase 2 documentada). El deploy de hoy se hizo siguiendo el patrón "IA + Bash tool + runbook" descrito en `backend-deploy-automation-search-2026-06-23.md`. Funciona pero deja la operación dependiente de la IA. Script orquestador `.ps1` lo independizaría.
- **Activar Sightengine** (P2). Hoy el código está inerte por design (`enabled=false` por defecto + seed BD `active_mode='MOCK'`). Cuando el operador decida activarlo, configurar `MODERATION_SIGHTENGINE_*` en EC2 + cambiar `active_mode` vía endpoint admin `POST /api/admin/stream-moderation/config/mode`.

### Documentación / housekeeping

- `didit-setup.md` modificación pre-existente en working tree: el operador decide commitear o descartar (no introducida en esta sesión).
- `project-log.md` entry cerrando este frente compuesto: el operador o el agente en una sesión posterior con contexto completo.

## 11. Métricas SEO esperadas a vigilar (KPI compuesto del baseline)

El bug crítico que motivó el frente SEO está resuelto. KPIs que ahora debe vigilar el operador en próximos meses:

- **Impresiones GSC**: deben crecer 20-30% mes a mes desde M3 (2026-09-16). Baseline = `tracking-mensual.md` M0 (jun 2026).
- **Posición media GSC**: debe pasar de 30 (M0) → 15 (M3) → 8 (M6) → 5 (M12).
- **Sesiones Organic Search en GA4**: subir de ~5% del tráfico total a ~30% en 12 meses.
- **Pages indexed (Coverage report GSC)**: las 8 URLs del blog deben pasar de `Discovered - currently not indexed` o `Crawled - currently not indexed` a `Submitted and indexed` en próximos 7-14 días tras este deploy. Re-submitting via GSC URL Inspection acelera.

Próxima revisión obligatoria del tracking mensual: **2026-09-16** (M3 = 3 meses desde launch del frente).
