# ADR-019 — Blog servido desde SPA React (no HTML estático)

## Estado

Aceptada (2026-05-11).

Supersede a [ADR-018](./adr-018-blog-static-rendering.md), que propuso publicación estática del blog vía script de pre-render. Tras implementación parcial en TEST se decidió no continuar y volver a la SPA React como única vía de servicio del blog público.

## Contexto

El blog público de SharemeChat (`/blog` y `/blog/<slug>`) necesita tres propiedades:

1. **Publicable**: el operador transiciona un artículo a `PUBLISHED` desde el backoffice y queda visible en la web sin pasos manuales adicionales.
2. **Indexable**: Google y bots de redes sociales (Open Graph) ven título, descripción, imagen y JSON-LD.
3. **Mantenible**: una sola implementación del look, sin duplicación entre stack frontend y stack de generación.

ADR-018 propuso pre-renderizar el blog a HTML estático servido desde S3+CloudFront. Tras implementación parcial en TEST (script `ops/scripts/prerender-blog.ps1`, cache behavior `/blog*` en la distribución frontend público, plantillas A/B en PowerShell), el equipo observó:

- **Existe ya un blog React funcional** en `frontend/src/pages/blog/` (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`) con estilos editoriales en `frontend/src/styles/pages-styles/BlogStyles.js`. Está conectado al CMS vía `GET /api/public/content/articles` y `GET /api/public/content/articles/{slug}` (`src/main/java/com/sharemechat/content/publishing/ContentPublicController.java`).
- **La capa SEO en cliente ya existe parcialmente**: `BlogArticleView.jsx:57-97` manipula `document.head` con helpers `upsertMeta`, `upsertCanonicalLink`, `upsertJsonLd` para emitir `<title>`, `description`, canonical, Open Graph, Twitter Card y JSON-LD `Article` (líneas 197-238).
- **Googlebot ejecuta JavaScript desde 2019** (web rendering service basado en Chromium). Los bots de Open Graph (Facebook, LinkedIn, X) y Twitter Card también renderizan JS para meta tags dinámicas en clientes modernos.
- La pre-renderización mantenía **dos implementaciones del look** (React + PowerShell con CSS embebido en `Get-BlogCommonCss`) que tenían que mantenerse en paralelo cada vez que cambiaba un detalle visual.
- La coordinación entre `ops/scripts/deploy-frontend.ps1` y `ops/scripts/prerender-blog.ps1` era frágil (deuda registrada en `docs/04-operations/known-debt.md`): un `aws s3 sync --delete` del frontend producto borraba los HTML del blog si no se ejecutaba el prerender justo después.

## Opciones consideradas

### Opción 1 — Continuar con ADR-018 (HTML estático)

Pre-renderizar a S3+CloudFront tras cada publicación, con cache behavior `/blog*` dedicado en CloudFront.

Pros:
- SEO industrial sin depender de JS.
- Blog resiliente a caídas del backend (HTML cacheado en edge).
- Tiempo de primera carga mínimo (HTML servido directo).

Contras:
- Dos implementaciones del look (React + PowerShell).
- Sincronización manual operativa: cada publicación obliga a ejecutar el script.
- Cache behavior y bucket compartidos con la SPA introducen riesgos cruzados (sync borrando objetos del blog).
- Coste mantenimiento alto vs. valor SEO marginal en 2026 con bots modernos.

### Opción 2 — Servir todo desde la SPA React (elegida)

Mantener `BlogContent.jsx` y `BlogArticleView.jsx`. Las rutas `/blog` y `/blog/<slug>` caen al default behavior de CloudFront, la función edge `redirect-spa-test` reescribe a `/index.html` y la SPA hidrata el contenido leyendo la API.

Pros:
- Una sola implementación del look.
- Iteración visual rápida con styled-components compartidos con el preview admin del CMS (`ContentArticleEditor.jsx` importa de `BlogStyles.js`).
- CloudFront sin behavior específico para el blog.
- Sin sincronización operativa entre deploy SPA y publicación de artículos.

Contras:
- SEO "bueno pero no perfecto": depende de que el crawler ejecute JS. Bots menores pueden ver el bundle React vacío.
- Si el backend cae, el blog cae (no hay caché estática en edge).
- Tiempo de primera carga depende del bundle React.

### Opción 3 — Migrar a Next.js (SSG / SSR puro)

Reescribir el frontend a Next.js con generación estática por slug (`getStaticPaths` + `getStaticProps`) o SSR (`getServerSideProps`).

Pros:
- SEO industrial sin las limitaciones de la Opción 2.
- Stack moderno con tooling maduro.

Contras:
- Coste de migración estimado 2-3 semanas mínimo (CRA → Next, react-router → app router, build pipeline, configuración SSR/SSG, hosting).
- Cambio de stack para resolver un problema acotado a una sección del sitio.
- Riesgo de regresión en superficies no-blog (videochat, login, dashboards) durante la migración.

Descartada para esta fase. Queda como deuda futura registrada si la tracción del blog lo justifica.

## Decisión

Servir todo el blog público desde la SPA React. Mantener los componentes existentes (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`, `BlogStyles.js`) como vía única.

Mejorar funcionalmente en Sub-pasada 2B:

- Hero image en cards del listado y en detalle (campo `heroImageUrl` ya disponible tras Fase 1).
- Sidebar con buscador client-side (input + filtro JS vanilla) y categorías agrupando artículos reales (sustituye los `TagPill` hardcoded actuales).
- Related al pie del detalle (3 artículos de categorías distintas).
- Share row (X, Meta, Instagram, TikTok como enlaces a perfiles, no como "compartir el artículo") + botón "Copiar enlace" con `navigator.clipboard`.
- Reglas `.callout` en `ArticleBody` para estilar el `<div class="callout">` que ya emite el backend tras Fase 1.
- Tiempo de lectura calculado en frontend (palabras del `htmlBody` / 225 wpm).
- Ajustes tipográficos menores en `BlogStyles.js` (reducir `HeroTitle` y similares).

Aplicar SEO industrial en Sub-pasada 2C:

- Cerrar el TODO de `og:image` en `BlogArticleView.jsx:207-208` consumiendo `article.heroImageUrl`.
- Migrar el JSON-LD de `Article` a `BlogPosting` con `articleSection`, `wordCount`, `mainEntityOfPage`, `image`, `publisher.logo`.
- Añadir capa SEO al listado (`/blog`): `<title>`, `description`, canonical, Open Graph, Twitter Card, JSON-LD `Blog`/`CollectionPage`.
- Corregir `inLanguage` y `og:locale` para soportar locales distintos de `es` cuando exista contenido EN.
- Extraer helpers (`upsertMeta`, `upsertCanonicalLink`, `upsertJsonLd`, nuevo `upsertLink`) a `frontend/src/pages/blog/seoHelpers.js` para reutilizar entre listado y detalle.
- Declarar `<link rel="alternate" hreflang="es">` y `hreflang="x-default"` (no emitir `hreflang="en"` aún).
- Evaluar añadir Google Image Sitemap (`xmlns:image`) en `SitemapController.java` para SEO de imágenes (decisión backend, evaluación aparte).

## Justificación

La SPA ya existe, ya está conectada al CMS y ya tiene los componentes principales de SEO en cliente. El delta para llegar a "blog editorial completo con SEO industrial" se cubre con dos sub-pasadas de iteración acotada (2B + 2C) sin cambiar de stack.

La pre-renderización (Opción 1) resolvía un problema (SEO sin JS) que en 2026 con Googlebot moderno es marginal, a cambio de duplicar el sistema visual y añadir coordinación operativa frágil. El balance no justifica el coste.

Migrar a Next.js (Opción 3) resolvería el caso ideal de SEO, pero el coste de migración no es proporcional al valor que aporta sobre la Opción 2 con la fase actual del proyecto (pre-PRO, blog incipiente). Queda como deuda futura.

## Impacto

**Arquitectura**:
- `/blog` y `/blog/<slug>` caen al default behavior de CloudFront frontend público (función edge `redirect-spa-test` reescribe URIs sin punto a `/index.html`). La SPA hidrata.
- No hay cache behavior `/blog*` específico. El que existía durante la exploración de ADR-018 fue eliminado el 2026-05-11.
- La distribución frontend público tiene una superficie menos que mantener.

**Código**:
- `frontend/src/pages/blog/` queda como única implementación del blog público.
- `frontend/src/styles/pages-styles/BlogStyles.js` se amplía en 2B (nuevos styled components: `ArticleCardImage`, search/category sidebar, `RelatedSection`, `ShareRow`, `ReadingTimeBadge`, reglas `.callout` en `ArticleBody`).
- `frontend/src/pages/blog/seoHelpers.js` se crea en 2C extrayendo helpers actuales de `BlogArticleView.jsx`.
- Cero cambios en backend Java por esta decisión (la API pública ya sirve todo lo necesario).

**Operaciones**:
- Eliminado el paso "ejecutar `prerender-blog.ps1` tras cada publicación". La SPA refleja cambios en tiempo real (TTL de CloudFront sobre `/index.html` y caché del bundle JS, según `Cache-Control` que ya emite `deploy-frontend.ps1`).
- `ops/scripts/prerender-blog.ps1` archivado en `ops/scripts/archive/` (cabecera DEPRECATED). No se ejecuta más.
- Dos entradas de `docs/04-operations/known-debt.md` relacionadas con el script quedan marcadas como `[CERRADA]`.

**Riesgos**:
- Bots no-JS ven el bundle vacío. Mitigación: meta tags y JSON-LD se emiten en cliente, lo cual cubre Googlebot, Bing moderno y bots de redes sociales modernos. Bots minoritarios o legacy quedan fuera.
- Si el backend cae, el blog deja de servir contenido. Mitigación operativa: TEST se opera manualmente; PRO tendrá que tener procedimiento de monitorización y posiblemente caché HTTP en la propia respuesta `/api/public/content/**` (decisión separada, fuera de alcance de este ADR).

## Consecuencias

Positivas:

- Una sola implementación del look (React + styled-components).
- Iteración visual rápida sin necesidad de regenerar HTML.
- Reutilización de componentes con el resto de la SPA (`PublicNavbar`, footer, `BlogStyles` compartido con preview admin del CMS).
- CloudFront simplificado: sin behavior dedicado para el blog.
- Operación más simple: publicar en backoffice basta, sin pasos manuales adicionales.

Negativas / aceptadas:

- SEO "bueno pero no perfecto": client-side rendering. Googlebot lo gestiona; bots minoritarios pueden quedar fuera.
- Dependencia del backend para servir contenido del blog (sin caché edge estática).
- Tiempo de primera carga depende del bundle React.

Trade-offs:

- Se renuncia a la resiliencia ante caídas de backend a cambio de simplicidad operativa y mantenibilidad del código.
- Se renuncia al SEO "perfecto" (HTML servido directo) a cambio de no duplicar el sistema visual.

## Notas

- Si la tracción del blog crece y los datos de Search Console muestran que un porcentaje no despreciable de tráfico viene de bots que no ejecutan JS, reabrir la conversación de migración a Next.js (Opción 3).
- El script archivado conserva piezas reutilizables si en el futuro se vuelve a explorar la pre-renderización: workaround UTF-8 para PowerShell 5, CSS embebido del blog, plantillas A/B.
- Las entradas de `known-debt.md` cerradas por esta decisión: "Helper Invoke-JsonGetUtf8 sin timeout explícito en prerender-blog.ps1" y "Coordinación frágil entre deploy-frontend.ps1 y prerender-blog.ps1".

## Referencias

- [ADR-018](./adr-018-blog-static-rendering.md) — Publicación estática del blog público (Superseded por esta ADR; ver sección Cierre de aquella).
- [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md) — Workflow editorial simplificado. La D7 (publicación estática diferida sin fecha) sigue aplicando tras este ADR.
- `frontend/src/pages/blog/Blog.jsx`, `frontend/src/pages/blog/BlogContent.jsx`, `frontend/src/pages/blog/BlogArticleView.jsx` — Componentes actuales del blog.
- `frontend/src/styles/pages-styles/BlogStyles.js` — Styled components compartidos con el preview admin del CMS.
- `src/main/java/com/sharemechat/content/publishing/ContentPublicController.java` — API pública del blog (sin cambios por este ADR).
- `ops/scripts/archive/prerender-blog.ps1` — Script archivado (referencia histórica, no ejecutable).
- `docs/04-operations/known-debt.md` — Deudas cerradas en Sub-pasada 2A.1 (2026-05-11).
