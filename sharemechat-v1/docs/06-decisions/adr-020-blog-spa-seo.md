# ADR-020 — SEO industrial en SPA del blog (post-ADR-019)

## Estado

Aceptada (2026-05-12).

Complementa [ADR-019](./adr-019-blog-spa-react.md), que cerró servir el blog desde la SPA React asumiendo un SEO "bueno pero no perfecto". Este ADR documenta las decisiones tomadas para llevar ese SEO al máximo razonable dentro de los límites del client-side rendering, sin migrar de stack ni reintroducir prerendering.

## Contexto

[ADR-019](./adr-019-blog-spa-react.md) cerró el modelo de servicio del blog público: la SPA React (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`) sirve `/blog` y `/blog/<slug>` directamente, sin prerendering a S3 (camino abandonado en [ADR-018](./adr-018-blog-static-rendering.md)). Las consecuencias negativas registradas en ese ADR incluyeron:

- SEO "bueno pero no perfecto": dependiente de que el crawler ejecute JavaScript. Googlebot lo gestiona desde 2019, pero crawlers menores y bots de redes sociales pueden ver el bundle vacío.
- Latencia de primera carga dependiente del bundle React.
- Sin caché edge para resiliencia ante caída del backend.

Tras cerrar la Sub-pasada 2B (mejora funcional del blog: hero images, sidebar dinámico, related, share row, tiempo de lectura, callouts CSS), el siguiente paso natural era **elevar la calidad SEO de la SPA hasta el techo razonable del CSR**: meta tags correctas y completas, Open Graph e imágenes, Twitter Card, JSON-LD `BlogPosting` y `Blog`, hreflang preparado para futura internacionalización, sitemap con imágenes para Google.

Antes de Sub-pasada 2C, el estado del SEO en el blog era:

- `public/index.html` con el baseline de Create React App (`<html lang="en">`, `<title>Sharemechat</title>`, `<meta name="description" content="Web site created using create-react-app">`).
- `BlogArticleView.jsx` con helpers SEO inline (`upsertMeta`, `upsertCanonicalLink`, `upsertJsonLd`) que emitían `<title>`, `<meta name="description">`, canonical, Open Graph parcial, Twitter Card parcial y JSON-LD tipo `Article`. Con dos bugs documentados: `inLanguage` producía `en-ES` para artículos en inglés (BCP47 inválido) y `og:locale` estaba hardcoded a `es_ES`. `og:image` quedaba como TODO desde Fase 4A.
- `BlogContent.jsx` (listado `/blog`) sin SEO de ningún tipo: ni title, ni description, ni canonical, ni JSON-LD.
- `SitemapController.java` emitiendo el sitemap base con `<urlset>` + `<url>` por artículo PUBLISHED, sin namespace de Google Image Sitemap.

El objetivo de 2C: cerrar todos esos huecos sin migrar a Next.js (descartado por ADR-019) ni reintroducir prerendering (descartado por ADR-018, superseded).

## Opciones consideradas

### Opción 1 — No hacer nada

Mantener el SEO actual.

Pros:
- Cero trabajo. La SPA funciona, los artículos se indexan minimamente.
- Cero riesgo de regresión.

Contras:
- Bugs conocidos (`inLanguage`, `og:locale`) siguen activos.
- Listado `/blog` sin SEO indexable: Google no entiende qué es esa página.
- Sin `og:image`: previews sociales degradados o ausentes.
- Sin JSON-LD `BlogPosting`: Google trata los artículos como páginas genéricas, no como entradas de blog.
- Sin hreflang preparado: cualquier futura internacionalización exige rehacer.

Descartada. El coste de no actuar crece con cada artículo publicado.

### Opción 2 — Migrar a Next.js para SEO server-side

Reescribir el blog en Next.js con `getStaticPaths` + `getStaticProps` (SSG) o `getServerSideProps` (SSR).

Pros:
- HTML servido con SEO completo desde el primer byte. Crawlers sin JS ven todo.
- Previews sociales perfectos.
- Routing y i18n maduros.

Contras:
- Coste de migración estimado 2-3 semanas (cambio de stack frontend, refactor de rutas, build pipeline, hosting).
- Riesgo de regresión en superficies no-blog (videochat, login, dashboards) durante la migración.
- Resuelve un problema acotado a una sección del sitio cambiando todo el stack.

Descartada por ADR-019. Sigue descartada aquí. Queda como deuda futura si la tracción del blog lo justifica.

### Opción 3 — Prerendering selectivo a S3

Recuperar el script de pre-render archivado y volver al modelo de ADR-018.

Pros:
- HTML pre-renderizado con SEO completo.
- Caché edge en CloudFront.

Contras:
- Reabre todos los problemas que cerraron ADR-018 y ADR-019: dos implementaciones del look, coordinación frágil entre deploys, behaviors edge específicos, sincronización manual operativa.

Descartada. El ADR-019 ya valoró el coste/beneficio.

### Opción 4 — SEO industrial dentro de la SPA, fase por fase (elegida)

Implementar 6 fases (C0-C5) que cubren todos los huecos identificados, manteniendo la arquitectura SPA actual. Asumir como deuda explícita las limitaciones del CSR (crawlers no-JS ven baseline) hasta que la tracción justifique migrar a Next.js.

Pros:
- Resuelve bugs y huecos sin cambiar stack.
- Helpers reutilizables (`seoHelpers.js`) para futuras superficies.
- Cada fase es un commit pequeño, desplegable y validable de forma aislada.
- Cero impacto en el resto del SPA salvo `public/index.html` (cambio baseline que beneficia a todas las páginas).
- Único componente backend tocado (`SitemapController.java`) sigue siendo cambio acotado y reversible.

Contras:
- Crawlers que no ejecutan JS siguen viendo solo el baseline. OpenGraph.xyz y Twitter Card Validator pueden no detectar las meta tags dinámicas en algunas configuraciones. Previews sociales en Facebook/LinkedIn/WhatsApp pueden quedar degradados.
- No resuelve la dependencia del bundle React para SEO.

Elegida.

## Decisión

Implementar la Sub-pasada 2C en seis fases secuenciales (C0-C5), todas commits independientes y desplegables aisladamente. Cada fase fue validada en TEST antes de avanzar.

### C0 — Baseline de `public/index.html`

Tres cambios en el HTML estático servido por CloudFront antes de la hidratación SPA:

- `<html lang="en">` → `<html lang="es">`.
- `<title>Sharemechat</title>` → `<title>SharemeChat — Videochat 1 a 1 en directo</title>`.
- `<meta name="description" content="Web site created using create-react-app">` → `<meta name="description" content="Plataforma de videochat 1 a 1 en directo para conexiones auténticas entre adultos.">`.

Estos valores son lo que ven los crawlers sin JS y lo que aparece en la pestaña del navegador durante el primer paint. Aplica a TODAS las rutas del SPA, no solo al blog.

### C1 — Extracción de helpers a `seoHelpers.js`

Refactor puro. Cero cambio de comportamiento. Los helpers SEO inline en `BlogArticleView.jsx` (`upsertMeta`, `upsertCanonicalLink`, `upsertJsonLd`, `truncate`) se mueven a `frontend/src/pages/blog/seoHelpers.js` y se añaden cuatro helpers nuevos preparados para C2-C4:

- `upsertLink(selector, attrs)` — versión genérica de `upsertCanonicalLink` para hreflang.
- `removeMeta(selector)` — eliminar elemento del `<head>`, defensivo ante ausencia.
- `mapLocaleToBcp47(locale)` — `es → es-ES`, `en → en-US`, `fr → fr-FR`.
- `mapLocaleToOg(locale)` — `es → es_ES`, `en → en_US`, `fr → fr_FR`.

8 exports totales en el módulo.

### C2 — Detalle SEO completo

Reescritura del `useEffect([article])` en `BlogArticleView.jsx`. Cubre ocho funcionalidades en un único commit acotado al `useEffect` y su cleanup:

- Migración del JSON-LD `Article` a `BlogPosting` (más específico, mejor reconocido por Google para blogs). Campos: `headline`, `description`, `url`, `mainEntityOfPage`, `datePublished`, `dateModified`, `inLanguage`, `articleSection`, `keywords`, `author`, `publisher` (con `logo`), `image`.
- Fix de bug: `inLanguage` ahora consume `mapLocaleToBcp47(article.locale)` (antes producía `en-ES` para locale=en).
- Fix de bug: `og:locale` ahora consume `mapLocaleToOg(article.locale)` (antes hardcoded `es_ES`).
- `og:image` y `twitter:image` emitidos cuando `article.heroImageUrl` está presente; eliminados cuando no.
- `twitter:card` condicional: `summary_large_image` con hero image, `summary` sin ella.
- `article:published_time`, `article:modified_time`, `article:section`, y un `article:tag` por cada keyword.
- `<meta name="author">` y `<meta name="publisher">` añadidos.
- Cleanup robusto del `useEffect` que elimina al desmontar las meta tags específicas del artículo (og:image, twitter:image, article:* incluidos todos los article:tag), evitando que queden fantasma al navegar a otras páginas del SPA.

### C3 — Hreflang en detalle

Añadidos dos `<link rel="alternate" hreflang>` en el detalle:

- `hreflang="es-ES"` apuntando a la URL absoluta del artículo.
- `hreflang="x-default"` apuntando a la misma URL.

Preparado para internacionalización futura: cuando existan versiones en otros idiomas, basta añadir más `<link>` con sus URLs correspondientes. No se emite `hreflang="en"` ni similar mientras no existan URLs alternas reales (declararlas sin URL válida confunde a Google y descarta el hreflang en bloque).

Cleanup ampliado para eliminar todos los `link[rel="alternate"][hreflang]` al desmontar.

### C4 — SEO en listado `/blog`

Añadido un `useEffect([articles])` en `BlogContent.jsx` que emite el SEO del listado:

- `<title>` "Blog · SharemeChat — Videochat 1 a 1 en directo".
- `<meta name="description">` con texto editorial fijo.
- `<link rel="canonical">` a la URL absoluta del listado.
- Hreflang `es-ES` + `x-default` (mismo patrón que C3).
- Open Graph completo (type=website, title, description, url, site_name, locale=es_ES, image apuntando a `/logo192.png`).
- Twitter Card básico (card=summary, title, description).
- JSON-LD `Blog` con `blogPost` array, un `BlogPosting` por cada artículo cargado con `headline`, `url`, `description` truncada, `datePublished`, `image`, `articleSection`. Condicional a `articles.length > 0` para evitar JSON-LD vacío durante el primer render.

Cleanup que restaura el title al baseline de C0 y elimina hreflang + JSON-LD `blog-listing` al desmontar.

C4 también elimina el `truncate` duplicado local que existía en `BlogContent.jsx` y consume el `truncate` de `seoHelpers.js` (cierre de la deuda registrada en C1).

### C5 — Google Image Sitemap en backend

Único cambio backend de toda 2C. Modificación de `SitemapController.java` para emitir Google Image Sitemap:

- Namespace `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` añadido al `<urlset>`.
- Bloque `<image:image><image:loc>...</image:loc></image:image>` condicional dentro de cada `<url>` cuando `article.getHeroImageUrl()` está presente y empieza por `http://` o `https://`. La URL del listado `/blog` no lleva bloque image (no tiene un hero único asociado).
- Filtro defensivo: cero ruido en el sitemap por URLs basura o relativas.
- Reutiliza el helper `escapeXml` privado ya existente en el controller. Cero dependencias nuevas. Cero refactor.

## Justificación

La pregunta operativa para 2C era: dado que ya hemos cerrado que el blog vive en la SPA (ADR-019), ¿qué calidad de SEO podemos alcanzar sin cambiar la arquitectura?

La respuesta es: prácticamente la misma que un sitio SSG/SSR moderno **para crawlers que ejecutan JavaScript**. Esa categoría incluye Googlebot (desde 2019), Bingbot moderno, los bots de previews sociales de redes principales en sus versiones recientes y la mayoría de validadores que muestran resultados realistas. La calidad para crawlers que no ejecutan JS sigue siendo la del baseline de C0; eso es lo que `og:image:width`/`height`, `xhtml:link` en sitemap u otras finezas no resuelven y solo Next.js resolvería.

La iteración fase por fase permite tres cosas:

- **Despliegues pequeños**: cada fase se valida con DevTools, Rich Results Test y OpenGraph.xyz antes de avanzar. Cero "big bang".
- **Rollback granular**: si una fase rompe algo, se revierte solo esa.
- **Helpers reutilizables**: el módulo `seoHelpers.js` queda disponible para futuras superficies (home, login, dashboards) que quieran añadir SEO.

C1 antes que C2 fue clave: el refactor puro (sin cambio de comportamiento) bajó el riesgo de C2, que fue el commit con más cambios funcionales de la sub-pasada.

C0 antes que todo lo demás fue prioritario porque mejora el SEO baseline de **todas** las páginas del SPA simultáneamente, no solo del blog. Beneficio gratuito para home, login, dashboards.

C5 al final porque es backend independiente y solo aporta valor real una vez los artículos tienen sus `og:image` correctos en C2.

## Impacto

**Arquitectura**:
- Cero cambios en la topología CloudFront, S3 u origen.
- Cero cambios en la API pública (mismo DTO, mismo contrato).
- Cero migraciones SQL.
- Cero dependencias nuevas (ni en frontend ni en backend).

**Código frontend**:
- `public/index.html`: 3 líneas modificadas (C0).
- `frontend/src/pages/blog/seoHelpers.js`: nuevo módulo de ~127 líneas con 8 exports (C1).
- `frontend/src/pages/blog/BlogArticleView.jsx`: bloque SEO reescrito (C2 + C3). ~150 líneas netas en el `useEffect` SEO + cleanup ampliado.
- `frontend/src/pages/blog/BlogContent.jsx`: nuevo `useEffect[articles]` SEO de ~105 líneas + cleanup (C4). Eliminación del `truncate` duplicado local.

**Código backend**:
- `src/main/java/com/sharemechat/content/publishing/SitemapController.java`: 13 líneas netas añadidas (namespace + bloque condicional con filtro defensivo).

**Operaciones**:
- Tres deploys frontend (C0-C1-C2 agrupables, C3 separado, C4 separado) + un deploy backend (C5).
- Validación tras cada fase con DevTools + Rich Results Test + OpenGraph.xyz.
- Sin cambios en runbooks operativos: el flujo de publicación de un artículo no cambia.

**Riesgos asumidos durante implementación**:
- C2 con muchos cambios en un solo useEffect: validación intensiva tras deploy.
- Cleanup parcial entre fases podría dejar meta tags fantasma al navegar; mitigado con sobreescritura completa en cada `useEffect` SEO + cleanup explícito en C2/C3/C4.
- Bundle JS crece muy ligeramente (~159 KiB tras 2C, prácticamente sin delta respecto a antes).

## Consecuencias

### Positivas

- **Googlebot moderno indexa todo correctamente**: detail con `BlogPosting`, listado con `Blog`, hreflang preparado, imágenes via image sitemap.
- **Search Console reconoce los structured data** tras propagación (validable en Rich Results Test antes de que Google los indexe).
- **Helpers reutilizables**: `seoHelpers.js` queda disponible para extender SEO a otras superficies (home, dashboards públicos) sin refactor adicional.
- **Bugs cerrados**: `inLanguage` y `og:locale` ahora derivados del locale del artículo. Cualquier contenido futuro en inglés se etiquetará correctamente sin más cambios.
- **Cleanup robusto**: meta tags específicas del detalle (article:tag, og:image, etc.) se eliminan al navegar fuera. Cero residuos visibles entre páginas del SPA.
- **Listado `/blog` ya indexable**: antes era invisible para Google como entidad; ahora es un `Blog` con `blogPost` array reconocido.
- **Cero deuda nueva de arquitectura**: la sub-pasada no introdujo nuevos puntos de coordinación operativa ni nuevas dependencias.

### Negativas / aceptadas

- **Crawlers sin JS siguen viendo solo el baseline de C0**. Aceptado como deuda arquitectónica resoluble únicamente con Next.js o re-prerendering. Documentado.
- **Previews sociales pueden degradarse** en clientes legacy (LinkedIn antiguo, WhatsApp en versiones donde el bot no ejecuta JS). Googlebot, X y bots modernos sí ejecutan JS y ven los meta tags correctos.
- **El `og:image` del listado es `/logo192.png`**: es el favicon de CRA, no un logo de marca dedicado de 1200×630 óptimo para Open Graph. Suficiente para validación, mejorable con asset propio.
- **Sin `og:image:width`/`height`** en ningún sitio: algunos validadores Open Graph estrictos lo piden. Aceptado por ahora.
- **Sin `xhtml:link` en sitemap**: cuando se internacionalice, exigirá refactor del `SitemapController`.

### Trade-offs

- Cubrir el 80% del valor SEO real con cambios contenidos en la SPA (esta opción) frente a cubrir el 100% reescribiendo a Next.js (descartado por coste). El balance favorece la opción elegida hasta que la tracción del blog justifique reabrir la conversación de migración.

## Notas

### Validación realizada

Tras cada fase desplegada en TEST se ejecutaron tests automáticos (curl + grep + xmllint) y tests manuales con DevTools y herramientas externas (Google Rich Results Test, OpenGraph.xyz, Twitter Card Validator). Sesión de validación integral tras C0-C4 con 14 tests: 10 OK + 2 con observación menor + 2 manuales delegados al operador + 1 fail operacional (backend apagado durante la validación, sin relación con el código). C5 validado tras deploy backend con curl sobre `/sitemap.xml` + namespace check + `<image:image>` presence.

### Deuda registrada (no resuelta en 2C)

Las siguientes deudas quedaron registradas durante la sub-pasada y no se abordaron deliberadamente para mantener el alcance acotado:

- `og:image:width` y `og:image:height` ausentes en todos los emisores.
- `og:locale:alternate` ausente (no aplica mientras solo haya `es-ES`).
- `logo192.png` es favicon CRA, sin sustituto de marca dedicado en `public/`.
- `twitter:site` y `twitter:creator` ausentes (depende de cuenta oficial de marca).
- Sin code-splitting del bundle por ruta `/blog`.
- Imágenes hero en una sola resolución (sin `srcset` `@2x`).
- Sin telemetría / Sentry para errores SEO en cliente.
- Sin sitemap-index: un solo `/sitemap.xml`. Suficiente hasta 50.000 URLs.
- Sitemap sin `xhtml:link rel="alternate"` por locale (requerirá refactor cuando se internacionalice).
- `og:type` `article` en el detalle no se limpia al transicionar a página retracted; se mantiene hasta el siguiente useEffect SEO. Bajo riesgo.
- `tagList` se calcula dos veces dentro del `useEffect[article]` (una en bloque `article:tag`, otra en JSON-LD). Aceptable a tamaño actual.

### Notas operativas

- Toda la implementación es de cliente excepto C5 (backend).
- Cero migraciones SQL.
- Cero cambios en `ArticlePublicSummaryDTO` ni `ArticlePublicDetailDTO`.
- Cero dependencias nuevas en `package.json` ni `pom.xml`.
- El bundle JS crece muy ligeramente; el delta es despreciable frente al tamaño total (~159 KiB gzip).
- El deploy de C5 requiere arrancar el backend de TEST y reemplazar el JAR (procedimiento manual habitual; TEST se opera manualmente, sin systemd).

## Referencias

- [ADR-018](./adr-018-blog-static-rendering.md) — Publicación estática del blog (Superseded). Camino prerendering descartado.
- [ADR-019](./adr-019-blog-spa-react.md) — Blog servido desde SPA React. ADR-020 amplía sus decisiones sin contradecirlas.
- [ADR-017](./adr-017-state-snapshots-and-docs-coexistence.md) — Coexistencia de snapshots y documentación narrativa. Patrón aplicado al documentar las fases de 2C.
- [ADR-010](./adr-010-internal-content-cms-ai-assisted-workflow.md) — CMS interno (origen del flag `disclosureRequired` que ADR-020 considera para meta tags futuras).
- `frontend/src/pages/blog/seoHelpers.js` — Módulo creado en C1, base de C2-C4.
- `frontend/src/pages/blog/BlogArticleView.jsx` — Detalle del artículo, modificado en C2 y C3.
- `frontend/src/pages/blog/BlogContent.jsx` — Listado del blog, modificado en C4.
- `frontend/public/index.html` — Baseline modificado en C0.
- `src/main/java/com/sharemechat/content/publishing/SitemapController.java` — Sitemap con namespace de imagen añadido en C5.
