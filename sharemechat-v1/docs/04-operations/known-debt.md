# Deudas técnicas conocidas

Registro de deudas detectadas durante operación o auditoría que no son incidencias urgentes pero conviene no perder. Cuando una deuda se cierre, mover su sección a `incident-notes.md` con marca de resolución y eliminar de aquí.

## 2026-05-25 — Detectada y resuelta durante refactor properties PRO-5.A

### [CERRADA] Rename de keys WEBRTC_TURN_* en .env de TEST y AUDIT antes del próximo deploy del JAR

**Origen**: PRO-5.A (frente de provisioning PROD, 2026-05-25). Refactor de `src/main/resources/application*.properties` para eliminar el sesgo TEST del fichero base y soportar tres entornos (`test`/`audit`/`prod`) con simetría. Durante el refactor se decidió migrar el naming de las env vars WebRTC TURN de `<ENV>_WEBRTC_TURN_*` (con prefijo de entorno) a `WEBRTC_TURN_*` (sin prefijo, valor distinto por `.env` de cada EC2). Grep exhaustivo en código Java confirmó cero dependencias del naming con prefijo en servicios o configuración (`@Value`, `@ConfigurationProperties`, `Environment.getProperty`), así que la migración es segura desde el punto de vista del backend.

**Hecho**: tras PRO-5.A, `application.properties` consume las 5 env vars sin prefijo:

- `WEBRTC_TURN_URL_UDP`, `WEBRTC_TURN_URL_TCP`, `WEBRTC_TURN_URL_TLS`
- `WEBRTC_TURN_USERNAME`, `WEBRTC_TURN_CREDENTIAL`

Pero las EC2 TEST y AUDIT en su `/opt/sharemechat/.env` siguen teniendo las keys con prefijo de entorno:

- TEST EC2: `TEST_WEBRTC_TURN_URL_UDP/TCP/TLS`, `TEST_WEBRTC_TURN_USERNAME`, `TEST_WEBRTC_TURN_CREDENTIAL`
- AUDIT EC2: `AUDIT_WEBRTC_TURN_URL_UDP/TCP/TLS`, `AUDIT_WEBRTC_TURN_USERNAME`, `AUDIT_WEBRTC_TURN_CREDENTIAL`

Mientras esas EC2 sigan corriendo el JAR antiguo (pre-PRO-5.A), el naming con prefijo sigue funcionando porque el JAR antiguo es quien consume esas keys. La deuda se activa el día que el operador decida subir el JAR refactorizado a TEST o AUDIT.

**Impacto si no se hace antes del deploy**: el backend arranca correctamente (las 5 properties tienen default vacío `${WEBRTC_TURN_URL_UDP:}` en `application.properties`, no fallan el bootstrap) pero las URLs TURN llegan vacías al backend. Resultado: el TURN relay queda desactivado, fallo silencioso de WebRTC en NATs difíciles (sesiones realtime fallan cuando uno o ambos peers están detrás de NAT simétrico o CGN). La degradación NO se detecta hasta que un usuario real intenta una sesión de matching/calling con red restrictiva.

**Acción pendiente**:

- Antes del próximo deploy del JAR refactorizado a TEST EC2: SSH a `test-backend`, editar `/opt/sharemechat/.env`, renombrar las 5 keys eliminando el prefijo `TEST_`:
  - `TEST_WEBRTC_TURN_URL_UDP` → `WEBRTC_TURN_URL_UDP`
  - `TEST_WEBRTC_TURN_URL_TCP` → `WEBRTC_TURN_URL_TCP`
  - `TEST_WEBRTC_TURN_URL_TLS` → `WEBRTC_TURN_URL_TLS`
  - `TEST_WEBRTC_TURN_USERNAME` → `WEBRTC_TURN_USERNAME`
  - `TEST_WEBRTC_TURN_CREDENTIAL` → `WEBRTC_TURN_CREDENTIAL`
- Antes del próximo deploy del JAR refactorizado a AUDIT EC2: SSH a `audit-backend`, editar `/opt/sharemechat/.env`, renombrar análogo eliminando el prefijo `AUDIT_`.
- Validación post-rename antes de arrancar el JAR nuevo: verificar con `grep -E '^WEBRTC_TURN_' /opt/sharemechat/.env` que las 5 keys están sin prefijo y con valor.
- Validación post-arranque: `curl https://<host>/api/webrtc/config` debe devolver `iceServers[2].urls` con valores poblados (`turn:...`, `turns:...`), no vacíos.

PROD desde día uno usará `WEBRTC_TURN_*` sin prefijo en su `.env` (creado en PRO-5 como parte del provisioning), por lo que esta deuda NO aplica a PROD.

**Prioridad**: media-alta. Bloqueante operativamente el día del deploy. Trivial de ejecutar (5 minutos por entorno). El riesgo real es olvidar el rename antes de reiniciar el servicio sharemechat-audit/test, lo que degrada silenciosamente la conectividad WebRTC.

**Cerrada en**: 2026-05-25, misma sesión que la apertura de la deuda (TAREAS 1+2 del cierre de PRO-5.A). Validación operativa completa antes del commit:

- **TEST EC2**: backend parado pre-cambio (TEST es arranque manual, no systemd). JAR antiguo backuped a `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.pre-PRO-5.A` (SHA `a840bec7723428ca3cf57b59b2380e4ece306a4aa795f273d348b4c07faba094`). JAR refactorizado desplegado (SHA `38e7a80bd79eb3ece12ee47fc44c582bfaf3ad03dd23b15e98ed4760d342be12`). `/opt/sharemechat/.env` con backup `.env.bak.pre-PRO-5.A` y 4 keys renombradas `TEST_WEBRTC_TURN_URL_UDP/TCP`, `TEST_WEBRTC_TURN_USERNAME/CREDENTIAL` → sin prefijo (TLS no estaba poblada en TEST, no aplicó). Backend arrancado con `nohup java -jar ... --spring.profiles.active=test`: bootstrap exitoso en 29.152 s, Flyway "Schema is up to date" (V1+V2+V3 sin movimiento), Tomcat 8080, sin errores de placeholder. Smoke tests OK: `/api/users/me` 401, `/api/public/content/articles?locale=es` 200, `/api/consent/model-contract/current` 200 con URL `assets.test.sharemechat.com/legal/...` (valida resolución correcta de `app.assets.base-url` desde `application-test.properties`).

- **AUDIT EC2**: ventana de mantenimiento ultra-corta (~10 s, `systemctl stop` 15:39:25 UTC → `Started SharemechatV1Application in 29.102 seconds` registrado a 15:39:57 UTC). JAR antiguo backuped a `.bak.pre-PRO-5.A` (SHA `a760d8bde8d2e68914ba43b484c4d69d349792426d90cb3fbed23b8d918fff04`). JAR refactorizado desplegado (mismo SHA `38e7a80b...`). `/opt/sharemechat/.env` con backup y 5 keys renombradas `AUDIT_WEBRTC_TURN_*` → `WEBRTC_TURN_*`. Verificación final con `cat /proc/$PID/environ` del MainPID del service: las 5 env vars `WEBRTC_TURN_URL_UDP/TCP/TLS/USERNAME/CREDENTIAL` presentes en el entorno del proceso java (TLS con valor vacío, coherente con el `.env` original AUDIT). Smoke tests OK: `/api/users/me` 401, `/api/public/content/articles?locale=es` 200, `/api/consent/model-contract/current` 200 con URL `assets.audit.sharemechat.com/legal/...`. Pipeline perimetral (`sharemechat-audit-access-normalizer/blocker/daily-report.service`) intacto tras el restart: timers visibles vía `systemctl list-timers` con next-runs esperados, normalizer disparó automáticamente 21 s después del restart.

- **PROD**: no aplica (la deuda era para TEST/AUDIT donde existían keys con prefijo de entorno; PROD desde día uno usará `WEBRTC_TURN_*` directamente en PRO-5).

Backups `.env.bak.pre-PRO-5.A` y `*.jar.bak.pre-PRO-5.A` conservados en ambos hosts por si rollback fuera necesario. La deuda queda completamente cerrada al cierre de TAREA 2 del paquete PRO-5.A (commit del refactor que incluye este known-debt actualizado).

## 2026-05-22 — Detectadas durante refactor 10.A.5

### URL mock hardcoded a TEST en VeriffClientImpl.java

**Origen**: detectado durante el grep exhaustivo del paquete 10.A.5 (refactor URLs hardcoded → properties). Fuera de scope explícito del paquete porque NO afecta al funcionamiento productivo.

**Hecho**: `src/main/java/com/sharemechat/service/VeriffClientImpl.java` línea 28 construye una URL inventada `String fakeUrl = "https://verification.test.sharemechat.com/mock/veriff/" + fakeSessionId;`. La URL se devuelve cuando el servicio Veriff está deshabilitado (mock mode), simulando lo que devolvería el provider real.

**Impacto**: nulo en producción (Veriff real no devuelve URLs `verification.test.sharemechat.com`; solo aparece cuando el mock está activo). En cualquier entorno donde el mock se active, la URL tiene "test" hardcoded en el host inventado.

**Acción pendiente**: cuando se toque el flujo Veriff (paquete de integración KYC real o limpieza del mock), parametrizar el host o usar un dominio neutro tipo `mock-veriff.local` que no sugiera "test" como entorno.

**Prioridad**: baja. Cosmético. No bloqueante.

## 2026-05-09 — Detectadas durante primer inventariado de TEST

### [CERRADA] Cache policy subóptima para /.well-known/acme-challenge/* en CloudFront TEST

**Origen**: snapshot `state-test-2026-05-09-1002.yaml`, sección `cloudfront.cache_behaviors`. Persiste en snapshots v2 posteriores.

**Hecho**: la cache behavior `/.well-known/acme-challenge/*` en la distribución CloudFront `frontend_public` de TEST tiene `cache_policy: Managed-CachingOptimized`.

**Impacto**: lo correcto sería `Managed-CachingDisabled` para que certbot vea respuestas frescas durante validaciones ACME. En la práctica funciona porque `Managed-CachingOptimized` honra el `Cache-Control` del origen, pero deja un margen de error si el origen alguna vez no envía esa cabecera.

**Acción pendiente**: cambiar la cache behavior a `Managed-CachingDisabled` en el próximo cambio CloudFront que toque la distribución `frontend_public`. Validar que también AUDIT y PRO siguen el mismo patrón cuando se inventaríen.

**Prioridad**: baja. Validar también en AUDIT y PRO al hacer la nivelación.

**Cerrada en**: 2026-05-20 (paquete 10.A.0), antes de iniciar la nivelación de AUDIT. Cambio aplicado en CloudFront TEST `E2Q4VNDDWD5QBU` con `aws cloudfront update-distribution` (ETag pre `E2NEU26H0UBU3V`, ETag post `E1Z8RZ5B6MIFUG`). El behavior `/.well-known/acme-challenge/*` pasa de `Managed-CachingOptimized` (`658327ea-…`) a `Managed-CachingDisabled` (`4135ea2d-…`). Distribución alcanzó `Deployed` en ~3 min. Validación post-cambio confirma `Managed-CachingDisabled` aplicado y la ruta sigue sirviendo desde el origen (`api-test-backend`). Detalle en [incident-notes.md](incident-notes.md) sección "Cierre deuda cache policy /.well-known/acme-challenge/* en CloudFront TEST". Pendiente verificar el mismo behavior en AUDIT y PRO al inventariarlos, replicando el cambio si aplica.

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

## 2026-05-17 — Detectadas durante hotfix CloudFront TEST (paquete 5)

### [CERRADA] CustomErrorResponses distribución-level en CloudFront AUDIT (probablemente) replica el bug arreglado en TEST

**Origen**: detectado durante el hotfix del paquete 5 sobre la distribución TEST `E2Q4VNDDWD5QBU` (`test.sharemechat.com`). El bug era una entrada `CustomErrorResponses` a nivel distribución que reescribía cualquier HTTP 404 (incluidos los legítimos del backend para `/api/.../{id-inexistente}`) en HTTP 200 sirviendo `/index.html` del frontend SPA desde S3. Resultado visible: el detalle de artículo público del blog devolvía 200 HTML en vez de 404 JSON, y por extensión cualquier endpoint admin con path variable (paquete 3) tenía el mismo agujero silencioso.

**Hecho**: el fix en TEST (2026-05-17) eliminó `CustomErrorResponses.Items` (pasó de `Quantity: 1` a `Quantity: 0`). El SPA-fallback ya estaba siendo gestionado por la CloudFront Function `redirect-spa-test` (viewer-request en default behavior) que rewritea URIs sin extensión a `/index.html` antes de tocar el origin. El `CustomErrorResponses` era redundante para SPA-routing y dañino para la API.

**Riesgo en AUDIT**: la distribución AUDIT `E1ILXV7P6ENUV8` (`audit.sharemechat.com`) probablemente comparte la misma topología (frontend SPA + backend API + Function análoga). Si tiene el mismo `CustomErrorResponses 404→/index.html`, comparte el bug latente. Hoy no se manifiesta porque AUDIT no tiene endpoints públicos con path variable activos (no se ha desplegado el CMS v2 todavía); cuando se replique el rediseño bilingüe en AUDIT, el bug aparecerá.

**Acción pendiente**:
1. Cuando se aborde el despliegue del CMS bilingüe en AUDIT, inspeccionar `CustomErrorResponses` de la distribución `E1ILXV7P6ENUV8` con `aws cloudfront get-distribution-config --id E1ILXV7P6ENUV8`.
2. Si está presente con el mismo patrón, eliminarlo (`Quantity: 0`) replicando el fix de TEST. Verificar antes que la Function análoga (probable `redirect-spa-audit`) ya gestiona el SPA-fallback en viewer-request — si no la tiene, NO eliminar `CustomErrorResponses` sin más; primero clonar la Function de TEST a AUDIT.
3. Smoke test post-fix equivalente al de TEST (`/api/public/content/articles/no-existe?locale=es` debe devolver 404 JSON, no 200 HTML).

**Riesgo en PROD**: la distribución frontend del producto en PROD aún no existe (solo `sharemechat-landing-prod`). Cuando se cree, **NO configurar `CustomErrorResponses 404→/index.html` a nivel distribución**. Usar exclusivamente CloudFront Function en viewer-request (estilo `redirect-spa-test` en TEST) para el SPA-fallback. Anotar en el runbook/ADR de despliegue de PROD.

**Prioridad**: media. No urgente en AUDIT mientras siga sin endpoints públicos path-variable activos. Bloqueante antes de habilitar CMS bilingüe en AUDIT.

**Snapshot pre-fix TEST**: guardado localmente en `C:\tmp\cf-test-pre-fix.json` (ETag pre `E1066XHKL8MRHZ`, ETag post `E2NEU26H0UBU3V`).

**Cerrada en**: 2026-05-21 (paquete 10.A.2), como segundo paso del frente 10.A de nivelación AUDIT. Inspección de la distribución `E1ILXV7P6ENUV8` confirmó el bug latente: `CustomErrorResponses.Quantity=2` con entradas `403 → /index.html (200)` y `404 → /index.html (200)`. Validación funcional pre-cambio: `curl https://audit.sharemechat.com/.well-known/acme-challenge/probe-<rand>` devolvía `HTTP/2 200` con `index.html` desde S3 (`server: AmazonS3`, `x-cache: Error from cloudfront`), confirmando que `CustomErrorResponses` estaba enmascarando el 404 del backend nginx y **rompería cualquier renovación HTTP-01 vía CloudFront** si en el futuro se intentara. Precondición `redirect-spa-audit` Function asociada al `viewer-request` del `DefaultCacheBehavior` confirmada antes del cambio (igual que en TEST). Fix aplicado vía `aws cloudfront update-distribution --id E1ILXV7P6ENUV8 --if-match E3UN6WX5RRO2AG` con `CustomErrorResponses.Quantity=0` y eliminación del array `Items` (junto con el fix análogo de cache policy acme-challenge en la misma pasada, ETag post `E1F83G8C2ARO7P`). Validación post-cambio confirma `curl /.well-known/acme-challenge/probe-<rand>` → `HTTP/2 404 desde nginx limpio`, `curl /ruta-inexistente-sin-extension` → `HTTP/2 200 + index.html via redirect-spa-audit Function` (SPA-fallback intacto). Detalle operativo en [incident-notes.md](incident-notes.md) sección "Fix CloudFront AUDIT 2026-05-21 (paquete 10.A.2)". El riesgo en PROD sigue vigente como nota documental: cuando se cree la distribución frontend del producto PROD, NO configurar `CustomErrorResponses 404 → /index.html` a nivel distribución; usar exclusivamente CloudFront Function en viewer-request.

### Assets `/logo192.png` y `/manifest.json` faltan en bucket S3 de TEST (devuelven 403 AccessDenied)

**Origen**: detectado durante smoke tests post-hotfix CloudFront TEST. Smoke test #12 (`/logo192.png`) y smoke test #18 (`/manifest.json`) devolvieron HTTP 403 AccessDenied de S3 (`<Error><Code>AccessDenied</Code>...`), no HTTP 200 con el asset.

**Hecho**: el bucket S3 frontend de TEST (`sharemechat-frontend-test`) está configurado con OAC (Origin Access Control). Con OAC, cuando un objeto no existe S3 devuelve 403 en vez de 404 (el bucket policy concede `GetObject` pero no `ListBucket`). Por tanto el 403 implica "el objeto no está en el bucket".

**Impacto**: ambos son assets que CRA genera por defecto en el build (`logo192.png` para PWA icon, `manifest.json` para PWA metadata). Su ausencia degrada la experiencia PWA (ícono de instalación, splash screen) pero no rompe la app. El usuario en navegador normal no nota nada; un usuario instalando como PWA puede ver iconos rotos.

**Confirmación de que NO es regresión del hotfix CloudFront**: el `CustomErrorResponses` eliminado solo gestionaba HTTP 404; los 403 no estaban siendo reescritos antes ni después. El comportamiento es idéntico pre/post fix.

**Acción pendiente**:
1. Verificar en el build del frontend (`frontend/build/` tras `npm run build`) si los archivos se generan localmente.
2. Si se generan localmente, revisar el script de deploy (`ops/scripts/deploy-frontend.ps1`) para confirmar que sube esos paths al bucket. Posible patrón de exclusión erróneo.
3. Si no se generan, revisar `public/manifest.json` y `public/logo192.png` en el repo del frontend.
4. Tras corregir, smoke test: `curl -i https://test.sharemechat.com/logo192.png` debe devolver 200 image/png.

**Prioridad**: baja. PWA install no es flujo crítico hoy. Cierre estético + cierre de iconos PWA cuando se decida priorizar.

## 2026-05-20 — Detectadas durante el cierre del paquete 8 (rediseño CMS bilingüe)

### Lista obsoleta de fases del pipeline editorial en `test.md`

**Origen**: `docs/03-environments/test.md` línea 205 aprox. Deuda preexistente: ADR-023 introdujo la fase 4.5 (`cms-translate-en`) sin actualizar esta enumeración, y [ADR-026](../06-decisions/adr-026-cms-builder-validator-split.md) introduce ahora la 5.5 (`cms-json-validator`) sin tocarla tampoco para no expandir scope.

**Hecho**: la línea describe los runs IA tipo `FULL_ARTICLE_ORCHESTRATED` y enumera las fases como `cms-research-seo → cms-draft-writer → cms-editorial-polish → cms-brand-legal-review → cms-json-builder`. Faltan 4.5 (`cms-translate-en`, obligatoria desde ADR-023) y 5.5 (`cms-json-validator`, obligatoria desde ADR-026). El pipeline real son 7 fases, no 5.

**Impacto**: documental. No bloquea operación porque el orquestador en Cowork (`cms-orchestrator.md`) sí refleja las 7 fases. Pero un agente o lector nuevo que se apoye en `test.md` para entender el pipeline tendrá una visión incompleta y desactualizada.

**Acción pendiente**: en un paquete documental de mantenimiento del entorno TEST, actualizar esa línea con las 7 fases reales del pipeline bilingüe. Aprovechar para verificar si hay otras referencias colaterales obsoletas en `docs/03-environments/` u otros documentos descriptivos.

**Prioridad**: baja. Mejora de coherencia documental, no urgente.

### Posible tabla `skills_pipeline` desactualizada en `ContentPromptBuilder.java`

**Origen**: detectado durante el paquete 8.C (integración de fase 5.5 en orquestador). NO verificado en código (fuera del alcance del paquete 8, que era exclusivamente skills + documentación). Anotación heredada del cierre del paquete 8.C.

**Hecho**: el backend genera el prompt orquestador del CMS desde `src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java`, método `appendFullArticleOrchestratedPipeline` (o equivalente). Si ese método contiene un bloque interno que lista explícitamente las fases del pipeline (típicamente una tabla XML-semántica `<skills_pipeline>` con filas tipo `Fase N - skill - output`), probablemente menciona las fases 1-5 (o 1-4.5 + 5 tras la actualización del ADR-023) sin la nueva 5.5.

**Impacto**: el prompt que el backend genera para Cowork puede no anunciar la fase 5.5 explícitamente. El orquestador en Cowork ya conoce la 5.5 por su MD actualizado y la ejecuta igual, pero la traza de auditoría queda menos limpia: lo que el backend dice que debería pasar y lo que Cowork ejecuta divergen en una fila.

**Acción pendiente**: paquete de backend posterior. Verificar primero si `ContentPromptBuilder.java` lista las fases explícitamente; si lo hace, añadir la 5.5 de forma aditiva (igual que [ADR-023](../06-decisions/adr-023-bilingual-editorial-pipeline-es-en.md) añadió la 4.5 en su día) sin reorganizar la lógica del método. Si no las lista (caso de que el bloque sea genérico y delegue todo el detalle a la skill orquestadora), no hay nada que tocar.

**Prioridad**: baja. No bloquea operación; solo coherencia entre backend y skills.