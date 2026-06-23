# SEO pre-render analysis 2026-06-21

> Análisis técnico independiente del plan del asesor para resolver el bug crítico de indexación documentado en [`seo-baseline-snapshot-2026-06-21.md`](seo-baseline-snapshot-2026-06-21.md) sección 7.
>
> Modo lectura + WebSearch. Sin modificaciones al código. Sin instalación de dependencias.

## 1. Resumen ejecutivo y veredicto

**El plan del asesor es viable en su forma general (pre-render selectivo SOLO para `/blog/*` ejecutado en el deploy PROD), pero la herramienta nombrada está MUERTA**. react-snap publicó su última versión 1.23.0 hace ~8 años (2018) y no recibe commits. Usarla en 2026 es introducir tecnología abandonada en el camino crítico de deploy.

**Veredicto resumido**:

1. **Mantener el ENFOQUE arquitectónico del asesor** (pre-render build-time selectivo, sólo blog, sólo deploy PROD, sitemap dinámico inmutable).
2. **Sustituir la herramienta**: usar **un script puppeteer custom** (Node + `puppeteer` o `puppeteer-core` + `@sparticuz/chromium` si más adelante se migra a Lambda) integrado en `deploy-frontend.ps1`. NO usar react-snap. NO usar Rendertron (Google lo deprecó en 2022). NO usar prerender-spa-plugin original (abandonado 2023). El fork `@prerenderer/prerenderer` de Tofandel es una alternativa secundaria viable pero añade dependencias transitivas que no aportan sobre un script custom de ~150 líneas.
3. **NO migrar a Next.js / Astro / Vike** en este frente. CRA está oficialmente deprecated desde 2025-02-14 (ver § 4), eso es una **deuda real de modernización** pero merece su propio frente, no es prerequisito del fix de indexación. Mezclarlo aquí dispara el alcance de "8h de quick win" a "2-3 semanas de migración con riesgo de regresión en videochat".
4. **El plan resuelve el bug crítico completamente** (HTML del shell SPA → HTML pre-renderizado con title/canonical/hreflang/JSON-LD/internal links del listing).
5. **Estimación realista con Claude Code**: 6-10h para implementar + integrar + verificar (ver § 7). Productivable en M3 (2026-09-16) sin problema.

**Recomendación final**: aprobar el plan con la sustitución de herramienta. Implementar como `ops/scripts/prerender-blog-prod.ps1` (orquestador PowerShell) + `ops/scripts/prerender-blog/render.js` (script Node con Puppeteer). Incorporar a `deploy-frontend.ps1` como paso post-sync condicionado a `-Environment prod`. Aprovechar la implementación para cerrar la deuda menor de `og:image:width/height` y opcionalmente `og:image` con asset de marca dedicado.

## 2. Análisis del plan propuesto

### Lo que el plan acierta (y por qué debe preservarse)

- **Pre-render selectivo, no migración de framework**: minimiza alcance. La migración a Next.js/Astro/Vike resolvería más cosas pero abre semanas de trabajo con riesgo en WebRTC. El fix de indexación tiene urgencia operativa (M3 = 2026-09-16, validación KPIs vs plan pesimista).
- **Solo PROD, no TEST/AUDIT**: respeta ADR-033 (robots fail-closed por entorno). No reintroduce el problema cerrado por el cierre del frente SEO en PROD del 2026-06-11.
- **One-JAR backend intacto**: cero cambios en SitemapController.java ni en application-*.properties. Coherente con la convención del repo.
- **Build npm SPA intacto**: bundle único válido para los 3 entornos, hidrata correctamente desde el HTML pre-renderizado (siempre que el shell tenga el mismo `<div id="root">`).
- **Sitemap.xml dinámico se mantiene**: bien — el sitemap funciona, el bug no está ahí.
- **Modo coming soon no interfiere**: correcto, el blog es público y no depende del modo operacional.

### Gaps no detectados por el asesor (que añado en este análisis)

1. **react-snap está MUERTA**. Última publicación npm 1.23.0 hace ~8 años. Sin commits recientes. Si el plan se ejecuta literal, se introduce dependencia abandonada en el camino crítico de deploy. [npm react-snap](https://www.npmjs.com/package/react-snap) (acceso 2026-06-21).

2. **Conflicto react-snap ↔ react-helmet-async documentado**: issue [#507 en stereobooster/react-snap](https://github.com/stereobooster/react-snap/issues/507) reporta que react-snap añade meta tags primero y react-helmet las sobrescribe en orden incorrecto. Aunque la solución sea otra herramienta, el patrón "meta tags emitidos por JS imperativo (seoHelpers.js)" + "meta tags emitidos por react-helmet-async (Seo.jsx)" exige cuidado: el pre-render debe **esperar a que ambos sistemas hayan terminado** antes de capturar el HTML. Con puppeteer custom esto es controlable con `waitForSelector` + `waitForFunction`.

3. **CRA oficialmente deprecated 2025-02-14**: el equipo React publicó [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) (acceso 2026-06-21). El proyecto está en CRA 5 + React 17. **Esto NO bloquea el fix de indexación**, pero es deuda estratégica relevante. La sigue siendo el plan correcto para esta sesión (frente acotado), pero conviene documentar la deuda separada de "migrar fuera de CRA en 2026" como ADR futuro.

4. **Hydration mismatches**: el plan los menciona indirectamente pero no propone mitigación concreta. Detalle en § 6.

5. **Imágenes hero**: el pre-render debe esperar a que las imágenes carguen antes de capturar el DOM, si no `<img>` puede quedar sin `src` resuelto y el HTML emitido no tendrá la imagen real (impacto en Largest Contentful Paint del SEO).

6. **Enumeración de URLs**: el plan asume que el backend devuelve los slugs publicados. Confirmado en este análisis: `GET /api/public/content/articles?locale=es&size=200` y `?locale=en&size=200` devuelven `ArticlePublicSummaryDTO` con `slug`. No hay endpoint específico, pero el listado funciona. Ver § 5.

7. **Coste CloudFront**: el plan menciona la duda. Cálculo concreto: ~12 paths por deploy (1 home, 2 listings, 2-6 listing paginated, 12 artículos =6 ES+6 EN cuando lleguemos a 6 artículos). Con cadencia 1 art/sem y deploys ~4/mes = ~50-100 paths/mes. **Muy por debajo del free tier de 1000 paths/mes**. Cero coste recurrente CloudFront. [AWS CloudFront pricing](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html) (acceso 2026-06-21).

8. **¿Y si el pre-render falla a mitad?** El plan no propone idempotencia/atomicidad. Detalle en § 6.

9. **SPA navigation post-aterrizaje**: el plan no aborda qué pasa cuando un usuario aterriza en `/blog/es/articulo1` y navega a `/blog/es/articulo2` client-side con react-router. Detalle en § 6.

## 3. Comparativa de herramientas (tabla)

Stack del proyecto: React 17 + CRA 5 + react-helmet-async@3 + seoHelpers.js imperativo + react-router-dom@5 + deploy PowerShell+S3+CloudFront. Modo desplegado: PROD apex `sharemechat.com`. PowerShell 5.1 es el único runtime nativo en `ops/scripts/`.

| Herramienta | Madurez 2026 | Compat. stack | Encaje deploy actual | Coste recurrente | Mantenimiento futuro | Riesgo |
|---|---|---|---|---|---|---|
| **a) react-snap** | **MUERTA**: último release `1.23.0` hace ~8 años en npm, sin actividad GitHub. [npm](https://www.npmjs.com/package/react-snap) (2026-06-21). | Conflicto documentado con react-helmet-async ([issue #507](https://github.com/stereobooster/react-snap/issues/507)). No probada con React 17 moderno. | Add devDependency. Build hook `postbuild` ejecutado por CRA. | 0 € | **Alto**: nadie arregla bugs. Cualquier issue con Puppeteer moderno (en 2026 ya v22+) deja el proyecto bloqueado. | Alto — usar en 2026 es deuda inmediata. |
| **b) Puppeteer custom (`puppeteer` o `puppeteer-core` + chrome local)** | Activamente mantenido por equipo Chrome. v22+ releases regulares. | Total con react-helmet-async + seoHelpers.js si el script espera la hidratación correcta (`waitForSelector` sobre `<article>` o `<div data-hydrated>`). | Script Node invocado desde `deploy-frontend.ps1`. PowerShell ya orquesta `npm`, `aws` — añadir `node` es cero fricción. | 0 € | Bajo: Puppeteer es proyecto Google. La lógica custom (~100-150 LoC) es trivial de mantener. | Bajo. **RECOMENDADA**. |
| **c) prerender-spa-plugin original (chrisvfritz)** | Último update abril 2023. [npm](https://www.npmjs.com/package/prerender-spa-plugin). Stable v3.4.0. | Webpack plugin, requiere modificar config CRA (eject o `react-app-rewired`). Complejo en CRA 5. | Mal: rompe el patrón "build CRA neutro" del proyecto. | 0 € | Medio. El proyecto está casi parado pero no oficialmente abandonado. | Medio. |
| **d) `@prerenderer/prerenderer` (Tofandel fork)** | Activamente mantenido. Webpack plugin v5.3.10 hace ~1 año. [GitHub](https://github.com/Tofandel/prerenderer). | Plugin webpack. Requiere `react-app-rewired` o eject para CRA. Compat. con React 17 OK. | Mal: rompe el patrón "build CRA neutro". Webpack config customizada en `deploy-frontend.ps1` añade complejidad. | 0 € | Medio. El fork está vivo pero el ritmo es lento. | Medio-bajo. **Alternativa secundaria** si la lógica puppeteer custom resulta más compleja. |
| **e) prerender.io (SaaS)** | Activo. Pricing $49/mes plan básico (25k renders), enterprise $99+. [prerender.io](https://prerender.io/) (acceso 2026-06-21). | Funciona como middleware/proxy on-demand. Detecta User-Agent y devuelve HTML pre-renderizado. | Mal: requiere integración Lambda@Edge o backend middleware. Cambia modelo de deploy del proyecto. | **$49+/mes**. Para 6 artículos es absurdo: ~12 URLs reales. | Bajo (es servicio externo). | Vendor lock-in. Datos del blog pasan por terceros. |
| **f) Hado SEO / SEO4Ajax (SaaS más baratos)** | Activos. $19-29/mes según fuentes ([Hado SEO alternatives 2026](https://hadoseo.com/blog/best-prerender-io-alternatives-2026), acceso 2026-06-21). | Mismo patrón SaaS. | Mal por la misma razón. | $19-29/mes mínimo. | Bajo. | Vendor lock-in + cuenta extra que mantener. |
| **g) Rendertron (Google)** | **DEPRECATED en 2022**. Google lo descontinuó. [GitHub archived](https://github.com/GoogleChrome/rendertron) (acceso 2026-06-21). | Funciona como servicio HTTP que renderiza on-demand. | Mal: requiere Lambda + EC2 + Docker. Sobre-ingeniería para el volumen. | Hosting + RDS si self-hosted. | Cero soporte oficial. | Alto. **No usar.** |
| **h) Lambda@Edge + Puppeteer custom (on-demand)** | Patrón vivo. [Ejemplo dev.to 2025](https://dev.to/aws-builders/how-i-replaced-prerenderio-with-my-own-serverless-renderer-on-aws-for-0month-344c). | Compat. con cualquier stack porque renderiza ya servido. | Cambia el modelo: detección de User-Agent en CloudFront Function + Lambda renderer + S3 cache. Más complejo que build-time. | Lambda invocations + S3 storage. Probablemente <5€/mes con caching 24h. | Medio: arquitectura serverless extra que mantener. | Medio. Cómodo a futuro si el volumen crece >> 6 artículos. **Sobre-ingeniería para el caso actual.** |

**Veredicto comparativa**: opción **(b) puppeteer custom build-time** es la winner por menor complejidad operativa, compatibilidad total con el stack actual, encaje natural con el patrón de scripts PowerShell del repo, y coste recurrente cero. La opción (h) Lambda@Edge es el plan B si el volumen de artículos crece a >100 o si se quiere prerender on-demand también para rutas largas-cola.

## 4. Alternativas a reconsiderar

ADR-019 (2026-05-11) descartó migrar a Next.js argumentando "Googlebot ejecuta JS desde 2019, CSR suficiente". La parte "CSR suficiente" se ha refutado empíricamente (el HTML servido es el shell home idéntico para todas las rutas, sin internal linking). Pero la pregunta es: **¿la solución es pre-render selectivo o migración de framework?**

### a) Next.js

**Pros**:
- Resuelve TODO el problema de raíz (no solo blog; toda la app indexable).
- SSG + ISR para blog, `'use client'` para WebRTC. [Next.js 16 rendering modes](https://makerkit.dev/blog/tutorials/nextjs-when-to-use-ssr) (acceso 2026-06-21).
- Sale del CRA deprecated.
- Stack maduro, comunidad enorme.

**Cons**:
- **Migración estimada 2-3 semanas** ya documentada en ADR-019. Crítica para frente acotado de M3.
- **Modelo de deploy cambia**: Next.js SSR/ISR exige un runtime Node (Vercel, Lambda, EC2). Rompe ONE-JAR del backend Spring + bundle estático a S3+CloudFront.
- **Riesgo en superficies WebRTC** (videochat, dashboards): el `'use client'` directive ayuda pero la migración del router (react-router-dom@5 → app router) tiene fricción real con WebRTC (componentes con `useRef` para `RTCPeerConnection`, ciclo de vida).
- Decisión del operador en ADR-019 explícita: descartado por coste/beneficio en fase pre-PRO.

**Dictamen técnico**: **descartar PARA ESTE FRENTE**. La migración a Next.js es una decisión arquitectónica mayor que merece su propio ADR (deuda CRA-deprecated). El fix de indexación no debe estar acoplado a esa decisión. Reconsiderar en H2-2026 o tras el lanzamiento, cuando haya runway.

### b) Astro

**Pros**:
- Genera HTML estático por defecto con React/Vue/Svelte como "islands" hidratadas.
- Reducción de bundle 60-80% según [Astro Web Framework Guide 2025](https://apatero.com/blog/astro-web-framework-complete-guide-2025) (acceso 2026-06-21).
- Migración estimada 1-2h "para sitios estáticos típicos" según [Astro React Integration Guide](https://reliasoftware.com/blog/astro-react-integration-guide) (acceso 2026-06-21).
- Astro tiene [guía oficial de migración desde CRA](https://docs.astro.build/en/guides/migrate-to-astro/from-create-react-app/).

**Cons**:
- La estimación "1-2h" aplica a sitios principalmente estáticos. SharemeChat es videochat WebRTC + dashboards + auth: tiene **mucha más app que blog**.
- Comentario revelador del DEV.to comparison 2025: *"If your Next.js site is a genuine web application with complex interactivity, stay on Next.js — Astro isn't trying to replace it for that use case."* [Next.js 16 vs Remix vs Astro 2025](https://dev.to/saswatapal/nextjs-16-vs-remix-vs-astro-choosing-the-right-react-framework-in-2025-3lio) (acceso 2026-06-21).
- El videochat 1-a-1 con `simple-peer` + `socket.io-client` + WebRTC PeerConnection es el caso típico de "genuine web application with complex interactivity".
- Migración del routing (react-router-dom@5) y de los styled-components requiere tocar TODAS las pages, no solo blog.

**Dictamen técnico**: **descartar PARA ESTE FRENTE**. Astro brilla para blogs + landings pero no para SPAs WebRTC. Mismo principio que Next.js: no acoplar el fix de indexación a una migración de framework.

### c) Remix / React Router v7

**Pros**:
- React Router v7 ofrece `ssr:false` + `prerender:true` para pre-renderizar todas las rutas estáticas como SSG. [React Router Pre-Rendering](https://reactrouter.com/how-to/pre-rendering) (acceso 2026-06-21).
- Migración desde react-router-dom@5 a @7 documentada (no trivial, pero sin saltar a otro stack).

**Cons**:
- Sigue requiriendo migración del build pipeline (CRA → Vite o equivalente).
- El proyecto está en react-router-dom@5; migrar primero a @6 y luego a @7 es 2-3 semanas conservador.

**Dictamen técnico**: **descartar PARA ESTE FRENTE**. Mismo argumento.

### d) Vite + plugin SSG (Vike / vite-plugin-ssr)

**Pros**:
- Vike (formerly vite-plugin-ssr) tiene `+prerender` hook estable. [Vike prerender docs](https://vike.dev/prerender) (acceso 2026-06-21).
- Vite es el sustituto recomendado de CRA por la propia [Sunsetting CRA announcement](https://react.dev/blog/2025/02/14/sunsetting-create-react-app).

**Cons**:
- Migrar CRA → Vite es trabajo en sí mismo (config, env vars, jest, etc.). En CRA 5 el operador ya está en una versión moderna; migrar a Vite es deuda separada.
- Vike añade complejidad de routing similar a Next.js mini.

**Dictamen técnico**: **descartar PARA ESTE FRENTE**. Es buen candidato para "frente CRA-deprecated" futuro, junto con Next.js.

### Conclusión § 4

**Ninguna alternativa de migración de framework supera al pre-render selectivo del plan original para el alcance "fix indexación M3".** La razón es de pragmatismo: el bug es de internal linking + HTML inicial, no de arquitectura. La arquitectura tiene su propia deuda (CRA deprecated) que merece frente separado.

Recomendación firme: **mantener el plan del asesor, sustituir herramienta**.

## 5. Diseño técnico detallado del flujo recomendado

### Arquitectura propuesta

```
deploy-frontend.ps1 prod product
  └─ [N] (paso nuevo, solo si Environment=prod y Surface in (product,both))
       └─ prerender-blog-prod.ps1
            ├─ 1. Llama backend PROD: enumera slugs ES+EN
            ├─ 2. Construye lista URLs absolutas para pre-render
            ├─ 3. node prerender-blog/render.js <urls> <out-dir>
            │     ├─ puppeteer.launch()
            │     ├─ para cada URL:
            │     │   ├─ page.goto(url, waitUntil:'networkidle0')
            │     │   ├─ page.waitForSelector('[data-blog-hydrated]')   ◄─ marcador hidratación
            │     │   ├─ page.waitForFunction(() => meta.canonical y JSON-LD presentes)
            │     │   ├─ page.content() → HTML completo
            │     │   └─ fs.writeFile(out-dir + path, html)
            │     └─ puppeteer.close()
            ├─ 4. aws s3 cp out-dir/ s3://sharemechat-frontend-prod/ --recursive --content-type text/html
            └─ 5. aws cloudfront create-invalidation --paths /blog/* /
```

### Endpoint backend confirmado

`ContentPublicController.java:52`:

```
GET /api/public/content/articles?locale={es|en}&size=200
```

Devuelve `ArticlePublicSummaryDTO` con (al menos) `slug`. Llamada de enumeración (dos llamadas, una por locale).

### URLs a pre-renderizar

Mínimo viable (~14 URLs):

```
https://sharemechat.com/                         (home ES — opcional, ya cubierta por Seo.jsx + Helmet)
https://sharemechat.com/en/                      (home EN — opcional)
https://sharemechat.com/blog/es                  (listing ES)
https://sharemechat.com/blog/en                  (listing EN)
https://sharemechat.com/blog/es/<slug-1>         (artículo ES)
https://sharemechat.com/blog/es/<slug-2>
https://sharemechat.com/blog/es/<slug-3>
https://sharemechat.com/blog/en/<slug-1-en>
https://sharemechat.com/blog/en/<slug-2-en>
https://sharemechat.com/blog/en/<slug-3-en>
```

[propuesta] **Solo `/blog/*`** en MVP. Home (`/` y `/en/`) ya usa Seo.jsx con Helmet — el problema crítico es del blog, no de la home. Si después se observa que home también beneficia, se añade en segunda iteración.

### Punto exacto de integración en `deploy-frontend.ps1`

El script actual tiene la estructura:

```
[0.5] Drift check (HEAD vs manifest)
[1]   Read state-mapping.yaml
[2]   Lock + clean build-<surface>/
[3]   npm run build:<surface>
[4]   aws s3 sync build-<surface>/ s3://<bucket>/
[5]   Smoke test estático (GET index.html + bundle hash)
[6]   Smoke test funcional (si backend up)
[7]   aws cloudfront create-invalidation
```

**Punto óptimo de inserción**: entre [5] y [7]. Lo llamamos `[5.5]` o `[6.5]` según queramos correrlo antes o después del smoke funcional. Recomendado:

```
[5]   Smoke test estático
[5.5] Pre-render blog (SOLO si -Environment prod -and -Surface in (product,both))
[6]   Smoke test funcional
[7]   aws cloudfront create-invalidation (incluir /blog/* en paths)
```

Razón de orden:
- Antes que [6] funcional: el funcional verifica que el backend responde, pero no toca el blog. No bloquea.
- Antes que [7] invalidación: queremos que la invalidación cubra tanto el sync general como los HTML pre-renderizados nuevos.

**Filtro condicional**: el bloque `[5.5]` debe ejecutarse solo cuando:
- `$Environment -eq 'prod'`
- `$Surface -in @('product', 'both')`
- `-not $StandbyMode` (en standby el bucket no es el origin vivo, no tiene sentido pre-renderizar)

### Credenciales

El script `deploy-frontend.ps1` ya asume `aws` CLI autenticado. **No se requieren credenciales adicionales** si:
- Puppeteer usa el bundle ya subido a S3 vía CloudFront PROD (`https://sharemechat.com/...`). Es el camino recomendado: pre-render contra CloudFront garantiza que el HTML pre-renderizado refleja exactamente lo que el usuario verá. Si Puppeteer va al backend directamente desde Node, hay riesgo de divergencia.
- Alternativa: pre-render contra el bucket directamente vía AWS SigV4 con `--profile`. Más complejo. Recomendado solo si la latencia CF + invalidación previa requerida bloquea el flujo.

**Decisión propuesta**: pre-render contra `https://sharemechat.com/<path>` (CloudFront, post-sync, pre-invalidación). El sync acaba de subir el bundle; CF puede tener cache viejo del `index.html`. Por eso el orden:

```
[4]   aws s3 sync  → bundle nuevo en S3
[5.5] pre-render → puppeteer pide /blog/es a CloudFront
                   ├─ Si CF tiene cache viejo del shell genérico, sirve el viejo.
                   ├─ El viejo es funcionalmente equivalente: misma SPA hidrata, mismas API calls.
                   ├─ Riesgo: si el shell viejo tiene un bug que el nuevo arregla, pre-renderizamos el viejo.
                   └─ Mitigación: hacer un cloudfront create-invalidation /index.html / antes del pre-render.
```

**Solución limpia**:

```
[4]   aws s3 sync
[4.5] aws cloudfront create-invalidation /index.html / (forzar nuevo shell ya servido)
[5]   Smoke estático
[5.5] Pre-render (puppeteer contra CF)
[6]   Smoke funcional
[7]   aws cloudfront create-invalidation /blog/* (incluir HTMLs pre-renderizados)
```

Dos invalidaciones distintas en el ciclo. Cada path cuenta como 1, total ~3-4 paths/deploy. Cero coste (free tier 1000/mes).

### Convención S3 para HTML pre-renderizado

Patrón del SitemapController.java + función edge `redirect-spa-test` actual: la función edge reescribe URIs sin punto a `/index.html`. Para que CloudFront sirva un HTML diferente para `/blog/es`, hay que:

**Opción 1**: subir el HTML como objeto con key `blog/es` (sin extensión `.html`). Esto requiere que la función edge **NO reescriba a `/index.html` cuando hay un objeto en la key exacta**. Hay que verificar el código de la función edge actual.

**Opción 2 (más limpia, recomendada)**: subir `blog/es/index.html` y configurar la función edge para que añada `/index.html` al final si la ruta termina sin extensión. Verificar comportamiento actual.

**Opción 3 (parche)**: subir como `blog/es` y `blog/es/index.html` ambas (doble subida) para cubrir las dos formas que pueda usar la función edge. Antes-recomendada en ADR-018 D4(c). Funcional pero feo.

**Acción requerida antes de implementar**: leer `redirect-spa-test` (función edge) para confirmar cuál de las 3 aplica. **NO está leída en este análisis**. Es la primera pregunta operativa del § 9.

### Esperar a la hidratación correcta (clave técnica)

Puppeteer debe capturar el HTML **después** de que:
- React haya montado.
- El `useEffect([article])` de `BlogArticleView` haya emitido las meta tags via seoHelpers.js.
- El `useEffect([articles])` de `BlogContent` haya emitido el listado.
- react-helmet-async haya aplicado los tags de Seo.jsx en home/footer.
- Las imágenes hero del artículo hayan cargado (importante para LCP).

**Estrategia recomendada**: añadir un atributo `data-hydrated="true"` al `<body>` o a un wrapper raíz **cuando el effect SEO terminal haya corrido** (1 línea de código en cada componente). Puppeteer hace `page.waitForSelector('body[data-hydrated="true"]')` con timeout 10s. Fallback: `waitForFunction(() => document.title !== "1-to-1 Video Chat with Verified Models | SharemeChat")` (porque el shell tiene ese title, si cambia significa que hidrató).

[propuesta] Implementar el marker `data-hydrated` es 1 línea de código por componente blog. Robusto. Recomendado.

### Lista de URLs dinámica (cuando se añadan artículos)

El script enumera `GET /api/public/content/articles?locale=es&size=200` cada deploy. NO requiere mantener manualmente una lista. Se añade un artículo nuevo en CMS, próximo deploy lo pre-renderiza automáticamente.

## 6. Riesgos identificados y mitigaciones

| Riesgo | Severidad | Detalle | Mitigación |
|---|---|---|---|
| **Hydration mismatches** | Media | El HTML pre-renderizado contiene tags emitidos por seoHelpers/Helmet. Al hidratar React podría intentar añadirlos de nuevo o reordenarlos. | react-helmet-async ya está pensado para SSR (mantiene mismas keys server/client). Para seoHelpers (imperativo via `useEffect`), el código YA hace `upsertMeta` que actualiza si existe (no duplica). NO debería haber mismatch. **Verificar en TEST primero**. |
| **Imágenes hero no cargadas al capturar** | Media | Si Puppeteer captura antes de `<img>.complete`, el HTML emitido tiene `<img>` sin altura/anchura. Impacta LCP en SEO. | `page.goto(url, {waitUntil: 'networkidle0'})` + check explícito `await page.evaluate(() => Array.from(document.images).every(img => img.complete))`. |
| **Rutas dinámicas / nuevos artículos** | Baja | El operador publica un artículo; si no se relanza deploy, el nuevo no se pre-renderiza. | Documentar en runbook: tras publicar, ejecutar `deploy-frontend.ps1 prod product` (o solo el paso de pre-render aislado). El sitemap.xml YA se actualiza dinámicamente (Spring Boot lo emite con cache 1h), así que Googlebot lo descubre vía sitemap aunque el HTML pre-renderizado falte temporalmente. |
| **Tiempo de ejecución del pre-render** | Baja | 12-14 URLs × ~3-5s/URL con carga de imágenes = 1-2 minutos. Crece linealmente con cadencia 1 art/sem. En 1 año ~50 artículos = 100 URLs ES+EN ≈ 5-10 min. Lanzamiento agosto 2026: ~6-12 artículos ≈ 1-2 min. Aceptable. | Si en algún momento >100 URLs, paralelizar con `puppeteer-cluster`. No urgente. |
| **Fallo a mitad → S3 inconsistente** | Media | Si la URL #5 falla, las URLs 1-4 ya están en S3 actualizadas y 5+ no. Mezcla viejo/nuevo. | (a) Pre-renderizar a un directorio temporal `out-dir/`. (b) Subir todo el directorio con `aws s3 sync` atómico al final. (c) Si cualquier URL falla, abort y NO subir nada (el shell viejo sigue sirviendo). |
| **Backend PROD no responde durante pre-render** | Media | Necesario para enumerar slugs. | Smoke test backend antes de `[5.5]`. Si backend down, **abortar el paso de pre-render con warning** pero NO bloquear el deploy entero (el sync ya hizo su trabajo; el pre-render queda como TODO manual). |
| **CloudFront sirve cache stale durante pre-render** | Media | Si CF cachea el shell viejo, Puppeteer renderiza el viejo. | Invalidación `/index.html /` ANTES del pre-render (paso `[4.5]`). 1 path. Free. |
| **SPA navigation client-side post-aterrizaje** | Baja | Usuario aterriza en `/blog/es/articulo1` (HTML pre-renderizado con SEO correcto), navega a `/articulo2` con react-router. **¿Las meta tags se actualizan?** | **Sí, sin cambios**. El sistema actual (seoHelpers imperativo + Helmet) ya funciona en client-side navigation: el `useEffect([article])` se dispara con el nuevo slug y `upsertMeta` actualiza el `document.head`. El pre-render NO ROMPE esto. Verificar empíricamente en TEST. |
| **Bundle JS hash cambia entre el shell pre-renderizado y el sync** | Bajo | Si CRA cambia el hash del bundle entre dos builds del mismo commit (no debería), el `<script src=".../main.HASH.js">` del HTML pre-renderizado podría apuntar a un bundle inexistente. | El pre-render se hace DESPUÉS del sync. CRA con mismo commit produce mismo hash determinístico. Riesgo bajo. |
| **Diferencia entre lo que sirve Puppeteer y lo que sirve Googlebot real** | Bajo | Puppeteer chrome moderno vs Googlebot WRS (Chrome 131+, según Google 2025). | Funcionalmente equivalente para HTML estático generado. Riesgo bajo. |
| **og:image: width/height ausentes** (deuda menor existente) | Bajo | Validadores OG estrictos lo piden. | Aprovechar la fase: añadir width/height a las meta tags emitidas por seoHelpers cuando se ejecute el pre-render. § 8. |

## 7. Estimación de horas con Claude Code

Estimación realista para Claude Code en sesiones de chat con el operador, asumiendo que el operador ejecuta los comandos y reporta los resultados:

| Tarea | Horas (rango) |
|---|---|
| **Diseño + crear `ops/scripts/prerender-blog/render.js`** (Node + Puppeteer, lógica de waitForSelector / image-loaded check / output a out-dir) | 1.5-2.5 h |
| **Crear `ops/scripts/prerender-blog-prod.ps1`** (orchestrator: enumera slugs vía curl, llama node render.js, sube a S3, invalida CF) | 1-1.5 h |
| **Integrar paso `[5.5]` en `deploy-frontend.ps1`** (condicional `$Environment -eq 'prod'`, paso `[4.5]` invalidación preliminar) | 0.5-1 h |
| **Verificar comportamiento de la función edge `redirect-spa-test`** y decidir convención S3 (objeto `blog/es` vs `blog/es/index.html` vs ambos) | 0.5-1 h |
| **Añadir marker `data-hydrated`** en BlogContent y BlogArticleView (1 línea + 1 useEffect en cada) | 0.5 h |
| **Probar end-to-end en TEST primero** (mismo script, hardcodear sharemechat.com → test.sharemechat.com en `-Environment test` temporal) | 1-1.5 h |
| **Verificar con curl/grep que `/blog/es` servido contiene los `<a href>` esperados y title correcto** | 0.5 h |
| **Verificar con Google Rich Results Test que el JSON-LD BlogPosting es válido** | 0.5 h |
| **Subir a PROD y verificación final** (curl + GSC URL Inspection del HTML) | 1 h |
| **Hotfixes esperables**: ajustar `waitForSelector` por casos límite, errores de timing con imágenes, cosa rara de la función edge | 1-2 h |

**Total estimado**: **6-10 horas reales** (≈ 1.5-2 sesiones de medio día con el operador). **Productivable a PROD en M3 (2026-09-16) sin problema.**

## 8. Limpieza de deuda menor a oportunidad de la implementación

La sesión de pre-render toca seoHelpers.js y los componentes blog. Es buen momento para cerrar deudas menores documentadas en known-debt:

| Deuda | Esfuerzo extra | Recomendación |
|---|---|---|
| **`og:image:width` y `og:image:height` ausentes** | +0.5 h | **Hacer**. Añadir constants en seoHelpers (1200, 630) y emitir las dos meta. Mejora previews legacy. |
| **`twitter:site` y `twitter:creator` ausentes** | +0.5 h | **Hacer si el operador confirma el handle** `@sharemechat`. Constants en seoHelpers. |
| **`logo192.png` como `publisher.logo` y `og:image` del listado** | +1-2 h | **Diferir**. Requiere asset de marca dedicado (1200x630) que vive en el bucket assets. Frente separado. |
| **BreadcrumbList JSON-LD en BlogArticleView** | +1 h | **Hacer**. Es 1 nuevo JSON-LD script type=Article emitido como `BreadcrumbList` con Home > Blog > Artículo. Alto valor en SERP. |
| **Hreflang bidireccional en cliente** (sitemap ya lo tiene; cliente sigue asimétrico) | +0.5-1 h | **Hacer**. El DTO `ArticlePublicDetailDTO` ya tiene `alternates` (línea 24 de ContentPublicController inferida por el código). Consumir y emitir `<link rel="alternate" hreflang="en-US" href="...">` real. |

**Pack recomendado**: og:image dimensions + BreadcrumbList + hreflang bidireccional = **+2-3 h** sobre las 6-10h del frente. Total: **8-13 h**. Sigue siendo M3-friendly.

## 9. Dudas residuales que necesitan respuesta del operador antes de implementar

1. **¿Cómo se comporta la función edge `redirect-spa-test` cuando un objeto S3 existe en la key exacta del path?** Necesario para decidir convención: `blog/es` plano, `blog/es/index.html`, o ambos. **Verificar el código de la función edge antes de tocar nada**. El plan de pre-render no funciona sin esto resuelto.

2. **¿El operador acepta correr el pre-render contra CloudFront PROD** (auto-pre-render del propio dominio público, paso `[5.5]` después de sync y pre-invalidación) **o prefiere contra el bucket S3 directamente** (Puppeteer con SigV4)? La primera es más simple y representa exactamente lo que Googlebot verá. La segunda evita un round-trip CF.

3. **¿Confirma el operador que tener el blog en CRA-deprecated es deuda separada** y NO se debe acoplar al fix de indexación, o prefiere unificar todo en un frente "migrar a Vite + pre-render con Vike" (3-4 semanas)? Mi recomendación firme: **separar**. Pero es decisión del operador / fundador.

4. **¿El operador confirma que el plan acepta hacer 2 invalidaciones por deploy** (1 para forzar shell nuevo pre-pre-render, 1 final para HTMLs pre-renderizados)? Coste ~3-4 paths/deploy × 4 deploys/mes = 12-16 paths/mes. Cero coste (free 1000/mes). Pero hay overhead de tiempo (~30s cada invalidación).

5. **¿Existe handle oficial `@sharemechat` en X confirmado**, para que la limpieza de `twitter:site`/`twitter:creator` se haga en la misma sesión?

6. **Existe ya un asset de marca 1200×630 en `assets-sharemechat-prod`** que pueda sustituir `logo192.png` como `og:image` por defecto? Si sí, lo añadimos también. Si no, deferimos.

## 10. Fuentes externas consultadas

Todas accesibles el 2026-06-21:

1. [npm — react-snap](https://www.npmjs.com/package/react-snap) — confirma versión 1.23.0 publicada hace ~8 años, sin actividad reciente.
2. [GitHub — stereobooster/react-snap](https://github.com/stereobooster/react-snap) — confirma repo sin commits recientes.
3. [GitHub — stereobooster/react-snap issue #507](https://github.com/stereobooster/react-snap/issues/507) — conflicto documentado con react-helmet.
4. [React blog — Sunsetting Create React App (2025-02-14)](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) — comunicado oficial deprecation CRA.
5. [DevClass — React team formally deprecates CRA](https://devclass.com/2025/02/18/react-team-formally-deprecates-create-react-app-following-perfect-storm-of-incompatibility/) — cobertura externa.
6. [npm — react-helmet-async](https://www.npmjs.com/package/react-helmet-async) — versiones, compat React 16-19.
7. [GitHub — staylor/react-helmet-async](https://github.com/staylor/react-helmet-async) — repo oficial.
8. [npm — prerender-spa-plugin](https://www.npmjs.com/package/prerender-spa-plugin) — estado último update ~abril 2023.
9. [GitHub — Tofandel/prerenderer](https://github.com/Tofandel/prerenderer) — fork activo del plugin.
10. [GitHub — GoogleChrome/rendertron](https://github.com/GoogleChrome/rendertron) — archived, deprecated 2022.
11. [Prerender.io blog — Alternatives to Rendertron](https://prerender.io/blog/alternatives-to-rendertron-for-dynamic-rendering/) — confirma estado Rendertron.
12. [Hado SEO — Best Prerender.io Alternatives in 2026](https://hadoseo.com/blog/best-prerender-io-alternatives-2026) — comparativa SaaS pricing 2026.
13. [Prerender.io official site](https://prerender.io/) — pricing $49+/mes 25k renders.
14. [web.dev — Pre-render routes with react-snap](https://web.dev/articles/prerender-with-react-snap) — documentación legacy del enfoque.
15. [Reliasoftware — Astro React Integration Guide](https://reliasoftware.com/blog/astro-react-integration-guide) — guía migración Astro.
16. [Astro Docs — Migrating from Create React App](https://docs.astro.build/en/guides/migrate-to-astro/from-create-react-app/) — guía oficial.
17. [DEV.to — Next.js 16 vs Remix vs Astro 2025](https://dev.to/saswatapal/nextjs-16-vs-remix-vs-astro-choosing-the-right-react-framework-in-2025-3lio) — comparativa frameworks.
18. [Makerkit — When to Use SSR in Next.js 16](https://makerkit.dev/blog/tutorials/nextjs-when-to-use-ssr) — rendering strategies.
19. [Vike — prerender hook docs](https://vike.dev/prerender) — alternativa Vite SSG.
20. [React Router — Pre-Rendering](https://reactrouter.com/how-to/pre-rendering) — `ssr:false + prerender:true`.
21. [DEV.to — How I Replaced Prerender.io with a Serverless AWS Renderer ($0/month)](https://dev.to/aws-builders/how-i-replaced-prerenderio-with-my-own-serverless-renderer-on-aws-for-0month-344c) — patrón Lambda@Edge + Puppeteer custom 2025.
22. [AWS Docs — CloudFront invalidation pricing](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html) — free tier 1000 paths/mes, $0.005/path después.
23. [Apatero — Astro Web Framework Guide 2025](https://apatero.com/blog/astro-web-framework-complete-guide-2025) — perf claims Astro.
