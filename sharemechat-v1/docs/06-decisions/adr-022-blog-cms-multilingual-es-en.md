# ADR-022 — Blog y CMS multilingüe ES + EN (post-ADR-020)

## Estado

Aceptada (2026-05-13).

Aplicabilidad: blog público, CMS interno, pipeline editorial asistido por IA. Decisión arquitectónica que define el modelo multilingüe nativo del blog para alcanzar simultáneamente mercado hispanohablante y mercado anglosajón con SEO bien indexado. Complementa a [ADR-019](./adr-019-blog-spa-react.md) (servicio del blog desde la SPA), [ADR-020](./adr-020-blog-spa-seo.md) (SEO industrial en la SPA) y [ADR-010](./adr-010-internal-content-cms-ai-assisted-workflow.md) (CMS interno con pipeline IA). No supersede ninguno: amplía el alcance del blog y del pipeline a múltiples locales.

## Contexto

El blog público de SharemeChat tras [ADR-020](./adr-020-blog-spa-seo.md) es **monolingüe en español**:

- Las tres páginas frontend del blog (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`) renderizan textos en español (chrome y artículos).
- El campo `locale` del modelo `ContentArticle` existe en BD pero hoy todos los artículos PUBLISHED están con `locale=es`.
- El sitemap, JSON-LD y meta tags en cliente emiten `inLanguage="es-ES"`, `og:locale="es_ES"`, hreflang `es-ES` + `x-default` apuntando a la misma URL (preparación documentada en C3 de ADR-020).
- El pipeline editorial IA (skills `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `cms-json-builder`, `sharemechat-voice`) produce artículos en español únicamente.

El mercado objetivo declarado para PRO es **Europa + EEUU**. Con la situación actual:

- Google indexa los artículos como contenido `es-ES`. En EEUU compiten contra contenido nativo en inglés y quedan relegados como contenido extranjero, independientemente de su calidad editorial.
- El mercado anglosajón queda fuera del alcance SEO orgánico. Cualquier inversión en marketing en EEUU debe absorber la fricción de servir contenido en español a una audiencia que busca en inglés.
- El campo `locale` en BD anticipa multilingüismo, pero ni el frontend, ni el routing, ni el sitemap, ni el pipeline tienen el resto del andamiaje para soportar varias versiones de un mismo artículo.

La pregunta arquitectónica es: **¿cómo soportar contenido nativo en varios locales (empezando por es y en) con SEO bien indexado en cada mercado, manteniendo simple la pipeline editorial?**

Decisiones laterales que condicionan esta:

- `/legal` está hardcoded en inglés (deuda registrada en `known-debt.md` 2026-05-12). No se interna­cionaliza aquí; se mantiene como status quo.
- El chrome de la SPA (login, dashboards, videochat) tiene i18n parcial vía `react-i18next` ([ADR-006](./adr-006-shared-i18n-strategy-product-backoffice.md)) pero el blog no está internalizado (deuda registrada en `known-debt.md` 2026-05-12).
- El pipeline editorial está plenamente operativo en ES con 3 artículos PUBLISHED tras Sub-pasada 2B.

## Opciones consideradas

### Opción A — Status quo (solo ES + chrome i18n del blog)

Mantener el contenido editorial solo en español. Internacionalizar únicamente las cadenas de chrome (cabeceras, labels, mensajes) del blog vía `react-i18next` para que la marca presente coherencia ante visitantes anglófonos, pero los artículos siguen siendo solo en ES.

Pros:
- Cero cambios en BD, sitemap ni pipeline editorial.
- Coste de implementación mínimo (sub-pasada de i18n acotada al chrome).

Contras:
- No resuelve el problema real: el **contenido** sigue siendo solo ES. Google no encuentra artículos en inglés que indexar en mercado anglosajón.
- La fricción para usuarios anglófonos sigue intacta: pueden navegar el chrome pero los artículos están en español.
- Marketing en EEUU sigue siendo caro: tráfico que llega rebota.

Descartada. Resuelve solo la cosmética sin tocar el problema SEO de fondo.

### Opción B — Artículos independientes por locale (sin grupos ni hreflang)

Publicar artículos en EN como entradas independientes del CMS, sin vínculo formal con sus homólogos en ES. Cada uno con su slug y URL propios. Sin `hreflang`, sin `group_id`, sin DTO de `alternates`.

Pros:
- Modelo de BD prácticamente sin cambios: bastaría con que `locale` se use de verdad.
- Operativa editorial flexible: cada locale evoluciona a su ritmo, sin obligación de mantener paridad.

Contras:
- **Canibalización SEO**: dos artículos sobre el mismo tema (uno ES, uno EN) compiten entre sí en Google sin que el motor sepa que son traducciones. Google puede tratarlos como contenido duplicado parcial, dispersar señales de autoridad o indexar solo uno de los dos.
- Sin `hreflang`, Google no puede asignar la versión correcta al mercado correcto. Un usuario de EEUU buscando en inglés podría aterrizar en la versión ES por su mayor antigüedad, sin redirect ni sugerencia.
- Pérdida de coherencia editorial: las versiones divergen con el tiempo, las correcciones se aplican solo en una, no hay forma operativa de auditar la paridad.

Descartada. Resuelve la presencia de contenido EN pero introduce un problema SEO mayor que el que pretende resolver.

### Opción C — Multilingüe nativo con grupos y hreflang (elegida)

Cada artículo "lógico" se materializa como **un grupo** de filas en `content_articles`, una por locale, vinculadas por un campo `group_id` (UUID). Las URLs llevan prefijo `/en/` para el locale no-default (`/blog/<slug>` para ES, `/en/blog/<slug>` para EN). El backend emite `hreflang` en el sitemap y en el DTO público (campo `alternates`); el frontend lo materializa como `<link rel="alternate" hreflang="...">` por cada locale del grupo.

Pros:
- Google entiende las versiones como traducciones vinculadas vía `hreflang`. Cada locale indexa nativamente en su mercado. Cero canibalización.
- Modelo de BD simple: una tabla + un UUID. No requiere tabla `content_groups` separada.
- Extensible: añadir un cuarto locale (fr/de/it) es operativamente incremental, sin cambios estructurales en BD ni en el contrato de la API.
- Pipeline editorial cohesionado: las versiones derivan de un ES revisado, garantizando paridad de hechos y editorial.

Contras:
- Doble coste editorial inicial: cada artículo nuevo genera dos versiones.
- Mantenimiento de paridad cuando se edita ES después de publicar EN (deuda explícita, política a definir).
- Slugs por locale exigen disciplina editorial: la traducción literal del slug ES rara vez es óptima para SEO en EN.

Elegida.

## Decisión

Adoptar la Opción C con las decisiones operativas concretas listadas abajo. Implementación planificada en seis fases (4A-4F) descritas en la sección Impacto.

### Decisiones de mercado

- **Mercado objetivo PRO**: Europa + EEUU.
- **Locales soportados al lanzar**: `es` (default) y `en`. `fr`, `de` e `it` pospuestos hasta que haya tracción real que justifique el coste editorial; añadirlos será incremental gracias al modelo elegido.

### Decisiones de URLs y SEO

- **Slugs distintos por locale**: cada versión tiene el slug óptimo SEO en su idioma, no la traducción literal del otro. Ejemplo: ES `elegir-videochat-seguro` / EN `how-to-choose-safe-videochat`. La decisión refleja que las keywords objetivo difieren por mercado y que un slug literal traducido tiende a ser inferior al slug pensado para SEO del locale destino.
- **Prefijo URL por locale**:
  - `es` (default) sin prefijo: `/blog`, `/blog/<slug>`.
  - `en` con prefijo: `/en/blog`, `/en/blog/<slug>`.
  - Esquema extensible: futuros locales heredan el mismo patrón (`/fr/blog`, etc.).
- **Hreflang industrial**: emitido por el backend en `sitemap.xml` (con `xhtml:link` por cada `alternate`) y por el frontend en el `<head>` (`<link rel="alternate" hreflang="es-ES">`, `hreflang="en-US">`, `hreflang="x-default">`). El mapeo entre versiones se resuelve consultando `group_id` en el backend; el DTO público lo materializa para el cliente.

### Decisiones de detección y UX

- **Detección de locale por defecto**: el frontend leerá `navigator.language` para decidir el locale inicial cuando el usuario entra a una ruta neutra, **sin** redirección automática. La URL es la fuente de verdad: si entra a `/blog/...`, ve la versión ES aunque su navegador esté en inglés.
- **Switcher manual** en el chrome del blog para cambiar de locale en cualquier momento; mueve al usuario al equivalente del grupo si existe (consultando `alternates` del DTO), o a la home del locale destino si no.
- **Banner sugerente**: si `navigator.language` empieza por `en` pero el locale activo es `es` (y existe versión EN en el grupo), mostrar un banner discreto del tipo *"This content is available in English"* con CTA *"[Switch]"*. Sin auto-redirect; respeta la URL escrita.

### Decisiones de pipeline editorial

- **Generación EN deriva de ES revisado**: la versión EN no se redacta desde cero ni desde el research. Se traduce desde el ES ya pulido y aprobado (`04_review/reviewed.md` en la convención del pipeline) por una skill IA dedicada (`cms-translate-en`) y se pasa por revisión editorial humana antes de publicar.
- **Migración de los 3 artículos ya PUBLISHED**: se ajustan a la nueva estructura de BD (`group_id` UUID asignado, `locale=es` confirmado). Sus versiones EN se generan después, en la fase 4D.
- **Mismo run del pipeline genera ambas versiones**: el flujo orquestado produce `final_es.json` + `final_en.json` en una única ejecución cuando se quiere ambas. Si se quiere publicar solo ES, el operador omite la versión EN al subir al CMS. El pipeline no fuerza paridad.

### Decisiones de BD

- **Una sola tabla `content_articles`** ampliada con una columna `group_id` (UUID, NOT NULL después de la migración inicial). Modelo simple: cada fila sigue siendo "un artículo en un locale concreto".
- **`group_id` es UUID independiente**, no el id del primer artículo del grupo. Esto desacopla el grupo de la fila individual y evita problemas si en el futuro se borra el "primer" artículo del grupo.
- **Constraint `UNIQUE (slug, locale)`** sustituye al `UNIQUE` global de `slug` actual. Permite que ES y EN tengan slugs distintos sin colisión, y permite (raramente) que un slug coincida entre locales si es la elección óptima SEO.
- Tabla `content_groups` separada **descartada** por sobre-ingeniería: el grupo es solo un identificador compartido; añadir metadatos al grupo se hace cuando hagan falta.

### Decisiones de backend

- **Endpoints públicos sin cambios de URL**: los mismos endpoints (`/api/public/content/articles`, `/api/public/content/articles/{slug}`) ganan un parámetro `locale` opcional con default `es`. Ejemplo: `GET /api/public/content/articles?locale=en&size=50`. El detalle por slug resuelve con `(slug, locale)`.
- **DTO público gana campo `alternates`**: lista de `{ locale, slug, url }` por cada artículo del grupo (excluyendo el propio). El frontend lo usa para emitir `<link rel="alternate" hreflang>`. El backend lo construye consultando `content_articles WHERE group_id = ? AND status = 'PUBLISHED'`.
- **Sitemap con `xhtml:link`**: el `SitemapController` emite un bloque `<xhtml:link rel="alternate" hreflang="...">` por cada locale del grupo dentro de cada `<url>`. Namespace `xmlns:xhtml="http://www.w3.org/1999/xhtml"` añadido al `<urlset>`. El sitemap sigue siendo único (no se split por locale en esta fase).

### Decisiones de frontend

- **Routing con basename condicional**:
  - Si el locale activo es `es` → `<BrowserRouter basename="/">`.
  - Si el locale activo es `en` → `<BrowserRouter basename="/en">`.
- Los componentes internos del blog mantienen sus rutas semánticas (`/blog`, `/blog/<slug>`). El basename los re-monta bajo el prefijo correcto sin que cada componente conozca el locale activo.
- **Chrome del blog internacionalizado**: las ~30-50 cadenas de chrome del blog (sidebar, cards, share row, mensajes de empty/error, etc.) pasan por `react-i18next` ([ADR-006](./adr-006-shared-i18n-strategy-product-backoffice.md)) con dos namespaces: `blog.es.json` y `blog.en.json`. Cierra parcialmente la deuda registrada en `known-debt.md` 2026-05-12.

### Decisiones de pipeline IA (skills de Claude.ai)

- **Skill nueva `cms-translate-en`**: lee `04_review/reviewed.md` (versión ES revisada y aprobada por el flujo de polish + brand-legal-review) y produce `04_review/reviewed_en.md`. Traduce contenido, **ajusta keywords y slug** para SEO anglosajón (no traducción literal), respeta la voz de marca ([sharemechat-voice](../../.claude/skills/anthropic-skills/sharemechat-voice) cuando la versión EN del prompt esté disponible) y no altera hechos ni estructura.
- **Skill modificada `cms-json-builder`**: cuando existan ambos `reviewed.md` y `reviewed_en.md`, genera dos JSON (`final_es.json` y `final_en.json`) con el mismo `group_id` UUID, en una sola ejecución. Si solo existe `reviewed.md`, mantiene el comportamiento actual (un único JSON con `locale=es`).
- **Resto de skills sin cambios**: `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review` siguen operando solo en ES (la EN deriva del ES pulido, no se redacta independientemente).

### Decisiones operativas

- **`/legal` queda en inglés hardcoded** (status quo). Cualquier ruta `/en/legal` se resuelve mediante redirect permanente (301) a `/legal` para coherencia URL y evitar duplicación SEO.
- **Plan de fases 4A-4F** (ver sección Impacto). Cada fase es desplegable y validable de forma aislada, siguiendo el patrón establecido en ADR-020 (commits pequeños, sin big bang).

## Justificación

La pregunta central es por qué Opción C frente a A y B:

- **Frente a Opción A (status quo + chrome i18n)**: A no resuelve el problema. El contenido sigue siendo ES y el SEO anglosajón sigue ausente. Internacionalizar el chrome sin contenido en EN sería esfuerzo invertido en una solución cosmética.
- **Frente a Opción B (artículos independientes)**: B introduce un problema mayor (canibalización SEO, divergencia editorial) que el que evita (simplicidad del modelo). El coste de añadir `group_id` UUID + `alternates` al DTO es bajo; el beneficio (Google entiende las versiones correctamente) es alto.

Sobre las decisiones internas de Opción C:

- **Slugs distintos por locale**: porque las keywords SEO óptimas en cada idioma rara vez son traducciones literales. Forzar paridad de slug perjudica el SEO del locale no-default. El coste es disciplina editorial; la skill `cms-translate-en` lo absorbe.
- **Prefijo `/en/` y no `/es/`**: priorizar la URL más corta para el locale default minimiza el impacto sobre URLs existentes y SEO ya ganado. Las 3 URLs ES actuales (`/blog/<slug>` × 3) no cambian. Si en el futuro Google muestra preferencia por `/es/` explícito para consistencia, se reabre la conversación con redirects 301 (alternativa documentada en Notas).
- **`group_id` UUID vs id del primer artículo**: un UUID independiente desacopla el grupo de cualquier fila individual. Si en el futuro se borra el "primer" artículo o se reordenan los locales, el grupo persiste.
- **Pipeline EN deriva de ES revisado, no del research**: la calidad editorial se concentra en el ES (que pasa por research → draft → polish → brand-legal-review). La traducción IA + revisión humana es más barata que ejecutar el pipeline completo dos veces y garantiza coherencia de hechos y voz entre versiones.
- **Mismo run produce ambos JSON**: minimiza la fricción operativa. El operador no tiene que decidir "primero ES, luego EN dos semanas después"; produce ambos en una sesión, revisa el EN, y publica cuando esté listo.

La iteración fase por fase replica el modelo de ADR-020: cada fase desplegable y validable, sin big bang, con rollback granular.

## Impacto

Plan de implementación en seis fases (4A-4F). Cada fase es un conjunto de commits cohesionados, desplegable y validable de forma independiente. Las estimaciones son órdenes de magnitud, no compromisos contractuales.

### 4A — Migración BD + backend

- `ALTER TABLE content_articles ADD COLUMN group_id BINARY(16) NULL` (o el tipo UUID nativo del schema actual).
- `UPDATE content_articles SET group_id = UUID()` para los artículos existentes; cada artículo recibe un UUID propio (al no haber versiones EN aún, cada fila es su propio grupo).
- `ALTER TABLE content_articles MODIFY group_id BINARY(16) NOT NULL` tras el backfill.
- `DROP INDEX uq_slug ON content_articles` (si existe como tal) y `CREATE UNIQUE INDEX uq_slug_locale ON content_articles (slug, locale)`.
- Entity `ContentArticle.java` gana campo `groupId` con `@Column(name="group_id")`.
- DTOs públicos (`ArticlePublicSummaryDTO`, `ArticlePublicDetailDTO`) ganan campo `alternates: List<AlternateRefDTO>`.
- Controllers públicos aceptan `@RequestParam(required = false, defaultValue = "es") String locale` en `/api/public/content/articles` y resuelven `/api/public/content/articles/{slug}?locale=en`.
- Migración Flyway versionada en `db/migration/`.

**Coste estimado**: ~1 sesión.

### 4B — Frontend routing + chrome i18n

- `App.js` configura `<BrowserRouter basename={locale === 'en' ? '/en' : '/'}>` con `locale` resuelto desde URL (`/en/...` → `en`) o desde `navigator.language` + persistencia en `localStorage`.
- `App.js` registra la ruta `/legal` redirect permanente desde `/en/legal` a `/legal`.
- Extracción de las ~30-50 strings de chrome del blog a `blog.es.json` y `blog.en.json` consumidos vía `react-i18next` ([ADR-006](./adr-006-shared-i18n-strategy-product-backoffice.md)).
- Componentes del blog (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`) leen `t('blog.sidebar.search.placeholder')` etc.

**Coste estimado**: 1-2 sesiones.

### 4C — Pipeline IA: skill `cms-translate-en` y ajustes en `cms-json-builder`

- Creación de la skill `cms-translate-en` con el prompt operativo (lee `04_review/reviewed.md`, traduce respetando voz/marca, ajusta keywords y slug para SEO anglosajón, escribe `04_review/reviewed_en.md`).
- Modificación de `cms-json-builder` para detectar la presencia de `reviewed_en.md` y emitir `final_es.json` + `final_en.json` con el mismo `group_id` UUID generado en el run.

**Coste estimado**: ~1 sesión.

### 4D — Generación EN para los 3 artículos PUBLISHED

- Ejecutar el pipeline (o solo `cms-translate-en` + `cms-json-builder`) sobre el ES revisado de cada artículo existente.
- Revisar manualmente cada `reviewed_en.md`.
- Subir al CMS las tres versiones EN, vinculadas al `group_id` UUID correspondiente.

**Coste estimado**: ~1 día operativo editorial.

### 4E — Sitemap + hreflang en backend y frontend

- `SitemapController` añade namespace `xmlns:xhtml` al `<urlset>` y emite `<xhtml:link rel="alternate" hreflang="...">` por cada locale del grupo dentro de cada `<url>`.
- `seoHelpers.js` (frontend) emite `<link rel="alternate" hreflang>` por cada `alternates[i]` del DTO actual, incluido `hreflang="x-default"`.
- Cleanup adaptado al nuevo modelo.

**Coste estimado**: ~1 sesión.

### 4F — Banner sugerente y switcher manual

- Detección de mismatch entre `navigator.language` y locale activo.
- Componente banner con CTA `[Switch]` que ejecuta la navegación al equivalente del grupo.
- Switcher manual en el chrome del blog (header o sidebar), siempre disponible.
- Persistencia de preferencia en `localStorage` para no volver a sugerir tras descartar.

**Coste estimado**: ~1 sesión.

**Total estimado del plan completo (4A-4F)**: ~3-4 semanas de trabajo enfocado, asumiendo paralelización razonable entre fases backend y fases frontend.

### Impacto resumido por capa

- **BD**: 1 migración Flyway con `ALTER TABLE` + backfill + cambio de constraint. Reversible (drop column + restore unique).
- **Backend**: 1 entity, 2 DTOs, 2 controllers, 1 sitemap controller. Cero dependencias nuevas.
- **Frontend**: routing (`App.js`), 3 componentes de blog (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`), módulo `seoHelpers.js`, 2 archivos i18n nuevos (`blog.es.json`, `blog.en.json`).
- **Pipeline IA**: 1 skill nueva (`cms-translate-en`), 1 skill modificada (`cms-json-builder`).
- **Operaciones**: 1 día editorial de migración EN; sin cambios en deploy/runbooks fuera del flujo Flyway estándar.

## Consecuencias

### Positivas

- **SEO máxima cobertura**: Google indexa cada versión en su mercado nativo. ES gana visibilidad en mercado hispanohablante; EN gana visibilidad en mercado anglosajón. `hreflang` evita penalización por contenido duplicado o canibalización entre versiones.
- **Arquitectura extensible**: añadir un cuarto locale (fr/de/it) es estrictamente incremental: una columna `locale` ya existe, un `group_id` por grupo ya existe, slugs por locale ya están desacoplados, sitemap ya emite multi-locale. La sub-pasada para añadir un cuarto locale se reduce a generar contenido y registrar el nuevo prefijo URL.
- **`/legal` queda sin deuda nueva**: la decisión operativa de mantenerlo en EN hardcoded con redirect 301 desde `/en/legal` mantiene el status quo sin introducir complejidad ahora ni bloquear una sub-pasada futura de i18n del legal.
- **Pipeline editorial cohesionado**: la versión EN deriva del ES pulido, garantizando paridad de hechos y voz. La traducción IA + revisión humana es operativamente más barata que dos pipelines independientes.
- **DTO con `alternates` reutilizable**: el campo `alternates` no es solo para hreflang; el switcher manual y el banner sugerente lo consumen también. Una sola estructura sirve para tres usos.

### Negativas / aceptadas

- **Doble coste editorial por artículo nuevo**: cada artículo en ES requiere generar también su versión EN si se quiere paridad de mercados. Mitigado por el pipeline IA (la traducción es mucho más barata que la redacción).
- **Mantenimiento de paridad ES↔EN**: si se edita la versión ES tras publicar EN, la EN no se sincroniza automáticamente. Queda como deuda explícita: la política (sincronizar siempre, sincronizar bajo demanda, marcar EN como "obsoleta" cuando ES diverge, etc.) se decide en sub-pasada futura.
- **Calidad de traducción IA es variable**: si la IA traduce mal o pierde matices de voz, la revisión humana de 4D / publicaciones nuevas absorbe el coste. Riesgo manejable mientras el operador revise sistemáticamente.
- **URLs ES privilegiadas**: el locale default sin prefijo (`/blog/...`) es asimétrico con EN (`/en/blog/...`). Coherente con el principio de minimizar disrupción sobre URLs ya indexadas, pero puede crear percepción de "ES es el default real" frente a EN como "ciudadano de segunda". Si SEO o producto piden simetría (`/es/blog/...` + `/en/blog/...`) en el futuro, hay un coste de redirects 301 y posible pérdida temporal de ranking.
- **Slugs distintos por locale duplican trabajo SEO**: el operador (o la skill `cms-translate-en`) debe pensar dos slugs óptimos por artículo, no uno traducido. Mitigado por la skill; persistente como disciplina editorial.

### Trade-offs

- **Una tabla + `group_id` vs tabla `content_groups` separada**: se renuncia a metadatos por grupo (descripción del grupo, autor del grupo, etc.) a cambio de simplicidad del modelo. Si en el futuro el grupo necesita metadatos propios, se introduce la tabla `content_groups` como evolución no breaking (el `group_id` actual pasa a ser FK).
- **Pipeline IA traduce vs redacta**: se renuncia a redactar EN desde el research (que podría dar artículos mejor calibrados al mercado EN desde el principio) a cambio de coherencia editorial y coste. Si la calidad EN se vuelve problema en producción, se reabre la conversación (alternativa documentada en Notas).
- **`/en/` prefix vs subdominio (`en.sharemechat.com`)**: se renuncia a la separación de dominio (que daría posibilidad de hosting independiente, reputación SMTP separada, etc.) a cambio de un único certificado, una única distribución CloudFront y URLs internamente consistentes. Si en el futuro escalar a varios dominios geográficos aporta valor, se reabre.

## Notas

### Notas operativas

- **El pipeline editorial actual sigue siendo la fuente única de verdad**. EN deriva de ES revisado, no es un pipeline paralelo. Toda decisión editorial (hechos, voz, estructura) se toma en ES.
- **Revisión humana de la versión EN antes de publicar** es obligatoria. La skill `cms-translate-en` produce un draft; nunca se publica EN sin pasada humana.
- **El backoffice admin del CMS deberá mostrar artículos agrupados por `group_id`** en lugar de filas individuales (sub-pasada incluida en 4B o 4D, según ergonomía). Si no se hace, el operador ve duplicados confusos en el listado.
- **`/legal` queda fuera del alcance** de este ADR. Hardcoded EN, sin cambios. Cualquier `/en/legal` redirect 301 a `/legal`. Sub-pasada de i18n para `/legal` queda como deuda registrada en `known-debt.md`.
- **Migración BD**: la columna `group_id` debe pasar por una transición NULL → NOT NULL con backfill en medio. En TEST se opera manualmente. En PRO se aplicará por Flyway estándar.

### Alternativas futuras consideradas

- **Generación EN paralela desde el research** (no derivada del ES): rechazada por coste y por la pérdida de coherencia editorial entre versiones. Si en el futuro la calidad de traducción IA se vuelve un problema sistemático, reconsiderar este modelo.
- **`/es/` explícito** para simetría URL con `/en/`: rechazada por el coste de redirects 301 sobre las URLs ES ya indexadas y por la disrupción SEO temporal. Si SEO o métricas de producto muestran que la simetría es necesaria, reconsiderar con plan de migración cuidado.
- **Locales adicionales `fr`, `de`, `it` para PRO**: pospuestos hasta tracción real. El modelo elegido los soporta sin cambios estructurales; añadirlos es estrictamente operativo (contenido + un prefijo URL más).
- **Subdominio por locale** (`en.sharemechat.com`): rechazada por sobreingeniería actual. Reconsiderar si en el futuro hace falta hosting independiente por geografía.
- **Generación EN automática en publicación** (sin revisión humana): rechazada. Riesgo editorial inaceptable; la calidad IA todavía requiere ojo humano para garantizar voz y precisión.

### Deuda registrada

Las siguientes deudas quedan abiertas tras este ADR y se irán resolviendo en sub-pasadas dedicadas o en el curso natural del proyecto:

- **Política de sincronización ES→EN cuando se edita ES**: pendiente. Opciones a evaluar: sincronización automática vía pipeline, marca "outdated" en EN cuando ES diverge, sincronización manual bajo demanda.
- **`/legal` en español**: pendiente futura sub-pasada de i18n del legal. Coordinada con asesoría jurídica para validar equivalencia entre versiones.
- **Sitemap split por locale** (subsitemaps `sitemap-es.xml` + `sitemap-en.xml` referenciados desde `sitemap-index.xml`): pendiente si el volumen lo justifica. Hoy un único `sitemap.xml` con `xhtml:link` es suficiente.
- **Banner sugerente con IP geo**: la fase 4F usa `navigator.language` que es el dato del navegador. Si en el futuro queremos detección por geolocalización IP (ej. usuario en EEUU con navegador en ES porque cambió de país), reconsiderar con un servicio de IP geo.
- **Switcher manual de locale visible siempre**: la fase 4F lo coloca en el chrome del blog. Si se decide ponerlo también en el chrome global del sitio (footer, header), sub-pasada cosmética.
- **AdminAdministrationPanel.jsx** y otras superficies del backoffice no contemplan grupos. Si la operativa editorial lo requiere, sub-pasada de UI admin.
- **Tests automatizados de paridad de grupos**: cuando exista suite E2E, añadir tests que verifiquen que cada `group_id` tiene al menos un artículo en estado coherente.

## Referencias

- [ADR-019](./adr-019-blog-spa-react.md) — Blog servido desde SPA React. ADR-022 amplía el alcance del modelo SPA a multilingüe sin cambiar la decisión de servirlo desde React.
- [ADR-020](./adr-020-blog-spa-seo.md) — SEO industrial en SPA del blog. ADR-022 reabre el `SitemapController` (4E) y `seoHelpers.js` (4E) para emitir `hreflang` real con `alternates`, sustituyendo el `hreflang="es-ES" + x-default"` apuntando a la misma URL preparado en C3.
- [ADR-021](./adr-021-email-tag-routing.md) — Trazabilidad operativa de emails con alias +tag. Sin relación funcional, pero comparte plantilla estructural con ADR-022.
- [ADR-010](./adr-010-internal-content-cms-ai-assisted-workflow.md) — CMS interno con pipeline IA. ADR-022 amplía el pipeline con la skill `cms-translate-en` y ajusta `cms-json-builder` para emitir dos JSON.
- [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md) — Workflow editorial simplificado (DRAFT → IN_REVIEW → PUBLISHED → RETRACTED). El workflow se aplica por locale: cada versión transiciona independientemente.
- [ADR-006](./adr-006-shared-i18n-strategy-product-backoffice.md) — Estrategia i18n compartida entre product y backoffice. ADR-022 consume la misma librería (`react-i18next`) y patrón de namespaces para internacionalizar el chrome del blog.
- [ADR-017](./adr-017-state-snapshots-and-docs-coexistence.md) — Coexistencia de snapshots y documentación narrativa. Patrón aplicado al planificar las fases 4A-4F.
- Skills Claude.ai relacionadas: `cms-research-seo`, `cms-draft-writer`, `cms-editorial-polish`, `cms-brand-legal-review`, `cms-json-builder`, `sharemechat-voice`, más la nueva `cms-translate-en` introducida por este ADR.
- `src/main/java/com/sharemechat/content/entity/ContentArticle.java` — Entity a ampliar con `groupId` (4A).
- `src/main/java/com/sharemechat/content/publishing/ArticlePublicSummaryDTO.java` y `ArticlePublicDetailDTO.java` — DTOs a ampliar con `alternates` (4A).
- `src/main/java/com/sharemechat/content/publishing/ContentPublicController.java` — Controllers a ampliar con parámetro `locale` (4A).
- `src/main/java/com/sharemechat/content/publishing/SitemapController.java` — Sitemap a ampliar con `xhtml:link` por locale (4E).
- `frontend/src/App.js` — Routing con `basename` condicional + redirect `/en/legal` → `/legal` (4B).
- `frontend/src/pages/blog/Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx` — Componentes a internacionalizar en chrome (4B).
- `frontend/src/pages/blog/seoHelpers.js` — Emisión de `<link rel="alternate" hreflang>` por cada `alternates[i]` (4E).
- `docs/04-operations/known-debt.md` — Bloque del 2026-05-12, deudas "Blog SPA hardcoded en español sin i18n" y "/legal hardcoded en inglés sin i18n" parcialmente referenciadas por este ADR.
