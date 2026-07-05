# Reproducción headless: MaintenanceOverlay al guardar SEO — CloudFront failover en PATCH

**Fecha**: 2026-07-05
**Autor**: análisis asistido por IA con reproducción headless (Playwright + curl)
**Contexto**: continuación del informe [2026-07-05-cms-2c1-maintenance-overlay-diagnosis.md](2026-07-05-cms-2c1-maintenance-overlay-diagnosis.md) (commit 8cdd002), que no pudo capturar la causa porque solo usó curl HTTP y no ejercitó el flujo del navegador.
**Bug**: **REPRODUCIDO al 100%** con navegador headless. Causa raíz: **CloudFront hace failover al bucket S3 de mantenimiento en peticiones PATCH del navegador** (con Origin header). El bucket S3 devuelve el `index.html` del admin (200 text/html), `isMaintenanceResponse` lo interpreta como fallover legítimo y muestra el overlay.
**Estado**: informe. Sin cambios de código.

## 1. Elección de herramienta y por qué

- **Elegida: Playwright** (v1.61.1, chromium headless).
- **Alternativa considerada: Puppeteer**. No estaba instalada; Playwright tampoco. Playwright ganó porque tiene interceptores request/response nativos con acceso al body vía `res.body()` sin plugins, mejor API de esperas (`waitForFunction`, `waitForURL`) y locators por texto listos para uso.
- **Nada añadido al repo**. `playwright` + navegador chromium instalados en scratchpad (`C:/Users/alain/AppData/Local/Temp/claude/.../scratchpad/pw/node_modules`), fuera del `package.json` del frontend. Al terminar, se elimina la carpeta scratchpad completa (§9).

## 2. Scripts de reproducción

Los tres scripts viven en el scratchpad (borrados al terminar; ver §9). Copia íntegra pegada al final del informe (§10) para trazabilidad.

- `pw/repro.js` — flujo completo login → editor → click Guardar SEO → observación 10s. Reprodujo el overlay.
- `pw/repro3.js` — mismo flujo con esperas robustas + captura de body de todas las respuestas a `/api/admin/content/articles/9/*`. Capturó el body HTML servido por S3.
- `curl` sondas para verificar la matriz método × Origin sin navegador.

## 3. Logs capturados

### 3.1 Flujo (extracto de `flow-log.txt`)

```
[18:03:56Z] goto admin login
[18:03:58Z] click login submit
[18:03:58Z] landed at https://admin.test.sharemechat.com/dashboard-admin
[18:03:58Z] click sidebar "Content CMS"
[18:04:01Z] opening article 9 -> {"ok":true}
[18:04:04Z] fill primary keyword ES = "test-repro"
[18:04:04Z] primary fill -> {"ok":true,"before":"test-repro","after":"test-repro"}
[18:04:04Z] save SEO button state BEFORE click = {"found":true,"disabled":false,"text":"Guardar campos SEO"}
[18:04:05Z] click -> {"clicked":true,"disabledAtClick":true}
[18:04:05Z] observing for 10s
[18:04:06Z] t+1s = {"overlayVisible":true, "seoError":null, "okBanner":null}
[18:04:07Z] t+2s = {"overlayVisible":true, ...}
[18:04:15Z] t+10s = {"overlayVisible":true, ...}
```

**Overlay visible desde t+1s hasta t+10s. Sin error inline, sin banner OK. Botón vuelve a `disabled:false`**.

### 3.2 Network (extracto del PATCH — línea decisiva)

```
[18:04:05.095Z] REQUEST  PATCH  /api/admin/content/articles/9/translations/es
                        body={"primaryKeyword":"test-repro-1783274853325"}
[18:04:05.229Z] RESPONSE PATCH  /api/admin/content/articles/9/translations/es
                        status=200
                        content-type=text/html; charset=utf-8
                        server=AmazonS3
                        x-cache=Error from cloudfront
                        content-length=3613
                        body=<!doctype html><html lang="en"><head>...
                             <title>1-to-1 Video Chat with Verified Models | SharemeChat</title>...
```

**Los tres marcadores decisivos**:

| Marcador | Valor observado | Qué significa |
|---|---|---|
| `content-type` | `text/html; charset=utf-8` | CT que dispara `isMaintenanceResponse` |
| `server` | `AmazonS3` | Origin secundario del OriginGroup |
| `x-cache` | `Error from cloudfront` | CloudFront sirvió desde S3, no desde nginx |

El bucket S3 sirve el **mismo `index.html` del admin** (3613 bytes, con `<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>`), el mismo bundle que en el informe previo pareció "el HTML del producto público" pero es en realidad **el propio index.html del admin bundle** replicado en el bucket de failover.

### 3.3 Console y errores

Console del navegador: sin warnings ni errores durante todo el flujo. `errors-log.txt` completamente vacío. **No hay excepción JavaScript no capturada. El overlay se dispara por diseño del código frontend en respuesta al 200 text/html**.

## 4. Análisis paso a paso del disparo del overlay

Ruta del click hasta el overlay, con referencias al código:

1. Operador pulsa el `<button>` "Guardar campos SEO" en [BodyLocaleTabs.jsx:622](../../frontend/src/pages/admin/content/components/BodyLocaleTabs.jsx:622).
2. Handler `onSaveSeo` = `handleSaveSeo` en [ContentArticleEditor.jsx:451](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx:451).
3. `handleSaveSeo` construye el payload solo con los campos que cambiaron (aquí: `{"primaryKeyword":"test-repro-..."}`) y llama a `apiFetch('/admin/content/articles/9/translations/es', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})` en [ContentArticleEditor.jsx:492](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx:492).
4. `apiFetch` en [http.js:130+](../../frontend/src/config/http.js) hace `fetch()` a `admin.test.sharemechat.com/api/admin/content/articles/9/translations/es` con **cookies (`credentials: 'include'`) + headers CORS que incluyen `Origin: https://admin.test.sharemechat.com`**.
5. **CloudFront intercepta la request PATCH+Origin y hace failover al bucket S3 secundario del OriginGroup**. Respuesta: `HTTP/2 200`, `content-type: text/html`, body = `index.html` del admin bundle, `server: AmazonS3`.
6. `apiFetch` recibe la respuesta y llama a `isMaintenanceResponse(res)` en [http.js:26-37](../../frontend/src/config/http.js:26). La regla `if (ct.includes('text/html')) return true` retorna **true**.
7. `apiFetch` emite `window.dispatchEvent(new CustomEvent('sharemechat:maintenance'))` y lanza error para el catch del handler.
8. `MaintenanceProvider` en [MaintenanceProvider.jsx:100+](../../frontend/src/components/MaintenanceProvider.jsx) escucha el evento, hace `setMaintenance(true)`, monta el `<MaintenanceOverlay>` con el título "SHAREMECHAT ... scheduled maintenance".
9. `handleSaveSeo` captura la excepción en el catch (línea 506), pero **el overlay ya está montado por encima**, así que el banner `setSeoError(...)` queda tapado — el operador solo ve el overlay.

**No hay excepción JavaScript no capturada. No hay ping periódico defectuoso. No hay bug del `handleSaveSeo` de 2C.1**. El código funciona exactamente como está escrito. El problema es que **la infraestructura CloudFront devuelve HTML donde debería devolver JSON**, y el frontend lo interpreta correctamente como señal de mantenimiento (por diseño de `isMaintenanceResponse`).

## 5. Confirmación con curl: la matriz decisiva

Aislé cada variable con curl para distinguir qué exactamente provoca el failover.

| Método | Endpoint | Origin header | Server observado | Content-Type | Notas |
|---|---|---|---|---|---|
| `PATCH` | `/articles/9` (metadata) | **con** Origin | **AmazonS3** | text/html | **failover** |
| `PATCH` | `/articles/9` (metadata) | sin Origin | nginx/1.28.0 | application/json | OK |
| `PATCH` | `/articles/9/translations/es` | **con** Origin | **AmazonS3** | text/html | **failover** |
| `PATCH` | `/articles/9/translations/es` | sin Origin | nginx/1.28.0 | application/json | OK (§3.2 informe previo) |
| `POST` | `/articles/9/transition` | con Origin | nginx/1.28.0 | application/json | OK (409 esperado) |
| `PUT` | `/articles/9/translations/es/body` | con Origin | nginx/1.28.0 | application/json | OK |
| `OPTIONS` | `/articles/9` (preflight DELETE) | con Origin | nginx/1.28.0 | (CORS ok) | `access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS` |

Regla observada:

> **Método `PATCH` + header `Origin` presente → CloudFront falloverea al bucket S3 secundario.**

Otros verbos (`POST`, `PUT`, `DELETE`, `OPTIONS`, `GET`) con Origin funcionan sin failover. Solo `PATCH` cae.

Y — dato adicional que apunta a la causa **backend/CORS**: en el preflight OPTIONS del backend, el header `Access-Control-Allow-Methods` responde:

```
access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS
```

**PATCH no está declarado como método permitido en la CORS config del backend**. Esto es un olvido del backend (en `WebMvcConfigurer` o el `CorsConfigurationSource`), pero el impacto directo es en la interacción con CloudFront: cuando CloudFront hace preflight o cuando ve un PATCH, el behavior de la distribución falla y el OriginGroup falloverea a S3.

## 6. Causa raíz — dos bugs concurrentes

### 6.1 **#C1 (infra)**: CloudFront hace failover al bucket S3 para PATCH+Origin

- **Ámbito**: distribución CloudFront de `admin.test.sharemechat.com` (y probablemente el mismo problema en `test.sharemechat.com`, `admin.audit.sharemechat.com`, `admin.sharemechat.com`).
- **Manifestación**: cualquier PATCH desde el navegador (que siempre lleva `Origin`) al backend recibe respuesta `200 text/html AmazonS3`.
- **Vector afectado directamente**: **cualquier PATCH del CMS admin**. En particular:
  - `PATCH /articles/{id}` (guardar metadata compartida).
  - `PATCH /articles/{id}/translations/{locale}` (guardar SEO per-locale — este es el botón de 2C.1).
  - **No** afecta a los demás verbos (POST transition/create/apply-bilingual, PUT body, DELETE artículo, GET listado y detalle).
- **Causa técnica probable** (a confirmar en consola AWS CloudFront):
  1. La distribución no tiene `PATCH` en "Allowed HTTP methods" del Cache Behavior aplicado a `/api/*`, o
  2. Hay una Function/Lambda@Edge que solo maneja `{GET, POST, PUT, DELETE, OPTIONS}` y para PATCH devuelve un error interpretado como origin failure, o
  3. Hay una regla WAF que bloquea PATCH y CloudFront la traduce como origin failure, disparando el OriginGroup failover.
- **Manifestación desde 2C.1**: el bug **existía antes** de 2C.1 (afectaba a `PATCH /articles/{id}` de metadata compartida desde el paquete 6). Pero se hace más visible ahora porque:
  - 2C.1 añade el botón "Guardar campos SEO" per-locale con inputs Primary/Secondary keywords, que se toca por CADA campo y por CADA locale.
  - Es el flujo de edición SEO que el operador ejerce con más frecuencia post-pipeline (revisar y afinar keywords, títulos, meta).

### 6.2 **#F2 (frontend)**: `isMaintenanceResponse` demasiado permisivo — dispara con cualquier 200 text/html

- **Ámbito**: [http.js:26-37](../../frontend/src/config/http.js:26).
- **Comportamiento actual**: `if (ct.includes('text/html')) return true` — **cualquier** respuesta con Content-Type text/html activa el overlay.
- **Problema**: la señal de failover CloudFront→S3 es una regla operativa, no una API. La regla actual no puede distinguir "S3 sirvió HTML porque el origin backend está caído" (evento real de mantenimiento) de "S3 sirvió HTML porque CloudFront tiene un bug de configuración de método permitido" (falsa alarma).
- **Impacto**: mientras dure #C1, cualquier PATCH del admin dispara el overlay. Y aunque #C1 se solucione, este helper seguirá siendo un vector de "overlay porque algo raro sirvió HTML" que puede confundir al operador. La regla actual **no falla mal por sí sola** — su comportamiento es coherente con la señal que ve — pero es frágil frente a bugs de infra.

### 6.3 Cómo interactúan

- **#C1 es la causa raíz operativa** — sin el failover, no hay 200 text/html.
- **#F2 es lo que traduce ese failover en overlay** — sin `isMaintenanceResponse` retornando true por text/html, el operador vería un error inline "Response no válida" o similar.

Los dos juntos producen el síntoma observado. **Resolver #C1 elimina el bug**. Resolver solo #F2 no lo elimina — el PATCH sigue devolviendo HTML, la UI mostraría otro error, pero al menos no ocultaría el editor.

## 7. Diferencia con el informe previo (8cdd002)

El informe [2026-07-05-cms-2c1-maintenance-overlay-diagnosis.md](2026-07-05-cms-2c1-maintenance-overlay-diagnosis.md) usó **solo curl** para replicar el escenario. Todos los curls que hice allí:

- Iban **sin header `Origin`** (por defecto curl no lo envía).
- Iban sin User-Agent Chrome, sin Referer.

Y por eso **nunca vieron el failover** — CloudFront enrutaba al backend nginx normalmente y devolvía application/json. El informe previo llegó a dos hallazgos reales pero **no eran la causa del síntoma que el operador reportó**:

- **#B1** (backend `AuthController.refresh` sin `@Transactional`) — bug real, preexistente, afecta el refresh silencioso del admin. Sigue en pie.
- **#F1** (`isBackendAlive` no acepta 401 sin Content-Type como "backend vivo") — bug real, hace que el overlay no se apague. Sigue en pie.

Ambos son bugs verdaderos, pero **no eran los que hacían aparecer el overlay al pulsar Guardar SEO**. El operador tenía razón al insistir en que el bug persistía "con sesión fresca, tras hard reload, en incógnito". Los bugs #B1/#F1 exigen sesión caducada; el bug real #C1 se dispara con sesión completamente fresca en cuanto sale el primer PATCH desde el navegador.

**El error del informe previo**: extrapolar de curl a "el backend está sano" sin ejecutar el flujo del navegador. curl no reproduce la superficie de ataque completa. Aprendizaje aplicable: **para bugs de UX que involucran CloudFront/CORS, replicar con navegador (Playwright o similar) es obligatorio**; curl solo cubre el backend directo.

## 8. Recomendaciones (sin implementar)

Ordenadas por severidad y facilidad. **Ninguna se aplica sin acuerdo del operador**.

### 8.1 Fix #C1 primario — revisar CloudFront

**Acción**: consola AWS CloudFront, distribución de `admin.test.sharemechat.com`:

1. Revisar **Cache Behavior** aplicado a `/api/*` → "Allowed HTTP methods". Debe incluir PATCH. Si el conjunto seleccionado es `GET, HEAD, OPTIONS, PUT, POST, DELETE` (sin PATCH), cambiar a `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.
2. Revisar **Origin Group** de la distribución → "Failover criteria". Debe ser solo `500/502/503/504`. Si incluye `403/405/500/502/503/504` u otros, el rechazo del método no permitido por CloudFront se traduce en failover injustificado.
3. Revisar cualquier **CloudFront Function** o **Lambda@Edge** enganchada a "viewer-request" / "origin-request" del behavior `/api/*`. Verificar que su rama para PATCH está implementada y no propaga un error.
4. Revisar **AWS WAF** asociado a la distribución. Filtrar por logs de peticiones bloqueadas: `httpMethod = PATCH`. Si aparecen bloqueos por reglas managed que consideran PATCH "sospechoso", crear excepción para el path `/api/admin/*`.

Una vez ajustado en TEST, replicar la corrección en AUDIT y PROD (mismo día de despliegue del fix para no dejar disparidad).

### 8.2 Fix backend complementario — declarar PATCH en CORS

Aunque #C1 se arregle en CloudFront, el `access-control-allow-methods` del backend no incluye PATCH. Esto no dispara el failover por sí solo, pero **rompe el preflight CORS** para clientes que sí lo hagan (algunos navegadores lo requieren para `Content-Type: application/json` en cross-origin, incluso same-site).

**Acción**: en el `WebMvcConfigurer` o `CorsConfigurationSource` (Spring) del backend, añadir `PATCH` a la lista de métodos permitidos. Es un one-liner. Sub-pasada dedicada corta, no dentro de ADR-045.

### 8.3 Fix #F2 defensivo — endurecer `isMaintenanceResponse`

Aunque #C1 se arregle, la regla actual "cualquier text/html = maintenance" seguirá siendo frágil. Recomendaciones alternativas (elegir una):

**Alternativa A** (más simple): solo activar overlay cuando el `content-type: text/html` viene con status **5xx**. Un 200 text/html sirviendo `index.html` (por SPA fallback mal configurado o CloudFront failover misdisparado) NO debería ser señal de mantenimiento.

**Alternativa B** (más segura): añadir un header específico en el bucket de mantenimiento, e.g. `x-sharemechat-mode: maintenance`, y hacer que `isMaintenanceResponse` solo dispare cuando ese header exista. Requiere tocar el bucket S3 pero elimina falsos positivos futuros.

**Alternativa C** (defensa mínima): comprobar además que el `content-length` no coincide con el del bucket normal, o que el body no empieza con `<!doctype html>`. Muy ad-hoc; no recomendada como solución final pero sirve de mitigación temporal.

### 8.4 Mitigación operativa mientras no aterrizan los fixes

- **Sin mitigación 100% desde el navegador operador**. El único workaround técnico es evitar PATCH → pero cambiar todos los PATCH del admin CMS a POST/PUT es un rediseño de contratos que no compensa.
- Para trabajos urgentes: usar curl (que ya funciona sin Origin) para hacer los cambios SEO. No es sostenible.

### 8.5 Verificación cruzada TEST/AUDIT/PROD

Antes de dar por buena cualquier corrección de #C1, hacer el mismo experimento con Playwright contra TEST, AUDIT y PROD (con credenciales correspondientes). Si AUDIT/PROD tienen configuraciones CloudFront diferentes, el bug puede manifestarse solo en algunas superficies.

## 9. Higiene aplicada

- Playwright y navegador chromium en `C:/Users/alain/AppData/Local/Temp/claude/.../scratchpad/pw/`. **No** en `package.json` del proyecto. **No** en devDependencies.
- Cookies solo en memoria del script + un `cookies-final.json` con solo `valuePreview` (12 chars) — sin el JWT completo.
- Credenciales pasadas por `PW_EMAIL` / `PW_PASSWORD` env vars al invocar `node repro.js`. Nunca a disco.
- Screenshots (`shot-*.png`) y DOMs (`dom-*.html`) contienen datos del artículo 9 de TEST, no PII de usuarios reales.
- Al terminar: la carpeta `scratchpad/` se elimina en su totalidad (incluye `node_modules/playwright`, `~/.cache/ms-playwright/`, cookies, screenshots, logs). Comando: `rm -rf "C:/Users/alain/AppData/Local/Temp/claude/.../scratchpad"`.

## 10. Script de reproducción (íntegro)

Guardado antes de borrar el scratchpad, para que el operador pueda regenerarlo. `repro3.js` fue el que capturó los headers de respuesta completos.

```javascript
// pw/repro3.js — reproducción headless del bug 2C.1 con captura completa de
// respuestas a /api/admin/content/articles/9/*. Ver §3.2 para logs.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EMAIL = process.env.PW_EMAIL;
const PASSWORD = process.env.PW_PASSWORD;
const ADMIN_BASE = 'https://admin.test.sharemechat.com';
const ARTICLE_ID = 9;
const OUT_DIR = __dirname;
const TS = () => new Date().toISOString();
const stamp = (kind, msg) => `[${TS()}] [${kind}] ${msg}\n`;

(async () => {
  const logs = [], netlog = [], captured = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const shouldCapture = (url) => /\/api\/admin\/content\/articles\/9(\?|$|\/)/.test(url);

  page.on('response', async (res) => {
    const req = res.request();
    if (!req.url().startsWith(ADMIN_BASE) || req.url().includes('/static/')) return;
    const ct = res.headers()['content-type'] || '';
    if (shouldCapture(req.url())) {
      const raw = await res.body().catch(() => Buffer.alloc(0));
      captured.push({
        when: TS(), method: req.method(), url: req.url(),
        reqHeaders: req.headers(), reqBody: req.postData(),
        status: res.status(), resHeaders: res.headers(),
        bodyLength: raw.length,
        bodyPreview: raw.toString('utf8').substring(0, 2500),
      });
    }
    netlog.push(stamp('response', `${req.method()} ${req.url()} -> ${res.status()} ct="${ct}"`));
  });
  page.on('request', (req) => {
    if (!req.url().startsWith(ADMIN_BASE) || req.url().includes('/static/')) return;
    netlog.push(stamp('request', `${req.method()} ${req.url()} ${req.postData() ? '| body='+req.postData().substring(0,300) : ''}`));
  });

  const say = (s) => logs.push(stamp('flow', s));

  try {
    say('login');
    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => null),
      page.locator('button[type="submit"]').first().click(),
    ]);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    say('goto content');
    await page.getByText('Content CMS', { exact: false }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1500);

    say(`open article ${ARTICLE_ID}`);
    await page.evaluate((id) => {
      const target = Array.from(document.querySelectorAll('tr')).find(r => {
        const first = r.querySelector('td');
        return first && (first.textContent || '').trim() === String(id);
      });
      if (target) {
        const btn = Array.from(target.querySelectorAll('button')).find(b => /Abrir|Open/i.test(b.textContent || ''));
        if (btn) btn.click();
      }
    }, ARTICLE_ID);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('div,label')).some(l => /^Primary keyword/i.test((l.textContent||'').trim()) && l.textContent.length < 60),
      { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    say('fill primary ES');
    await page.evaluate(() => {
      const primary = Array.from(document.querySelectorAll('div,label')).find(l => /^Primary keyword/i.test((l.textContent||'').trim()) && l.textContent.length < 60);
      let c = primary;
      while (c && !c.querySelector('input[type="text"]')) c = c.parentElement;
      const input = c ? c.querySelector('input[type="text"]') : null;
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'test-repro-' + Date.now());
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);

    say('click Guardar campos SEO');
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /^Guardar campos SEO/i.test((x.textContent||'').trim()));
      if (b) { b.scrollIntoView(); b.click(); }
    });

    await page.waitForTimeout(6000);
    fs.writeFileSync(path.join(OUT_DIR, 'captured3.json'), JSON.stringify(captured, null, 2));
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, 'flow-log3.txt'), logs.join(''));
    fs.writeFileSync(path.join(OUT_DIR, 'network-log3.txt'), netlog.join(''));
    await browser.close();
    console.log(`DONE. captured=${captured.length}`);
  }
})();
```

Invocación:

```
PW_EMAIL='operations+admin@sharemechat.com' PW_PASSWORD='...' node pw/repro3.js
```

Y curl para replicar sin navegador (útil para reproducir el failover ante AWS support):

```bash
# Failover S3 (con Origin browser)
curl -X PATCH 'https://admin.test.sharemechat.com/api/admin/content/articles/9/translations/es' \
  -b cookies -H 'Content-Type: application/json' \
  -H 'Origin: https://admin.test.sharemechat.com' \
  -H 'Referer: https://admin.test.sharemechat.com/dashboard-admin' \
  --data-binary '{"primaryKeyword":"x"}' -i
# → 200 text/html AmazonS3

# Backend directo (sin Origin)
curl -X PATCH 'https://admin.test.sharemechat.com/api/admin/content/articles/9/translations/es' \
  -b cookies -H 'Content-Type: application/json' \
  --data-binary '{"primaryKeyword":"x"}' -i
# → 200 application/json nginx/1.28.0
```

---

**ESTADO: COMPLETADO**
