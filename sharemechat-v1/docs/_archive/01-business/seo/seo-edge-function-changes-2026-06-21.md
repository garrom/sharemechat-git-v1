# SEO edge function changes 2026-06-21

> Ejecución del prompt 1/3 del paquete pre-render. Aplica los dos cambios prerequisito en CloudFront PROD documentados en [`seo-edge-function-analysis-2026-06-21.md`](seo-edge-function-analysis-2026-06-21.md) § 5 y § 6, y los valida empíricamente sin tocar frontend, backend ni pre-render todavía.

## 1. Cambios aplicados

### Función edge `redirect-spa-prod`

Modificación en [`ops/cloudfront-functions/redirect-spa-prod.js`](sharemechat-v1/ops/cloudfront-functions/redirect-spa-prod.js): rama nueva para paths bajo `/blog/*` que reescribe a `<path>/index.html` en lugar de sustituir por `/index.html` (raíz). El resto del comportamiento (www→apex, legacy `.html` 301, exclusiones `/api/`, `/static/`, etc.) intacto.

Diff aplicado:

```diff
     // Reescritura SPA:
-    // si no hay extensión de fichero, servir index.html
+    // - /blog/* (paths con pre-render selectivo): anadir /index.html como sufijo.
+    //   Permite servir HTML especificos por articulo y listing desde
+    //   s3://sharemechat-frontend-prod/blog/<path>/index.html.
+    //   Si el objeto no existe, S3 (OAC) devuelve 403 y la distribucion lo
+    //   convierte a 200 + /index.html (Custom Error Response) -> shell SPA.
+    //   Ver seo-edge-function-analysis-2026-06-21.md.
+    // - Resto de paths sin extension: shell SPA en /index.html como hasta hoy.
     if (!uri.includes('.')) {
-        request.uri = '/index.html';
+        if (uri === '/blog' || uri.startsWith('/blog/')) {
+            var trimmed = uri.replace(/\/$/, '');
+            request.uri = trimmed + '/index.html';
+        } else {
+            request.uri = '/index.html';
+        }
     }
```

Aplicado a CloudFront vía `aws cloudfront update-function` + `publish-function`. Stage LIVE actualizado y verificado byte-idéntico al repo.

### Custom Error Response en la distribución PROD

Distribución `E2FWNC80D4QDJC` (alias `sharemechat.com`, `www.sharemechat.com`).

Antes:

```json
{ "Quantity": 0 }
```

Después:

```json
{
    "Quantity": 1,
    "Items": [
        {
            "ErrorCode": 403,
            "ResponsePagePath": "/index.html",
            "ResponseCode": "200",
            "ErrorCachingMinTTL": 0
        }
    ]
}
```

Aplicado con `aws cloudfront update-distribution`. La distribución pasó a estado `Deployed` en ~30 segundos.

### README actualizado

`ops/cloudfront-functions/README.md` recibe sección "Historial de cambios" con entrada `2026-06-21` documentando los dos cambios y enlazando a [`seo-edge-function-analysis-2026-06-21.md`](seo-edge-function-analysis-2026-06-21.md).

## 2. Baseline (pre-cambios)

Capturado antes de tocar nada. Las tres URLs devolvían el shell SPA genérico (comportamiento conocido y motivo del frente):

```
=== BASELINE: /blog/es ===
HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 3192
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>

=== BASELINE: /blog/es/que-es-videochat-1-a-1 ===
HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 3192
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>

=== BASELINE: / (home) ===
HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 3192
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
```

## 3. No-regression test tras Custom Error Response

Ejecutado tras `Status: Deployed` de la distribución. Los tres curls devuelven respuesta **idéntica al baseline** (mismos códigos, mismo content-length 3192, mismo title del shell, mismo last-modified). Sin regresión:

```
=== POST-CER: /blog/es ===
HTTP/2 200
content-length: 3192
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>

=== POST-CER: /blog/es/que-es-videochat-1-a-1 ===
HTTP/2 200
content-length: 3192
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>

=== POST-CER: / ===
HTTP/2 200
content-length: 3192
```

**Veredicto**: ✅ no-regression OK. El CER por sí solo no cambia el comportamiento porque la función edge sigue mapeando todos los paths sin extensión a `/index.html`, que sí existe en S3 (nunca dispara 403).

## 4. No-regression test tras modificar función edge

Ejecutado tras `publish-function` + sleep 90s + verificación LIVE byte-idéntico al repo. Los tres curls devuelven respuesta **idéntica al baseline**:

```
=== POST-CHANGE: /blog/es ===
HTTP/2 200
content-length: 3192
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>

=== POST-CHANGE: /blog/es/que-es-videochat-1-a-1 ===
HTTP/2 200
content-length: 3192
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>

=== POST-CHANGE: / ===
HTTP/2 200
content-length: 3192
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
```

**Veredicto**: ✅ no-regression OK. Confirmación empírica de que la combinación nueva función + CER es transparente cuando no hay HTML pre-renderizado en S3:

- `/blog/es` → la función reescribe a `/blog/es/index.html` → S3 OAC devuelve 403 → CER convierte a 200 + sirve `/index.html` → cliente ve shell SPA igual que antes.
- `/blog/es/que-es-videochat-1-a-1` → idem.
- `/` → la función la mantiene en `/index.html` (no es `/blog/*`) → sirve shell directo.

## 5. Test positivo del pre-render

Subido objeto dummy a la convención esperada:

```
aws s3 cp /tmp/test-probe.html s3://sharemechat-frontend-prod/blog/test-probe/index.html --content-type "text/html; charset=utf-8"
```

Tras invalidación + 90s de propagación:

```
=== TEST POSITIVO 1: /blog/test-probe sin trailing slash ===
HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 298       ← tamaño dummy, no del shell (3192)
last-modified: Mon, 22 Jun 2026 10:19:47 GMT  ← timestamp del upload
etag: "430838a5f87afac96e07bc065bb9bc8e"
server: AmazonS3
x-cache: Miss from cloudfront    ← primera petición
<title>TEST-PRERENDER-PROBE-2026-06-21</title>    ← title del dummy

=== TEST POSITIVO 2: /blog/test-probe/ con trailing slash ===
HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 298
last-modified: Mon, 22 Jun 2026 10:19:47 GMT
etag: "430838a5f87afac96e07bc065bb9bc8e"
x-cache: Hit from cloudfront    ← cache hit del primero (mismo key tras reescritura)
<title>TEST-PRERENDER-PROBE-2026-06-21</title>
```

**Veredicto**: ✅ **TEST POSITIVO OK**. La función edge:

- `/blog/test-probe` → reescribe a `/blog/test-probe/index.html` → S3 sirve el dummy → cliente recibe título dummy.
- `/blog/test-probe/` → reescribe a `/blog/test-probe/index.html` (trailing slash normalizado) → cache hit del mismo objeto.

El sistema sirve correctamente HTML específico por path cuando existe en S3 bajo la convención B (`blog/<path>/index.html`).

## 6. Test del fallback 403 → 200

Petición a un path bajo `/blog/` que no existe en S3:

```
=== TEST FALLBACK: /blog/test-this-does-not-exist-2026 ===
HTTP/2 200    ← NO 403; CER lo convirtió
content-type: text/html; charset=utf-8
content-length: 3192    ← shell SPA
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>
```

**Veredicto**: ✅ **TEST FALLBACK OK**. La función reescribe a `/blog/test-this-does-not-exist-2026/index.html` → S3 OAC devuelve 403 → CER lo convierte a 200 sirviendo `/index.html` (shell SPA). El cliente nunca ve 403.

Esto cubre el caso operativo crítico: artículo publicado en CMS pero sin deploy de pre-render aún. La SPA hidratará via API y mostrará el contenido igual que hoy.

## 7. Limpieza

Borrado del dummy + invalidaciones:

```
aws s3 rm s3://sharemechat-frontend-prod/blog/test-probe/index.html
→ delete: s3://sharemechat-frontend-prod/blog/test-probe/index.html

aws s3 ls s3://sharemechat-frontend-prod/blog/ --recursive | grep test-probe
→ vacio (cero residuos)
```

Invalidaciones aplicadas: dos rondas. La primera (`I9WBELL6D62L4UT0WLTZR3U0CB`, paths `/blog/test-probe` + `/blog/test-probe/`) marcó `Completed` pero el cache CF mantuvo el dummy unos minutos más. Segunda invalidación con wildcard (`IB8OIB3ESXSVT8TPQY1Z2Z9N7B`, path `/blog/test-probe*`) marcó `Completed` y verificación final mostró el cache limpio:

```
=== Verificacion definitiva tras 2a invalidacion ===
HTTP/2 200
content-length: 3192    ← shell SPA, no el dummy (298)
last-modified: Thu, 11 Jun 2026 14:32:38 GMT
date: Mon, 22 Jun 2026 10:39:16 GMT    ← timestamp post-invalidacion
<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>
```

Estado final: cero objetos `test-probe*` en `s3://sharemechat-frontend-prod/`, cero dummy servido por CloudFront. Cache limpio. Fallback CER funcionando para el path (sirve shell con 200).

## 8. Estado final

### Función edge `redirect-spa-prod` (LIVE en CloudFront)

Diff entre repo y LIVE descargado de AWS:

```
IDENTICAL (after EOL normalization)
```

Stage LIVE refleja exactamente el código del repo. Cero drift.

### CustomErrorResponses de la distribución PROD `E2FWNC80D4QDJC`

```json
{
    "Quantity": 1,
    "Items": [
        {
            "ErrorCode": 403,
            "ResponsePagePath": "/index.html",
            "ResponseCode": "200",
            "ErrorCachingMinTTL": 0
        }
    ]
}
```

### Bucket PROD

```
aws s3 ls s3://sharemechat-frontend-prod/blog/ --recursive
→ vacio (cero objetos bajo /blog/)
```

No hay HTML pre-renderizado en S3 todavía. Esto se introduce en el prompt 2/3 del paquete (script de pre-render + integración en `deploy-frontend.ps1`).

### Comportamiento operativo resultante

| URL | Comportamiento |
|---|---|
| `/blog/es`, `/blog/<path>` con HTML pre-renderizado en S3 | Sirve el HTML específico (200, content del pre-render). |
| `/blog/es`, `/blog/<path>` sin HTML pre-renderizado en S3 | S3 OAC devuelve 403 → CER convierte a 200 + shell SPA. La SPA hidrata via API. Comportamiento operativo idéntico al previo al cambio. |
| `/` (home), rutas SPA fuera de `/blog/` | Sin cambios. Función reescribe a `/index.html` igual que antes. |
| `/api/*`, `/static/*`, `/sitemap.xml`, `/robots.txt`, `/favicon.ico` | Sin cambios. Excepciones de la función intactas. |
| `www.sharemechat.com/*` | Sin cambios. 301 a apex intacto. |
| Legacy `.html` (legal, faq, safety, community-guidelines, cookies-settings) | Sin cambios. 301 al SPA intacto. |

## 9. Tiempo total

Aproximadamente **45 minutos** del baseline (12:11) a la verificación final tras la 2ª invalidación (12:39 confirmación + 12:40 último curl). Incluye:

- Baseline + análisis de pre-condiciones: ~2 min.
- Custom Error Response: aplicación + espera Deployed: ~3 min (deployment fue ~30s, no los 5-15 min estimados).
- Modificación función edge + README + diff + publish + propagación 90s: ~5 min.
- No-regression tests (3 rondas, baseline / post-CER / post-función): ~3 min.
- Subida dummy + invalidación + propagación + test positivo: ~5 min.
- Test fallback: ~1 min.
- Limpieza + dos rondas de invalidación + verificación cache limpio: ~25 min (la mayor parte fue espera de invalidaciones CF).

## 10. Incidentes

Dos puntos de fricción menores durante la ejecución, sin impacto en el resultado:

1. **`jq` no disponible en el sandbox bash**. Resuelto: todas las manipulaciones JSON hechas en PowerShell con `ConvertFrom-Json` / `ConvertTo-Json`.

2. **BOM UTF-8 al escribir el config JSON con `Out-File -Encoding utf8` en PowerShell 5.1**. AWS CLI rechazaba el archivo con `Error parsing parameter '--distribution-config': Expected: '=', received: '   '`. Resuelto: re-escritura con `[System.IO.File]::WriteAllText` + `New-Object System.Text.UTF8Encoding $false` (UTF-8 sin BOM). Confirmado: primeros bytes del archivo `123,13,10` = `{\r\n`.

3. **Cache CloudFront mantuvo el dummy unos minutos tras la primera invalidación `Completed`**. La invalidación AWS marcó `Completed` antes de que la propagación a todos los POPs terminara. Resuelto con una segunda invalidación con path wildcard (`/blog/test-probe*`) que sí limpió el cache de todos los edge locations. El objeto en S3 ya estaba borrado en el momento, así que en ningún momento hubo riesgo SEO real (el dummy tiene `<meta name="robots" content="noindex,nofollow">` de todas formas).

Sin incidentes que requieran rollback. El sistema queda en el estado correcto descrito en § 8.
