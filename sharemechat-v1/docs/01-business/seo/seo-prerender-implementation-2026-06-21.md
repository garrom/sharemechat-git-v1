# SEO pre-render implementation 2026-06-21

> Prompt 2/3 del paquete de pre-render del blog. PARTE A (infra) y PARTE B (dry-run) completadas con éxito. **PARTE C (deploy real a PROD) ABORTADA por drift check CRITICAL**: el deploy requiere decisión humana antes de continuar. Sistema PROD intacto, sin regresión.

## 1. Cambios aplicados

### Nuevos ficheros

- [`ops/scripts/prerender-blog/package.json`](sharemechat-v1/ops/scripts/prerender-blog/package.json) — manifest aislado del frontend, dependencia `puppeteer@^22.0.0`.
- [`ops/scripts/prerender-blog/render.js`](sharemechat-v1/ops/scripts/prerender-blog/render.js) — script Node con Puppeteer. Lee config JSON, lanza headless Chrome, para cada URL espera marker `body[data-blog-hydrated="true"]` (con fallback `title+canonical`), espera carga de imágenes (15s max, no aborta), captura `page.content()` y escribe `outDir/<url>/index.html`. Exit 0 si todas OK, 1 si alguna falló.
- [`ops/scripts/prerender-blog/.gitignore`](sharemechat-v1/ops/scripts/prerender-blog/.gitignore) — `node_modules/`, `out/`, `package-lock.json`.
- [`ops/scripts/prerender-blog-prod.ps1`](sharemechat-v1/ops/scripts/prerender-blog-prod.ps1) — orquestador PowerShell. Verifica node, instala dependencias si faltan, enumera slugs via backend (`GET /api/public/content/articles?locale={es|en}&size=200`), construye lista de URLs, genera config JSON sin BOM con `WriteAllText`, lanza `render.js`, verifica archivos generados, hace `aws s3 sync` a `s3://sharemechat-frontend-prod/blog/` con `content-type text/html; charset=utf-8` y `cache-control "public, max-age=300"`, limpia temporal. No invalida CloudFront (lo hace el caller).

### Ficheros modificados

- [`frontend/src/pages/blog/BlogContent.jsx`](sharemechat-v1/frontend/src/pages/blog/BlogContent.jsx): marker `document.body.setAttribute('data-blog-hydrated', 'true')` **dentro del bloque `if (articles.length > 0)`** tras `upsertJsonLd('blog-listing', jsonLd)`. Cleanup en el `return () =>` con `removeAttribute`. Sin tocar el resto del useEffect.
- [`frontend/src/pages/blog/BlogArticleView.jsx`](sharemechat-v1/frontend/src/pages/blog/BlogArticleView.jsx): marker `document.body.setAttribute('data-blog-hydrated', 'true')` justo tras `upsertJsonLd('blog-article', jsonLd)`. Cleanup en el `return () =>` con `removeAttribute`. Sin tocar el resto.
- [`ops/scripts/deploy-frontend.ps1`](sharemechat-v1/ops/scripts/deploy-frontend.ps1): añadido bloque **paso `[4.5/N]`** justo antes del paso `[5.5/N]` (update manifest). Condición de ejecución: `Environment=prod -and Surface=product -and -not StandbyMode`. Si el pre-render falla, log warning pero **NO aborta el deploy** (el bundle SPA ya está arriba; el CER 403→200 cubre el blog). Si OK, invalida `/blog/*` en CloudFront.

### Sin tocar

- Backend Java, `SitemapController.java`, `ContentPublicController.java`, `application-*.properties` — intactos.
- ADRs — no se cierra ninguna deuda existente en este prompt (lo hará el Prompt 3).
- Otros componentes frontend, sitemap.xml, robots.txt, función edge, CER.

## 2. Dry-run en PARTE B

Config dry-run construida con los 6 artículos publicados (3 ES + 3 EN) → 8 URLs:

```
/blog/es
/blog/en
/blog/es/que-es-videochat-1-a-1
/blog/es/elegir-videochat-seguro
/blog/es/foto-perfil-videochat
/blog/en/what-is-1-on-1-video-chat-vs-dating-apps
/blog/en/how-to-choose-safe-video-chat
/blog/en/profile-photo-video-chat-guide
```

`render.js` ejecutado contra el shell SPA actualmente desplegado en PROD (sin marker, así que cayó al fallback `title+canonical` en las 8 URLs). Output resumido:

```
Pre-render iniciado. hostname=https://sharemechat.com urls=8
[OK] /blog/es                                                 → 34440 bytes (fallback)
[OK] /blog/en                                                 → 34214 bytes (fallback)
[OK] /blog/es/que-es-videochat-1-a-1                          → 39151 bytes (fallback)
[OK] /blog/es/elegir-videochat-seguro                         → 39784 bytes (fallback)
[OK] /blog/es/foto-perfil-videochat                           → 40307 bytes (fallback)
[OK] /blog/en/what-is-1-on-1-video-chat-vs-dating-apps        → 38972 bytes (fallback)
[OK] /blog/en/how-to-choose-safe-video-chat                   → 39499 bytes (fallback)
[OK] /blog/en/profile-photo-video-chat-guide                  → 39974 bytes (fallback)
Resumen: 8 OK, 0 fallos.
```

Verificación de criterios (PARTE B paso B4) de los 8 archivos generados:

| Fichero | bytes | title específico | canonical | hreflang | JSON-LD | Internal links |
|---|---:|---|---|---:|---|---:|
| `blog/es/index.html` | 34 586 | "Blog · SharemeChat — Videochat 1 a 1 en directo" | `https://sharemechat.com/blog/es` | 3 | Blog + BlogPosting | **3** |
| `blog/en/index.html` | 34 262 | "Blog · SharemeChat — 1-on-1 live video chat" | `https://sharemechat.com/blog/en` | 3 | Blog + BlogPosting | **3** |
| `blog/es/que-es-videochat-1-a-1/index.html` | 39 340 | "Qué es el videochat 1-a-1 vs dating tradicional \| SharemeChat" | `https://sharemechat.com/blog/es/que-es-videochat-1-a-1` | 3 | BlogPosting | 2 |
| `blog/es/elegir-videochat-seguro/index.html` | 40 028 | "Cómo elegir un videochat seguro: guía para adultos \| SharemeChat" | `https://sharemechat.com/blog/es/elegir-videochat-seguro` | 3 | BlogPosting | 2 |
| `blog/es/foto-perfil-videochat/index.html` | 40 508 | "Cómo elegir una buena foto de perfil para videochat \| SharemeChat" | `https://sharemechat.com/blog/es/foto-perfil-videochat` | 3 | BlogPosting | 2 |
| `blog/en/what-is-.../index.html` | 39 014 | "What Is 1-on-1 Video Chat vs Dating Apps? \| SharemeChat" | `https://sharemechat.com/blog/en/what-is-1-on-1-video-chat-vs-dating-apps` | 3 | BlogPosting | 2 |
| `blog/en/how-to-.../index.html` | 39 529 | "How to Choose a Safe Video Chat Platform: Adult Guide \| SharemeChat" | `https://sharemechat.com/blog/en/how-to-choose-safe-video-chat` | 3 | BlogPosting | 2 |
| `blog/en/profile-photo-.../index.html` | 40 005 | "How to Choose a Profile Photo for Video Chat \| SharemeChat" | `https://sharemechat.com/blog/en/profile-photo-video-chat-guide` | 3 | BlogPosting | 2 |

**Criterios de aceptación cumplidos**:

- ✅ Cada artículo tiene title ESPECÍFICO (no el shell).
- ✅ Cada canonical apunta a la URL canónica del artículo.
- ✅ Listings tienen 3 internal links a artículos (= 3 artículos publicados por locale).
- ✅ Cada artículo tiene JSON-LD `BlogPosting`. Listings además tienen `Blog`.
- ✅ Content-length > 3192 en todos (mínimo 34 214 bytes, máximo 40 508).
- ✅ 3 hreflang en todos (es, en, x-default).

Dry-run **OK**. El fallback `title+canonical` funcionó: el SEO industrial post-hidratación de ADR-020 emite suficiente DOM como para que Puppeteer detecte que la SPA ha terminado de aplicar meta tags. Tras desplegar el bundle nuevo con marker `data-blog-hydrated`, la detección será directa (más rápida) y no necesitará caer al fallback.

## 3. Deploy ejecutado en PARTE C

**ABORTADO por drift check pre-deploy CRITICAL**. Output del paso `[0.5/N]`:

```
=== Drift pre-deploy: PROD / frontend_product ===
Manifest:       ops/deploy-state/prod.yaml
origin/main:    6cebf90

surface                        commit       age(d)     working-tree
-------                        ------       ------     ------------
backend (desplegado)           b0fa773      11.1       -
frontend_admin (desplegado)    0cdba7f      15.1       -
frontend_product (CANDIDATO)   6cebf90      -          DIRTY

Backend esta 104 commit(s) por detras de origin/main.

Severity: CRITICAL
Razones:
  - backend (b0fa773) != candidato a desplegar (6cebf90).
  - backend desplegado hace 11.1d (>72h).
  - working tree del repo SUCIO al construir (cambios de codigo sin commitear).
  - backend (b0fa773) esta POR DETRAS del candidato (6cebf90).
  - Entre backend y candidato se tocaron ficheros del contrato:
      sharemechat-v1/src/main/java/com/sharemechat/dto/UserDTO.java,
      sharemechat-v1/src/main/java/com/sharemechat/service/ProductOperationalModeService.java.

    *** SEVERITY CRITICAL ***
    Se han detectado cambios en ficheros del contrato entre el backend
    desplegado y el commit a desplegar. Si continuas, el frontend nuevo
    podria leer campos/lecturas del API que el backend no provee, con
    riesgo de pantallas rotas (como el incidente del 2026-06-08 en AUDIT).

DEPLOY ABORT: Severity CRITICAL en host NO interactivo.
```

Razón del bloqueo: el backend desplegado en PROD es de hace 11 días y está 104 commits por detrás de `origin/main`. Entre el commit del backend desplegado y el commit candidato a desplegar como frontend, se modificaron **ficheros del contrato API** (`UserDTO.java`, `ProductOperationalModeService.java`). Desplegar el frontend nuevo contra ese backend viejo arriesga repetir el incidente del 2026-06-08 (frontend con `productAccessMode` sobre backend 9 días anterior → MODEL y CLIENT viendo solo header+footer).

Adicionalmente, el working tree está dirty (mis cambios de los .jsx + ps1 + nuevos archivos + 4 docs SEO sin commitear).

**Cumplo la regla del proyecto** (CLAUDE.md, "Despliegue (CRÍTICO)"): *"En CRITICAL el script ABORTA SIEMPRE; la IA NO debe usar `-SkipDriftCheck` para sortear el prompt, debe PARAR y avisar al operador."*

**Sistema PROD intacto**. El abort ocurrió en el paso `[0.5/N]`, antes de cualquier modificación. El bundle SPA viejo sigue desplegado; el blog sigue funcionando como antes del prompt (sin HTML pre-renderizado, CER 403→200 cubre); cero regresión.

## 4. Verificación final post-deploy (PARTE C4)

**No aplica**. El deploy no se ejecutó. Sistema PROD intacto.

## 5. Estado final del bucket PROD

`s3://sharemechat-frontend-prod/blog/`: **vacío**. Estado idéntico al cierre del Prompt 1. El CER 403→200 en la distribución `E2FWNC80D4QDJC` sigue activo y sirve el shell SPA en todas las URLs del blog.

## 6. Tiempo total

| Fase | Tiempo |
|---|---|
| PARTE A — crear scripts + marker en .jsx + npm run build | ~6 min |
| PARTE B — npm install puppeteer + enumerar slugs + dry-run + inspección | ~7 min |
| PARTE C intento — drift check abort | ~1 min |
| Composición informe + tabla | ~3 min |
| **Total** | **~17 min** |

## 7. Incidentes

**Único incidente bloqueante: drift check CRITICAL antes de poder ejecutar PARTE C**. Detalle en sección 3.

Sub-incidentes menores (sin impacto):

1. **Working tree dirty**: tengo 6 ficheros modificados sin commitear (BlogContent.jsx, BlogArticleView.jsx, deploy-frontend.ps1, didit-setup.md del Prompt anterior, README cloudfront-functions del Prompt 1, redirect-spa-prod.js del Prompt 1) + 4 docs SEO nuevos + directorio prerender-blog/ nuevo. Esto contribuye al CRITICAL pero no es la causa raíz (el drift de backend lo es).
2. **Puppeteer deprecation warning**: `puppeteer@22.15.0` instalado, con warning *"< 24.15.0 is no longer supported"*. Funcional pero conviene actualizar a `^24` en un futuro mantenimiento. No bloqueante.

## 8. Comparación antes/después

**Aún no aplicable**. El deploy no se ejecutó. La comparación pendiente:

| URL | content-length antes | content-length después | title antes | title después |
|---|---:|---:|---|---|
| `/blog/es` | 3 192 | _pendiente_ | shell | "Blog · SharemeChat —..." |
| `/blog/en` | 3 192 | _pendiente_ | shell | "Blog · SharemeChat — 1-on-1..." |
| `/blog/es/que-es-videochat-1-a-1` | 3 192 | _pendiente_ | shell | "Qué es el videochat 1-a-1..." |
| `/blog/es/elegir-videochat-seguro` | 3 192 | _pendiente_ | shell | "Cómo elegir un videochat seguro..." |
| `/blog/es/foto-perfil-videochat` | 3 192 | _pendiente_ | shell | "Cómo elegir una buena foto de perfil..." |
| `/blog/en/what-is-1-on-1-video-chat-vs-dating-apps` | 3 192 | _pendiente_ | shell | "What Is 1-on-1 Video Chat vs Dating Apps?" |
| `/blog/en/how-to-choose-safe-video-chat` | 3 192 | _pendiente_ | shell | "How to Choose a Safe Video Chat Platform..." |
| `/blog/en/profile-photo-video-chat-guide` | 3 192 | _pendiente_ | shell | "How to Choose a Profile Photo..." |

El dry-run de PARTE B demuestra que el sistema es capaz de generar los HTMLs correctos (tabla de la sección 2). Falta solo subirlos a S3, lo cual ocurre en el paso `[4.5/N]` del deploy bloqueado.

---

## 9. Acciones requeridas del operador antes de proceder

El deploy PROD está bloqueado por una **deuda de despliegue de backend** que es anterior a este frente (backend en PROD lleva 11 días sin actualizar, 104 commits por detrás). El frente SEO no introdujo el drift; solo lo destapó al intentar desplegar.

Opciones por orden de preferencia:

**Opción 1 — desplegar backend primero (recomendada)**:

1. Identificar la causa del drift de backend (11.1 días). ¿Hay deuda operativa documentada, frente activo, o simplemente no se ha desplegado?
2. Desplegar el backend en PROD con `origin/main` actual (`6cebf90`) o el commit que el operador decida.
3. Tras backend Deployed + smoke OK, ejecutar `ops/scripts/update-manifest-backend.ps1 -Environment prod`.
4. Re-intentar el deploy frontend del Prompt 2 sin tocar nada de lo que está hecho. El drift check pasará (backend ya estará al nivel del candidato frontend).

**Opción 2 — el operador acepta el riesgo conscientemente**:

1. Verificar manualmente que los cambios en `UserDTO.java` y `ProductOperationalModeService.java` entre `b0fa773` y `6cebf90` son retrocompatibles (los campos nuevos del DTO son opcionales o no consumidos por la rama frontend que va a desplegarse).
2. Si confirma retrocompatibilidad, ejecutar el deploy con `-SkipDriftCheck`. Esto es una decisión humana que la IA NO puede tomar por sí misma según CLAUDE.md.

**Opción 3 — commitear primero el working tree** (sub-paso de opciones 1 y 2):

- Las 6 ediciones de archivos + 4 docs nuevos del frente SEO conviene commitearlos antes de re-intentar. Esto reduce el dirty flag pero **NO elimina** el CRITICAL (el drift de backend persiste).

**Lo que NO debería ejecutar la IA sin autorización explícita**:

- `-SkipDriftCheck`: viola la regla operativa del proyecto.
- `git commit` directo: hay cambios cross-frente (didit-setup.md no es mío) que conviene revisar primero.

---

## 10. Estado del sistema al cierre

| Componente | Estado |
|---|---|
| Función edge `redirect-spa-prod` (PROD) | Modificada (Prompt 1). LIVE en CF. Cero drift repo↔AWS. |
| CER 403→200 en distribución `E2FWNC80D4QDJC` | Activo (Prompt 1). |
| Bucket `s3://sharemechat-frontend-prod/blog/` | Vacío. Cliente sigue recibiendo shell SPA via CER. |
| Scripts pre-render (`prerender-blog/`, `prerender-blog-prod.ps1`) | Creados, validados localmente (PARTE A + B). |
| Marker `data-blog-hydrated` en BlogContent.jsx + BlogArticleView.jsx | Aplicado. Build npm OK. **Aún no desplegado a PROD**. |
| `deploy-frontend.ps1` con paso `[4.5/N]` pre-render | Modificado. Sintaxis OK. **Aún no probado en deploy real**. |
| Bundle SPA en `s3://sharemechat-frontend-prod/` | El del último deploy (`6cebf90`). **Sin cambios desde inicio de sesión**. Sin marker en producción. |
| Blog en `https://sharemechat.com/blog/*` | Sirviendo shell SPA con 200 OK (CER del Prompt 1). Sin pre-render todavía. Indexación SEO sigue como en el baseline (problema crítico del informe `seo-baseline-snapshot-2026-06-21.md` no resuelto aún). |

**Cero regresión introducida. El paquete está al 80% técnicamente, pendiente de la decisión operativa del operador sobre el drift de backend.**
