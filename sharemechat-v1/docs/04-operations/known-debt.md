# Deudas técnicas conocidas

Registro de deudas detectadas durante operación o auditoría que no son incidencias urgentes pero conviene no perder. Cuando una deuda se cierre, mover su sección a `incident-notes.md` con marca de resolución y eliminar de aquí.

## 2026-05-09 — Detectadas durante primer inventariado de TEST

### Cache policy subóptima para /.well-known/acme-challenge/* en CloudFront TEST

**Origen**: snapshot `state-test-2026-05-09-1002.yaml`, sección `cloudfront.cache_behaviors`. Persiste en snapshots v2 posteriores.

**Hecho**: la cache behavior `/.well-known/acme-challenge/*` en la distribución CloudFront `frontend_public` de TEST tiene `cache_policy: Managed-CachingOptimized`.

**Impacto**: lo correcto sería `Managed-CachingDisabled` para que certbot vea respuestas frescas durante validaciones ACME. En la práctica funciona porque `Managed-CachingOptimized` honra el `Cache-Control` del origen, pero deja un margen de error si el origen alguna vez no envía esa cabecera.

**Acción pendiente**: cambiar la cache behavior a `Managed-CachingDisabled` en el próximo cambio CloudFront que toque la distribución `frontend_public`. Validar que también AUDIT y PRO siguen el mismo patrón cuando se inventaríen.

**Prioridad**: baja. Validar también en AUDIT y PRO al hacer la nivelación.

## 2026-05-09 — Detectadas durante segundo inventariado de TEST

### Backend de TEST sin gestión systemd

**Origen**: snapshot `state-test-2026-05-09-1014.yaml`, confirmado tras arranque manual. Documentado en `docs/03-environments/test.md` (sección "Topología real").

**Hecho**: el JAR de backend en TEST corre como proceso de `ec2-user` sin unit systemd asociada. Tras un reboot de la EC2, el backend no se relanza automáticamente.

**Impacto**: por diseño (TEST se levanta y apaga manualmente cada día). No es deuda técnica que rompa nada hoy. La documentación ya refleja esta peculiaridad.

**Acción pendiente**: revisar si conviene introducir un campo `expected_to_be_running: <bool>` en el mapping local del entorno cuando se aborde la skill `state-inventory` v1.2, para que `state-diff` pueda distinguir "TEST apagado y se esperaba apagado" (no es noticia) de "AUDIT apagado pero debería estar levantado" (alarma real).

**Prioridad**: baja. Es información, no problema.

## 2026-05-09 — Detectadas durante el cierre de la sesión maratón

### Distribución assets_legacy (E9K9T7NBNQ1SI) deshabilitada compartiendo bucket con la canónica

**Origen**: snapshot `state-test-2026-05-09-1659.yaml` (v2), sección `cloudfront.distributions`.

**Hecho**: la distribución `assets_legacy` aparece en AWS con `Status=Deployed` pero `Enabled=false`, sin alias DNS, y apunta al MISMO bucket (`assets-sharemechat-test1`) que `assets_canonical`. Tiene además un WebACL (WAF) asociado.

**Impacto**: residuo de migración previa que sigue existiendo en AWS. No recibe tráfico DNS pero ocupa cuenta y posiblemente tiene coste residual del WAF asociado. Cualquier operación sobre el bucket compartido tiene que considerar el doble origen aunque solo uno esté operativo.

**Acción pendiente**:
1. Confirmar mediante logs/análisis que `assets_legacy` no está sirviendo nada vivo (al estar deshabilitada y sin alias DNS, no debería).
2. Eliminar la distribución y desasociar el WebACL si no se usa en otra parte.
3. Una vez eliminada, retirar `assets_legacy` del bloque `cloudfront_distributions` en `~/.sharemechat/state-mapping.yaml`.
4. Revisar si el patrón "fantasma" se replica en AUDIT y PRO al inventariarlos.

**Prioridad**: baja. No molesta operativamente. Cierre de orden y posible ahorro de coste residual.

### Schema v2 de state-inventory no captura Enabled ni WebACL/WAF de las distribuciones

**Origen**: detectado al inventariar `assets_legacy`. El agente tuvo que registrar el `Enabled=false` y la presencia de WAF en `metadata.notes` libre porque el esquema no los modela.

**Hecho**: el esquema v2 del snapshot recoge `status` (Deployed/InProgress) pero no `Enabled`. Tampoco captura asociación de WebACL.

**Impacto**: información operativa relevante queda en notas de texto libre, no en campos estructurados. La skill `state-diff` no puede comparar mecánicamente esos campos.

**Acción pendiente**: en la próxima evolución de la skill (v1.2 o v2), añadir al bloque `cloudfront.distributions[]`:

```yaml
- enabled: <bool>
  web_acl_id_alias: <alias lógico o null>
```

Esto requiere también extender el mapping local con un bloque opcional `web_acls` que dé aliases lógicos a los WebACL IDs reales.

**Prioridad**: baja. Mejora del esquema, no urgente.

### Cadena de servicios sharemechat-test-access-* en estados degradados

**Origen**: snapshots `state-test-2026-05-09-1002.yaml` (primera detección) y `state-test-2026-05-09-1659.yaml` (confirmación). Sustituye y amplía la deuda anterior "access-blocker failed".

**Hecho**: en EC2 TEST, los cuatro servicios systemd de la cadena de access logs/análisis están en estados no operativos:
- `sharemechat-test-access-blocker.service` → `failed` (DRY-RUN según descripción de la unidad).
- `sharemechat-test-access-classifier.service` → `not-found` (unidad no instalada).
- `sharemechat-test-access-normalizer.service` → `inactive`.
- `sharemechat-test-daily-report.service` → `inactive`.

**Impacto**: el pipeline de access logs (normalize → classify → block → report) que fue desplegado en TEST en modo DRY-RUN no está corriendo. No es bloqueante porque TEST está en DRY_RUN=1 (no afecta a tráfico real), pero la cadena entera no está produciendo las salidas advisory diarias que se esperaba.

**Acción pendiente**:
1. Decidir si la cadena se reactiva o se deprecara. Si se reactiva: instalar la unit `classifier`, arreglar el fallo del `blocker` (`sudo journalctl -u sharemechat-test-access-blocker -n 100`), arrancar `normalizer` y `daily-report`, y validar el flujo end-to-end.
2. Si se depreca: eliminar las units en limpio y borrar los scripts asociados de `ops/test-access-*/`.
3. Revisar `sharemechat-v1/ops/test-access-normalizer/`, `sharemechat-v1/ops/audit-access-normalizer/` para entender el alcance real.

**Prioridad**: baja. No afecta a tráfico productivo. Cierre de orden operativo.

## 2026-05-09 — Detectadas durante implementación de ADR-018 (blog estático)

### Backend no envía charset=utf-8 en Content-Type de /api/public/content/**

**Origen**: detectado al implementar `ops/scripts/prerender-blog.ps1`. PowerShell 5 `Invoke-RestMethod` corrompía tildes y eñes (`Cómo` → `CÃ³mo`). Verificado con `(Invoke-WebRequest "https://test.sharemechat.com/api/public/content/articles/<slug>").Headers["Content-Type"]` → devuelve `application/json` sin charset.

**Hecho**: las respuestas JSON de los endpoints públicos del blog no especifican `charset=utf-8` en el header `Content-Type`. Solo `application/json` a secas.

**Impacto**: cualquier cliente JSON conservador que respete RFC-2616 antiguo asume ISO-8859-1 cuando no hay charset explícito. Esto rompe tildes en clientes legacy: PowerShell 5, scripts antiguos, integraciones third-party que no anticipen el caso. Hoy mitigamos en el script de pre-render con un helper `Invoke-JsonGetUtf8` que decodifica explícitamente como UTF-8, pero la solución correcta es server-side.

**Acción pendiente**: Spring Boot debería emitir `Content-Type: application/json; charset=UTF-8` explícito en `ContentPublicController` y `SitemapController`. Opciones: anotar `produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8"` o configurar globalmente el `MappingJackson2HttpMessageConverter`.

**Prioridad**: media. Mitigado en el script actual. Hacer cuando se toque el backend.

### [CERRADA] Helper Invoke-JsonGetUtf8 sin timeout explícito en prerender-blog.ps1

**Origen**: nota del agente al sustituir `Invoke-RestMethod` por el helper UTF-8.

**Hecho**: el helper `Invoke-JsonGetUtf8` en `ops/scripts/prerender-blog.ps1` usa el timeout default de `Invoke-WebRequest` (100 segundos) en lugar de los 30 segundos que tenía la implementación original con `Invoke-RestMethod`.

**Impacto**: si el backend responde lentamente, el script se queda colgado más tiempo del razonable. No es problema en operación normal, pero si el backend está saturado o el endpoint colgado, el script bloquea el shell durante 100s.

**Acción pendiente**: añadir `-TimeoutSec 30` a la llamada `Invoke-WebRequest` dentro de `Invoke-JsonGetUtf8`.

**Prioridad**: baja. Pulido. Hacer en el próximo cambio al script.

**Cerrada en**: 2026-05-11 (Sub-pasada 2A.1). El script `prerender-blog.ps1` quedó archivado en `ops/scripts/archive/` tras la decisión de servir el blog desde la SPA React (ver [ADR-019](../06-decisions/adr-019-blog-spa-react.md), supersede a [ADR-018](../06-decisions/adr-018-blog-static-rendering.md)). Esta deuda deja de aplicar al desactivar la generación estática.

### [CERRADA] Coordinación frágil entre deploy-frontend.ps1 y prerender-blog.ps1

**Origen**: detectado durante validación de C2 (ADR-018).

**Hecho**: `deploy-frontend.ps1 <env> product` ejecuta `aws s3 sync --delete` contra `sharemechat-frontend-test/`, lo que **borra cualquier objeto S3 que no esté en el `build/` local**. Como los HTMLs estáticos del blog (`blog/<slug>` y `blog`) NO están en `build/` (los genera el script de pre-render por separado), un deploy del frontend producto borra el blog estático sin previo aviso.

**Impacto**: tras desplegar frontend producto sin regenerar el blog después, las URLs `/blog` y `/blog/<slug>` devuelven `AccessDenied` (S3 con OAC) hasta que se ejecute `prerender-blog.ps1`. En TEST es inocuo porque no hay tráfico real. En PRO sería un incidente de SEO real.

**Acción pendiente**: opciones:
1. Modificar `deploy-frontend.ps1` para que añada `--exclude "blog/*" --exclude "blog"` cuando `surface=product` (preferida por simplicidad).
2. Hacer que `deploy-frontend.ps1 <env> product` invoque automáticamente `prerender-blog.ps1 <env>` después del sync.
3. Documentar como invariante operativa: "después de cada `deploy-frontend.ps1 product` ejecutar siempre `prerender-blog.ps1`".

**Prioridad**: media. Crítica antes de PRO. En TEST es deuda contenida.

**Cerrada en**: 2026-05-11 (Sub-pasada 2A.1). Ya no hay blog estático: `/blog` y `/blog/<slug>` se sirven desde la SPA React. El cache behavior `/blog*` fue eliminado de la distribución frontend público, los objetos HTML residuales fueron borrados del bucket frontend público, y `prerender-blog.ps1` quedó archivado en `ops/scripts/archive/`. Ver [ADR-019](../06-decisions/adr-019-blog-spa-react.md) (supersede a [ADR-018](../06-decisions/adr-018-blog-static-rendering.md)). `deploy-frontend.ps1` deja de tener relación de coordinación con prerender alguno.

## 2026-05-12 — Detectadas durante Sub-pasadas 2B/2C/2D

### Placeholder genérico en el buscador del blog

**Origen**: smoke test de B5.1 (sidebar dinámico con buscador client-side).

**Hecho**: el `<input>` del buscador del sidebar usa `placeholder="Buscar en el blog…"`, texto neutro sin orientar al usuario sobre qué se puede buscar (título, categoría, keyword).

**Impacto**: cosmético. Decisión consciente tomada en B5.1 para no comprometerse con un patrón de búsqueda concreto antes de saber qué usan los usuarios reales.

**Acción pendiente**: cuando exista analítica de uso del buscador, refinar el placeholder con ejemplos representativos (ej. "Buscar por tema, categoría o palabra…"). Sin urgencia.

**Prioridad**: baja.

### text-transform: uppercase en ArticleBadge y ArticleCategoryPill crea inconsistencia visual con el sidebar

**Origen**: B5.1, validación visual del sidebar de categorías frente al detalle del artículo.

**Hecho**: el sidebar muestra el nombre de la categoría tal cual viene del backend (ej. "Conexión y conversación"). En cambio, `ArticleBadge` (cards del listado) y `ArticleCategoryPill` (cabecera del detalle) aplican `text-transform: uppercase` en `BlogStyles.js`, mostrando "CONEXIÓN Y CONVERSACIÓN" para la misma categoría.

**Impacto**: cosmético. Decisión consciente: el uppercase aporta acento editorial al badge/pill pero rompe la coincidencia literal con el sidebar.

**Acción pendiente**: si se quiere coherencia visual estricta, eliminar el `text-transform` del badge/pill (preferida) o aplicarlo también al sidebar. Decisión de diseño.

**Prioridad**: baja.

### logo192.png es favicon CRA, no logo de marca dedicado

**Origen**: C2 (JSON-LD `BlogPosting.publisher.logo`) y C4 (Open Graph del listado, `og:image`). Documentado en [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: el frontend usa `/logo192.png` (favicon que viene con Create React App) como `publisher.logo` en JSON-LD y como `og:image` del listado `/blog`. No es un asset de marca dedicado.

**Impacto**: la spec Open Graph recomienda 1200×630 mínimo para `og:image`; 192×192 queda lejos. Validadores como OpenGraph.xyz lo señalan. Previews sociales en Facebook/LinkedIn/X aparecen con un thumbnail genérico en lugar de un visual editorial de marca.

**Acción pendiente**: encargar/diseñar un `og-image.png` 1200×630 de marca SharemeChat. Sustituir las dos referencias en `BlogContent.jsx` (C4) y `BlogArticleView.jsx` (C2). Mantener `logo192.png` como favicon.

**Prioridad**: media. Mejorable visual y SEO social.

### og:image:width y og:image:height ausentes

**Origen**: C2 (detalle del artículo) y C4 (listado del blog). [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: el frontend emite `og:image` y `twitter:image` pero no las meta tags acompañantes `og:image:width` y `og:image:height`.

**Impacto**: algunos validadores Open Graph estrictos (LinkedIn antiguo, ciertos crawlers de previews) piden las dimensiones explícitas para reservar el espacio del preview antes de descargar la imagen. Sin ellas, el preview puede tardar más en pintarse o quedar degradado.

**Acción pendiente**: añadir `<meta property="og:image:width" content="...">` y `<meta property="og:image:height" content="...">` en `seoHelpers.js` consumiendo dimensiones reales del asset hero (requiere convención: heros en backend con dimensiones estandarizadas, o lectura del Content-Length / cabeceras).

**Prioridad**: baja.

### twitter:site y twitter:creator ausentes

**Origen**: C2 (detalle) y C4 (listado). [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: el frontend emite `twitter:card`, `twitter:title`, `twitter:description` y `twitter:image`, pero no `twitter:site` ni `twitter:creator`.

**Impacto**: cuando se comparte un artículo en X, el preview no atribuye el contenido a la cuenta oficial de SharemeChat ni al autor. Depende de que la marca tenga handle oficial activo.

**Acción pendiente**: cuando exista cuenta X oficial de SharemeChat, añadir `<meta name="twitter:site" content="@sharemechat">` (y opcionalmente `twitter:creator` por autor del artículo) en `seoHelpers.js`.

**Prioridad**: baja. Bloqueada por decisión de marca.

### URLs reales en iconos de redes sociales del blog

**Origen**: B6 (share row al pie del detalle del artículo).

**Hecho**: los enlaces de X, Meta, Instagram y TikTok del `ShareRow` en `BlogArticleView.jsx` apuntan a `href="#"` como placeholder. No son enlaces de compartir; son enlaces a los perfiles oficiales de la marca (decisión de B6).

**Impacto**: clicar en cualquier icono no lleva a ningún sitio. El usuario percibe la sección como rota o no funcional.

**Acción pendiente**: sustituir cada `href="#"` por la URL real del perfil cuando estén dados de alta. Si algún perfil no existe nunca, eliminar el icono correspondiente.

**Prioridad**: baja. Bloqueada por decisión de marca / cuentas oficiales.

### Limitación SPA para previews sociales sin JS

**Origen**: validación de C2 (Open Graph del detalle). Documentado en [ADR-019](../06-decisions/adr-019-blog-spa-react.md) y [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: Facebook, LinkedIn y WhatsApp **no ejecutan JavaScript** al previsualizar enlaces. Solo ven el baseline servido en `public/index.html` (C0): `<title>SharemeChat — Videochat 1 a 1 en directo</title>` + descripción genérica. Las meta tags dinámicas que `BlogArticleView.jsx` y `BlogContent.jsx` emiten en cliente quedan ignoradas por estos bots.

**Impacto**: cualquier enlace de un artículo compartido en FB/LinkedIn/WhatsApp muestra el preview genérico de la home, no el hero/título/descripción del artículo. Googlebot y X sí ejecutan JS y ven el SEO correcto.

**Acción pendiente**: dos caminos posibles, ambos descartados explícitamente en la fase actual:
1. Reintroducir prerendering selectivo del blog ([ADR-018](../06-decisions/adr-018-blog-static-rendering.md), Superseded).
2. Migrar el blog (o la SPA entera) a Next.js con SSG/SSR ([ADR-019](../06-decisions/adr-019-blog-spa-react.md), Opción 3 descartada por coste).

Reabrir la conversación si Search Console + analítica de tráfico social revelan que el blog está perdiendo CTR por previews degradados.

**Prioridad**: media-alta. Arquitectónica. Coste alto, valor variable según tracción del blog.

### Hardening del buscador del blog

**Origen**: smoke test B5 (sidebar dinámico con buscador client-side).

**Hecho**: el `<input>` del buscador en `BlogContent.jsx` no tiene `maxLength`, no aplica debounce y filtra los artículos client-side mediante operaciones sobre strings (no se construye `RegExp` ni se inyecta vía `dangerouslySetInnerHTML`). Hoy el riesgo XSS es nulo porque el filtro es 100% cliente y los strings se renderizan como texto plano.

**Impacto**: a tamaño actual ninguno. Cuando el buscador pase a server-side (probable cuando el listado crezca a cientos de artículos), heredará los riesgos clásicos: parametrización SQL, rate limiting, validación de longitud.

**Acción pendiente**:
1. Añadir `maxLength={120}` al `<input>` (defensa en profundidad).
2. Añadir debounce de 250-300ms en el `onChange` para no recalcular el filtro en cada keystroke.
3. Auditar al migrar a server-side: SQL parametrizado, rate limiting por IP, validación de longitud en backend.

**Prioridad**: media-alta. Bajo coste de las mitigaciones cliente; el bloque server-side se ataca cuando se haga la migración.

### Helpers de fecha y tiempo de lectura duplicados entre BlogContent.jsx y BlogArticleView.jsx

**Origen**: C4 reporte. Tras unificar `truncate` en `seoHelpers.js`, quedaron `fmtDate` y `getReadingMinutes` duplicados.

**Hecho**: las funciones `fmtDate(iso)` y `getReadingMinutes(html)` están definidas en `BlogContent.jsx` y `BlogArticleView.jsx` con implementación idéntica. `truncate` ya se unificó en C4 (vive en `seoHelpers.js`).

**Impacto**: bajo coste de mantenimiento pero divergencia silenciosa posible (si un fix se aplica solo en un sitio).

**Acción pendiente**: extraer ambas funciones a `frontend/src/pages/blog/blogHelpers.js` (módulo paralelo a `seoHelpers.js`) y reemplazar consumos en los dos componentes.

**Prioridad**: baja. Limpieza técnica.

### Styled muertos en BlogStyles.js

**Origen**: detectado en el plan 2B Sección D y confirmado durante B5 (al revisar consumidores de cada styled).

**Hecho**: los siguientes styled components en `frontend/src/styles/pages-styles/BlogStyles.js` no tienen consumidores tras 2B:
- `FeaturedSection`, `FeaturedCard`, `FeaturedContent`, `FeaturedVisual`, `FeaturedVisualPlaceholder`, `PlaceholderTop`, `PlaceholderBody`, `FeaturedTitle`, `FeaturedMeta`, `FeaturedExcerpt` (bloque "featured" deprecado al rediseñar el hero).
- `SidebarText` (sustituido por el nuevo sidebar dinámico de B5.1).
- `HeroAside`, `HeroAsidePlaceholder` y derivados (sin uso tras el rediseño del hero).

**Impacto**: ruido en el módulo de estilos, bundle JS ligeramente mayor (penalización despreciable en gzip por ser definiciones estáticas), confusión al iterar.

**Acción pendiente**: pasada de limpieza eliminando los styled muertos confirmados. Validar que ningún preview admin (`ContentArticleEditor.jsx`) los consume antes de borrar.

**Prioridad**: baja. Limpieza técnica.

### Bundle JS sin code-splitting de /blog

**Origen**: validación Test 4 de 2C. Confirmado en [ADR-020](../06-decisions/adr-020-blog-spa-seo.md) (Notas).

**Hecho**: la SPA carga un bundle único (~159 KiB gzip) que incluye los componentes del blog (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`, `BlogStyles.js`, `seoHelpers.js`) aunque el usuario nunca visite `/blog`.

**Impacto**: peso de bundle innecesario para sesiones que solo usan videochat / dashboards. Latencia de primera carga ligeramente mayor en mobile/3G.

**Acción pendiente**: introducir `React.lazy()` + `Suspense` en `App.js` para las rutas del blog, generando un chunk `blog.[hash].js` que solo se descarga al navegar a `/blog` o `/blog/<slug>`. Validar que el SEO en cliente no se rompe (el `useEffect` SEO se ejecuta tras hidratar el chunk).

**Prioridad**: baja. Performance.

### Pipeline IA Cowork: comillas dobles sin escapar en draft_markdown

**Origen**: error de parsing JSON al crear el artículo "elegir-videochat-seguro" durante Sub-pasada 2B.

**Hecho**: el JSON generado por el pipeline IA Cowork ([ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md)) puede contener comillas dobles internas sin escapar en el campo `draft_markdown` (por ejemplo, citas inline dentro de párrafos: `... dijo "esto" ...`). Esto rompe el parser JSON al ingestar el draft en el CMS.

**Impacto**: el operador debe editar manualmente el JSON antes de subirlo, escapando comillas o sustituyéndolas por comillas españolas. Fricción operativa recurrente.

**Acción pendiente** (para Fase 3 / hardening del pipeline):
1. Instruir al prompt de Cowork a usar comillas españolas «...» o comillas curvas (" ... ") en el cuerpo del Markdown.
2. Alternativamente, escapar comillas dobles internas con `\"` en el JSON generado.
3. Como red de seguridad, añadir un sanitizador previo al `JSON.parse()` en el flujo de ingesta del backoffice.

**Prioridad**: media. Fricción operativa.

### AdminAdministrationPanel.jsx usa usuario@sharemechat.com como placeholder

**Origen**: inventario D2 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)).

**Hecho**: el `<input placeholder>` de un campo de email en `AdminAdministrationPanel.jsx` usa el texto `usuario@sharemechat.com` como ejemplo. No es un email funcional ni se envía a ningún sitio.

**Impacto**: cosmético. El RFC 2606 reserva `example.com`, `example.org` y `example.net` para usos de ejemplo. Usar el dominio real puede confundir al operador.

**Acción pendiente**: cambiar el placeholder a `usuario@example.com` u otra forma neutra.

**Prioridad**: baja. Cosmético.

### Sin tests automatizados que verifiquen mapping visible↔tag en mailto

**Origen**: D2 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)).

**Hecho**: los 19 enlaces `<a href="mailto:contact+TAG@sharemechat.com">contact@sharemechat.com</a>` repartidos en 7 ficheros del frontend no tienen cobertura de tests que verifique que cada superficie usa el `+tag` correcto (`+web`, `+legal`, `+gdpr`).

**Impacto**: un typo (`+lega` en lugar de `+legal`, por ejemplo) pasaría inadvertido hasta que el operador lo notara en M365. Riesgo bajo a tamaño actual; crece si se añaden superficies.

**Acción pendiente**: cuando exista suite E2E (Playwright o Cypress), añadir un test que recorra cada pantalla con email visible y verifique el `href` exacto. Auditoría manual rápida disponible vía `grep -rn "mailto:contact+" frontend/src/` (debe devolver 19 ocurrencias).

**Prioridad**: baja. Mitigado mientras la convención esté documentada.

### /legal hardcoded en inglés sin i18n

**Origen**: análisis D1 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)) durante la incorporación del tab AI-Assisted Content.

**Hecho**: las 996 líneas de `frontend/src/footer/Legal.jsx` están en inglés literal, sin pasar por el sistema i18n (`react-i18next`). El resto de la SPA tiene textos i18n parciales (footer marketing, AgeGate), pero `/legal` queda fuera del sistema deliberadamente (decisión durante D1 al confirmar que toda la página era inglés hardcoded).

**Impacto**: si en el futuro se quiere `/legal` en español o cualquier otro idioma, hay que traducir 996 líneas a un JSON i18n y reescribir la estructura del componente. Coste no despreciable.

**Acción pendiente**: sub-pasada dedicada de i18n para `/legal` cuando exista decisión de marca/legal de tener versión multilingüe. Coordinar con asesoría legal para validar que el contenido traducido conserva equivalencia jurídica.

**Prioridad**: baja. Bloqueada por decisión de negocio.

### Blog SPA hardcoded en español sin i18n

**Origen**: análisis D1 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)).

**Hecho**: el blog público (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`) y sus styled-components (`BlogStyles.js`) contienen ~30-50 strings hardcoded en español: títulos de sección, mensajes de error, placeholder del buscador, labels del share row, copys de empty states, etc. No pasan por `react-i18next`. Los artículos en sí sí soportan `locale` (campo del backend), pero el chrome alrededor no.

**Impacto**: el atributo `locale` del artículo permite servir contenido en EN, pero el chrome queda en español. Inconsistencia visible si llega tráfico no hispanohablante. El hreflang preparado en C3 ([ADR-020](../06-decisions/adr-020-blog-spa-seo.md)) anticipa esta deuda pero no la resuelve.

**Acción pendiente**: sub-pasada de i18n del blog completo cuando exista demanda real de contenido en otros idiomas. Aprovechar la sub-pasada para revisar también el flujo de detección de locale (header `Accept-Language`, parámetro de URL, persistencia en localStorage).

**Prioridad**: baja. Bloqueada por decisión de negocio.

## Deudas cerradas durante 2026-05-09 (referencia histórica, ya resueltas)

### [CERRADA] Carpetas docs/skills/ y docs/_snapshots/ no registradas en governance

**Cerrada en**: commit `09263c7` con la creación de ADR-017 y la actualización de `documentation-governance.md` (Casos 8 y 9) y `docs/README.md`.

### [CERRADA] Campo flyway_table_present semánticamente engañoso en schema v1 de state-inventory

**Cerrada en**: commit `18dfe3a` con el bump de la skill `state-inventory` a v1.1. Reemplazado por el objeto `schema_versioning` con campos `flyway_runtime_present`, `manual_migrations_dir` y `last_manual_migration`.

### [CERRADA] Bug en el comando de deploy del frontend producto: invalidación de CloudFront equivocada

**Origen original**: detectado al inventariar las 4 distribuciones de TEST y comparar con el comando manual de deploy. El comando antiguo invalidaba `E1WZ44LRD39ZAO` (assets_canonical) en lugar de `E2Q4VNDDWD5QBU` (frontend_public), por lo que cada deploy del frontend producto NO refrescaba la cache real del frontend.

**Cerrada en**: commit `b1bf559` con el script `ops/scripts/deploy-frontend.ps1`. El nuevo script lee bucket y distribución del mapping local y nunca se vuelve a confundir entre superficies/entornos.

**Pendiente derivado**: cuando se inventaríen AUDIT y PRO, comprobar si los comandos antiguos sufrían el mismo error y ejecutar `deploy-frontend.ps1` también allí.

### [CERRADA] Cache behavior /blog* en CloudFront TEST con Managed-CachingDisabled

**Origen original**: decisión transitoria durante validación de ADR-018 para iterar rápido sin TTL bloqueando.

**Cerrada en**: 2026-05-09, vía CloudShell (`aws cloudfront update-distribution`). Cache policy del behavior `/blog*` cambiada de `Managed-CachingDisabled` (4135ea2d-6df8-44a3-9df3-4b5a84be39ad) a `Managed-CachingOptimized` (658327ea-f89d-4fab-a63d-7e88639e58f6). El cambio respeta los `Cache-Control` que el script `prerender-blog.ps1` ya pone en los objetos S3 (1h detalles, 10min listado).

**Pendiente derivado**: el snapshot v2 de TEST refleja el estado anterior; al regenerar el siguiente snapshot quedará reflejado el cambio. Replicar el patrón al desplegar AUDIT y PRO.