# Investigación: scroll de página en Dashboard tab favoritos (2026-08-08)

**Estado:** BLOQUEADO — Claude Code no consiguió resolverlo en la sesión del 2026-08-08 tras varias iteraciones. Se documenta aquí para retomar en sesión limpia sin repetir pasos.

**Owner de la investigación:** pendiente asignar.

---

## 1. Bug

En el Dashboard cliente (`sharemechat-v1/frontend/src/pages/dashboard/DashboardClient.jsx`) y modelo (`DashboardModel.jsx`), tab **favoritos**, cuando se selecciona un contacto con historial P2P largo (~15+ mensajes), la **página entera hace scroll de body** en lugar de que el scroll viva dentro del `StyledChatScroller` propio del chat.

Consecuencia: composer del chat ("Escribe un mensaje...") y footer "SharemeChat®" quedan fuera del viewport hasta que el user hace scroll manual hacia abajo.

Comportamiento correcto esperado: página fija en 100vh, chat interno con su propio scroller (patrón tipo WhatsApp Web).

## 2. Reproducción

1. Login en `test.sharemechat.com` (o `audit`, o `prod` cuando aplique).
2. Ir a tab **Favoritos**.
3. Seleccionar un contacto con muchos mensajes en el historial (los que tienen ~15+ mensajes). En TEST, contactos `Guarris` y `Laracraf` reproducen; `modelstudio2` no reproduce porque tiene pocos mensajes.
4. La página aparece con scroll de body. Cuentas los bubbles: cerca de `document.querySelectorAll('[data-kind="favorites-chat"] div').length ≈ 100+` divs.

**Nota**: se manifiesta más si DevTools está abierto ocupando parte de la pantalla (viewport reducido a ~330-460px alto). Con viewport grande y pocos mensajes puede no verse.

## 3. Origen histórico

`StyledContainer` (definido en `sharemechat-v1/frontend/src/styles/NavbarStyles.js`) nació con `min-height: 100vh` desde el commit inicial `7e6b543` (2025-10-30). Es shared por 15+ vistas (dashboards, perfiles, KYC, coming-soon, etc.).

Para vistas de contenido con scroll de página (perfil, blog público, KYC steps) `min-height: 100vh` es correcto. Para dashboards con chat/streaming internos es incorrecto — permite que la cadena flex crezca con el contenido.

Bug latente desde ~9 meses. Solo se ha notado ahora porque hasta hoy no se había cargado un chat P2P con historial suficientemente largo combinado con viewport pequeño.

## 4. Cadena DOM real (diagnóstico DevTools 2026-08-08)

De abajo hacia arriba, con el bug activo (viewport innerHeight=327px por DevTools abierto, body.scrollHeight=2861):

| # | tag | class                              | box_h | overflow  | flex        | display | min-height |
|---|-----|-----------------------------------|-------|-----------|-------------|---------|------------|
| 0 | DIV | sc-bPkUNa eJSvhq (StyledChatWhatsApp) | 2387  | auto      | 1 1 0%      | block   | 0          |
| 1 | DIV | sc-gFqXPY jOsXow                  | 2452  | visible   | 1 1 0%      | flex    | 0          |
| 2 | DIV | sc-lkCrJH hmIqJs                  | 2452  | hidden    | 1 1 0%      | flex    | 0          |
| 3 | DIV | sc-gDzyrw gOcWKK                  | 2452  | hidden    | 1 1 0%      | flex    | 0          |
| 4 | DIV | sc-dTWiOz gIuyHK                  | 2452  | visible   | 1 1 0%      | flex    | 0          |
| 5 | DIV | sc-cpclqO dSkGIn                  | 2452  | visible   | 1 1 0%      | flex    | 0          |
| 6 | DIV | sc-fOOuSg sc-iIvHqT (StyledCenter) | 2452 | hidden    | 1 1 auto    | flex    | 0          |
| 7 | DIV | sc-boKDdR gTLZGU (StyledMainContent) | 2484 | hidden  | 1 1 0%      | flex    | auto       |
| 8 | DIV | sc-itBLYH jQqeix (StyledContainer)  | 2547 | **visible** | 0 1 auto  | flex    | **100vh** (327px) |
| 9 | DIV | #root                             | 461   | visible   | 0 1 auto    | block   | 461px      |
| 10 | BODY |                                | 461   | auto      | 0 1 auto    | block   | 461px      |
| 11 | HTML |                                | 461   | visible   | 0 1 auto    | block   | 461px      |

**Culpable identificado: fila 8, `StyledContainer`**. Debería tener `height: 100vh; overflow: hidden; min-height: 0` para restringir la cadena flex de abajo. En su lugar aplica el default `min-height: 100vh` que permite crecer con contenido.

Verificado con `getComputedStyle(el).height` = 2547.72px, `overflow` = visible, `minHeight` = 327px (= 100vh actual).

## 5. Cambios intentados en la sesión del 2026-08-08 (todos SIN ÉXITO)

Se pasó `<StyledContainer data-layout="fixed" data-tab={activeTab}>` en `DashboardClient.jsx:3098` y `DashboardModel.jsx:3329`. El atributo `data-layout="fixed"` **SÍ aparece en el DOM** (verificado con `el.getAttribute('data-layout')` → `'fixed'`).

Se probaron 3 variantes del CSS condicional en `StyledContainer` (`sharemechat-v1/frontend/src/styles/NavbarStyles.js`). Ninguna hace que la regla condicional se aplique en runtime:

### Intento 1 — CSS nested attribute selector
```javascript
export const StyledContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #111418;
  color: #e0e0e0;

  &[data-layout="fixed"] {
    height: 100vh;
    min-height: 0;
    overflow: hidden;
  }
`;
```
Bundle compila la regla (verificado con `grep 'data-layout' build-product/static/js/*.chunk.js`). DOM tiene el attribute. Computed style: `overflow: visible height: 2547px min-height: 100vh` → regla condicional NO aplica.

**Commit:** `7484e71` (frontend deploy `main.501afd68.js`). Revertido por bundle siguiente.

### Intento 2 — Ternary con `css` helper de styled-components
```javascript
import styled, { css } from 'styled-components';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: #111418;
  color: #e0e0e0;

  ${props => props['data-layout'] === 'fixed' ? css`
    height: 100vh;
    min-height: 0;
    overflow: hidden;
  ` : css`
    min-height: 100vh;
  `}
`;
```
Mismo resultado. Computed: `height: 2645.83px, minHeight: 327px (100vh), overflow: visible`. La rama ELSE está activa (aplica `min-height: 100vh`); la función `${props =>}` sí se ejecuta pero devuelve el ELSE aunque el DOM confirme `data-layout="fixed"`.

**Commit:** `cb606ff` (bundle `main.9efd2bf1.js`).

### Intento 3 — Declaraciones planas condicionales (mismo pattern que `StyledMainContent.overflow` que SÍ funciona)
```javascript
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: #111418;
  color: #e0e0e0;
  height: ${props => props['data-layout'] === 'fixed' ? '100vh' : 'auto'};
  min-height: ${props => props['data-layout'] === 'fixed' ? '0' : '100vh'};
  overflow: ${props => props['data-layout'] === 'fixed' ? 'hidden' : 'visible'};
`;
```
Bundle `main.81304111.js` desplegado. Sigue igual: `height: 2547.72px overflow: visible`. Ni ventana incógnita ni Ctrl+Shift+R lo arregla. Bundle correcto cargado (confirmado en Network).

**Commit:** `7442ff2` (bundle `main.81304111.js`, actualmente desplegado en TEST).

### Contraste que debería funcionar pero no
`StyledMainContent` en `sharemechat-v1/frontend/src/styles/pages-styles/VideochatStyles.js:135` usa el mismo pattern y SÍ funciona:
```javascript
overflow: ${props =>
  (props['data-tab'] === 'videochat'
    || props['data-tab'] === 'favoritos'
    || props['data-tab'] === 'calling')
    ? 'hidden'
    : 'auto'};
```
Este condicional engancha y responde a `data-tab`. Verificado en diagnóstico (fila 7, `sc-boKDdR gTLZGU StyledMainContent`, `overflow: hidden` con data-tab=favoritos activo).

**Diferencia clave desconocida**: por qué `StyledMainContent` con `data-tab` funciona y `StyledContainer` con `data-layout` no. Ambos son styled.div en el mismo bundle, misma librería.

## 6. Hipótesis pendientes de verificar

### H1 — Colisión de nombre de clase `sc-itBLYH`
Puede que haya DOS o más `StyledContainer` distintos en el proyecto y el elemento renderizado corresponde a otro que no se está tocando. Verificar:
```bash
grep -rn "StyledContainer" sharemechat-v1/frontend/src/styles/ | grep -E "= styled|export"
```
Y en DOM: `document.querySelectorAll('.sc-itBLYH').length`. Si es >1, hay ambigüedad.

Nota: en el diagnóstico del operador `document.querySelectorAll('.sc-itBLYH').length` = 1 (verificado). Pero puede que la clase generada por styled-components colisione entre dos definiciones distintas al haber `styled.div` idénticos.

### H2 — CSS global sobrescribiendo con `!important`
Revisar `index.css`, `App.css`, algún `GlobalStyle` en el árbol.

### H3 — Props no llegan al styled-component
Aunque el DOM tenga `data-layout="fixed"`, puede haber un wrapper HOC (posiblemente introducido por una lib) que intercepte props antes de llegar al template. Usar React DevTools Component tab, buscar `StyledContainer`, ver props recibidos.

### H4 — Regla de CSS aplicada pero cascada gana
En DevTools Elements → seleccionar el `<div class="sc-itBLYH...">` → tab **Styles** → ver TODAS las reglas aplicables al elemento y qué está tachado. Puede haber cascade winner inesperado.

### H5 — Bug de styled-components 5.x con data-attr como prop en template function
Poco probable pero verificable: reemplazar `data-layout` por prop personalizado (`$fixed={true}` transient prop) y ver si el condicional aplica entonces.

## 7. Estado actual desplegado (2026-08-08)

- Repo: `sharemechat-git-v1`, branch `main`.
- Frontend TEST: commit `7442ff2`, bundle `main.81304111.js`, URL `test.sharemechat.com`.
- Backend TEST: commit `6f52ceb` (sin relación con este bug, se dejó activo por el frente traducción chat P2P).
- Cambios adicionales activos que SÍ funcionan y hay que preservar:
  - `StyledMainContent` en `VideochatStyles.js:148` extendido para hacer `overflow:hidden` en tabs videochat/favoritos/calling (commit `07c0f07`). ESTE SÍ FUNCIONA para su elemento.
  - Wrappers de tab blog en `DashboardClient.jsx:3168` y `DashboardModel.jsx:3455` con `overflowY:'auto'` para scroll interno (necesario cuando el fix del `StyledContainer` funcione).

## 8. Bug tangencial descubierto en la investigación

Al re-clickear el mismo contacto ya seleccionado en la lista de favoritos, `openChatWith` en `DashboardClient.jsx:2402` hace `setCenterMessages([])` optimista pero el `useEffect([targetPeerId, activeTab])` en `DashboardClient.jsx:1181` NO se dispara (deps no cambian porque el peer es el mismo). Chat queda vacío con loading indefinido. Fix propuesto pero NO aplicado: guard `if (Number(targetPeerId) === peer && activeTab === 'favoritos') return;` al inicio de `openChatWith`. Aplica también a `DashboardModel.jsx` que comparte el mismo pattern (comentario "SIMÉTRICO a Model" en el código).

Este bug también es preexistente (independiente del scroll). Marcado como TODO para el siguiente pase.

## 9. Reglas de operación del repo (para la siguiente sesión)

- Fuente de verdad: `CLAUDE.md` en la raíz.
- Responder en español, sin `Co-Authored-By:` en commits, sin exponer secretos en chat.
- Deploy frontend: `ops/scripts/deploy-frontend.ps1 -Environment test -Surface product -AssumeYesNonCritical`.
- Backend TEST vía SSH alias `test-backend`.
- Cierre de bloques con línea `ESTADO: COMPLETADO / ESPERANDO INPUT OPERADOR / BLOQUEADO POR ERROR`.

## 10. Comandos útiles para retomar

Diagnóstico DOM (ejecutar en DevTools console con tab favoritos abierto y contacto de historial largo seleccionado):
```javascript
let el = document.querySelector('[data-kind="favorites-chat"]');
let chain = [];
while (el) {
  const cs = getComputedStyle(el);
  chain.push({
    tag: el.tagName,
    cls: el.className.toString().slice(0, 55),
    box_h: Math.round(el.getBoundingClientRect().height),
    scroll_h: el.scrollHeight,
    height: cs.height,
    minH: cs.minHeight,
    overflow: cs.overflowY,
    flex: cs.flex,
    display: cs.display
  });
  el = el.parentElement;
}
console.table(chain);
```

Cuenta de instancias sospechosas:
```javascript
console.log('.sc-itBLYH count:', document.querySelectorAll('.sc-itBLYH').length);
console.log('data-layout=fixed count:', document.querySelectorAll('[data-layout="fixed"]').length);
```

Verificar que el bundle desplegado tiene el código del intento 3:
```bash
node -e "const c = require('fs').readFileSync('sharemechat-v1/frontend/build-product/static/js/372.'+require('fs').readdirSync('sharemechat-v1/frontend/build-product/static/js').find(x=>x.startsWith('372.'))?.split('372.')[1] || '','utf8'); console.log(c.match(/data-layout.{0,200}/g).slice(0,3));"
```

---

## 11. CAUSA RAÍZ DEFINITIVA (sesión de diagnóstico limpia, 2026-08-08)

**Resuelto el porqué de los 8 intentos fallidos: se editó el archivo equivocado.**

### 11.1 El hecho central

Existen **DOS** `StyledContainer` distintos, y todas las iteraciones tocaron el que NO se renderiza:

| Definición | Archivo | ¿Lo usa el dashboard? |
|---|---|---|
| `StyledContainer` (el del `data-layout`) | `frontend/src/styles/NavbarStyles.js:73` | **NO** — nunca se importa aquí |
| `StyledContainer` (el del `data-tab`) | `frontend/src/styles/pages-styles/VideochatStyles.js:97` | **SÍ** — es el que se pinta |

En `DashboardClient.jsx` (y `DashboardModel.jsx`) el import real es:

```javascript
import {
  StyledContainer, ... StyledMainContent, ...
} from '../../styles/pages-styles/VideochatStyles';   // <-- ESTE módulo
```

El `StyledContainer` renderizado es el de `VideochatStyles.js:97`, cuyo CSS es EXACTAMENTE la fila 8 del diagnóstico DevTools:

```javascript
height: ${props => props['data-tab'] === 'videochat' ? '100vh' : 'auto'};  // favoritos → 'auto' (crece con contenido)
min-height: 100vh;                                                          // SIEMPRE → nunca baja de 100vh
// (sin overflow declarado → default 'visible' → el body scrollea)
```

El verdadero villano es **`min-height: 100vh` incondicional + `overflow: visible`** en un flex column: la cadena flex nunca queda capada y el body arrastra scroll con historial P2P largo.

### 11.2 Por qué los intentos parecían correctos pero no aplicaban

Todo lo tocado en `NavbarStyles.js` fue inocuo porque ese componente no se renderiza en el dashboard:

- **El bundle compilaba la regla `data-layout`** → cierto, pero pertenece al `StyledContainer` de `NavbarStyles`, que aquí no se pinta.
- **El atributo `data-layout="fixed"` aparecía en el DOM** → cierto: styled-components reenvía cualquier `data-*` al `<div>` aunque el CSS del template no lo consuma. Ver un atributo en el DOM NO prueba que exista una regla que lo lea.
- **La regla condicional nunca aplicaba** → porque el elemento pintado es el `StyledContainer` de `VideochatStyles`, que solo conoce `data-tab`, nunca `data-layout`.

### 11.3 Resolución de las hipótesis de la sección 6

- **H1 (colisión de definiciones): CORRECTA**, pero se descartó por un test mal planteado. Se comprobó `document.querySelectorAll('.sc-itBLYH').length === 1` y se concluyó "no hay ambigüedad". La ambigüedad NO son dos instancias en el DOM: son **dos definiciones en el código fuente**, y se editó la que no se renderiza. `sc-itBLYH` es la clase del `StyledContainer` de `VideochatStyles` (el bueno); el de `NavbarStyles` generaba otra clase que nunca llegó al DOM.
- **H2 (CSS global `!important`): descartada** — no hace falta; el efecto se explica por completo con H1.
- **H3 (props no llegan al styled-component): descartada** — los props sí llegan; el problema es que llegan al componente correcto pero el CSS que los leería está en otro componente.
- **H4/H5: irrelevantes** una vez identificado H1.

### 11.4 Contraste con `StyledMainContent` (por qué ese SÍ funcionaba)

`StyledMainContent` (fila 7 del diagnóstico) vive en el MISMO módulo que se renderiza (`VideochatStyles.js:135`) y su condicional lee `data-tab`, que es el atributo que el dashboard realmente pasa. Por eso enganchaba. La "diferencia clave desconocida" de la sección 5 era simplemente: uno estaba en el módulo correcto y el otro no.

### 11.5 Fix correcto (mínimo, sin componente nuevo ni condicionales por props)

Editar el archivo CORRECTO — `StyledContainer` en `VideochatStyles.js:97` — para hacerlo app-like (mata el scroll de página en toda la vista, que es el primer objetivo del operador):

```javascript
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--c-black);
  min-width: 48px;
  height: 100vh;        /* fijo (o 100dvh), no 'auto' */
  min-height: 0;        /* CLAVE: eliminar el min-height:100vh que fuerza crecer */
  overflow: hidden;     /* el body deja de scrollear; el scroll vive en los scrollers hijos */

  @supports (height: 100dvh) {
    height: 100dvh;
  }
`;
```

Los scrollers internos ya existen y absorben el contenido largo:
- `StyledChatScroller` (`VideochatStyles.js:1338`) → `overflow-y: auto`.
- Wrappers de blog / historial / tickets en `DashboardClient.jsx` (~3168-3180) → `overflowY:'auto'`.

Nota: si se prefiere conservar el scroll de body en tabs de contenido (blog/historial/tickets/stats) y solo capar los app-like (videochat/favoritos/calling), condicionar por `data-tab` **en este mismo componente** (mismo patrón que el `StyledMainContent` de abajo, que sí engancha). Pero para el objetivo declarado ("que no haya NINGÚN scroll en esa página") la versión plana de arriba basta.

### 11.6 ⚠️ Aviso de concurrencia (estado del working tree al momento del diagnóstico)

Durante este diagnóstico, una **sesión concurrente** (rama `claude/dashboard-favoritos-scroll-issue-490e84`) estaba editando estos mismos archivos en vivo. Llegó a la misma conclusión (H1) e introdujo un componente nuevo `StyledContainerFixed` en `NavbarStyles.js:87`, cableándolo en los dashboards. Pero dejó un **bug intermedio**:

- `DashboardClient.jsx:21` / `DashboardModel.jsx:19` importan `StyledContainerFixed` **desde `VideochatStyles`**.
- `StyledContainerFixed` solo está definido/exportado en **`NavbarStyles.js`**, no en `VideochatStyles`.
- Resultado: `StyledContainerFixed` resuelve a `undefined` → al renderizar `<StyledContainerFixed>` el dashboard **crashea / pantalla en blanco** (mismo tipo de fallo que motivó el check de drift).

**Acción acordada con el operador:** esta sesión de diagnóstico PARA y espera a que la sesión concurrente termine, para no pisarse en los mismos ficheros. Al retomar, verificar cuál de los dos enfoques quedó aplicado:
1. Fix plano en `VideochatStyles.js:97` (recomendado por esta sesión), o
2. Componente `StyledContainerFixed` separado — que es válido SI y solo SI el import se corrige para traerlo de `NavbarStyles` y se limpia el import erróneo de `VideochatStyles`.

Sea cual sea, la regla es una sola: **el componente que se toca debe ser el que el dashboard realmente importa/renderiza.**
