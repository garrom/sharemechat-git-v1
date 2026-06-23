# SEO baseline snapshot 2026-06-21

> Inspección estructurada del estado SEO del repo `sharemechat-git-v1` (commit `8a4055c` en `main`).
> Modo lectura. Pensado como baseline real para el asesor antes de proponer cambios.

## 1. Resumen ejecutivo

Lo que **SÍ está implementado y funcionando**:

- **Sitemap.xml** servido por Spring Boot (`SitemapController.java`), gateado solo al apex PROD (ADR-033). 20 URLs, `<xhtml:link>` hreflang ES↔EN bidireccional, `<image:image>` cuando hay hero, `lastmod` honesto desde BD (`updatedAt || publishedAt`).
- **Robots.txt** dinámico, fail-closed por entorno (solo PROD indexable), con `Sitemap:` directive, disallow de rutas protegidas, allow `/blog`.
- **SEO industrial post-hidratación** (ADR-020): la SPA emite `<title>`, `description`, canonical, hreflang, OG, Twitter Card y JSON-LD `BlogPosting`/`Blog`/`WebPage` desde React tras montaje (`react-helmet-async` para home/footer; `seoHelpers.js` imperativo para blog).
- **Multilingüe nativo ES+EN** (ADR-022) con `group_id` en BD y rutas `/blog/<locale>/<slug>`.
- **Pipeline editorial Cowork** maduro (6 skills: research-seo, draft-writer, editorial-polish, brand-legal-review, translate-en, json-builder + validator + orchestrator).
- **Estrategia SEO + tracking mensual** documentados (`estrategia.md`, `tracking-mensual.md`).

Lo que **NO está implementado**:

- **Pre-rendering a HTML estático** descartado en ADR-019 → ADR-018 superseded. El blog vive en CSR puro.
- **Internal linking en HTML inicial servido**: 0 enlaces. Bug crítico, sección 7.
- **Gateo de GTM/GA4 por entorno**: `GTM-T7BNJP4M` hardcoded en `index.html`. Dispara en TEST/AUDIT/PROD por igual.
- **Notificación a buscadores** tras publicar (Indexing API, IndexNow, ping de sitemap). No existe.
- **BreadcrumbList, Organization standalone**: no implementados.
- **Monitorización automatizada de indexación** (script GSC API, IndexNow, PageSpeed Insights). No existe.

**Hallazgos críticos** que justifican el diagnóstico GSC "ninguna página de referencia":

1. **HTML servido por CloudFront es el mismo shell SPA en TODAS las rutas** (3192 bytes idénticos en `/`, `/blog/es`, `/blog/en`, `/blog/es/<slug>`). Title hardcoded = `"1-to-1 Video Chat with Verified Models | SharemeChat"` para cualquier URL. **Cero canonical específico del artículo, cero hreflang del artículo, cero JSON-LD `BlogPosting`, cero `<a href>` a artículos en el HTML inicial**. Todo emerge tras la hidratación React.
2. **GTM dispara sin gateo** en entornos no-PROD: las visitas del operador a TEST/AUDIT contaminan métricas y pueden disparar conversiones falsas.
3. **Cero internal linking discoverable por Bing/crawlers sin JS** en listings: solo Googlebot moderno con JS ve los enlaces.

---

## 2. Documentación SEO existente

`docs/01-business/seo/`:

| Fichero | Bytes | Última modificación | Propósito |
|---|---:|---|---|
| `estrategia.md` | ~22k | 2026-06-17 (registro) | Estrategia honesta de tráfico orgánico 18m, benchmarks reales, proyección pesimista (~€500/18m) y normal (~€7k/18m). |
| `tracking-mensual.md` | ~varios k | 2026-06-18 (primer relleno M0) | Tabla manual mes a mes para KPIs GSC (impresiones/clics/CTR/posición) + GA4 + sociales. Rellenado semanal P7. |

**Resumen estratégico** (10-12 líneas):

- SEO orgánico **solo** no sostiene el negocio en 18m. Pesimista €500, normal €7k acumulado. Ninguno de los dos llega a break-even.
- Sector adulto bloqueado en TikTok/Meta/YouTube/Google Ads/Meta Ads. SEO + X + Reddit son los únicos canales orgánicos.
- Long-tail SEO + linking interno + Reddit como motor #2 es la estrategia que aplica.
- Cadencia: 1 artículo/semana sostenido, internal linking hub-and-spoke, no abandonar X/Reddit aunque parezcan inertes.
- KPIs compuestos que validan funcionamiento: impresiones GSC crecen 20-30% mensual desde M3; posición media 30→15→8→5 a lo largo de 12m; Organic Search del 5% al 30% del tráfico total en 12m.
- Revisión obligatoria cada 3 meses comparando estimación vs real. Próxima: 2026-09-16 (M3).

**ADRs relacionados con SEO/blog/sitemap/hreflang/canonical/pre-render**:

| ADR | Estado | Relevancia SEO |
|---|---|---|
| ADR-010 | Aceptada | CMS interno con pipeline IA. |
| ADR-014 | Aceptada | Pipeline editorial orquestado (6 fases). |
| ADR-015 | Aceptada | Canonical: dominios por entorno. Apex PROD = `sharemechat.com`. |
| ADR-016 | Aceptada | Workflow editorial + retracción. D7 publicación estática diferida. |
| ADR-018 | **Superseded por ADR-019** | Pre-render a S3 (abandonado). |
| ADR-019 | Aceptada (2026-05-11) | Blog servido desde SPA React. Pre-render archivado. |
| ADR-020 | Aceptada (2026-05-12) | SEO industrial dentro de la SPA (6 fases C0-C5). |
| ADR-022 | Aceptada (2026-05-13) | Multilingüe nativo ES+EN con `group_id` + hreflang. |
| ADR-023 | Aceptada | Pipeline editorial bilingüe ES→EN. |
| ADR-024 | Aceptada | Submit bilingüe en editor. |
| ADR-027 | Aceptada | Brief per locale. |
| ADR-033 | Aceptada (2026-06-10) | `robots.txt` fail-closed por entorno: solo apex PROD indexable. |

**Known-debt entries relacionadas con SEO/indexación** (en `docs/04-operations/known-debt.md`):

- "Backend no envía charset=utf-8 en Content-Type de /api/public/content/**" — prioridad media, mitigado en script archivado.
- "[CERRADA] Helper Invoke-JsonGetUtf8 sin timeout explícito en prerender-blog.ps1" — script archivado.
- "[CERRADA] Coordinación frágil entre deploy-frontend.ps1 y prerender-blog.ps1" — irrelevante tras ADR-019.
- "logo192.png es favicon CRA, no logo de marca dedicado" — usado como `publisher.logo` en JSON-LD y `og:image` del listado. Prioridad media.
- "og:image:width y og:image:height ausentes" — prioridad baja.
- "twitter:site y twitter:creator ausentes" — prioridad baja.

[propuesta] **Falta deuda explícita por el bug del internal linking** (sección 7). No está documentado como known-debt.

---

## 3. Sitemap.xml

**Generación**: backend Spring Boot, `src/main/java/com/sharemechat/content/publishing/SitemapController.java:85` (`@GetMapping("/sitemap.xml")`).

**`lastmod`**: honesto, refleja la fecha real de cambio del artículo en BD. `ContentArticleService.listPublishedForSitemap:1277`:

```java
java.time.Instant lastMod = a.getUpdatedAt() != null
        ? a.getUpdatedAt() : a.getPublishedAt();
```

NO se pone fecha de build. Formato `ISO_LOCAL_DATE` (`2026-06-07`, `2026-06-16`).

**Estructura**:

- Namespace `urlset` con `xmlns:xhtml` y `xmlns:image`.
- `<xhtml:link rel="alternate" hreflang>` por cada locale alternativo (bidireccional, articleAlternates pre-computado).
- `<image:image>` cuando `heroImageUrl` existe y empieza por `http(s)://` (filtro defensivo).

**Salida real servida** (`curl https://sharemechat.com/sitemap.xml`):

- HTTP 200, `Content-Type: application/xml;charset=UTF-8`, `cache-control: public, max-age=3600`.
- 20 URLs totales:
  - 2 home (`/` y `/en/`).
  - 10 footer (5 paths × 2 locales: `/faq`, `/safety`, `/community-guidelines`, `/cookies-settings`, `/legal`).
  - 2 listing blog (`/blog/es` y `/blog/en`).
  - 6 artículos (3 ES + 3 EN, pares por `group_id`).
- 40 `<xhtml:link>` (20 URLs × 2 locales).
- 12 `<image:image>` (los 6 artículos × 2 versiones, con hero).
- `lastmod` distintos: `2026-06-07` y `2026-06-16` (fechas reales de los 2 batches editoriales).

[hallazgo] **Sitemap bien implementado**. No requiere cambios estructurales.

---

## 4. Robots.txt

**Generación**: mismo `SitemapController.java:166-203`. Cache 24h. Fail-closed: solo apex PROD canónico devuelve robots indexable; cualquier otro `app.public.base-url` responde `User-agent: * / Disallow: /` (ADR-033).

**Contenido servido** (`curl https://sharemechat.com/robots.txt`):

```
User-agent: *
Allow: /blog
Allow: /blog/

Disallow: /api/
Disallow: /admin
Disallow: /client
Disallow: /model
Disallow: /dashboard
Disallow: /login
Disallow: /register
Disallow: /unauthorized
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /change-password
Disallow: /perfil

Sitemap: https://sharemechat.com/sitemap.xml
```

[hallazgo] **Robots correcto**. `Sitemap:` directive presente. No bloquea nada relevante para SEO. No requiere cambios.

---

## 5. Meta tags y JSON-LD

**Stack frontend**: `react-helmet-async@3.0.0` (dependencia confirmada en `frontend/package.json:11`). React 17 + CRA 5, **NO Next.js**.

**Componente `Seo.jsx`** (`frontend/src/components/Seo.jsx`):

- Usado para **home + páginas estáticas del footer** (faq, safety, community-guidelines, cookies-settings, legal).
- Usa `<Helmet>` para emitir: `<html lang>`, `<title>`, `description`, `canonical`, `hreflang es/en/x-default`, OG completo, Twitter Card, JSON-LD `WebPage`.
- Comentario literal en el archivo (línea 9-11): *"El blog (BlogContent, BlogArticleView, BlogNotFound) usa su propio sistema imperativo basado en seoHelpers.js y queda intacto en este lote."*

**Blog (NO usa Helmet)**: `frontend/src/pages/blog/seoHelpers.js` con funciones imperativas `upsertMeta`, `upsertCanonicalLink`, `upsertJsonLd`, `upsertLink`, `removeMeta`, `mapLocaleToBcp47`, `mapLocaleToOg`, `truncate`, `DEFAULT_OG_IMAGE`. Llamadas desde `useEffect` en `BlogContent.jsx` (listado) y `BlogArticleView.jsx` (detalle), tras hidratación.

**Articulos blog (`BlogArticleView.jsx`)**: tras montaje emite `<title>`, `description`, `canonical`, hreflang `es-ES` + `x-default`, OG (`type=article`, `title`, `description`, `url`, `site_name`, `locale`, `image` desde `heroImageUrl`), Twitter Card (`summary_large_image` si hero), `article:published_time/modified_time/section/tag`, `author`, `publisher`, y JSON-LD `BlogPosting` con `headline`, `description`, `url`, `mainEntityOfPage`, `datePublished`, `dateModified`, `inLanguage`, `articleSection`, `keywords`, `author`, `publisher.logo`, `image`. Cleanup en unmount.

**Listado `/blog/<locale>` (`BlogContent.jsx`)**: tras montaje emite `<title>`, `description`, canonical, hreflang `es-ES` + `x-default`, OG, Twitter Card, JSON-LD `Blog` con `blogPost` array (`BlogPosting` por artículo).

**Home (en `index.html` hardcoded)**: JSON-LD `WebSite` con `publisher.Organization` anidado. Inline literal (no via Helmet) — sirve a TODAS las rutas hasta que React hidrata.

**JSON-LD coverage**:

| Tipo | Dónde | Estado |
|---|---|---|
| `WebSite` | `index.html` global | OK (inline) |
| `Organization` | dentro del `publisher` del WebSite | OK pero no standalone |
| `WebPage` | home + footer páginas | OK (Helmet) |
| `Blog` | listado `/blog/<locale>` | OK (post-hidratación) |
| `BlogPosting` | detalle del artículo | OK (post-hidratación) |
| `BreadcrumbList` | — | **AUSENTE** [hallazgo] |
| `Organization` standalone | — | **AUSENTE** (solo anidado dentro de WebSite) |
| `FAQPage` | `/faq` | NO verificado; potencial mejora si la página lo merece |

[propuesta] **Añadir BreadcrumbList en BlogArticleView** (`Home > Blog > Artículo`) para rich result en SERPs. Esfuerzo: 1h. Alto valor para CTR.

---

## 6. Pre-render a S3 (ADR-018)

[hallazgo] **PRE-RENDER ABANDONADO**. ADR-018 superseded por ADR-019 el 2026-05-11.

- Script `ops/scripts/prerender-blog.ps1` archivado en `ops/scripts/archive/` con header DEPRECATED. No se ejecuta.
- Cache behavior `/blog*` eliminado de CloudFront el 2026-05-11.
- Decisión vigente: la SPA React sirve `/blog` y `/blog/<locale>/<slug>` desde S3+CloudFront vía la función edge `redirect-spa-test` que reescribe URIs sin punto a `/index.html`.
- Buckets reales: `sharemechat-frontend-{test,audit,prod}`.
- Razón del abandono (ADR-019): doble implementación del look React/PowerShell, coordinación frágil con `deploy-frontend.ps1`, asumió que "Googlebot ejecuta JS desde 2019 → CSR suficiente".

[hallazgo, **crítico**] **La asunción de ADR-019 sobre Googlebot+JS deja fuera**:
- Bing (rendering parcial).
- Agregadores RSS, link previews legacy (Facebook scraper antiguo, WhatsApp, Telegram).
- Bots de IA training que sí impactan visibilidad (GPTBot, ClaudeBot, PerplexityBot).
- El crawl de descubrimiento de Googlebot, que para sitios nuevos prioriza HTML inicial sobre JS.

---

## 7. HALLAZGO CRÍTICO — Internal linking del listing

[hallazgo, **crítico**] **El bug del research externo está CONFIRMADO**.

Test ejecutado el 2026-06-21 18:25 UTC desde el sandbox del repo (red abierta, sin auth):

```
curl -sL "https://sharemechat.com/blog/es" -o /tmp/blog-es.html
wc -c /tmp/blog-es.html      → 3192 bytes
grep -oE 'href="/blog/es/[^"]+"' /tmp/blog-es.html | wc -l    → 0

curl -sL "https://sharemechat.com/blog/en" -o /tmp/blog-en.html
wc -c /tmp/blog-en.html      → 3192 bytes
grep -oE 'href="/blog/en/[^"]+"' /tmp/blog-en.html | wc -l    → 0

curl -sL "https://sharemechat.com/" -o /tmp/home.html
wc -c /tmp/home.html         → 3192 bytes
grep -oE 'href="/blog[^"]*"' /tmp/home.html | wc -l    → 0
```

Los tres archivos descargados son **idénticos** (3192 bytes). Todos contienen el mismo shell SPA `index.html` con title `"1-to-1 Video Chat with Verified Models | SharemeChat"`. CloudFront sirve `/index.html` para cualquier ruta SPA gracias a la función edge `redirect-spa-test`.

**Verificación adicional sobre un artículo concreto**:

```
curl -sL "https://sharemechat.com/blog/es/que-es-videochat-1-a-1" -o /tmp/article-es.html
wc -c /tmp/article-es.html   → 3192 bytes (idéntico al shell)
grep '<title>' /tmp/article-es.html
  → <title>1-to-1 Video Chat with Verified Models | SharemeChat</title>
grep 'rel="canonical"' /tmp/article-es.html     → (vacío)
grep 'hreflang' /tmp/article-es.html             → (vacío, salvo dentro del shell global)
grep '"@type":"BlogPosting"' /tmp/article-es.html → (vacío)
```

**Interpretación**:

- El HTML inicial que Googlebot recibe en el primer pase es el shell del home con title de la home (en EN). Las meta tags específicas del artículo, canonical, hreflang y JSON-LD `BlogPosting` viven SOLO en JavaScript ejecutado tras la hidratación.
- Los listings `/blog/es` y `/blog/en` no emiten ningún `<a href>` a los artículos en el HTML inicial. Los enlaces se generan client-side en `BlogContent.jsx` tras `useEffect` que llama a `apiFetch('/api/public/content/articles?...')`.
- **Implicación SEO**: para Googlebot moderno (que ejecuta JS) los enlaces son descubiertos en segunda pasada con latencia. Para Bing antiguo, bots de IA, agregadores RSS y link previews legacy, el listado **es invisible**. Googlebot prioriza descubrimiento por HTML inicial al asignar crawl budget, lo que explica perfectamente "ninguna página de referencia" en GSC.
- El sitemap.xml es la ÚNICA vía sólida de descubrimiento de los artículos. El internal linking simplemente no existe en HTML inicial.

[propuesta] **Soluciones posibles ordenadas por esfuerzo**:

1. **Inyectar listado y home cards en `index.html` con un build step** (mantiene SPA pero el shell incluye los 6 enlaces actuales). Esfuerzo: 4-6h. Bajo riesgo. NO requiere reabrir ADR-019.
2. **Reactivar pre-render selectivo** SOLO para `/blog/<locale>` y `/blog/<locale>/<slug>` con `react-snap` o puppeteer custom corriendo en build. Esfuerzo: 1-2 días. Reabre el debate ADR-019.
3. **Migrar a Next.js** SSG. Esfuerzo: 2-3 semanas. Descartado por ADR-019/020.

Recomendación inicial: opción 1 si el asesor confirma que GSC mejora con cards inyectadas; si no, opción 2.

---

## 8. GA4 / GTM (deuda gateo por entorno)

[hallazgo, **crítico**] **GTM hardcoded sin gateo por entorno**.

En `frontend/public/index.html` (líneas iniciales, capturadas con curl al HTML servido):

```javascript
<script>
!function(e,t,a,n){e[n]=e[n]||[],e[n].push({"gtm.start":(new Date).getTime(),event:"gtm.js"});
var g=t.getElementsByTagName(a)[0],m=t.createElement(a);
m.async=!0,m.src="https://www.googletagmanager.com/gtm.js?id=GTM-T7BNJP4M",
g.parentNode.insertBefore(m,g)}(window,document,"script","dataLayer")
</script>
```

Y el iframe noscript:

```html
<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T7BNJP4M" height="0" width="0" style="display:none;visibility:hidden"></iframe>
```

**Container `GTM-T7BNJP4M` hardcoded en el HTML estático**, antes de la hidratación React, **sin posibilidad de discriminar entorno**.

**Identificación del entorno en runtime**: el frontend usa `runtimeEnv.js` con `runtimeEnv.hostname === 'sharemechat.com'` para discriminar PROD vs TEST/AUDIT (referencia encontrada en `known-debt.md`). Pero el snippet GTM se ejecuta **antes** de que React monte y antes de que `runtimeEnv` esté disponible.

**Build process**: `npm run build:product` usa `env-cmd -f .env.product`, pero el `index.html` es estático y los valores `REACT_APP_*` solo se inyectan en el JS del bundle, no en el snippet GTM (que se evalúa antes del bundle).

**Implicación operativa**:
- Cualquier sesión TEST/AUDIT del operador o un revisor envía eventos a GTM-T7BNJP4M.
- Si GTM dispara tags GA4, las métricas de PROD se contaminan con tráfico interno.
- Si GTM tiene tags de conversión (pixel Reddit/X, conversiones de signup), pueden dispararse con cada navegación interna.

[propuesta] **Soluciones**:

1. **Mover el snippet GTM a un componente React** que verifique `window.location.hostname === 'sharemechat.com'` antes de inyectarlo dinámicamente. Esfuerzo: 2h. La cara: pierde el firing en el primer paint del HOME (los eventos antes del React-mount no llegan). Para Cookie Banner ya hay cierta tolerancia.
2. **Build-time templating**: usar `env-cmd` o variable expansion para reemplazar `GTM-T7BNJP4M` por `%REACT_APP_GTM_ID%` en `index.html`, con valores `.env.product.test`/`.audit`/`.prod`. Esfuerzo: 3h. Más limpio pero requiere 3 builds distintos del producto, lo cual rompe ONE JAR (no aplica al frontend, que ya tiene 2 builds product/admin — añadir entornos es viable).
3. **CloudFront Lambda@Edge** que inyecte el ID GTM correcto según el host del request. Esfuerzo: 1 día. Más complejo, evita rebuilds.

Recomendación: opción 1 (gateado client-side) es la más simple y compatible con la arquitectura actual. Si el asesor requiere medición desde el primer paint, opción 2.

**Verificación adicional pendiente**: GA4 property ID **no encontrado** en código grep — la integración GA4 probablemente vive dentro de GTM, no como gtag suelto. Confirmar con el operador.

---

## 9. Pipeline editorial CMS

Skills Cowork bajo `docs/cms/skills/` (formato A YAML frontmatter + cuerpo):

| Fase | Skill | Rol |
|---|---|---|
| 0 | `cms-orchestrator` | Director del pipeline, encadena las 6 fases. |
| 1 | `cms-research-seo` | Research web + análisis SEO (keywords, intent, competencia). |
| 2 | `cms-draft-writer` | Borrador completo en Markdown ES. |
| 3 | `cms-editorial-polish` | Pulido de prosa. |
| 4 | `cms-brand-legal-review` | Revisión brand + DSA/GDPR. |
| 4.5 | `cms-translate-en` | Traducción ES→EN. |
| 5 | `cms-json-builder` | JSON final compatible con schema CMS. |
| 5.5 | `cms-json-validator` | Validación sintáctica RFC 8259. |
| transv. | `sharemechat-voice` | Voz editorial reutilizable. |

**Trigger de publicación**: workflow editorial dentro del CMS (estado `IN_REVIEW → PUBLISHED`).

[hallazgo] **NO HAY fase "notify search engines" tras publicar**. Lo que ocurre tras publicar un artículo:

1. Backend actualiza la entidad `ContentArticle` a `PUBLISHED`.
2. `SitemapController` lo incluye automáticamente en la próxima petición a `/sitemap.xml` (sin regeneración explícita, se construye on-the-fly con cache 1h en el response).
3. CloudFront NO se invalida.
4. **No se notifica a Google (Indexing API), Bing (IndexNow), ni se hace ping al sitemap**.
5. La cuenta GSC está activa y el operador puede pedir indexación manual desde la consola; el documento `tracking-mensual.md:7` lo menciona literal: *"requieren login en Google Search Console... manualmente"*.

[propuesta] **Implementar IndexNow** (1 endpoint POST simple, soportado por Bing/Yandex/SeznamCZ, opt-in de Google según comunicación reciente). Esfuerzo: 2-3h. El backend ya conoce el slug al publicar; añadir un componente que dispare el POST a `https://api.indexnow.org/indexnow?url=<url>&key=<api-key>` tras el commit DB.

[propuesta] **Implementar Google Indexing API** solo para JobPosting/BroadcastEvent o flujo manual desde GSC. Para blog posts, GoogleBot descubre vía sitemap; el operador puede pedir indexación manual en GSC sin necesidad de API. Esfuerzo si se quiere igual: 4-5h con OAuth Service Account.

---

## 10. ops/scripts/ y runtimes disponibles

Scripts existentes:

| Script | Runtime | Propósito |
|---|---|---|
| `check-deploy-drift.ps1` | PowerShell 5.1 | Detecta drift entre HEAD y manifests de despliegue. |
| `deploy-frontend.ps1` | PowerShell 5.1 | Deploy product/admin a S3+CloudFront con drift check. |
| `tunnel-rds.ps1` | PowerShell 5.1 | Túnel SSH a RDS via bastion. |
| `update-manifest-backend.ps1` | PowerShell 5.1 | Actualiza manifest tras deploy backend manual. |
| `social-thread-finder.ps1` | PowerShell 5.1 | Reddit RSS finder (fallback ADR-041). |
| `sync-skills-to-cowork.ps1` | PowerShell 5.1 | Sync skills repo → Cowork. |
| `README-social-thread-finder.md` | — | Doc del social finder. |
| `archive/prerender-blog.ps1` | PowerShell 5.1 (archived) | DEPRECATED (ADR-018 superseded). |

[hallazgo] **TODOS los scripts del repo son PowerShell 5.1**. No hay Python, Node, ni Bash bajo `ops/scripts/`.

[hallazgo] **Cero integraciones con buscadores ya implementadas**. Búsqueda case-insensitive en todo el repo de `search-console|indexnow|pagespeed|webmaster|indexing-api` → 0 archivos.

[propuesta] **Si se va a crear un script de monitorización de indexación**: PowerShell es el stack natural (consistencia con el resto). Pero Python o Node ofrecen mejor experiencia con APIs Google (OAuth, librerías oficiales). Decisión técnica con tradeoff explícito: PS por coherencia (curva de aprendizaje 0 para el operador) vs Python/Node por riqueza ecosistema APIs Google. Recomendación intermedia: **Python 3** porque tiene OAuth2 + google-api-python-client maduros, y se puede invocar desde un wrapper `.ps1` para mantener el patrón operativo.

---

## 11. Integraciones con buscadores existentes

Búsqueda `case-insensitive` en todo `sharemechat-v1/` por `search-console`, `indexnow`, `pagespeed`, `webmaster`, `indexing-api`:

**0 archivos** matchean.

[hallazgo] **NO HAY ninguna integración con buscadores en el código del repo**. Ni GSC API, ni Indexing API, ni IndexNow, ni Bing Webmaster, ni PageSpeed Insights. La cuenta GSC está activada y verificada (mencionado en `estrategia.md:21`), pero todo el consumo es **manual desde el navegador**.

---

## 12. Canonical y hreflang

**Canonical del artículo** (calculado en frontend, `seoHelpers.js` + `BlogArticleView.jsx`):

- Patrón: `${ORIGIN}/blog/${article.locale}/${article.slug}`.
- `ORIGIN` proviene de `PRODUCT_ORIGIN` (`runtimeEnv.js`) o `window.location.origin` como fallback.

**URL en el sitemap.xml** (`SitemapController.java:148`):

- Patrón: `baseUrl + "/blog/" + t.getLocale() + "/" + t.getSlug()`.
- `baseUrl` viene de `app.public.base-url` property del Spring profile activo (PROD = `https://sharemechat.com`).

**Comparación concreta** para `que-es-videochat-1-a-1`:

- Sitemap: `https://sharemechat.com/blog/es/que-es-videochat-1-a-1` (verificado en `/tmp/sitemap.xml`).
- Canonical esperado en cliente (post-hidratación): `https://sharemechat.com/blog/es/que-es-videochat-1-a-1` (mismo patrón).

[hallazgo, **a confirmar empíricamente con JS rendering**] **Las URLs deberían coincidir EXACTAMENTE** (mismo case, sin trailing slash, mismo locale prefix). Esto no es verificable con curl puro porque el canonical no aparece en el HTML inicial. Recomendado verificar con `curl + headless Chrome` o desde DevTools navegador para confirmar.

[hallazgo] **Risk asymmetric**: si en cliente alguna vez se calculara con trailing slash mientras el sitemap NO lo lleva, Google podría tratar las dos URLs como distintas. El código actual es consistente (sin trailing slash en ambos lados), pero la asunción depende de no cambiar uno sin el otro.

**Hreflang**:

- **En sitemap**: bidireccional. Para cada `<url>`, se emiten todos los `<xhtml:link>` de los locales del grupo (`articleAlternates` pre-computado en `SitemapController.java:141`). Confirmado en `/tmp/sitemap.xml` (40 xhtml:link para 20 URLs).
- **En cliente (BlogArticleView)**: emite `hreflang="es-ES"` apuntando a la URL del artículo + `hreflang="x-default"`. NO emite `hreflang="en"` real apuntando a la versión EN del mismo artículo lógico ([ADR-020 C3](sharemechat-v1/docs/06-decisions/adr-020-blog-spa-seo.md), línea 138: *"no se emite hreflang='en' ni similar mientras no existan URLs alternas reales"*).

[hallazgo] **El frontend post-hidratación NO emite `hreflang="en"` para artículos ES con versión EN**, aunque el sitemap SÍ los empareja. Asimetría histórica de ADR-020 C3 que ADR-022 (multilingüe ES+EN) DEBERÍA haber cerrado y aparentemente no se cerró. Verificar contra el código actual de `BlogArticleView.jsx` (post-ADR-022) si la asimetría persiste o si ya se corrigió.

[propuesta] Esfuerzo 1h. **Confirmar e implementar hreflang bidireccional en cliente** consumiendo `article.alternates` del DTO `ArticlePublicDetailDTO`.

---

## 13. Pendientes y deuda detectada

### Críticos (bloquean indexación/descubrimiento)

1. **HTML inicial del listing y la home no emite enlaces a artículos.** El sitemap es la única vía de descubrimiento. Causa probable de "ninguna página de referencia" en GSC. Sección 7.
2. **HTML inicial del artículo es el shell home con title de home y sin canonical/hreflang/JSON-LD del artículo.** Crawlers sin JS ven contenido de la home con URL del artículo → riesgo de mis-indexación o canonicalización a home.
3. **GTM-T7BNJP4M dispara sin gateo en TEST/AUDIT/PROD.** Contamina métricas y conversiones. Sección 8.

### Altos (perjudican CTR o cobertura)

4. **`BreadcrumbList` no implementado** en blog. Rich result de SERP perdido.
5. **`Organization` standalone no implementado** (solo anidado dentro de `WebSite` en `index.html`). Recomendado en home para Knowledge Panel.
6. **Hreflang en cliente probablemente sigue asimétrico** (solo `es-ES` + `x-default` en lugar de `es-ES` + `en-US` reales). Confirmar.
7. **No hay notificación post-publish a buscadores** (sitemap ping, IndexNow, Indexing API). Cada artículo nuevo espera al próximo crawl natural.
8. **No hay monitorización automatizada de indexación**. La revisión es manual desde GSC.

### Medios (deuda conocida pre-existente)

9. **`logo192.png` (favicon CRA) usado como `publisher.logo` y `og:image` del listado** en lugar de logo de marca dedicado.
10. **`og:image:width`/`height` ausentes**.
11. **`twitter:site`/`twitter:creator` ausentes**.
12. **Backend no envía `charset=utf-8`** en `Content-Type` de `/api/public/content/**` (mitigado en script archivado).

### Bajos (cosméticos / futuros)

13. **Sin code-splitting del bundle por ruta `/blog`** (deuda ADR-020).
14. **Imágenes hero en una sola resolución** (sin `srcset`).
15. **Sin sitemap-index** (suficiente hasta 50k URLs; trivial cuando se llegue).

---

## 14. Quick wins propuestos (mejor leverage)

Ordenados por relación valor/esfuerzo:

1. **Inyectar lista de artículos publicados en `index.html` en build-time** (esfuerzo: **4-6h**). Un step en `react-scripts build` o postbuild que lea los 6 artículos publicados (vía `curl https://sharemechat.com/api/public/content/articles` o leyendo la BD desde un script de build) y los inyecte como `<noscript><ul><li><a>...</a></li>...</ul></noscript>` justo antes de `<div id="root">`. Resuelve el bug crítico del internal linking para Bing y bots sin JS sin reabrir ADR-019. **Valor: alto** (puede ser la causa raíz del problema GSC).

2. **Gatear GTM por hostname** (esfuerzo: **2h**). Extraer el snippet GTM de `index.html` a un componente React `<GtmLoader />` que verifique `window.location.hostname === 'sharemechat.com'` antes de inyectarlo. **Valor: alto** (limpia métricas y conversiones; condición previa para confiar en cualquier KPI de tracking-mensual.md).

3. **Implementar IndexNow** (esfuerzo: **2-3h**). Endpoint POST simple desde backend tras publicar artículo: `POST https://api.indexnow.org/indexnow?url=<canonical>&key=<api-key>`. Notifica a Bing, Yandex, SeznamCZ, Naver. Trivial de implementar; **valor: medio-alto** (especialmente para Bing, que también aparece en analítica del operador).

4. **Añadir `BreadcrumbList` JSON-LD** en `BlogArticleView` (esfuerzo: **1h**). `Home > Blog > Artículo`. **Valor: medio** (mejora CTR en SERPs y enriquece el rich result).

5. **Confirmar e implementar hreflang bidireccional en cliente** (esfuerzo: **1h**). Verificar que `BlogArticleView` consume `article.alternates` del DTO y emite `<link rel="alternate" hreflang="en-US">` real apuntando a la URL EN del grupo. **Valor: medio** (resuelve asimetría con el sitemap).

**Pack mínimo recomendado para empezar**: 1 + 2 + 4 ≈ 8h totales. Ataca el bug crítico de internal linking, limpia el tracking y mejora CTR. Si quedan recursos, añadir 3 + 5.

---

## Dudas mayores que quedan (para el fundador)

1. **¿Quiere el fundador reabrir el debate ADR-019 sobre pre-render selectivo a HTML estático?** El "quick win" del punto 1 (inyectar lista en `index.html` con noscript) es un paliativo viable pero no resuelve la asimetría arquitectónica de fondo: artículos individuales seguirán dependiendo de JS para emitir canonical/hreflang/JSON-LD. Una migración mínima a pre-render selectivo SOLO para `/blog/*` (con `react-snap` o equivalente) resolvería todo de raíz pero implica reabrir ADR-019. ¿Tradeoff aceptable?

2. **¿Está el operador dispuesto a aceptar que GTM no dispare hasta que React monte** (consecuencia del quick win 2)? La alternativa (build-time templating con 3 builds de producto: `.env.product.test`/`.audit`/`.prod`) preserva el firing en primer paint pero rompe el patrón actual de 2 builds (product/admin) y exige coordinar 3 deploys. ¿Es asumible perder eventos de primer paint en home a cambio de cero contaminación cross-entorno?

3. **¿Cuál es el estado real de la verificación con Bing Webmaster Tools y de la cuenta de Yandex** (relevante para IndexNow)? La estrategia menciona GSC + GA4 explícitamente, pero no Bing ni Yandex. IndexNow es trivial técnicamente, pero solo aporta valor si esos buscadores tienen propiedad verificada del dominio. ¿O priorizamos GSC Indexing API a pesar de su coste OAuth?
