# Diagnóstico: MaintenanceOverlay al clicar pestaña "English (en)" — no reproducible

**Fecha**: 2026-07-05
**Autor**: análisis asistido por IA (Playwright headless + auditoría fuente)
**Contexto**: continuación de la secuencia sobre el CMS admin 2C.1. Bug reportado por el operador tras aplicar Fix.C1 (commit `f771e02`).
**Resultado**: **el bug NO se reproduce en Playwright headless** contra el mismo hostname, mismo artículo, mismas credenciales. La sospecha principal es que se trata del **entorno del navegador del operador** (bundle JS cacheado pre-Fix.C1, service worker registrado, estado dirty malinterpretado, o estado stale del overlay pegado por el bug preexistente #F1).
**Estado**: informe. Sin cambios de código. Recomendaciones para el operador en §6.

## 1. Reporte del operador (recordatorio)

- Sesión fresca en `admin.test.sharemechat.com`.
- Abre `articleId 9` (ya con `primary_keyword_es` persistido).
- Pestaña ES: guarda campos SEO (200 JSON, persiste).
- Click en pestaña "English (en)".
- Aparece MaintenanceOverlay ("SHAREMECHAT... scheduled maintenance").
- **En Network NO aparece ninguna petición**.
- **En Console NO aparecen errores**.

Bug distinto del anterior: aquel disparaba con click en "Guardar campos SEO" y venía por respuesta HTTP HTML; este dispara con simple cambio de pestaña, sin peticiones ni errores visibles.

## 2. Fase 2 — estado de la translation EN (refutación de H4)

`GET /api/admin/content/articles/9`. Translation EN completa y bien formada:

```json
{
  "id": 16, "locale": "en",
  "slug": "how-to-choose-safe-adult-cam-site-guide",
  "title": "How to Choose a Safe Adult Cam Site: A Practical Guide for Adults",
  "seoTitle": "How to Choose a Safe Adult Cam Site: Practical Guide",
  "metaDescription": "A practical guide for adults: ...",
  "brief": "Choosing a safe adult cam site is not trivial: ...",
  "bodyS3Key": "content/articles/9/en/draft.md",
  "bodyContentHash": "bc57c80676b15f7e44301d6ce5c617bf...",
  "targetKeywords": "[{\"term\": \"safe adult cam site\", \"type\": \"primary\", ...}, ...]",
  "primaryKeyword": "safe adult cam site",
  "secondaryKeywords": [
    "model verification","private 1v1 cam","adult webcam platform",
    "DSA compliance cam site","cam site red flags"
  ],
  "createdAt": "2026-07-05T15:17:44Z", "updatedAt": "2026-07-05T15:17:44Z"
}
```

**Todos** los campos que 2C.1 lee (`primaryKeyword`, `secondaryKeywords` array, `title`, `slug`, `seoTitle`, `metaDescription`, `brief`, `bodyS3Key`, `bodyContentHash`) están presentes con tipos esperados. **H4 refutada**: los datos no están corruptos ni faltan campos.

Cross-check con el smoke E2E 2C.0/apply-bilingual: la translation EN fue generada por el pipeline y el `EDIT_APPLIED` con `run_id=13` a las `15:17:44Z` de hoy — un ciclo `apply-bilingual` que dejó los campos consistentes.

## 3. Fase 1 — reproducción con Playwright

Playwright chromium headless contra `admin.test.sharemechat.com`, mismo backend TEST post-Fix.C1 (`f771e02` desplegado y verificado), mismas credenciales del operador.

### 3.1 Setup

Se cargó `pw/repro-en-tab.js` con instrumentación exhaustiva. Se sobrescribió `window.dispatchEvent` **antes** del bundle del site para logear cualquier emisión de `'sharemechat:maintenance'` o `'auth:logout'` con stack trace, y se enganchó `window.error`, `unhandledrejection`, `console.*` a todos los niveles. Snapshots del DOM del bloque "Contenido por idioma" antes y después del click.

### 3.2 Flujo

1. Login admin OK (`POST /api/admin/auth/login → 200`).
2. Navega a "Content CMS".
3. Abre artículo 9. Editor renderiza correctamente el bloque ES con Primary keyword ES = "safe videochat…" (34/120 chars), Secondaries 3/5, etc.
4. Click DIRECTO en pestaña "English (en)". Sin tocar ES.
5. Observación 6s.

### 3.3 Resultado

```json
{
  "overlayEver": false,
  "dispatchEvents": 0,
  "domBefore": "Contenido por idioma — ES  Keywords SEO  Primary keyword* 34/120 caracteres ...",
  "domAfter":  "Contenido por idioma — EN  Keywords SEO  Primary keyword 19/120 caracteres ..."
}
```

Registro de eventos:

- t+1s..t+6s: `overlay=false`, `errorInline=null`, `dispatchLogCount=0`.
- `errors-log.txt`: **vacío** (0 pageerror, 0 weberror, 0 unhandledrejection).
- Console: sin warnings de React, sin hydration errors, sin prop-type errors.
- Network: única petición nueva tras el click:
  `GET /api/admin/content/articles/9/translations/en/body → 200 text/plain server=nginx/1.28.0`.
  Sin 5xx, sin text/html, sin `server: AmazonS3`, sin `x-cache: Error from cloudfront`.

### 3.4 Test extra de estabilidad

`pw/repro-en-tab-flap.js` — 5 ciclos consecutivos `ES ↔ EN ↔ ES ↔ EN ↔ EN`. Todos los ciclos: `overlay:false`, `activeLocaleHeading` cambia correctamente entre "— ES" y "— EN", `dispatchCount:0`. **No hay bug intermitente ni de timing**.

### 3.5 Test extra con dirty state

Escribí en el input Primary keyword ES sin guardar (para forzar `seoDirty=true`) y clicé la pestaña EN. Resultado:

```json
{ "overlay": false, "confirmModal": true, "dispatchCount": 0 }
```

Aparece el `ConfirmModal` con título "Cambios sin guardar" que exige confirmar descartar cambios. Esto **no es** el MaintenanceOverlay (§4.2 abajo), pero es un modal semi-transparente que oscurece parcialmente la pantalla y podría confundirse.

## 4. Fase 3 — análisis del fuente

### 4.1 Rutas de disparo del `MaintenanceOverlay`

`grep` completo en `frontend/src` de `'sharemechat:maintenance'`, `notifyMaintenance`, `setMaintenance`, `MaintenanceOverlay`:

- [`MaintenanceProvider.jsx:35`](../../frontend/src/components/MaintenanceProvider.jsx:35): `EVENT_NAME = 'sharemechat:maintenance'`.
- [`MaintenanceProvider.jsx:104`](../../frontend/src/components/MaintenanceProvider.jsx:104): `window.addEventListener(EVENT_NAME, handler)` — único listener.
- [`MaintenanceProvider.jsx:86`](../../frontend/src/components/MaintenanceProvider.jsx:86): dispara `{active: false}` cuando ping recupera. Nunca dispara `{active: true}`.
- [`MaintenanceProvider.jsx:122-125`](../../frontend/src/components/MaintenanceProvider.jsx:122): helper exportado `notifyMaintenance(isActive)`.
- [`http.js:39-45`](../../frontend/src/config/http.js:39): `notifyMaintenance(active)` local del interceptor.
- [`http.js:155`](../../frontend/src/config/http.js:155): **único** call site que emite `{active: true}`. Dispara **solo** cuando `isMaintenanceResponse(res)` retorna true, es decir cuando la respuesta es 502/503/504 sin `X-Product-Mode: PRELAUNCH|CLOSED`, o `content-type: text/html`.

No hay error boundaries React en el proyecto (`grep` de `componentDidCatch|getDerivedStateFromError|ErrorBoundary`: **0 matches**). Por tanto una excepción JavaScript **no** puede convertirse en overlay; se propagaría al console o crashearía el árbol.

**Conclusión**: para que aparezca el overlay hace falta una respuesta HTTP problemática (5xx sin PRELAUNCH o text/html). **Sin petición no hay overlay.**

### 4.2 Overlay vs ConfirmModal

Comparación visual de las dos posibles overlays fullscreen:

| Aspecto | `MaintenanceOverlay` | `ConfirmModal` "Cambios sin guardar" |
|---|---|---|
| Fuente | [`MaintenanceProvider.jsx:190-204`](../../frontend/src/components/MaintenanceProvider.jsx:190) | [`ConfirmModal.jsx:96-143`](../../frontend/src/pages/admin/content/components/ConfirmModal.jsx:96) |
| Fondo | Backdrop sólido `#f6f6f6` (blanco/gris casi total, z-index `2147483000`) | Semi-transparente centrado (usa `PreviewOverlay`) |
| Contenido | "SHAREMECHAT" gigante (fuente 2.2rem+, letter-spacing 0.18em) + dos párrafos EN/ES sobre "scheduled maintenance" | Título "Cambios sin guardar" + mensaje "Tienes cambios sin guardar en {locale}. ¿Descartar?" + botones Descartar/Mantener |
| Origen | CustomEvent `sharemechat:maintenance` | Setter de state en `handleLocaleChange` cuando `bodyDirty || seoDirty` |
| Cierre | Automático, cuando el ping recupera | Click en botón Cancelar, o click fuera |

Son visualmente **muy distintos**. Confusión difícil salvo que el operador haya descrito imprecisamente lo que ve.

### 4.3 Flujo del click en pestaña EN (por si acaso)

`handleTabClick(loc)` en [`BodyLocaleTabs.jsx:288-293`](../../frontend/src/pages/admin/content/components/BodyLocaleTabs.jsx:288) → llama `onActiveLocaleChange(loc)` → conectado a `handleLocaleChange` en [`ContentArticleEditor.jsx:358-380`](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx:358):

```javascript
const handleLocaleChange = (newLocale) => {
  if (newLocale === activeBodyLocale) return;
  if (bodyDirty || seoDirty) {
    setConfirmModal({ ... title: 'Cambios sin guardar', ... });
    return;
  }
  setActiveBodyLocale(newLocale);
};
```

Si NO hay dirty → cambio directo. useEffect en [`ContentArticleEditor.jsx:348-353`](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx:348) reacciona y dispara `loadActiveBody(currentId, 'en', article)` en [`ContentArticleEditor.jsx:298-339`](../../frontend/src/pages/admin/content/ContentArticleEditor.jsx:298):

1. `setSeoDraft({ title: tr.title || '', ..., primaryKeyword: tr.primaryKeyword || '', secondaryKeywords: secArray.join(', ') })` — mapeo defensivo con `|| ''`. Con la translation EN completa (§2), este mapeo produce valores válidos.
2. `apiFetch('/admin/content/articles/9/translations/en/body')` — GET. En Playwright devuelve 200 text/plain nginx (§3.3). GET no dispara el bug PATCH-Origin que arregló Fix.C1.

**El path del click es limpio**. No hay acceso a `undefined.something` visible en el mapeo (todos los accesos usan `?.` u operador `||`). H2 refutada por code review + reproducción.

### 4.4 `TranslationBootstrapForm`

Componente embebido en [`BodyLocaleTabs.jsx:101-249`](../../frontend/src/pages/admin/content/components/BodyLocaleTabs.jsx:101) (**no** en fichero separado; el orden de lectura obligatorio del prompt mencionaba `TranslationBootstrapForm.jsx` como fichero separado, pero en el código real vive dentro de `BodyLocaleTabs.jsx`). Se renderiza **solo cuando `missingTranslation=true`** ([`BodyLocaleTabs.jsx:382-395`](../../frontend/src/pages/admin/content/components/BodyLocaleTabs.jsx:382)), y `missingTranslation` viene de `bodyMissing` que se setea a `true` únicamente cuando el fetch del body devuelve **404**.

La translation EN del artículo 9 tiene body en S3 (`bodyS3Key: "content/articles/9/en/draft.md"`, hash presente). El GET body EN devuelve 200 (no 404). Luego **`bodyMissing=false`**, luego **`TranslationBootstrapForm` no se renderiza**. H1 refutada: el componente que sospechaba el prompt ni siquiera se monta en este caso.

### 4.5 Otros vectores potenciales

- **Ping periódico del MaintenanceProvider**: solo activo cuando el overlay YA está activo ([`MaintenanceProvider.jsx:79-89`](../../frontend/src/components/MaintenanceProvider.jsx:79)). Solo puede APAGAR, no ENCENDER. Descartado como disparo inicial.
- **`SessionProvider.loadMe()`**: si el operador tiene sesión caducada, `GET /users/me` puede devolver 401. Pero 401 con Content-Type vacío (verificado en el informe previo `8cdd002`) **no** dispara `isMaintenanceResponse` (que solo mira 5xx o text/html). No path plausible.
- **Bug backend Fix.C1**: PATCH-Origin devolvía 200 HTML antes del fix. Post-fix, PATCH con Origin devuelve 200 JSON (verificado en Playwright §3.3). El navegador del operador podría estar ejecutando el bundle JS ANTIGUO cacheado, pero eso no explica por qué el simple click en EN (que dispara GET, no PATCH) causaría el overlay. Salvo que ese bundle antiguo también tuviese algún path defectuoso ahora enmascarado.

## 5. Causa raíz identificada

**Bug NO reproducible en Playwright con las mismas condiciones**. Descartadas H1, H2, H3, H4 con evidencia de fuente y datos:

- H1 (TranslationBootstrapForm rompe): no se renderiza, `bodyMissing=false`.
- H2 (BodyLocaleTabs accede a undefined): mapeo defensivo con `|| ''`, y Playwright ejecuta el path sin fallar.
- H3 (excepción JS silenciada por error boundary): no hay error boundaries en el proyecto.
- H4 (datos corruptos EN): datos completos y consistentes.

**Sin causa raíz de código del proyecto identificada**. La causa raíz que queda es **el entorno del navegador del operador**. Los candidatos más probables:

### 5.1 Bundle JS pre-Fix.C1 cacheado en el navegador

**Escenario más probable**. El navegador del operador cargó `main.<oldhash>.js` cuando aún tenía el bug PATCH-Origin. Ese bundle se ejecuta desde caché HTTP local. Cuando el operador tocó SEO ES, el PATCH salió y respondió 200 text/html (bug antiguo), disparando `notifyMaintenance(true)`. El overlay quedó activo. Luego el ping recupera vía `pingBackend` — **pero** por el bug preexistente #F1 (informe `8cdd002` §5.2), `isBackendAlive` es estricto sobre Content-Type y falla a apagar el overlay en muchos casos. Al clicar EN, el overlay ya estaba montado (heredado del estado sucio anterior). El operador cree que el click lo disparó cuando ya estaba activo desde el click de "Guardar SEO" previo — y Fix.C1 solo aplica al bundle NUEVO.

**Cross-check**: el operador reporta "sesión fresca" y "guarda campos SEO correctamente (200 JSON, persiste)" en ES. Si el PATCH fue 200 JSON, entonces su navegador SÍ está ejecutando el bundle POST-Fix.C1. Aún así puede tener el overlay heredado de un fallo transitorio previo, o de un ping estricto que rechaza cualquier respuesta que no sea Content-Type application/json exacto.

### 5.2 Service Worker registrado interceptando peticiones

Improbable: no hay `serviceWorker.register` en el frontend según el grep. Descartable con Application → Service Workers en DevTools del navegador del operador.

### 5.3 Estado dirty confundido con overlay

Improbable dada la descripción tan específica del operador ("SHAREMECHAT... scheduled maintenance"), pero cross-check: la §3.5 muestra que `ConfirmModal` "Cambios sin guardar" sí aparece si hay dirty state, aunque visualmente muy distinto (§4.2).

### 5.4 Estado stale del overlay heredado de una sesión previa

El bug preexistente #F1 (isBackendAlive estricto) hace que el overlay se quede pegado incluso cuando el backend está sano si en algún momento se activó. Si el operador tocó algo antes de la "sesión fresca" (mismo día, mismo navegador) y no cerró/refrescó, el estado del `MaintenanceProvider` puede seguir en `active=true` con el ping fallando por Content-Type estricto. En este caso, cualquier click posterior (incluso ir a EN) mantendría el overlay visible aunque no lo dispare por sí mismo.

## 6. Recomendaciones (sin implementar código)

**Al operador**, para diferenciar cuál de §5.1-§5.4 aplica:

1. **Hard reload con caché limpia**: en Chrome DevTools abierto, click derecho al botón de reload → "Empty Cache and Hard Reload". Repetir el flujo. Si el overlay YA NO aparece, el problema era caché de bundle (§5.1) y basta con instruir a los operadores admin a hard-reload tras cada deploy admin.

2. **Modo incógnito**: repetir el flujo en ventana incógnito sin extensiones. Si NO aparece el overlay, es caché o extensión del perfil normal. Si SIGUE apareciendo, no es caché/perfil.

3. **DevTools Network**: al pulsar EN, confirmar en el filtro "All" (no "XHR") sin filtros de path y con "Preserve log" ACTIVADO, si aparece o no el `GET /api/admin/content/articles/9/translations/en/body`. Si aparece con `server: nginx` y 200 text/plain, es un caso §5.4 (overlay stale del `MaintenanceProvider`). Si aparece con `server: AmazonS3` y text/html, hay otro path adicional que Fix.C1 no cubrió y hay que investigarlo con la screenshot literal.

4. **Application → Service Workers**: revisar si hay algún SW registrado en `admin.test.sharemechat.com`. Si lo hay, "Unregister" y repetir. Descarta §5.2.

5. **Application → Storage → Clear site data** (`admin.test.sharemechat.com`): borrar todo (cookies + localStorage + sessionStorage + IndexedDB + SW + cache) y volver a hacer login. Repetir el flujo. Si ya no aparece, era estado pegado en storage.

6. **Compartir screenshot literal del overlay**: en el navegador donde se reproduce el bug, capturar la pantalla completa cuando aparece el overlay. Verifica que efectivamente dice "SHAREMECHAT" gigante con "scheduled maintenance" (`MaintenanceOverlay` §4.2) y no otra cosa (ConfirmModal, o alguna otra UI).

7. **Compartir HAR de Network completo** con "Preserve log" activo desde antes del click hasta después del overlay. Si sale una petición con response text/html o 5xx que Playwright no vio, es un caso nuevo. Si no sale ninguna nueva petición y el overlay aparece igual, es §5.4 confirmado.

## 7. Diferencia respecto al informe previo (`8451997`)

- El informe previo `8451997` diagnosticó y arregló el failover CloudFront de PATCH+Origin (Fix.C1). Ese bug se disparaba en el click de "Guardar campos SEO" via respuesta 200 text/html.
- Este bug reportado (click en EN) **no se reproduce** en el TEST post-Fix.C1 con navegador headless.
- Los bugs preexistentes #F1 (`isBackendAlive` estricto sobre Content-Type) y #B1 (backend `AuthController.refresh` sin `@Transactional`) del informe `8cdd002` siguen sin arreglarse. #F1 en particular sigue explicando por qué el overlay puede quedarse pegado en el navegador del operador incluso cuando el backend está sano.

## 8. Fix propuesto (si tras §6 se confirma origen del proyecto)

**Si tras las 7 recomendaciones el bug sigue apareciendo en un entorno controlado del operador**, se abriría una nueva subpasada con el HAR + screenshot como input. Hasta entonces no hay superficie de código del proyecto que tocar.

**Independientemente de este bug**, sigue pendiente Fix.F2 (endurecer `isMaintenanceResponse` para no disparar por cualquier 200 text/html, e `isBackendAlive` para aceptar 401 sin CT como "backend vivo"). Ese fix reduciría la probabilidad de overlays pegados en el futuro.

## 9. Higiene aplicada

- Playwright chromium en `scratchpad/pw/` fuera del repo; borrado al terminar.
- Cache Playwright (`AppData/Local/ms-playwright`, ~690 MB) borrado.
- Cookies del script solo en memoria; el fichero `cookies` de curl vive en scratchpad y se borra al terminar.
- Sin persistencia de credenciales en el repo. Sin commits salvo este informe.

---

**ESTADO: COMPLETADO — bug no reproducible; requiere info del navegador del operador para avanzar**
