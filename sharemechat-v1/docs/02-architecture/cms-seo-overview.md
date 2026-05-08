# CMS — SEO mínimo del blog público

Capa SEO del blog público de SharemeChat (Frente 2 sobre la Fase 4A del CMS,
ver [ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md)
y [ADR-015](../06-decisions/adr-015-canonical-domains-per-environment.md)).
El objetivo es que Google indexe correctamente los artículos publicados sin
salir todavía del modelo de servicio dinámico vía API JSON.

## Endpoints backend

Sin autenticación (`permitAll` en `SecurityConfig`):

- `GET /sitemap.xml` — `application/xml; charset=UTF-8`. Lista la home del
  blog y todos los artículos `state=PUBLISHED` con `<loc>` absoluto,
  `<lastmod>` (`updatedAt` o fallback a `publishedAt`), `<changefreq>`
  (`weekly` para artículos, `daily` para el listado) y `<priority>` (`0.7`
  / `0.8`). `Cache-Control: public, max-age=3600`.
- `GET /robots.txt` — `text/plain; charset=UTF-8`. Permite `/blog` y
  `/blog/`, deniega `/api/`, `/admin`, `/dashboard`, `/login`, `/register`,
  y emite `Sitemap: <baseUrl>/sitemap.xml`. `Cache-Control: public,
  max-age=86400`.

Ambos viven en `com.sharemechat.content.publishing.SitemapController`.

## Inyección SEO en el SPA

`frontend/src/pages/blog/BlogArticleView.jsx` mantiene sincronizado el
`<head>` con el artículo cargado (sin dependencias nuevas: manipulación
directa de `document.head` con `useEffect`, compatible con React 17):

- `<title>` = `${seoTitle || title} | SharemeChat`
- `<meta name="description">` = `metaDescription || brief truncado a 160`
- `<link rel="canonical">` = `${baseUrl}/blog/${slug}`
- Open Graph (`og:type=article`, `og:title`, `og:description`, `og:url`,
  `og:site_name=SharemeChat`, `og:locale=es_ES`)
- Twitter Card (`summary_large_image`, `twitter:title`,
  `twitter:description`)
- `<script type="application/ld+json">` con `Article` schema.org:
  `headline`, `description`, `url`, `datePublished`, `dateModified`,
  `inLanguage`, `author=Equipo SharemeChat`, `publisher=SharemeChat`.

`og:image` y `image` JSON-LD se omiten mientras el DTO no exponga
`heroImageUrl`. El código deja un `TODO` para emitirlos cuando exista.

## Resolución del host canónico

- **Backend**: `PublicSiteProperties` (`@ConfigurationProperties(prefix =
  "app.public")`) lee `app.public.base-url` desde
  `application*.properties`. TEST default `https://test.sharemechat.com`,
  AUDIT override `https://audit.sharemechat.com`, PRO ajustará a
  `https://sharemechat.com` cuando se monte (`APP_PUBLIC_BASE_URL`).
- **Frontend**: usa `window.location.origin`, que siempre coincide con el
  host por el que llegó el bot. ADR-015 garantiza apex único canónico por
  entorno (`www → 301 → apex` en CloudFront).

## Verificación operativa

En TEST, una vez desplegado:

- `curl -I https://test.sharemechat.com/sitemap.xml` → `200`,
  `Content-Type: application/xml`, `Cache-Control` presente.
- `curl https://test.sharemechat.com/robots.txt` → texto plano con la
  directiva `Sitemap: https://test.sharemechat.com/sitemap.xml`.
- `curl https://test.sharemechat.com/sitemap.xml | xmllint --noout -` →
  XML válido.
- Abrir `/blog/<slug>` en Chrome → DevTools → Elements → comprobar `<head>`
  tiene `<title>`, `<meta name="description">`, `<link rel="canonical">`,
  `og:*`, `twitter:*` y `<script type="application/ld+json">`.
- Validar JSON-LD en
  [Rich Results Test](https://search.google.com/test/rich-results)
  (esperado: detecta tipo `Article`, sin errores críticos).
- Pegar la URL en LinkedIn / Twitter → verifica que la previsualización
  muestra título y descripción correctos.

Una vez PRO se despliegue, registrar el dominio en Google Search Console y
enviar `https://sharemechat.com/sitemap.xml` para acelerar la indexación.

## Limitaciones

- Sin `og:image`: no hay imagen genérica todavía, pendiente de Fase 4B o
  cuando exista campo `heroImageUrl`.
- Sin sitemap-index: una sola URL `/sitemap.xml`. Suficiente hasta que el
  catálogo se acerque a 50.000 entradas.
- Sin `seoTitle` / `metaDescription` dedicados como columnas de
  `content_articles`: el frontend deriva ambos de `title` y `brief`. Si en
  el futuro se quieren editar de forma independiente sin tocar título y
  brief, exigirá migración Flyway con dos columnas nuevas y mapeo en el
  DTO (no contemplado en este frente).
