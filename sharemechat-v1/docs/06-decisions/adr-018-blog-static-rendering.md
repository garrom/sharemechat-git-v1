# ADR-018 — Publicación estática del blog público

## Estado

Propuesta (pendiente de aprobación del owner).

Si se aprueba, **supersede parcialmente** la decisión D7 de [ADR-016](./adr-016-content-workflow-simplification-and-retraction.md), que difería sin fecha la publicación estática del blog ("publicación estática a S3+CloudFront se difiere sin fecha. Razón: volumen actual 4 artículos. Sin justificación de coste o latencia.").

## Contexto

Tras el cierre del Frente 3 (workflow editorial simplificado, ADR-016) y la introducción del sistema de snapshots de estado (ADR-017), el blog público de SharemeChat sigue siendo una página dinámica: la SPA carga, hace una llamada `apiFetch('/public/content/articles?size=20')` al backend para el listado y otra `apiFetch('/public/content/articles/{slug}')` para cada artículo.

Este patrón funciona pero tiene **dos limitaciones reales** que se confirman hoy con auditoría runtime sobre el frontend producto y el snapshot v2 del entorno TEST:

### Limitación 1 — Resiliencia frente a caídas del backend

Cuando el backend Spring Boot no está disponible:

- En `/blog`: la SPA carga (CloudFront sirve `index.html` desde S3 sin tocar backend), el hero y la sidebar se ven, pero el listado de artículos muestra "No se pudo cargar el listado: <error>".
- En `/blog/<slug>`: la SPA carga igualmente, navbar y back link aparecen, pero el cuerpo del artículo muestra "Artículo no disponible".

**No es un 502 técnico** — la SPA está viva. Pero es **mala UX para tráfico SEO**. Un visitante que llega desde Google a `/blog/seguridad-en-videochat` y ve "Artículo no disponible" hace bounce inmediato, daña ranking y pierde la oportunidad de captación.

Este problema es estructural en el patrón actual: cualquier ventana de mantenimiento, despliegue, fallo de RDS o caída de la EC2 backend convierte el blog en pantalla de error.

### Limitación 2 — SEO de calidad

El componente `BlogArticleView.jsx` realiza un trabajo SEO serio: meta tags Open Graph, Twitter Card, JSON-LD `Article` con schema.org, canonical link, manejo de retracción ADR-016 con `<meta name="robots" content="noindex">`. Pero **toda esa capa se inyecta post-mount con JavaScript** (los `useEffect` que manipulan `document.head` directamente).

Esto implica que los crawlers que NO ejecutan JavaScript (Bing en algunos modos, agregadores RSS, link previews de WhatsApp/Slack/LinkedIn cuando el remitente es legacy) ven únicamente lo que está en el HTML servido inicialmente, que hoy es:

```html
<title>Sharemechat</title>
<meta name="description" content="Web site created using create-react-app">
```

Es decir, **el SEO real para crawlers no-JS es nulo**. El trabajo del componente es invisible para una porción significativa del ecosistema de bots y agregadores.

### Por qué cambiamos D7 de ADR-016

ADR-016 D7 difirió la publicación estática sin fecha justificándose en el volumen bajo (4 artículos). El razonamiento era: "no hay justificación de coste o latencia". Hoy ese análisis sigue siendo correcto en términos de coste y latencia, pero **omitía dos dimensiones** que ahora pesan más:

1. **Resiliencia** ante caídas del backend (limitación 1).
2. **SEO de calidad** para crawlers no-JS (limitación 2).

A medida que el blog gana relevancia editorial y se acerca PRO con tráfico real, las dos limitaciones se vuelven impedimentos reales, no académicos. Este ADR cierra esa brecha.

## Decisión

### D1 — Adoptar publicación estática del blog público

A partir de la implementación de este ADR, las páginas `/blog` y `/blog/<slug>` se sirven como **HTML estático pre-renderizado** desde S3 vía CloudFront, sin dependencia del backend Spring Boot en tiempo de respuesta.

El backend sigue siendo la fuente de verdad para el contenido editorial (artículos en BD + Markdown crudo en S3 privado). El backend NO se elimina del flujo: se invoca **solo en build-time** cuando se regenera la versión estática.

### D2 — Trigger manual desde backoffice (no automatización post-publish)

La regeneración del blog estático se dispara **manualmente** desde el backoffice o desde un comando local del operador. NO se acopla automáticamente al evento `IN_REVIEW → PUBLISHED` del workflow editorial.

Razones:
- Operación de 1 persona: no hay flujo de revisión paralelo que necesite automatización.
- Volumen bajo: regenerar manualmente tras publicar es asumible.
- Reduce piezas a mantener: no hay listener server-side, ni Lambda, ni webhook.
- Si en el futuro el volumen escala, la automatización es trivial de añadir como evolución.

### D3 — Regeneración completa en cada build (no incremental)

Cada build regenera **todas** las páginas del blog: `/blog` (listado completo) y `/blog/<slug>` para cada artículo en estado `PUBLISHED`. NO se hace regeneración selectiva por artículo modificado.

Razones:
- Volumen bajo: con decenas de artículos el build es trivial en tiempo.
- Simplicidad: cero lógica de invalidación selectiva, cero edge cases sobre cambios de categoría/locale.
- Si el volumen llega a cientos de artículos, evolucionar a build incremental será un cambio acotado y bien definido.

### D4 — Estrategia técnica: pre-render via script + cache behavior dedicado

La implementación combina tres elementos:

**(a) Script de pre-render**
Un script versionado en `ops/scripts/` (nombre tentativo `prerender-blog.ps1`) que:
1. Llama al backend (`GET /api/public/content/articles?size=50`) para enumerar slugs publicados.
2. Para cada slug, llama a `GET /api/public/content/articles/{slug}` para obtener `htmlBody` ya sanitizado por jsoup.
3. Genera HTML completo por página, incluyendo `<head>` con todas las meta tags SEO (description, Open Graph, Twitter Card, JSON-LD, canonical).
4. Escribe los ficheros directamente con keys S3 sin trailing slash y sin `.html`:
    - `blog` (un objeto plano, `Content-Type: text/html`) para `/blog`.
    - `blog/<slug>` (un objeto plano, `Content-Type: text/html`) para `/blog/<slug>`.
5. Sube a S3 con `aws s3 sync` o `aws s3 cp`.
6. Crea invalidación CloudFront sobre los paths `/blog*`.

**(b) Cache behavior dedicado en CloudFront**
Se crea un cache behavior nuevo `/blog*` en la distribución `frontend_public`, apuntando al mismo origen S3 (`sharemechat-frontend-test` para TEST) que el default behavior, pero **sin función edge asociada**. Esto significa:
- La función `redirect-spa-test` (que reescribe URIs sin punto a `/index.html`) NO se ejecuta para `/blog*`.
- CloudFront entrega lo que esté en S3 con la key correspondiente directamente.
- La SPA y el resto del frontend siguen sin cambios.

Cache policy: `Managed-CachingOptimized` o equivalente con TTL razonable (sugerido: 1h public, 1d edge), invalidable bajo demanda.

**(c) Convención de keys S3**
Para cada artículo `<slug>` publicado:
- Key `blog/<slug>` con `Content-Type: text/html; charset=utf-8`.
- Cache-Control: `public, max-age=3600, must-revalidate` (TTL corto en cliente, invalidable en CloudFront).

Para el listado:
- Key `blog` con mismo `Content-Type` y `Cache-Control`.

NO se usa `index.html` dentro de subcarpetas (que requeriría website hosting o reescritura edge). NO se usa extensión `.html` en la URL pública.

### D5 — Coexistencia con la SPA actual durante transición

La SPA actual (`BlogContent.jsx` y `BlogArticleView.jsx`) **NO se elimina** inmediatamente. Razones:

- Es la fuente de verdad funcional mientras se valida la versión estática.
- Permite rollback inmediato (basta con eliminar el cache behavior `/blog*` y CloudFront vuelve a servir la SPA).
- Permite comparar la versión estática contra la dinámica durante la fase de validación.

Una vez la versión estática esté validada en TEST y luego en AUDIT y PRO, se puede deprecar el código JSX del blog si se considera redundante. Esa decisión queda **fuera de alcance** de este ADR.

### D6 — Manejo de retracciones en la versión estática

Cuando un artículo pasa a `RETRACTED`:

1. El siguiente build del blog estático **omite** ese artículo del listado (porque la API ya no lo devuelve).
2. El siguiente build **NO regenera** la página estática del artículo. La página estática anterior sigue en S3.
3. El operador debe **eliminar manualmente** el objeto S3 `blog/<slug>` tras la retracción.
4. CloudFront seguirá sirviendo desde su cache hasta invalidación o expiración natural.

Para que la retracción surta efecto rápido:
- El script de pre-render acepta un modo `--retract <slug>` que elimina el objeto S3 e invalida el path en CloudFront en una sola operación.
- Alternativamente, el script puede leer la BD (vía endpoint que se cree) y borrar automáticamente las keys de slugs RETRACTED durante el build normal. Decisión operativa pendiente.

El comportamiento actual del backend (HTTP 410 Gone con tombstone JSON y `X-Robots-Tag: noindex`) sigue siendo válido como fallback durante la ventana hasta que se regenere el sitio estático. Si por alguna razón un visitante llega a `/blog/<slug-retractado>` antes de que se haya borrado la key estática, CloudFront sirve el HTML viejo. Esto es deuda asumida durante la ventana entre retracción y regeneración.

### D7 — Qué se incluye en el HTML pre-renderizado

Cada página estática del blog debe contener, completamente renderizado en el HTML servido (no inyectado por JS):

- `<title>` con título del artículo.
- `<meta name="description">` con brief truncado.
- `<link rel="canonical">` apuntando a la URL pública absoluta.
- Meta tags Open Graph: `og:type`, `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale`.
- Meta tags Twitter Card.
- Bloque JSON-LD `Article` con schema.org completo (incluye `datePublished`, `dateModified`, `inLanguage`, `author`, `publisher`).
- Cuerpo del artículo (`htmlBody` ya sanitizado por jsoup) dentro del shell del sitio.

La SPA puede seguir hidratando sobre el HTML pre-renderizado para mantener interactividad (navbar, navegación interna), pero el HTML servido sin JS ya es funcionalmente completo para lectura y SEO.

### D8 — Configuración de URL canónica desde el backend

El script de pre-render lee la URL pública canónica de la propiedad `app.public.base-url` del backend (vía endpoint o vía variable de entorno explícita). NO usa `window.location.origin` (que es lo que hace el componente JSX actual y queda vacío en build-time sin browser real).

Esto requiere coordinación: el backend debe exponer la propiedad de manera consultable o el operador debe pasarla explícitamente al script.

## Consecuencias

### Positivas

- **Resiliencia total ante caídas del backend** para tráfico de blog. CloudFront sigue sirviendo el HTML cacheado y los objetos S3 sin ninguna dependencia de la EC2 ni de la BD.
- **SEO completo en HTML servido**: meta tags y JSON-LD presentes desde el primer byte, sin requerir ejecución JS por parte del crawler.
- **Sin cambios al código JSX existente**: la SPA sigue funcionando idéntica para todo lo demás, y como fallback si algo falla con el pre-render.
- **Sin tocar la función edge `redirect-spa-test`**: cero riesgo de regresión sobre la SPA general.
- **Reutilizable**: el mismo patrón aplicará a AUDIT y PRO cuando se nivelen.

### Negativas

- **Latencia editorial**: tras publicar/retractar un artículo, el operador debe ejecutar el script para que la versión estática se actualice. Hasta entonces, el sitio estático refleja el estado anterior. Riesgo bajo para volumen de 1-persona y publicación esporádica.
- **Coordinación de URL canónica**: hay que asegurar que `app.public.base-url` está accesible al script en build-time. Pequeña dependencia operativa.
- **Riesgo de divergencia entre estática y SPA**: durante la transición, la SPA seguirá leyendo la API en vivo mientras el HTML estático es snapshot. Para evitar inconsistencias percibidas, los TTLs de CloudFront para `/blog*` deben ser razonables (no 1 año immutable como el bundle JS).
- **Olvido operativo en retracción**: si el operador olvida eliminar manualmente el objeto S3 tras retractar, la página estática sigue accesible. Mitigación: el script `--retract <slug>` automatiza este paso.
- **Tres pasos distintos para desplegar tras publicar**: build SPA + build admin + pre-render blog. Aceptable para volumen actual, pero merece runbook claro.

### Neutras

- **Coexistencia con la SPA**: durante un periodo no determinado ambos caminos están activos. La decisión de deprecar el código JSX del blog es independiente y se toma cuando haya confianza suficiente.
- **Backoffice no necesita cambios obligatorios**: el script de pre-render se puede ejecutar desde local. Si en el futuro se quiere botón "Regenerar blog" en el admin, será una mejora UX, no un requisito.

## Plan de implementación

1. **Aprobación de este ADR** por el owner.
2. **Validación previa** del comportamiento `redirect-spa-test`: confirmar con prueba manual que un objeto S3 con key `blog/test-page` y `Content-Type: text/html` se sirve correctamente al request `GET https://test.sharemechat.com/blog/test-page` SI hay un cache behavior `/blog*` que evita la función edge. Esta validación es 30 minutos en TEST con un fichero dummy.
3. **Crear cache behavior `/blog*`** en la distribución `frontend_public` de TEST. Sin función asociada. Misma origin que el default. TTL inicial: 0 para validación rápida, después subir a 1h.
4. **Script de pre-render v1**:
    - Leer slugs publicados.
    - Generar HTML con plantilla mínima (head completo + body con `htmlBody` + shell del sitio).
    - Subir a S3.
    - Invalidar CloudFront.
    - Modo `--retract <slug>`.
5. **Validación end-to-end en TEST** con los 2 artículos PUBLISHED actuales (`videochat-seguro-guia` y `pagos-modelos-plataformas`):
    - Ejecutar script.
    - Verificar `curl https://test.sharemechat.com/blog/videochat-seguro-guia` devuelve HTML completo con meta tags y body.
    - Verificar que `apagar backend` + recargar `/blog` sigue funcionando (resiliencia).
    - Verificar que un crawler simulado (`curl -A "Googlebot"`) ve todo el contenido en HTML directo.
6. **Replicar a AUDIT** una vez validado en TEST.
7. **Replicar a PRO** como parte del despliegue PRO con tráfico real.
8. **Decidir más adelante** si se deprecan `BlogContent.jsx` y `BlogArticleView.jsx` o se mantienen como fallback. Decisión fuera de alcance de este ADR.

## Decisiones explícitamente fuera de alcance

Este ADR **no decide** sobre:

- Diseño concreto del shell HTML que envuelve el `htmlBody` (templating). Eso es trabajo del script de pre-render.
- Si se añade campo `heroImageUrl` al DTO público para tener `og:image` real (TODO ya identificado en el código actual).
- Si se elimina el componente JSX del blog tras la consolidación de la versión estática.
- Si se introduce un campo `lastBuiltAt` o similar para diagnóstico.
- Si se automatiza el trigger desde backoffice (botón "Regenerar blog"). Posible mejora futura.
- Si se introduce SSG framework (Next.js, Astro). Este ADR opta deliberadamente por mantener CRA + script ad-hoc por simplicidad.

## Referencias

- ADR-016 — Workflow editorial simplificado y retracción (deuda D7 que este ADR resuelve).
- ADR-017 — Coexistencia de snapshots de estado y documentación narrativa (define cómo este ADR cierra alcance arquitectónico, no operativo).
- `docs/_snapshots/state-test-2026-05-09-1659.yaml` — Snapshot v2 que confirma topología real de TEST (4 distribuciones, 5 buckets, función edge).
- `frontend/src/pages/blog/BlogContent.jsx` — Componente actual del listado, dependiente de backend.
- `frontend/src/pages/blog/BlogArticleView.jsx` — Componente actual del detalle, dependiente de backend.
- `src/main/java/com/sharemechat/content/publishing/ContentPublicController.java` — API pública del blog.
- `ops/scripts/deploy-frontend.ps1` — Script de deploy del frontend producto/admin (referencia de patrón para `prerender-blog.ps1`).
