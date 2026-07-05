# Diagnóstico y fix: GET body devuelve HTML → falso maintenance + HTML en markdown

**Fecha**: 2026-07-06
**Autor**: análisis asistido por IA
**Contexto**: continuación de la serie CMS 2C. Bug distinto (aunque de la misma familia) al que arregló Fix.C1: el `PATCH` con `Origin` browser YA no falloverea, pero el `GET` a `/translations/en/body` cuando la translation EN no existe SÍ dispara el CustomErrorResponse SPA fallback → 200 text/html → `isMaintenanceResponse` viejo lo interpretaba como maintenance y además el HTML llegaba al textarea del body markdown.
**Estado**: **fix aterrizado en TEST**. 3 fixes en cascada, frontend-only.

## 1. Nueva evidencia aportada por el operador

- Reproduce en incógnito + caché limpia + sesión fresca.
- Al pulsar "Abrir" sobre un artículo, todas las peticiones dan 200 (articles, runs, versions, events, 17, body×2, me). Ninguna 401 ni 5xx.
- La ficha se renderiza pero el textarea del body EN muestra `<!doctype html>…<title>1-to-1 Video Chat with Verified Models</title>…`.
- Al pulsar "Guardar campos SEO" salta el MaintenanceOverlay.

## 2. Fase 1 — reproducción con curl (Playwright innecesario en la primera vuelta)

Login admin TEST. `GET /admin/content/articles/17` devuelve:

```json
{
  "id": 17, "state": "DRAFT", "category": "mierda",
  "translations": [
    { "locale": "es", "bodyS3Key": null, "bodyContentHash": null, ... }
  ]
}
```

**El artículo 17 no tiene translation EN** (solo `es`). Idem `art 14`.

Curl con `Origin: https://admin.test.sharemechat.com` (browser-like) al endpoint del body EN:

```
GET /api/admin/content/articles/17/translations/en/body

HTTP/2 200
content-type: text/html; charset=utf-8
content-length: 3613
server: AmazonS3            ← respuesta del bucket S3, no del backend
x-cache: Error from cloudfront

body:
<!doctype html><html lang="en"><head><script>!function(e,t,a,n){e[n]=e[n]||[]…</title>1-to-1 Video Chat with Verified Models | SharemeChat</title>…
```

**Reproducción al 100% en primer intento**. El backend nginx respondió 404 (translation EN no existe), y CloudFront lo convirtió a 200 + `/index.html` del bucket `sharemechat-admin-test` vía `CustomErrorResponses`.

## 3. Fase 2 — auditoría infra + S3

### 3.1 CloudFront distro E28YCPVIRB4ASH

```json
{
  "CustomErrorResponses": [
    { "ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0 },
    { "ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 0 }
  ],
  "CacheBehaviors[/api/*].AllowedMethods": ["HEAD","DELETE","POST","GET","OPTIONS","PUT","PATCH"]
}
```

**El `/api/*` cache behavior tiene todos los métodos permitidos** — nada que arreglar ahí (Fix.C1 ya lo dejó bien).

**`CustomErrorResponses: 404 → /index.html 200` es intencional para el SPA fallback client-side** (rutas admin como `/dashboard-admin/edit/9` que no existen como fichero estático en el bucket admin caen al index.html para que el router React las maneje). El problema: la regla es global de la distribución y **no distingue entre 404 del origin S3 (SPA legítimo) y 404 del origin API backend (recurso realmente ausente)**.

### 3.2 Bucket S3 `sharemechat-content-private-test`

`ls s3://sharemechat-content-private-test/content/articles/<id>/` cross-referenciado con el `bodyS3Key` de cada translation:

| ID | State | translations | ES bodyS3Key | EN bodyS3Key | S3 objeto real |
|---|---|---|---|---|---|
| 4 | PUBLISHED | 2 | content/articles/4/es/draft.md | content/articles/4/en/draft.md | ambos presentes |
| 3 | PUBLISHED | 2 | content/articles/3/es/draft.md | content/articles/3/en/draft.md | ambos presentes |
| 9 | DRAFT | 2 | content/articles/9/es/draft.md | content/articles/9/en/draft.md | `en/draft.md` presente (8233 bytes) |
| 14 | DRAFT | **1 (solo es)** | null | — | ninguno específico art14 |
| 17 | DRAFT | **1 (solo es)** | null | — | vacío |

**El bug se dispara siempre que**:
1. La translation EN NO existe en BD (art 14, 17): el fetch al body EN cae en 404 backend → 200 HTML CloudFront.
2. La translation EN existe pero el objeto S3 del body no está (hipótesis, no observada aquí pero posible tras un apply-bilingual roto): igual patrón.

**No es corrupción de datos**. Es la interacción entre el CustomErrorResponse global y el 404 legítimo del endpoint API.

## 4. Fase 3 — decisión de fix

Opciones evaluadas:

| Opción | Descripción | Descartada porque |
|---|---|---|
| A | Retirar `CustomErrorResponse: 404` del CloudFront | Rompe el SPA fallback del admin: rutas React sin fichero estático devolverían 404 real. |
| B | CloudFront Function / Lambda@Edge que discrimine `/api/*` | Alta complejidad, superficie de fallo nueva, coste operativo recurrente. |
| C | Backend responde 200 con body vacío en vez de 404 | Requiere tocar backend, y hay que decidir qué status devolver cuando la translation NO existe (semántica ambigua). |
| **D** | **Frontend defensive (elegida)** | Coste mínimo, cierra deudas #F1 + #F2, permite deploy independiente de la infra. |

**Cero cambios de infra CloudFront**. **Cero cambios de backend**. **Fix quirúrgico solo en frontend**, en 3 capas defensivas.

## 5. Fixes aplicados

### 5.1 Fix.A — no pedir body si la translation no existe

[`frontend/src/pages/admin/content/ContentArticleEditor.jsx`](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx) en `loadLocaleData(id, locale, art)`:

```diff
     } else {
       setSeoDraft(emptySeoDraft);
+      setBodyMissing(true);
+      return;
     }
```

Si `findTranslation(art, locale)` es `null`, marcamos `bodyMissing=true` y **NO llamamos al endpoint del body**. Cierra la causa raíz principal: en el editor del artículo 17 (o de cualquier artículo recién creado sin translation EN aún), el useEffect ya no dispara el fetch 404 → 200 HTML.

### 5.2 Fix.B — `isMaintenanceResponse` solo con 5xx (cierra #F2)

[`frontend/src/config/http.js`](../../frontend/src/config/http.js):

```diff
 const isMaintenanceResponse = (res) => {
   if (!res) return false;
-  if (res.status === 502 || res.status === 504) return true;
   if (res.status === 503) {
     const productMode = (res.headers.get('x-product-mode') || '').toUpperCase();
     if (productMode === 'PRELAUNCH' || productMode === 'CLOSED') return false;
     return true;
   }
-  const ct = (res.headers.get('content-type') || '').toLowerCase();
-  if (ct.includes('text/html')) return true;
-  return false;
+  if (res.status >= 500 && res.status < 600) return true;
+  return false;
 };
```

Regla positiva: dispara SOLO con status 5xx. `2xx` con text/html nunca dispara (SPA fallback intencional). `4xx` (401/403/404) tampoco dispara — son errores de negocio o auth manejados por otros paths. Timeouts / errores de red se re-lanzan al caller sin overlay (para no pisar aborts intencionales de AbortController).

### 5.3 Fix.C — defense-in-depth: detectar HTML como bodyMissing

[`frontend/src/pages/admin/content/ContentArticleEditor.jsx`](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx) en el `try` del fetch body:

```diff
     try {
       const md = await apiFetch(`/admin/content/articles/${id}/translations/${locale}/body`);
-      setBody(typeof md === 'string' ? md : '');
+      const md_str = typeof md === 'string' ? md : '';
+      if (/^\s*<!doctype\s/i.test(md_str)) {
+        setBodyMissing(true);
+        setBody('');
+      } else {
+        setBody(md_str);
+      }
     } catch (e) {
```

Si el string devuelto empieza con `<!doctype` (case-insensitive) — firma inequívoca del `index.html` del bucket admin — lo tratamos como body missing en vez de meterlo literal como markdown. Cubre el escenario "translation EN existe pero body S3 desapareció" que Fix.A no captura.

### 5.4 Bonus — `isBackendAlive` cierra #F1

[`frontend/src/components/MaintenanceProvider.jsx`](../../frontend/src/components/MaintenanceProvider.jsx):

```diff
 const isBackendAlive = (res) => {
   if (!res) return false;
-  if (res.status >= 502 && res.status <= 504) return false;
-  const ct = (res.headers.get('content-type') || '').toLowerCase();
-  if (ct.includes('application/json')) return true;
-  return false;
+  if (res.status >= 500 && res.status < 600) return false;
+  return true;
 };
```

Simetría con `isMaintenanceResponse`: el backend está vivo si respondió cualquier cosa NO-5xx. Un 401 con content-length 0 y sin CT header (respuesta típica del backend con sesión caducada) ahora se lee como "vivo", desbloqueando el overlay pegado que era el foco de la deuda #F1 (informe `8cdd002` §5.2).

## 6. Validación en TEST

Nuevo bundle admin: `main.b8bb5717.js`. Deploy vía `deploy-frontend.ps1 -Environment test -Surface admin`. Propagación CloudFront confirmada por curl al index.html.

Playwright headless, 18 checks — **todos PASS**:

| # | Check | Resultado |
|---|---|---|
| — | login admin | ✅ |
| 1 | Crear artículo nuevo (id=18) | ✅ |
| 1 | No aparece MaintenanceOverlay tras abrir | ✅ |
| 1 | 0 CustomEvents `sharemechat:maintenance` | ✅ |
| 1 | Ningún textarea empieza con `<!doctype` | ✅ (todos vacíos o con brief inicial) |
| 1 | Bootstrap EN visible (heading "Instanciar traducción EN") | ✅ |
| 2 | Guardar SEO ES tras poblar primary → 0 dispatches | ✅ |
| 2 | primaryKeyword ES persiste (`test-primary-es-…`) | ✅ |
| 3 | Instanciar EN → 0 dispatches | ✅ |
| 3 | Bootstrap form desaparece tras instanciar | ✅ |
| 3 | Formulario EN completo aparece con botón Guardar SEO (EN) | ✅ |
| 3 | Ningún textarea con HTML tras bootstrap | ✅ |
| 4 | Guardar SEO EN → 0 dispatches | ✅ |
| 4 | primaryKeyword EN persiste (`test-primary-en-…`) | ✅ |
| 5 | Regresión art 4 (PUBLISHED bilingüe): no overlay | ✅ |
| 5 | Heading `— ES` presente | ✅ |
| 5 | Heading `— EN` presente | ✅ |
| 5 | Ningún textarea con HTML | ✅ |

Artículo 18 de prueba borrado tras validación.

## 7. Causa raíz consolidada

**Bug estructural preexistente al ADR-045**: `CustomErrorResponses: 404 → /index.html 200` del CloudFront admin captura tanto los 404 legítimos del bucket S3 (SPA fallback deseado) como los 404 legítimos del origin API (recurso ausente). Cuando el frontend interpreta el 200 text/html como un cuerpo válido o como señal de maintenance, se producen los dos síntomas del operador:

1. **Overlay se dispara** porque `isMaintenanceResponse` viejo capturaba text/html 2xx.
2. **HTML aparece en el textarea del body markdown** porque `apiFetch` devuelve `res.text()` y el caller no distinguía.

**El ADR-045 no introdujo el bug** — la misma respuesta habría llegado también en el editor pre-ADR-045 si un artículo careciera de translation EN. Pero el ADR-045 aumentó la superficie de disparo:
- 2C.0/2C.1 añadió el flujo "crear artículo → editor → bootstrap EN", que ejerce el path con más frecuencia.
- 2C.2 (stacked sections) precarga ambos locales al abrir el editor, así que el fetch se produce siempre, no solo al cambiar de pestaña.

Fix.C1 arregló la faceta CORS/PATCH del mismo patrón. Este informe cierra la faceta 404/GET.

## 8. Deudas cerradas

- **#F1** (`isBackendAlive` demasiado estricto sobre Content-Type) — cerrada por §5.4.
- **#F2** (`isMaintenanceResponse` interpretaba cualquier 200 text/html como maintenance) — cerrada por §5.2.
- **Bug del click en pestaña EN** (informe `90bf1fc`) — cerrada por §5.1 y §5.3 (el click de pestaña sigue siendo irrelevante con el refactor 2C.2, pero el fetch que disparaba el overlay al cargar el editor ya no ocurre).

## 9. Higiene

- Playwright chromium en scratchpad fuera del repo; borrados scratchpad + `AppData/Local/ms-playwright` (~690 MB) al terminar.
- Cookies solo en memoria del script; sin persistir credenciales.
- Artículo 18 de prueba borrado del backend TEST tras validación.
- Sin cambios en infra AWS (CloudFront distribution intacta, ETag inalterado).
- Sin cambios en backend Java (no se recompiló ni redesplegó JAR).

## 10. Recomendaciones (opcionales, futuras)

- **A largo plazo**: pensar si el `CustomErrorResponse: 404` debe convivir con endpoints API en la misma distribución. Alternativas: dominio dedicado para API (`api.admin.test.sharemechat.com`) sin CustomErrorResponses, o Lambda@Edge que discrimine por path. Coste operativo alto; los fixes frontend actuales lo hacen aceptable posponer.
- **En el backend**: considerar cambiar `GET /translations/{locale}/body` para responder 200 con body vacío cuando `bodyS3Key` es null (parece que ya lo hace) y 404 sólo cuando la translation entera no existe. Contrato menos ambiguo. No urgente ahora que el frontend es defensivo.

---

**ESTADO: COMPLETADO — bug resuelto en TEST con 3 fixes frontend, cero cambios de infra ni backend**
