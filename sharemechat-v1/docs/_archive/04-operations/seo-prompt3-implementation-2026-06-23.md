# Implementación del Prompt 3 SEO — Cierre del frente pre-render del blog

**Fecha**: 2026-06-23 (sesión 22:48–23:10 UTC).
**Operador**: alain@LAPTOP-8UEIKVUT.
**Entorno tocado**: PROD (frontend producto + ops scripts).
**Scope**: pulido SEO post-pre-render (meta og/twitter completos, BreadcrumbList JSON-LD, Organization sameAs, hot-fix script PS5.1).
**Cierra**: frente SEO completo (Prompts 1+2+3 del paquete pre-render del blog).

---

## Alcance del Prompt 3

Continuación natural del Prompt 2 (pre-render real con Puppeteer del 2026-06-23 mañana, informe en [`backend-and-seo-deploy-2026-06-23.md`](backend-and-seo-deploy-2026-06-23.md)). El Prompt 2 dejó los 8 HTMLs blog servidos con title/canonical/hreflang/JSON-LD específicos del artículo, pero quedaron varias deudas menores:

- Falta de `og:image:alt`, `twitter:image:alt`, `twitter:site`, `twitter:creator` en todos los puntos del SPA.
- Falta de `og:image:type` salvo en el shell `index.html`.
- Falta de `BreadcrumbList` JSON-LD en los artículos (mejora rich results en SERPs).
- Falta de `sameAs` en `Organization` JSON-LD (handles sociales corporativos: X, Reddit).
- Bug PowerShell 5.1 en `prerender-blog-prod.ps1` (registrado durante el deploy del Prompt 2).

El Prompt 3 los cierra todos en una sola sesión, sin tocar backend, función edge ni CER.

---

## Bloques ejecutados

### A. Subida de imagen og corporativa — **SKIPPED**

Decisión del operador (opción "a" del análisis previo): la imagen `https://assets.sharemechat.com/brand/og-default-1200x630.png` (subida el 2026-06-10 al bucket `assets-sharemechat-prod`, 36 471 bytes) se mantiene como está. Coherente con `DEFAULT_OG_IMAGE` ya configurada en `seoHelpers.js` y `Seo.jsx` desde el frente SEO del 11-jun.

### B. Meta og/twitter completos

Cuatro componentes editados con scope mínimo (cero cambios en lógica de presentación):

- [`seoHelpers.js`](../../frontend/src/pages/blog/seoHelpers.js): 5 constantes nuevas:
  - `DEFAULT_OG_IMAGE_TYPE='image/png'`
  - `DEFAULT_OG_IMAGE_ALT_ES='SharemeChat — Videochat 1 a 1 con modelos verificadas'`
  - `DEFAULT_OG_IMAGE_ALT_EN='SharemeChat — 1-to-1 video chat with verified models'`
  - `TWITTER_HANDLE='@shareme_chat'`

- [`BlogContent.jsx`](../../frontend/src/pages/blog/BlogContent.jsx) (listado `/blog/{locale}`): añade 5 metas — `og:image:type`, `og:image:alt`, `twitter:site`, `twitter:creator`, `twitter:image:alt`. alt localizado al locale del listado.

- [`BlogArticleView.jsx`](../../frontend/src/pages/blog/BlogArticleView.jsx) (detalle `/blog/{locale}/{slug}`): añade los mismos 5 metas con **lógica condicional sobre `hasHeroImage`**:
  - Con hero propia (`article.heroImageUrl` no nulo): `og:image`=hero webp, `og:image:alt`=`article.title`. Se **omiten** `width`/`height`/`type` (no conocemos las dimensiones ni el MIME de la hero, lo infiere el crawler).
  - Sin hero (fallback default): `og:image`=marca 1200x630 PNG, `og:image:alt`=alt genérico de marca según locale, **se emiten** `width=1200`, `height=630`, `type=image/png`.
  - Cleanup actualizado: `removeMeta` para `og:image:type`, `og:image:alt`, `twitter:image:alt` al desmontar.

- [`Seo.jsx`](../../frontend/src/components/Seo.jsx) (home + páginas estáticas footer): añade `og:image:width/height/type` (solo si el caller NO pasa prop `image` propio), `og:image:alt`=título de la página, `twitter:site/creator`=`@shareme_chat`, `twitter:image:alt`=título.

### C. BreadcrumbList JSON-LD

Añadido en [`BlogArticleView.jsx`](../../frontend/src/pages/blog/BlogArticleView.jsx) dentro del mismo `useEffect` SEO, tras `upsertJsonLd('blog-article', ...)`. Estructura `Home > Blog > Artículo` con nombres localizados al locale del artículo (`Inicio`/`Home`, `Blog` invariante). Helper `upsertJsonLd` con id `'blog-breadcrumb'`. Cleanup elimina el `<script>` al desmontar.

Solo aplica en el detalle del artículo (no en el listing) según especificación del operador.

### D. Hreflang bidireccional — **YA IMPLEMENTADO**

Verificado en `BlogArticleView.jsx:304-323`: el componente ya emite hreflang del locale actual + uno por cada `article.alternates` recibido del DTO (`ArticlePublicDetailDTO.alternates: List<ArticleAlternateDTO>`, garantizado no-null por el backend) + `x-default` apuntando al ES (mercado primario) si existe, fallback al locale actual. **Sin cambios necesarios**.

### E. Organization sameAs

Editado [`public/index.html`](../../frontend/public/index.html) ampliando el `publisher` Organization dentro del JSON-LD WebSite con dos handles corporativos:

```json
"sameAs": [
  "https://x.com/shareme_chat",
  "https://www.reddit.com/user/sharemechat"
]
```

Refuerza el knowledge graph de Google y atribuye la entidad SharemeChat a las cuentas sociales oficiales.

### F. Hot-fix PS5.1 en `prerender-blog-prod.ps1`

Cierra la deuda registrada en [`backend-and-seo-deploy-2026-06-23.md:154`](backend-and-seo-deploy-2026-06-23.md). Helper `Invoke-NativeNoAbort` añadido al script (calca el patrón `Invoke-Native` de [`deploy-frontend.ps1:197-229`](../../ops/scripts/deploy-frontend.ps1) adaptado al caller con `Stop-Prerender`). Sustituye la llamada cruda `& node render.js --config $configPath` por `Invoke-NativeNoAbort -Block { ... }`.

Detalle clave aprendido en caliente durante la sesión: la primera versión del helper omitía `| Out-Host`, causando que stdout de `node` se acumulara en la pipeline de la función y `return $exit` devolviera el array de strings en lugar del entero. El check `if ($renderExit -ne 0)` evaluaba siempre verdadero. Se rectificó en una segunda iteración añadiendo `& $Block | Out-Host`, redirigiendo stdout al host (visible al usuario) sin contaminar el retorno.

### G. Build local + verificación grep

`npm run build:product` desde `frontend/`. Compiled with warnings (no-unused-vars y exhaustive-deps preexistentes, sin nuevos). Tamaños:
- `main.90c284a1.js` 57.55 kB gzip (−3 B vs anterior — Seo.jsx levemente más pequeño tras condicionales).
- `417.cc32345e.chunk.js` 253.98 kB gzip (+449 B — BlogArticleView + BlogContent con BreadcrumbList y nuevos campos).

Grep estático del bundle confirmó la presencia de `BreadcrumbList`, `@shareme_chat`, `og:image:alt`, `og:image:type`, `twitter:image:alt`. En `index.html` final: `og:image:alt`, `twitter:site`, `twitter:creator`, `twitter:image:alt`, `sameAs`, `reddit.com/user/sharemechat`, `x.com/shareme_chat`.

### H. Deploy a PROD

`deploy-frontend.ps1 -Environment prod -Surface product -AssumeYesNonCritical`. Severity ALERT autoconfirmada (dirty working tree + backend 4 commits por detrás del candidato; razones documentadas). Pasos 1/5–4/5 OK. Paso 4.5/N (pre-render) **falló en primera versión** del helper Invoke-NativeNoAbort (incidente abajo). Paso 5/5 (manifest update) y 5/N (cierre) ejecutados.

### Incidente intra-sesión: bug del propio helper en su primera iteración

- 20:55:47Z bundle desplegado correctamente al bucket S3 con invalidación CF.
- 20:55:53Z aprox: render.js completó OK (`Resumen: 8 OK, 0 fallos de 8 URLs`), pero `$renderExit` recibió el array de strings de stdout en vez del entero. `if ($renderExit -ne 0)` true. Script abortó con exit 99.
- Manifest actualizado a `bdea318` (HEAD pre-Prompt-3) por el paso 5.5/N.
- HTMLs nuevos pre-renderizados quedaron en el directorio temporal local, **no** subidos a S3. Los HTMLs viejos del Prompt 2 seguían en S3.
- 20:57:00Z aprox: fix aplicado al helper (`| Out-Host` en el scriptblock).
- 20:57:38Z: re-ejecución standalone de `prerender-blog-prod.ps1` → 8/8 archivos generados, sync a S3 OK.
- 20:59:37Z: invalidación CloudFront `/blog/*` manual (`I1HG42Z9NHBVXMOS3HMHQ850O4`).

**Estado final consistente**: bundle JS desplegado + HTMLs pre-renderizados con nuevas metas + invalidaciones aplicadas. Cero downtime y cero regresión.

### I. Verificación de las 8 URLs

`curl + grep` cubrió:

| Criterio | URLs cumpliendo | Notas |
|---|---|---|
| HTTP 200 | 8/8 | tamaños 34–41 KB |
| `og:image:alt` | 8/8 | |
| `twitter:site=@shareme_chat` | 8/8 | |
| `twitter:creator=@shareme_chat` | 8/8 | |
| `twitter:image:alt` | 8/8 | |
| `sameAs` con `reddit.com/user/sharemechat` + `x.com/shareme_chat` | 8/8 | del shell `index.html` JSON-LD WebSite, presente en todos los HTMLs pre-renderizados |
| `hreflang="x-default"` | 8/8 | + uno por cada locale del DTO `alternates` |
| `BreadcrumbList` JSON-LD | 6/6 artículos | NO en listings (por diseño, no pedido) |
| `og:image:type=image/png` | 2/2 listings | NO en artículos con hero webp (lógica condicional, MIME desconocido) |
| `og:image:width/height` | 2/2 listings | NO en artículos con hero webp (dimensiones desconocidas) |
| `BlogPosting` JSON-LD | 6/6 artículos | |
| `Blog` JSON-LD | 2/2 listings | |

**Inspección puntual** confirmó:

- Artículo `/blog/es/que-es-videochat-1-a-1`: `og:image=https://assets.sharemechat.com/blog/que-es-videochat-1-a-1.webp` con `og:image:alt='Qué es el videochat 1-a-1 y en qué se diferencia del dating tradicional'` (título del artículo). Sin width/height/type — correcto.
- Listado `/blog/es`: `og:image=https://assets.sharemechat.com/brand/og-default-1200x630.png` con width/height/type completos + alt genérico de marca.

### J. Commits agrupados

5 commits secuenciales en `main`:

1. `d79c87c feat(seo): completar meta og/twitter + BreadcrumbList en SPA blog` — 4 ficheros del SPA producto (bloques B+C).
2. `2e2961c feat(seo): Organization sameAs + og/twitter completos en shell index.html` — `public/index.html` (bloques B-shell+E).
3. `f0bd30d fix(ops): Invoke-NativeNoAbort en prerender-blog-prod.ps1 (PS5.1)` — bloque F.
4. `9f1c806 chore(deploy): manifest prod frontend_product -> f0bd30d post Prompt 3 SEO` — alinea `ops/deploy-state/prod.yaml` a HEAD que SÍ refleja el bundle servido (incidente del paso H lo dejó apuntando a `bdea318`).
5. `<este informe>` — documentación.

### K. Este informe

### L. Cierre del frente SEO

Entrada en `docs/project-log.md` añadida al cierre del frente. Estado de deudas:

- **Hot-fix PS5.1 en `prerender-blog-prod.ps1`** → CERRADA en este Prompt 3 (commit `f0bd30d`).
- **Borrado snapshot RDS `pre-deploy-didit-mock-20260623`** → continúa abierta, plazo 48–72h desde 20:14:50Z del 23-jun.
- **Validación E2E Didit real** → continúa diferida (no scope del frente SEO).

---

## Estado final

- **PROD frontend producto**: bundle `main.90c284a1.js` (sha256 `e6cafa61...`) en `s3://sharemechat-frontend-prod/`. 8 HTMLs blog pre-renderizados con criterios SEO completos.
- **Invalidaciones CF aplicadas**: `I8CFP6RGIND3VFCCX9AO3HE8SL` (bundle), `I1HG42Z9NHBVXMOS3HMHQ850O4` (/blog/*).
- **Manifest**: alineado a HEAD `f0bd30d`.
- **CER 403→200**: activa, cubre cualquier desincronización futura entre bundle y pre-render.
- **Frente SEO completo cerrado**: Prompt 1 (función edge + CER), Prompt 2 (pre-render Puppeteer), Prompt 3 (pulido + hot-fix).

## Próximos pasos abiertos (no scope SEO)

Sin nuevos abiertos del frente SEO. Continúan abiertos:

- Borrado snapshot RDS `pre-deploy-didit-mock-20260623` (operador, ventana 48-72h).
- Validación E2E Didit real (frente futuro KYC).
- Activación Sightengine (frente futuro stream-moderation P2).
- Redacción `deploy-backend.ps1` (deuda Fase 2 deploy automation).
