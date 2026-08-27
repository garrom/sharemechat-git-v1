# SEO edge function analysis 2026-06-21

> Análisis puntual de la función edge de CloudFront en PROD, para resolver la duda residual #1 del informe [`seo-prerender-analysis-2026-06-21.md`](seo-prerender-analysis-2026-06-21.md).
> Modo lectura. Sin modificar nada del repo ni de AWS. Sin objetos de prueba dejados atrás.

## 1. Función edge identificada

| Campo | Valor |
|---|---|
| **Nombre** | `redirect-spa-prod` |
| **Tipo** | CloudFront Function (NO Lambda@Edge) |
| **Runtime** | `cloudfront-js-1.0` |
| **Event type** | `viewer-request` |
| **ARN** | `arn:aws:cloudfront::430118829334:function/redirect-spa-prod` |
| **Distribución asociada** | `E2FWNC80D4QDJC` |
| **Aliases de la distribución** | `sharemechat.com`, `www.sharemechat.com` |
| **Stage activo** | `LIVE` (ETag `E3UN6WX5RRO2AG` en el momento de esta lectura) |
| **Ubicación canónica en el repo** | [`ops/cloudfront-functions/redirect-spa-prod.js`](sharemechat-v1/ops/cloudfront-functions/redirect-spa-prod.js) |
| **README operativo** | [`ops/cloudfront-functions/README.md`](sharemechat-v1/ops/cloudfront-functions/README.md) |
| **Versión rollback** (no asociada, referencia histórica) | [`ops/prod-cf-switch/redirect-spa-prod-LIVE-rollback.js`](sharemechat-v1/ops/prod-cf-switch/redirect-spa-prod-LIVE-rollback.js) |

**Drift check repo ↔ AWS LIVE**: ejecutado en esta sesión con `aws cloudfront get-function --name redirect-spa-prod --stage LIVE`. **Cero drift**: el código del repo es byte-idéntico al código que CloudFront tiene desplegado. Buena salud operativa.

**Custom Error Responses configurados en la distribución**: `Quantity: 0`. **NO HAY** ningún mapeo `4xx → /index.html` configurado. Relevante para la sección 6.

## 2. Código actual completo

Fuente: `ops/cloudfront-functions/redirect-spa-prod.js` (idéntico al LIVE en AWS).

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri || "/";

    // www -> apex (ADR-015): cualquier request a www.sharemechat.com se redirige al apex
    if (request.headers.host && request.headers.host.value === 'www.sharemechat.com') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: 'https://sharemechat.com' + uri } }
        };
    }

    // 301 de las 5 URLs legacy .html (servidas hoy por sharemechat-landing-prod)
    // a las rutas canonicas del SPA. Preserva SEO juice y backlinks externos
    // (CardBilling / Verotel docs, indexaciones de Google, etc.) tras el switch del origin.
    // cookie-settings.html (singular del landing legacy) -> /cookies-settings
    // (plural en App.jsx del SPA).
    var legacyRedirects = {
        '/legal.html':                '/legal',
        '/faq.html':                  '/faq',
        '/safety.html':               '/safety',
        '/community-guidelines.html': '/community-guidelines',
        '/cookie-settings.html':      '/cookies-settings'
    };
    if (legacyRedirects[uri]) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: legacyRedirects[uri] } }
        };
    }

    // Dejar pasar backend y assets/rutas estáticas reales
    if (
        uri.startsWith('/api/') ||
        uri.startsWith('/match') ||
        uri.startsWith('/messages') ||
        uri.startsWith('/uploads/') ||
        uri.startsWith('/assets/') ||
        uri.startsWith('/static/') ||
        uri.startsWith('/.well-known/acme-challenge/') ||
        uri === '/favicon.ico' ||
        uri === '/robots.txt'
    ) {
        return request;
    }

    // Reescritura SPA:
    // si no hay extensión de fichero, servir index.html
    if (!uri.includes('.')) {
        request.uri = '/index.html';
    }

    return request;
}
```

## 3. Lógica de reescritura analizada

### Patrones de URI matcheados y comportamiento

| Patrón URI | Comportamiento |
|---|---|
| `Host: www.sharemechat.com` (cualquier path) | **301 → `https://sharemechat.com<uri>`** (apex) antes de cualquier reescritura |
| `/legal.html`, `/faq.html`, `/safety.html`, `/community-guidelines.html`, `/cookie-settings.html` | **301 → URL canónica SPA** (mapeo legacy hardcoded) |
| `/api/...` | **Pasa tal cual** al origin (lo sirve el backend) |
| `/match`, `/messages` (prefijos) | **Pasa tal cual** (lo sirve el SPA, pero el SPA decide qué hacer; en práctica son rutas del SPA, no del backend — heredado de cuando había paths reales en el origin distinto) |
| `/uploads/`, `/assets/`, `/static/`, `/.well-known/acme-challenge/` | **Pasa tal cual** |
| `/favicon.ico`, `/robots.txt` | **Pasa tal cual** (sirve directamente desde S3 / origen) |
| Cualquier URI con `.` en algún punto (`foo.bar`, `main.71a2bc93.js`, `imagen.png`) | **Pasa tal cual** — se entiende como asset estático |
| **Cualquier URI sin punto** (`/blog/es`, `/blog/es/que-es-videochat-1-a-1`, `/dashboard`, `/login`, `/`) | **Reescribe `request.uri = '/index.html'`** (sustitución total, no sufijo) |

### Casos concretos pedidos en la tarea

| Petición del cliente | URI que la función envía a S3 |
|---|---|
| `GET /blog/es` | `GET /index.html` (sustituida la URI entera) |
| `GET /blog/es/que-es-videochat-1-a-1` | `GET /index.html` |
| `GET /blog/es/` | `GET /index.html` (el `/` final no es `.`, no marca extensión) |
| `GET /blog/es/elegir-videochat-seguro` | `GET /index.html` |
| `GET /static/js/main.HASH.js` | `GET /static/js/main.HASH.js` (pasa tal cual, contiene `.`) |
| `GET /robots.txt` | `GET /robots.txt` (excepción explícita) |
| `GET /sitemap.xml` | `GET /sitemap.xml` (excepción por tener `.xml`; pero además hay un Cache Behavior `/sitemap.xml` específico que la enruta al backend, fuera del default behavior) |

### Implicación crítica para el pre-render

La función **sustituye** la URI por `/index.html` (root absoluto), **NO añade** `/index.html` como sufijo. Por tanto:

- Si subimos a S3 el objeto `blog/es` (key plana, sin extensión) — **NO se sirve** porque CloudFront pide `/index.html` a S3, no `/blog/es`.
- Si subimos `blog/es/index.html` — **NO se sirve** porque CloudFront pide `/index.html` a S3, no `/blog/es/index.html`.
- Si subimos ambos — **NO se sirve** ninguno por la misma razón. La función ignora el path original al reescribir.

**Ninguna de las tres convenciones A, B o C funciona con la función edge actual sin modificarla.** Cualquier intento de pre-render que solo toque S3 + CloudFront invalidation pero no la función edge devuelve el shell SPA genérico (el comportamiento que tenemos hoy).

## 4. Resultado de la prueba empírica

**No necesaria — código concluyente.**

El análisis del JavaScript de la función es totalmente determinístico. El comportamiento se deriva línea a línea:

```javascript
if (!uri.includes('.')) {
    request.uri = '/index.html';   // ← sustitución absoluta, no sufijo
}
```

Si lanzara los probes `test-edge-probe-a` y `test-edge-probe-b` contra la función actual, **ambos devolverían el mismo title del shell SPA** (`"1-to-1 Video Chat with Verified Models | SharemeChat"`), porque ambos paths sin extensión se reescriben a `/index.html` antes de llegar al bucket. No aporta información nueva sobre el comportamiento; solo confirmaría lo que el código ya dice de forma inequívoca.

Por tanto, **omito los `aws s3 cp` + `curl` empíricos** para no dejar residuos en el bucket PROD ni gastar paths de invalidación gratuitos sin necesidad.

## 5. Convención S3 recomendada

**Convención B con modificación de la función edge**: subir el HTML pre-renderizado como objetos con key `blog/<path>/index.html` y enseñar a la función a reescribir `/blog/<path>` → `/blog/<path>/index.html`.

### Justificación

- **Convención A (key plana `blog/es`)** requeriría enseñar a la función a NO reescribir cuando el path empieza por `/blog/`. Funcionalmente correcto, pero requiere que S3 sirva con `Content-Type: text/html` un objeto sin extensión — funciona, pero es no-idiomático y obliga a `aws s3 cp` con `--content-type "text/html"` explícito en cada subida. Si alguien olvida el flag (operación manual de emergencia, hot-fix), S3 sirve `application/octet-stream` y rompe el render.
- **Convención B (`blog/<path>/index.html`)** es el patrón estándar de S3 static website hosting + el que recomendaba ADR-018 D4(c) en su día. Content-Type se infiere por extensión `.html` automáticamente. Robusto a operaciones manuales. Patrón conocido por cualquiera que haya operado con S3 estático.
- **Convención C (ambos)** duplica subida sin aportar valor; sería sólo un parche para no decidir.

### Cambio mínimo propuesto a la función edge

[propuesta] Reemplazar el bloque final de reescritura por:

```javascript
    // Reescritura SPA:
    // - /blog/* (paths pre-renderizados): añadir /index.html como sufijo,
    //   sirviendo el HTML específico del path desde S3 cuando exista.
    //   Permite SEO con title/canonical/hreflang/JSON-LD/internal-links
    //   reales por artículo y listing (ver seo-prerender-analysis-2026-06-21.md).
    // - Resto de paths sin extensión: shell SPA en /index.html como hasta ahora.
    if (!uri.includes('.')) {
        if (uri === '/blog' || uri.startsWith('/blog/')) {
            // Normaliza trailing slash: /blog/ -> /blog/index.html, no //index.html
            var trimmed = uri.replace(/\/$/, '');
            request.uri = trimmed + '/index.html';
        } else {
            request.uri = '/index.html';
        }
    }
```

Casos concretos tras la modificación:

| Petición | URI tras la función |
|---|---|
| `/blog` | `/blog/index.html` |
| `/blog/` | `/blog/index.html` |
| `/blog/es` | `/blog/es/index.html` |
| `/blog/es/` | `/blog/es/index.html` |
| `/blog/es/que-es-videochat-1-a-1` | `/blog/es/que-es-videochat-1-a-1/index.html` |
| `/dashboard`, `/login`, `/` | `/index.html` (sin cambios) |
| `/static/js/main.HASH.js`, `/robots.txt`, `/sitemap.xml` | sin cambios |

El delta de código es **~7 líneas JavaScript**. Sin nuevas dependencias. Sin cambios al bucket S3 ni al backend.

## 6. ¿Hace falta modificar la función edge?

**SÍ. Es prerequisito ineludible.** Sin la modificación de la sección 5, ninguna estrategia de pre-render selectivo a S3 funciona.

### Detalle de la modificación

1. **Editar `ops/cloudfront-functions/redirect-spa-prod.js`** con el cambio propuesto.
2. **Subir a CloudFront** con `aws cloudfront update-function --name redirect-spa-prod --function-config ... --function-code fileb://redirect-spa-prod.js` y luego `aws cloudfront publish-function`.
3. **Asociación con la distribución**: NO cambia. Sigue siendo la misma función en el mismo behavior.
4. **Mantener paridad repo ↔ LIVE**: el README de `ops/cloudfront-functions/README.md` ya lo exige.

### Riesgo asociado: fallback para slugs no pre-renderizados

Una vez la función reescriba `/blog/<path>` → `/blog/<path>/index.html`, **si el HTML pre-renderizado no existe en S3 (artículo publicado pero deploy aún no hecho), S3 con OAC devuelve 403 AccessDenied** (no 404). CloudFront sirve ese 403 al cliente. Resultado: artículo nuevo que aún no se ha pre-renderizado da 403 en lugar de mostrar el shell SPA. Peor UX que el comportamiento actual.

[propuesta] **Mitigaciones combinadas**:

**(a) Configurar Custom Error Response 403 → `/index.html` con 200 OK** en la distribución PROD. Hoy hay `Quantity: 0` (verificado). El cambio es:

```
CustomErrorResponses:
  Quantity: 1
  Items:
    - ErrorCode: 403
      ResponsePagePath: /index.html
      ResponseCode: 200
      ErrorCachingMinTTL: 0
```

Efecto: si S3 devuelve 403 (key no existe en bucket OAC), CloudFront devuelve el shell SPA con 200 OK. La SPA hidrata y muestra el artículo via API igual que hoy. Indistinguible del shell viejo para artículos no pre-renderizados.

Efecto colateral: cualquier asset estático no encontrado también responde 200 + shell SPA. **Esto ya es el comportamiento estándar de SPAs estáticas con catch-all**; no es un cambio peligroso, simplemente formaliza lo que toda SPA hace.

**(b) Política operativa**: tras publicar un artículo en el CMS, ejecutar `deploy-frontend.ps1 prod product` (o un sub-comando que solo dispare el paso de pre-render). Cadencia 1 artículo/semana hace esto trivial. Documentar en el runbook editorial.

**(c) Sitemap.xml dinámico ya cubre la indexación intermedia**: aunque el HTML pre-renderizado no exista todavía, Googlebot descubre el artículo vía sitemap (que se actualiza automáticamente al publicar, sin redeploy). Si entra al artículo antes del pre-render, recibe el shell SPA via Custom Error Response 403 → 200 con `/index.html`, hidrata y ve el contenido completo. No es óptimo SEO pero no es peor que la situación actual.

Las tres mitigaciones son **aditivas**: aplicar (a) y (b); (c) ya está. Conjuntas hacen que el pre-render sea una mejora estricta sobre la base actual.

### Resumen de cambios ineludibles a CloudFront

| Cambio | Severidad | Riesgo de rollback |
|---|---|---|
| Modificar función edge `redirect-spa-prod` (~7 líneas) | Bajo (cambio aditivo, no quita comportamiento previo para paths no-blog) | Trivial: copiar el código de `redirect-spa-prod-LIVE-rollback.js` o git revert + publish |
| Añadir CustomErrorResponse 403 → `/index.html` 200 | Bajo (sólo añade safety net; el comportamiento default actual sigue siendo válido para todo lo demás) | Trivial: `update-distribution` con `CustomErrorResponses.Quantity = 0` |

Ambos cambios son **reversibles en minutos** y NO requieren tocar S3, el backend, ni el build del frontend.

---

**Conclusión del análisis**: el plan del informe `seo-prerender-analysis-2026-06-21.md` necesita un paso adicional al inicio:

> **Paso 0**: modificar la CloudFront Function `redirect-spa-prod` para añadir la rama `/blog/*` → `<path>/index.html`, y configurar Custom Error Response 403 → `/index.html` 200 en la distribución PROD `E2FWNC80D4QDJC`.

Ese paso 0 desbloquea las convenciones B del pre-render. Estimación: **+1-1.5h** de las 6-10h totales del frente. Sigue M3-friendly.
