# ADR-033 — robots.txt fail-closed por entorno: solo apex PROD indexable

## Estado

Aceptada e implementada en backend el 2026-06-10. Despliegue en PROD pendiente del paso operativo de esta misma sesion.

## Contexto

El bundle frontend de SharemeChat es **uno solo** y se sirve desde tres distribuciones CloudFront distintas (TEST, AUDIT, PROD). Los tres entornos cargan exactamente el mismo `public/index.html` (3095 bytes, mismo hash). El diagnostico SEO empirico del 2026-06-10 confirmo que ese `index.html` contiene un `<link rel="canonical" href="https://sharemechat.com/">` hardcoded — la misma cadena en los tres entornos.

Ese canonical-incorrecto-a-PROD actua HOY como un **mitigador accidental de indexacion** de los entornos no-PROD:

- AUDIT (`audit.sharemechat.com`) NO tiene cableado el behavior `/robots.txt` en su distribucion CloudFront (`E1ILXV7P6ENUV8`). Una peticion a `audit.sharemechat.com/robots.txt` devuelve **HTTP 403 de S3** porque cae al default origin del bucket SPA y el objeto no existe. Googlebot lo interpreta como "sin restricciones" y asume permitido por defecto.
- TEST (`test.sharemechat.com`) si tiene los behaviors cableados (`state-test-2026-05-09-1014.yaml:128`), pero la EC2 backend de TEST se enciende y apaga manualmente. Cuando la EC2 esta apagada (verificado el 2026-06-10), `robots.txt` da timeout, lo que Googlebot tras varios reintentos tambien interpreta como permitido.
- En ambos casos, lo unico que evita HOY que Google indexe pre-prod como contenido autonomo es el canonical-a-sharemechat.com — una indirecta y subóptima señal de consolidacion.

El paso 3 del frente SEO pendiente es **eliminar ese canonical hardcoded** del `index.html` (para que las rutas SPA con su propio `<Seo>` o `seoHelpers` reciban el canonical correcto por ruta en lugar de canonical-a-home). Pero eliminarlo sin proteger AUDIT/TEST de otra forma reintroduciria el riesgo: AUDIT (en pleno onboarding PSP con Segpay) y TEST quedarian indexables sin mitigacion.

Hace falta un **mecanismo server-side, propio de cada entorno, que blinde la desindexacion antes** del cambio del canonical. Ese es el objeto de este ADR.

## Opciones consideradas

### Opcion 1 — Flag explicita `app.public.seo-indexable` con default false, solo PROD=true

Nueva property que cada `application-<env>.properties` declara explicitamente. `SitemapController.robots()` ramifica segun la flag.

Pros:
- Invariante de seguridad explicito en config; legible para auditor.
- Desacoplado del valor concreto de `app.public.base-url`.

Contras:
- Anyade superficie de configuracion que el operador debe recordar setear en cada entorno nuevo. Si se olvida en PROD nuevo, PROD desindexa — fail-closed pero exige accion.
- Duplicado parcial con la informacion que ya transmite `app.public.base-url`: el host PROD canonico ya esta versionado por ADR-015. Anyadir una flag paralela es ruido.

### Opcion 2 — Discriminante por normalizacion del host de `app.public.base-url` contra el apex PROD canonico

`SitemapController` parsea `app.public.base-url`, compara host (case-insensitive), esquema (`https`) y puerto (`-1`/`443`) contra `sharemechat.com`. Solo cuando los tres coinciden emite el robots indexable.

Pros:
- Reutiliza la property ya versionada por entorno (`application-prod.properties:33 = https://sharemechat.com`, `application-audit.properties:37 = https://audit.sharemechat.com`, `application-test.properties` analoga). No anyade nueva superficie de config.
- Fail-closed por diseño: baseUrl vacio, mal formado, `null`, esquema `http`, host distinto, www, puerto custom — todos derivan en `Disallow: /`.
- Auditable: un unico metodo privado `isProdApex()` con un literal constante. La fuente de verdad operativa esta en los `.properties` por entorno (versionados).
- Alineado con ADR-015 (el host PROD canonico es `sharemechat.com`, sin ambiguedad).

Contras:
- Acopla la decision al valor exacto de la property. Si en el futuro PROD se moviera (p.ej. a `chat.sharemechat.com`), habria que actualizar la constante `PROD_APEX_HOST` junto con el `.properties`. Bajo riesgo: cualquier movimiento de host PROD ya requiere reabrir ADR-015 y actualizar varios documentos.

### Opcion 3 — Inspeccionar el header `Host` de la peticion HTTP

Determinar indexabilidad a partir del host que el cliente envia, no de la config del backend.

Pros:
- No depende de config por entorno.

Contras:
- Spoofable trivialmente con `curl -H "Host: sharemechat.com"` contra cualquier backend, incluido el de AUDIT. Eso convierte el mecanismo en perforable.
- Acopla el contrato de robots.txt al contrato HTTP-Host, que es responsabilidad de la capa edge, no del backend. Reabre decisiones sobre `X-Forwarded-Host`, real_ip, etc.

Descartada por inseguridad.

## Decision

Se adopta la **Opcion 2**: discriminante por normalizacion del host de `app.public.base-url` contra el apex PROD canonico `sharemechat.com`. Solo si los tres elementos (esquema=`https`, host exacto, puerto default) coinciden, `robots.txt` emite el contenido indexable. En cualquier otro caso emite exactamente:

```
User-agent: *
Disallow: /
```

sin linea `Sitemap:`.

El cambio es **server-side puro**, vive en `SitemapController.robots()` (mismo fichero, mismo controller, sin nueva property). El metodo `sitemap()` no se toca en este ADR (sigue sirviendo el sitemap del blog; cuando un entorno no-PROD reciba peticiones a `/sitemap.xml`, el contenido sigue siendo el del blog si hay articulos publicados, pero al estar el robots como `Disallow: /`, Googlebot no llegara a procesar el sitemap).

## Justificacion

El criterio dominante es **fail-closed**: cualquier discrepancia o error de configuracion debe **desindexar**, nunca indexar.

La Opcion 2 cumple este criterio reusando una sola property que ya esta versionada por entorno (`app.public.base-url`). El operador no necesita recordar ninguna flag adicional: la pregunta "este entorno se indexa?" se contesta inspeccionando un valor que el operador ya tiene que setear por otra razon (ADR-015, hosts canonicos por entorno).

Las otras opciones o anyaden superficie de configuracion (Opcion 1: nueva flag paralela) o son inseguras (Opcion 3: discriminacion por Host header spoofable).

## Impacto

### Codigo
- `src/main/java/com/sharemechat/content/publishing/SitemapController.java`:
  - Nuevas constantes `PROD_APEX_HOST` y `ROBOTS_DISALLOW_ALL`.
  - Nuevo metodo privado `isProdApex()` (parsea baseUrl como `URI`, comprueba esquema https, host exacto, puerto default).
  - `robots()` ramifica al inicio: si `!isProdApex()`, responde `ROBOTS_DISALLOW_ALL`; en caso contrario, sirve el robots indexable previo (sin cambios sobre el contenido indexable historico).
  - `sitemap()` intacto.
- `src/test/java/com/sharemechat/content/publishing/SitemapControllerRobotsTest.java`: 11 tests cubriendo apex PROD, trailing slash, TEST, AUDIT, www, http, host desconocido, vacio, null, malformado, puerto custom.

### Operaciones
- PROD: tras desplegar el JAR, `https://sharemechat.com/robots.txt` debe seguir sirviendo el contenido indexable previo (Allow:/blog, Disallow:/api/..., Sitemap:). Es el **smoke-gate de aborto**: si PROD devuelve `Disallow: /`, restaurar JAR previo inmediatamente y reportar.
- TEST/AUDIT: una vez se actualice su backend con este JAR, su `robots.txt` pasara a `Disallow: /`. Mientras tanto, su comportamiento actual se mantiene (timeout en TEST, 403 en AUDIT).

### Landmine AUDIT — registrada en known-risks.md

Una vez se elimine el canonical hardcoded del `index.html` (paso 3 del frente SEO) y ese bundle se promueva a AUDIT, AUDIT quedara **sin canonical y sin robots.txt accesible** (la distribucion `E1ILXV7P6ENUV8` no tiene behavior `/robots.txt`). Antes de promover ese bundle a AUDIT, hay que cablear el behavior CloudFront `/robots.txt` -> `api-audit-backend` en `E1ILXV7P6ENUV8`. Esta accion vive en `known-risks.md`.

## Consecuencias

Positivas:
- AUDIT y TEST dejan de depender del canonical-incorrecto-a-PROD para no indexarse.
- Habilita el paso 3 del frente SEO (eliminar canonical hardcoded de `index.html`) sin reintroducir riesgo de indexacion pre-prod.
- Cualquier mal-config futura (host nuevo no contemplado, baseUrl vacio, esquema http) desindexa automaticamente.

Negativas:
- AUDIT/TEST `/robots.txt` ya no aporta señal positiva al equipo si se inspecciona como herramienta de diagnostico (cualquier visita devuelve `Disallow: /` sin distinguir motivo).
- Si en el futuro se quisiera permitir indexar un entorno no-PROD (p.ej. un staging publico con contenido publicado), requeriria abrir un ADR de ampliacion del discriminante (anyadir hosts adicionales al criterio, o pasar a Opcion 1 con flag explicita).

Trade-off asumido:
- Se prefiere fail-closed silencioso (todos los no-PROD = Disallow:/) sobre indexable por error en un entorno no-PROD.

## Notas

- El cambio NO toca el canonical del `index.html`. Eliminar ese canonical es responsabilidad del paso 3 del frente SEO, que reabrira este punto cuando se ejecute.
- El paso 1 del frente SEO (publicacion de `og-default-1200x630.png` en `assets-sharemechat-prod/brand/`) se completo el 2026-06-10 sin tocar codigo.
- La integracion con el check de drift (`check-deploy-drift.ps1`) no se modifica: `SitemapController.java` no entra en la lista de "ficheros del contrato" (esa lista cubre el contrato API frontend/backend, no la capa SEO server-side).
