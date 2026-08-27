# Diagnóstico: MaintenanceOverlay al pulsar "Guardar campos SEO" tras 2C.1

**Fecha**: 2026-07-05
**Autor**: análisis asistido por IA (sesión de diagnóstico con el operador)
**Estado**: informe. No implementa ni prescribe fix; el operador decide.
**Alcance**: análisis de sólo lectura. No modifica código.

## 1. Reporte del operador y objetivo

Durante la validación visual E2E post-2C.1 el operador reporta que:

- Rellena en la pestaña ES `Primary keyword = "videochat 1 a 1"` y `Secondary keywords = "videochat premium, chat 1 a 1, ..."`.
- Pulsa **Guardar campos SEO**.
- Tras unos segundos aparece el `MaintenanceOverlay` con el `<title>1-to-1 Video Chat with Verified Models | SharemeChat</title>` (el mismo del producto público).
- En Network no se ve un `PATCH /api/admin/content/articles/{id}/translations/es` claro.
- En Console aparece `GET https://admin.test.sharemechat.com/api/users/me 401 (Unauthorized)`.

Objetivo: **entender la causa raíz sin asumir**. Diagnóstico, no fix.

## 2. Hipótesis iniciales

- **H1**: sesión admin caducada (access_token 15 min).
- **H2**: bug del `handleSaveSeo` introducido en 2C.1 en la propagación de `primaryKeyword` / `secondaryKeywords`.
- **H3**: bug preexistente en `MaintenanceProvider` / `http.js` que interpreta 401 como "backend caído".
- **H4**: CORS o baseURL mal, la petición sale contra un host equivocado y recibe HTML.
- **H5**: combinación.

## 3. Fase 1 — replicación

Todos los curls contra `https://admin.test.sharemechat.com`, con el mismo backend TEST (`git_commit=dfd60bd`) que sirve al frontend admin `git_commit=6516a12` desplegado en este mismo hostname.

### 3.1 Login (evidencia sesión fresca)

```
POST /api/admin/auth/login          → HTTP 200, Set-Cookie access_token + refresh_token
```

### 3.2 PATCH con sesión fresca

```
PATCH /api/admin/content/articles/9/translations/es
Cookie: access_token=<valid>; refresh_token=<valid>
Body: {"primaryKeyword":"test-diagnostico","secondaryKeywords":"a, b, c"}

Response:
  HTTP/2 200
  content-type: application/json
  size: 1430
  body: TranslationDetailDTO válido (primary + secondaries persistidos)
```

**Confirmado**: el backend responde correctamente al PATCH que la UI 2C.1 envía. El endpoint del CMS admin funciona. No hay bug en el backend para el flujo con sesión válida.

### 3.3 Simulación de sesión caducada (varios escenarios)

Escenario A — solo el `access_token` ha expirado (refresh_token vivo):

```
POST /api/auth/refresh
Cookie: refresh_token=<valid>

Response:
  HTTP/2 500
  content-type: application/json
  size: 223
  body: {"timestamp":"2026-07-05T17:38:31.865...","status":500,
         "error":"Internal Server Error",
         "message":"Ha ocurrido un error interno...",
         "path":"/api/auth/refresh"}
```

Escenario B — sin cookies (sesión completamente perdida):

```
GET  /api/users/me                                                    → HTTP 401, CT=<vacío>, body=""
POST /api/auth/refresh                                                → HTTP 401, CT=<vacío>, body=""
PATCH /api/admin/content/articles/9/translations/es                   → HTTP 401, CT=<vacío>, body=""
```

**Todas las respuestas 401** del backend **no llevan `Content-Type`** ni body. Solo status 401 + `content-length: 0`. Verificado en headers (`x-cache: Error from cloudfront`, sin conmutación al bucket de mantenimiento).

### 3.4 Backend log capturado para el 500 del refresh

```
2026-07-05T17:38:31.865Z ERROR c.s.exception.GlobalExceptionHandler
  : Error no controlado en /api/auth/refresh:
  No EntityManager with actual transaction available for current thread
  - cannot reliably process 'remove' call
org.springframework.dao.InvalidDataAccessApiUsageException:
  ...
  at com.sharemechat.controller.AuthController.refresh(AuthController.java:244)
Caused by:
  jakarta.persistence.TransactionRequiredException: ...
```

**Confirmado**: el `POST /api/auth/refresh` **rompe con 500** cuando el request cae en la línea 244 de `AuthController.refresh` (rama que se ejecuta si `!primaryRoleAllowed || !refreshProfile.roles().isEmpty()`) por falta de `@Transactional`. Detalle técnico en §5.

## 4. Refutación de las hipótesis por evidencia

### 4.1 H4 refutada — no hay CORS ni baseURL mal

El frontend admin sirve un único `index.html` desde `https://admin.test.sharemechat.com`. El cliente HTTP resuelve `API_BASE = '/api'` (`sharemechat-v1/frontend/src/config/api.js:1`) — **path relativo**. Todas las peticiones van al mismo hostname del navegador. Las peticiones que hace el navegador del operador salen a `admin.test.sharemechat.com/api/...` y responden desde el backend correcto.

El `<title>1-to-1 Video Chat...</title>` que ve el operador NO viene de una respuesta del backend en fallover: viene del propio `index.html` del bundle admin. Se puede verificar directamente:

```
GET https://admin.test.sharemechat.com/       →  <title>1-to-1 Video Chat with Verified Models | SharemeChat</title>
GET https://test.sharemechat.com/             →  <title>1-to-1 Video Chat with Verified Models | SharemeChat</title>
```

Ambos `index.html` del admin y del product **comparten el mismo template** con el mismo `<title>` genérico (SIZE=3613 idéntico). El bundle JS es distinto (`main.97e01812.js` admin vs `main.b392ac6d.js` product), pero el HTML base es el mismo. El operador vio el `<title>` del propio admin creyendo que era del producto.

**No hay CORS ni baseURL bug. H4 refutada.**

### 4.2 H2 refutada — `handleSaveSeo` de 2C.1 propaga correctamente

El `handleSaveSeo` reescrito en 2C.1 (`sharemechat-v1/frontend/src/pages/admin/content/ContentArticleEditor.jsx:456-489`) construye el payload con la comparación normal contra el estado actual de la translation:

```javascript
if ((seoDraft.primaryKeyword || '') !== (tr?.primaryKeyword || '')) {
  payload.primaryKeyword = seoDraft.primaryKeyword && seoDraft.primaryKeyword.trim()
    ? seoDraft.primaryKeyword.trim()
    : null;
}
if ((seoDraft.secondaryKeywords || '') !== currentSecondariesCsv) {
  payload.secondaryKeywords = seoDraft.secondaryKeywords || '';
}
```

El payload que produce (equivalente a `{"primaryKeyword":"videochat 1 a 1","secondaryKeywords":"videochat premium, chat 1 a 1, ..."}`) es exactamente el mismo que el PATCH curl que verifiqué en §3.2 con sesión válida → HTTP 200 JSON válido. **El PATCH de 2C.1 no tiene bug**.

**H2 refutada.**

### 4.3 H1 confirmada parcialmente — sesión caducada es el detonante

El `access_token` dura 15 min. Cuando el operador estuvo probando la UI post-2C.1 sin recargar durante más tiempo, su access_token expiró. El PATCH que dispara "Guardar SEO" es el primer request que ejerce ese estado y por eso el operador ve el fallo aquí. **Pero el 401 del PATCH en sí mismo no debería mostrar el overlay** (ver §4.4 y §5).

### 4.4 H3 confirmada — pero por un camino distinto al pensado

El `isMaintenanceResponse(res)` de `http.js:26-37`:

```javascript
const isMaintenanceResponse = (res) => {
  if (!res) return false;
  if (res.status === 502 || res.status === 504) return true;
  if (res.status === 503) {
    const productMode = (res.headers.get('x-product-mode') || '').toUpperCase();
    if (productMode === 'PRELAUNCH' || productMode === 'CLOSED') return false;
    return true;
  }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  return false;
};
```

Para un 401 con Content-Type vacío (lo que devuelve el backend):
- `status !== 502/503/504` → no maintenance por status.
- `ct = ''` → `''.includes('text/html')` = false → no maintenance por CT.

**`isMaintenanceResponse(401 sin CT)` devuelve false. El PATCH no dispara el overlay por sí solo.**

Lo mismo aplica al 500 del refresh: `status !== 502/503/504`, `ct = 'application/json'` → no maintenance.

**Con la evidencia curl, el overlay TÉCNICAMENTE no se debería activar por el flujo puro "PATCH → 401 → refresh → 500"**. Ninguna respuesta del backend en este flujo cumple la condición de `isMaintenanceResponse`.

**Pero H3 sí es real, por un camino más sutil descrito en §5.2**.

## 5. Causa raíz — dos bugs preexistentes concurrentes

### 5.1 Bug backend #B1: `AuthController.refresh` no es `@Transactional`

**Fichero**: [`sharemechat-v1/src/main/java/com/sharemechat/controller/AuthController.java:178-277`](sharemechat-v1/src/main/java/com/sharemechat/controller/AuthController.java:178)

`refresh()` invoca `refreshRepo.deleteByUserId(...)` en la línea 244 (rama que se ejecuta cuando el usuario del `refresh_token` es admin/backoffice: `!primaryRoleAllowed || !refreshProfile.roles().isEmpty()`).

`deleteByUserId` es un método Spring Data JPA que requiere transacción para el DML. El método `refresh()` **no** lleva `@Transactional`, así que salta `TransactionRequiredException: No EntityManager with actual transaction available for current thread`. El `GlobalExceptionHandler` la traduce a HTTP 500 con JSON genérico.

Consecuencia: **el operador admin nunca puede refrescar su sesión desde la UI del CMS**. Cuando el `access_token` caduca, el refresh silencioso que ejecuta `http.js:107-125` explota con 500 sin renovar cookies. El siguiente request seguirá viendo 401.

**Vector afectado**: usuarios cuyo `refresh` cae en la rama del check "no primary-role-allowed o con roles backoffice" — es decir, **exactamente los operadores admin del CMS**. No afecta a usuarios de producto (rol USER/CLIENT/MODEL sin roles backoffice), que devuelven 401 explícito con cookies borradas por otras ramas antes.

**Introducido por**: no lo introdujo 2C.1. Es un bug preexistente al menos desde el paquete de auth 2A que introdujo la defensa en profundidad de refresh (líneas 233-248). Verificable con `git log -L 233,248:sharemechat-v1/src/main/java/com/sharemechat/controller/AuthController.java` (fuera de scope este informe).

### 5.2 Bug frontend #F1: `isBackendAlive` demasiado estricto — el overlay no se apaga

**Fichero**: [`sharemechat-v1/frontend/src/components/MaintenanceProvider.jsx:40-47`](sharemechat-v1/frontend/src/components/MaintenanceProvider.jsx:40)

```javascript
const isBackendAlive = (res) => {
  if (!res) return false;
  if (res.status >= 502 && res.status <= 504) return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return true;
  return false;
};
```

Este helper lo llama `pingBackend` cada 30s **cuando el overlay está activo** para detectar si el backend ha vuelto y así apagarlo (`MaintenanceProvider.jsx:79-89`).

Para el 401 sin Content-Type que devuelve el backend (verificado en §3.3):
- `status < 502` → primer check pasa (no es 5xx que descarte).
- `ct = ''` → `''.includes('application/json')` = false.
- `return false` → **considera backend "caído"**.

Consecuencia: **una vez que el overlay se activa (por el motivo que sea — un 5xx real del backend, un HTML de fallover, un reboot temporal), no puede apagarse si la sesión del operador ha caducado**, porque el ping recibe 401 sin CT y `isBackendAlive` lo lee como "backend seguido caído".

El operador se queda con el overlay pegado hasta que hace login manual desde otra pestaña o borra cookies. En su navegador ve el overlay más el `<title>` del admin (que casualmente es el mismo que el del producto público, por §4.1).

**Introducido por**: paquete 10.A.3.pre (según el comentario del propio fichero). No lo introdujo 2C.1.

### 5.3 Cómo los dos bugs interactúan para producir el síntoma

Un escenario completo consistente con el reporte del operador:

1. Operador trabaja en el CMS durante >15 min sin refrescar la página.
2. El `access_token` caduca.
3. En algún momento entre "trabajar en la UI" y "pulsar Guardar SEO", ocurre un evento transitorio del backend TEST (un reinicio, un hipo, un despliegue anterior tuyo que provocó un 502 momentáneo, o incluso el propio deploy 2C.1 que aplicaste 30 min antes). Ese evento activa el overlay una vez.
4. El backend TEST vuelve enseguida (segundos).
5. Pero el `pingBackend` del `MaintenanceProvider` **nunca lo detecta** porque el `ping` va con `access_token` caducado, el backend responde 401 sin CT, y `isBackendAlive` devuelve false.
6. El operador pulsa Guardar SEO. La UI dispara el PATCH pero el navegador (Chrome DevTools) puede no mostrarlo en Network si el overlay se ha montado por encima e intercepta el click. O el PATCH sale pero da 401 (invisible detrás del overlay).
7. Paralelamente, `SessionProvider.loadMe()` al pulsar cualquier cosa reevalúa la sesión con `GET /users/me`, ese es el 401 que aparece en consola.
8. El overlay sigue montado. El operador cree que el problema es el 2C.1 porque acaba de pulsar el botón nuevo, pero no lo es.

**Este escenario es plausible con toda la evidencia disponible**. No pude reproducirlo con curl (mi cookie está fresca), pero encaja con lo que el operador ve y con los dos bugs preexistentes documentados.

### 5.4 Escenario alternativo (menos probable pero no descartable)

Si el operador tiene un service worker o caché HTTP agresiva del navegador, alguna petición asíncrona (bootstrap de i18n, prefetch de assets) pudo servir HTML cacheado con status 200 → `isMaintenanceResponse` devuelve true → activa el overlay. No pude verificar esto sin acceso al navegador del operador (validación E2E manual queda para el operador).

## 6. Distinción de responsabilidades

| Etiqueta | Descripción |
|---|---|
| **(a) Introducido por 2C.1** | Ninguno. El PATCH que la UI envía se procesa correctamente con sesión válida (§3.2). El `handleSaveSeo` propaga bien los campos (§4.2). |
| **(b) Preexistente que se manifiesta más ahora** | **Bug #B1** (backend refresh sin `@Transactional`, 500 al refrescar admin). **Bug #F1** (`isBackendAlive` no acepta 401 sin CT como "backend vivo"). Ambos existían antes de 2C.1; 2C.1 aumenta la interacción con la UI del admin (más clicks, más peticiones que ejercen el path de refresh silencioso) y por eso aparece más. |
| **(c) Comportamiento operativo esperado** | El 401 en `/api/users/me` de la Consola es esperado (sesión caducada). El diseño correcto sería refrescar via `refresh_token` y continuar transparente; el bug #B1 lo rompe. |

## 7. Recomendaciones de resolución (sin implementar)

### Fix Bug #B1 — trivial y de alta prioridad

Añadir `@Transactional` al método `AuthController.refresh(...)` (o mejor, extraer el bloque de rotación de tokens a un `AuthTokenService.refresh(...)` `@Transactional` que el controller invoque; separa concerns y evita transacciones grandes en el controller). Sub-pasada de auth dedicada; **no** meterlo dentro del ADR-045.

Impacto: cierra el vector "el admin no puede refrescar su sesión". Sin este fix, cualquier sesión admin de más de 15 min degrada a "operador ve errores 401 hasta que rehace login".

### Fix Bug #F1 — pequeño pero requiere pensar semántica

Ampliar `isBackendAlive` para tratar como "vivo" los 401/403 sin body **explícitamente**, no solo por CT. Por ejemplo:

```javascript
const isBackendAlive = (res) => {
  if (!res) return false;
  if (res.status >= 502 && res.status <= 504) return false;
  // Cualquier 4xx es señal de que el backend está vivo (respondió con
  // status HTTP significativo); no importa si tiene Content-Type.
  if (res.status >= 400 && res.status < 500) return true;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return true;
  return false;
};
```

Con esto, el ping de 30s apagaría el overlay cuando el backend responde 401 (sesión caducada) — el usuario ve la UI real de nuevo, y la próxima interacción dispara el flujo normal de "sesión caducada, refresca o pide login" en lugar de quedarse pegado en maintenance.

**Trade-off**: el matiz aquí es que un backend "vivo pero devolviendo 4xx a cualquier cosa" no es lo mismo que un backend "sano". Pero para el propósito del overlay (que existe para cubrir 5xx / HTML fallover), el matiz es aceptable.

**Alternativa**: dejar `isBackendAlive` estricto y en su lugar auto-apagar el overlay cuando lleva >X minutos activo sin haber recibido evidencia contraria (falla al lado seguro).

### Fix H2 hipotético (no aplica)

No hay que tocar el `handleSaveSeo` de 2C.1: el PATCH que envía es correcto (§3.2, §4.2).

### Mitigación operativa mientras los fixes no aterrizan

- Ante un caso de "veo el overlay pegado en el admin": borrar cookies del dominio `admin.test.sharemechat.com` en el navegador y volver a hacer login. Esto fuerza a que el ping devuelva JSON tras un login válido y desactiva el overlay.
- Aumentar el `access_token` TTL más allá de 15 min es una tercera opción que no resuelve la causa raíz pero difiere la aparición del síntoma. No recomendado como fix primario.

## 8. Preguntas abiertas

- ¿Cuánto tiempo llevaba el operador en la UI cuando pulsó Guardar SEO? Si fue >15 min sin refrescar, corrobora el escenario §5.3.
- ¿En el momento en que el operador vio el overlay, había otro operador o proceso reiniciando el backend TEST? El log del backend a esa hora ayudaría a corroborar el "evento transitorio" del §5.3.
- ¿El operador tiene service worker registrado en el subdominio admin? DevTools → Application → Service Workers muestra el estado.
- ¿Pasar al operador a modo incógnito reproduce el bug? Si no lo hace, refuerza la hipótesis del caché / service worker (§5.4).

## 9. Hallazgo no esperado

**Bug #B1 (backend refresh sin `@Transactional`) es un bug operativo de seguridad de sesión de nivel medio**: mientras dure, cualquier operador admin del CMS pierde su sesión cada 15 min sin posibilidad de refresh silencioso, lo que degrada la experiencia editorial de forma inaceptable en producción. Este hallazgo **no era el objeto principal del diagnóstico** — aparece como consecuencia directa de investigar el flujo del refresh.

Recomendable abrir subpasada de auth dedicada (probablemente `auth-B.2.x` o similar según la cronología del operador) y aterrizarla antes de que el CMS admin salga a AUDIT/PROD. Anotar en `known-debt.md` como **#B1** con severidad media si no se aterrizará inmediatamente.

## 10. Higiene

- Cookies obtenidas via login admin y filtradas para simular sesión caducada: **borradas** del scratchpad al terminar el diagnóstico.
- Payloads de curl guardados en scratchpad para consolidar la tabla del §3: **borrados** al terminar.
- Sin escritura a `/tmp/` del EC2 (aprendizaje 2A aplicado: verificaciones de log con `sudo tail` directo, sin redirects).

---

**Estado del diagnóstico**: completo. No se ha implementado ningún fix; el operador decide qué se aborda y en qué subpasada. Ni el ADR-045 ni la subpasada 2C.1 introducen el problema.

**ESTADO: COMPLETADO**
