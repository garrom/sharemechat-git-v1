# ADR-015 — Dominios canónicos por entorno

## Estado

Aceptada e implementada (TEST y AUDIT). Pendiente despliegue en PRO.

## Contexto

La convención de hosts por entorno ha existido implícita en el código desde
hace tiempo, repartida entre varias capas:

- `application.properties` y `application-audit.properties` fijan
  `auth.cookieDomain`, `app.frontend.reset-url`,
  `app.frontend.verify-email-product-url`,
  `app.frontend.verify-email-admin-url` y `kyc.veriff.callback-url` con hosts
  literales por entorno.
- `WebSocketConfig` declara `setAllowedOriginPatterns(...)` con
  `https://test.sharemechat.com`, `https://audit.sharemechat.com` y
  `http://localhost:3000`.
- `SecurityConfig` y la cadena de filtros leen `cookieDomain` para resolver
  cookies JWT y refresh.
- `runtimeSurface.js` en el frontend mantiene `ADMIN_APP_ORIGIN` y
  `PRODUCT_APP_ORIGIN` apuntando a TEST como default cuando la build admin
  necesita construir URLs hacia la build de producto y viceversa.
- `legal.baseUrl` apunta a `https://assets.sharemechat.com/legal` y se
  reutiliza desde los tres entornos sin variación.

La auditoría
[doc-vs-code-gap-2026-05-07](docs/_archive/_audit/doc-vs-code-gap-2026-05-07.md) detectó
que la decisión efectiva nunca quedó escrita: `production.md` se mantenía
deliberadamente sobrio sin fijar host PRO, `shareme-context-overview.md` solo
listaba los hosts de TEST y AUDIT y el roadmap (`go-live-roadmap.md`)
declaraba "dominios" entre las cosas pendientes de paridad para PRO sin
cerrar el contrato.

Antes de implementar el SEO mínimo del blog (canonical, sitemap, JSON-LD,
meta tags) y antes de provisionar PRO, hace falta consolidar la decisión por
escrito para evitar:

- ambigüedad sobre cuál es la URL canónica del blog en cada entorno;
- divergencia futura entre lo que asume el frontend, lo que valida el
  backend y lo que sirve la capa edge;
- decisiones tácitas sobre `www.*`, subdominios `api.*` o subdominios `blog.*`
  que reabran un frente ya resuelto en TEST/AUDIT.

## Opciones consideradas

### Opción 1 — Apex sin `www` como host canónico, blog en subdirectorio

Producto y blog viven bajo el apex (`sharemechat.com`,
`test.sharemechat.com`, `audit.sharemechat.com`). API y realtime comparten
host con el producto vía paths `/api/...`, `/messages`, `/match`. La variante
con `www` redirige 301 al apex. Backoffice en subdominio `admin.*`.

Pros:

- coincide con la implementación ya validada en TEST y AUDIT.
- el blog hereda autoridad SEO del dominio principal sin repartirla.
- minimiza cambios al provisionar PRO: solo properties por entorno.
- alineado con tendencias modernas (Stripe, Linear, Vercel, Notion).

Contras:

- la política `www → apex` tiene que vivir en CloudFront/edge, fuera del
  repositorio principal; requiere disciplina operativa.

### Opción 2 — Blog en subdominio dedicado (`blog.sharemechat.com`)

Mover el blog a un subdominio independiente, con su propia distribución
edge.

Pros:

- aísla el blog del resto del producto.
- facilita mover el blog a infraestructura separada en el futuro.

Contras:

- reparte autoridad SEO entre dos dominios sin justificación de negocio.
- duplica la decisión de hosts canónicos (apex + blog) sin beneficio claro.
- la independencia operativa que aportaría se obtiene igualmente con la
  Fase 4B del CMS (publicación estática a S3+CloudFront) sin cambiar la URL
  pública.

### Opción 3 — API en subdominio dedicado (`api.sharemechat.com`)

Separar API y realtime en `api.*`, dejando el apex solo para frontend.

Pros:

- separación física entre frontend y backend.
- facilita escalado horizontal de la API sin tocar la distribución del
  frontend.

Contras:

- ningún entorno actual lo implementa así. La mención a
  `api.test.sharemechat.com` en `incident-notes.md` es histórica/informal y
  no constituye host canónico.
- exige nuevas decisiones sobre CORS, cookieDomain compartido y cookies
  cross-subdomain, que hoy están resueltas con apex único.
- replicarlo en PRO sin necesidad real introduce divergencia con TEST/AUDIT.

### Opción 4 — `www` como host canónico

Servir todo bajo `www.sharemechat.com` y redirigir el apex.

Pros:

- consistencia visible en URL siempre con prefijo `www`.

Contras:

- contrario a las tendencias actuales y a la implementación ya operativa en
  TEST/AUDIT (que usan apex).
- alarga visualmente la URL canónica del blog.
- no aporta ventaja técnica con CloudFront moderno + Route53 alias records.

## Decisión

Se adopta la **Opción 1**: apex sin `www` como host canónico por entorno,
blog en subdirectorio bajo el apex, API y realtime compartiendo host con el
producto, backoffice en subdominio `admin.*`. La variante `www` debe existir
como host activo y redirigir 301 al apex.

### 1. Producto público (apex sin `www`)

| Entorno | Host canónico                  |
|---------|--------------------------------|
| TEST    | `https://test.sharemechat.com` |
| AUDIT   | `https://audit.sharemechat.com`|
| PRO     | `https://sharemechat.com`      |

### 2. Variante con `www` (redirección 301 al apex)

| Entorno | Variante con `www`                  | Política                |
|---------|-------------------------------------|-------------------------|
| TEST    | `https://www.test.sharemechat.com`  | 301 al apex de TEST     |
| AUDIT   | `https://www.audit.sharemechat.com` | 301 al apex de AUDIT    |
| PRO     | `https://www.sharemechat.com`       | 301 al apex de PRO      |

La variante con `www` debe estar activa como host (certificado, DNS,
distribución edge) pero **nunca** sirve contenido propio. La canónica es
siempre el apex. La política se implementa en CloudFront/edge, no en
backend.

### 3. Backoffice (admin)

| Entorno | Host del backoffice                  |
|---------|--------------------------------------|
| TEST    | `https://admin.test.sharemechat.com` |
| AUDIT   | `https://admin.audit.sharemechat.com`|
| PRO     | `https://admin.sharemechat.com`      |

### 4. API y realtime (REST + WebSocket)

API y realtime **comparten host con el producto** en cada entorno (mismo
apex sin `www`). Paths:

- REST: `/api/...`
- WebSocket matching: `/match`
- WebSocket mensajería y llamada directa: `/messages`

No hay subdominio dedicado `api.*` operativo. La mención a
`api.test.sharemechat.com` que aparece en `incident-notes.md` es
histórica/informal y no constituye host canónico.

### 5. Blog público

Subdirectorio `/blog/<slug>` bajo el host del producto en cada entorno:

| Entorno | Canónica del blog                                |
|---------|--------------------------------------------------|
| TEST    | `https://test.sharemechat.com/blog/<slug>`       |
| AUDIT   | `https://audit.sharemechat.com/blog/<slug>` (operativo solo si en algún momento AUDIT publica blog; hoy AUDIT no es entorno editorial) |
| PRO     | `https://sharemechat.com/blog/<slug>`            |

Justificación: heredar la autoridad de dominio del sitio principal.
Compatible con la Fase 4B del CMS (publicación estática a S3+CloudFront)
sin cambiar la URL pública.

### 6. Activos legales

Compartido entre los tres entornos:

- `https://assets.sharemechat.com/legal/...`

Configurado en properties como `legal.baseUrl` (sin variación por
profile).

### 7. Cookie domain

| Entorno | `auth.cookieDomain`        |
|---------|----------------------------|
| TEST    | `.test.sharemechat.com`    |
| AUDIT   | `.audit.sharemechat.com`   |
| PRO     | `.sharemechat.com`         |

El punto inicial permite que la cookie sea válida para apex y subdominios
(`admin.*`, `www.*` durante el flujo de redirección, etc.).

## Justificación

La opción adoptada cierra una convención que ya estaba implementada y
validada en TEST y AUDIT. Documentarla por escrito:

- elimina la ambigüedad sobre la URL canónica del blog antes de implementar
  SEO;
- fija un contrato claro para CloudFront/edge sobre redirects `www → apex` y
  sobre comportamiento de subdominios `admin.*`;
- evita reabrir decisiones ya tomadas cuando se provisione PRO (paridad con
  AUDIT por properties);
- mantiene coherencia con la decisión separada de `cookieDomain` por
  entorno ya recogida en [ADR-009](adr-009-product-operational-mode.md).

Las opciones descartadas (subdominio dedicado para blog o API,
`www` canónico) no aportan valor real frente al patrón actual y reabrirían
decisiones de CORS, autoridad SEO y configuración de cookies sin
necesidad operativa que lo justifique.

## Impacto

Arquitectura:

- `WebSocketConfig` mantiene `setAllowedOriginPatterns(...)` con apex de
  cada entorno; cuando PRO se provisione, se añade `https://sharemechat.com`
  al listado.
- `SecurityConfig` no cambia.
- el contrato de URLs canónicas queda anclado por entorno en
  `application-<profile>.properties` y en el
  documento de entorno correspondiente (`test.md`, `audit.md`,
  `production.md`).

Código:

- ningún cambio funcional en esta iteración. La decisión es declarativa.
- la implementación SEO del blog (Frente 2 siguiente) puede usar este ADR
  como autoridad para resolver `canonical`, `og:url` y `JSON-LD` por
  entorno desde una propiedad versionada (`app.public.base-url` o
  equivalente).

Operaciones:

- la política `www → 301 → apex` debe garantizarse en CloudFront/edge para
  los tres entornos.
- cuando se monte PRO, los hosts y las cookies de TEST/AUDIT deben quedar
  aislados (riesgo ya recogido en
  [ADR-009](adr-009-product-operational-mode.md) y en Fase 0 del roadmap).

Riesgos:

- la política `www → apex` vive fuera del repositorio principal; un
  despliegue edge nuevo que olvide replicarla rompería el contrato sin que
  el código lo detecte.
- los `allowedOrigins` de `WebSocketConfig` no incluyen variantes `www.*`;
  aceptable porque el path WS es interno y no se accede desde `www.*`
  directamente.

## Consecuencias

Positivas:

- URL canónica fija por entorno: SEO puede declarar `canonical` sin
  ambigüedad.
- CloudFront/edge tiene contrato claro para configurar redirects `www →
  apex`.
- Cuando PRO se monte, los contratos están escritos: solo se ajustan
  properties.
- Cookie domain coherente con cookies compartidas entre `admin.*` y
  producto.

Negativas:

- La política `www → 301` vive en CloudFront/edge, no en código backend.
  Requiere coordinación con cualquier despliegue de edge nuevo.
- Sin paridad entre TEST y AUDIT en los `WebSocketConfig.allowedOrigins`
  (no aparecen variantes `www`); aceptable porque el path WS es interno y
  no se accede desde `www` directamente, pero queda como nota residual.

Trade-offs:

- se prioriza simplicidad y reaprovechamiento de la convención ya
  validada frente a separación física por subdominios; si en el futuro
  un escalado real lo justificara, la decisión se reabriría con un nuevo
  ADR.

## Pendiente residual

- Verificar y, si procede, implementar la redirección `www → apex` en
  CloudFront para los tres entornos (operativa, fuera del corpus de
  `docs/`).
- Añadir paridad de `allowedOrigins` en `WebSocketConfig` si se decide
  que algún cliente WS legítimo viene de `www.*` (hoy no es el caso).
- Documentar en `production.md` la matriz operativa de hosts cuando PRO
  se despliegue (host real, certificado, distribución edge); este ADR
  fija la convención lógica, no el inventario operativo concreto.

## Notas

- Esta ADR no toca la decisión separada sobre publicación estática del
  blog (Fase 4B del CMS, recogida en
  [ADR-010](adr-010-internal-content-cms-ai-assisted-workflow.md) y
  [ADR-014](adr-014-full-article-orchestrated-pipeline.md)). La URL
  canónica del blog se mantiene bajo el apex independientemente de si
  el HTML se sirve dinámicamente desde backend o como estático
  pre-generado en S3+CloudFront.
- La configuración concreta por entorno (certificados, distribuciones,
  alias records) vive fuera del repositorio principal; aquí solo queda
  fijada la convención lógica.
