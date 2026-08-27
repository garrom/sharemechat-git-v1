# Spec — Identidad visual del modal de MODELO + compactado del registro (2026-08-23)

Frente `claude/acquisition-modelos-registro`. Aprobado por el operador sobre mock fiel.
**Solo frontend** (product surface). Sin backend. Copy nuevo → i18n en 5 idiomas (es/en/fr/de/pt).

## Problema
1. El modal de registro/login de MODELO es casi idéntico al de CLIENTE (mismo componente `LoginModalContent`, mismos colores, layout y pestañas). La única diferencia hoy es una palabra en el título → el operador creó por error un CLIENTE en vez de MODELO.
2. El registro de CLIENTE es **demasiado alto**: pide scroll en un portátil (mal UX). Confirmado con captura (título + 3 inputs + 2 checks + botón + separador + Google).

## Objetivo
- Modal de MODELO **inconfundible** de un vistazo (identidad roja de marca `#ea1d1d`).
- Registro (los 3: client/model/master) **más compacto**, sin scroll en portátil.

---

## A) COMPACTADO (compartido — afecta login + registro client/model/master)

Ficheros: `styles/public-styles/LoginStyles.js` y `styles/public-styles/RegisterClientModelStyles.js`.
Seguro: estos estilos se usan **solo dentro del modal** (no hay página de registro full).

| Elemento | Propiedad | Antes | Después |
|---|---|---|---|
| `LoginStyles.StyledForm` | `gap` | 14px | **10px** |
| `LoginStyles.StyledForm` | `padding` (desktop) | `28px 28px` | **`20px 28px`** |
| `LoginStyles.StyledForm` | `padding` (≤md) | `24px 20px` | **`18px 20px`** |
| `LoginStyles.TabsRow` | `margin-bottom` | 22px | **14px** |
| `LoginStyles.TabsRow` | `gap` | 28px | **24px** |
| `LoginStyles.FormTitle` | `font-size` | 1.7rem | **1.35rem** |
| `RegisterClientModelStyles.Form` | `gap` | 14px | **10px** (lo hereda `InlineForm` → espacio entre campos) |
| `RegisterClientModelStyles.Title` | `font-size` | 1.7rem | **1.35rem** |
| `RegisterClientModelStyles.Input` | `padding` | `13px 16px` | **`10px 16px`** |
| `RegisterClientModelStyles.CheckRow` | `margin` | `6px 0` | **`2px 0`** |
| `RegisterClientModelStyles.Button` | `padding` | `14px 18px` | **`12px 18px`** |

Ahorro estimado ~90px de alto. Radios, colores y tipografías de peso NO cambian.

---

## B) IDENTIDAD DE MODELO (rojo de marca `#ea1d1d`)

Se activa cuando `audience === 'model'` o `view === 'register-model'` (`isModelCtx`).
Driver: el modal se abre con `audience='model'` desde `/modelos` (ModelLanding). Verificar wiring.

### B1. Cinta superior (la señal más fuerte) — `LoginStyles.js` + `LoginModalContent.jsx`
Nuevo styled `ModelRibbon` (y `ModelRibbonIcon`, `ModelRibbonSub`):
- Barra full-width arriba del todo del modal (ANTES de `TabsRow`).
- `background:#ea1d1d; color:#fff; padding:12px 20px; display:flex; align-items:center; gap:10px; font-size:13.5px; font-weight:700;`
- Icono circular a la izquierda: `<i class="fa ...">` cámara/vídeo (usar el set FontAwesome ya presente, p.ej. `faVideo`), en burbuja `rgba(255,255,255,.18)`.
- Texto: título `auth.modelRibbon.title` (uppercase por CSS) + subtítulo `auth.modelRibbon.subtitle` (peso normal, opacidad .92).
- Render en `LoginModalContent` condicionado a `isModelCtx`, colocado dentro de `StyledForm` como primer hijo (o justo encima). Ojo: `StyledForm` tiene `padding`; la cinta debe ir a sangre → envolver en un contenedor con `margin` negativo del padding, o mover la cinta fuera del padding. **Decisión:** darle a la cinta `margin: -20px -28px 6px` (neutraliza el padding del form para ir a sangre) en desktop y `-18px -20px 6px` en ≤md.

### B2. Pestaña activa roja — `LoginStyles.TabButton` + `LoginModalContent.jsx`
- Añadir en `TabButton`: `&[data-accent='model'][data-active='true'] { color:#fff; border-bottom-color:#ea1d1d; }`
- En `LoginModalContent`, pasar `data-accent={isModelCtx ? 'model' : undefined}` a ambos `TabButton`.

### B3. Título + subtítulo — `RegisterModelModalContent.jsx`
- `Title` usa `auth.registerModel.title` → cambiar copy a "Crea tu cuenta de modelo".
- Nuevo styled `Subtitle` (color `#9aa4b2; font-size:0.82rem; line-height:1.5; margin:0;`), texto `auth.registerModel.subtitle`. Se renderiza justo debajo del `Title`.

### B4. Botón rojo — `RegisterModelModalContent.jsx`
- Local `const ModelButton = styled(Button)`:
  `background:#ea1d1d; color:#fff; &:hover:not(:disabled){ background:#c81616; box-shadow:0 18px 40px rgba(234,29,29,0.36); }`
- Sustituir `<Button>` por `<ModelButton>` en el submit del registro de modelo.

### B5. (Coherencia) Login en contexto modelo
- El login es el mismo mecanismo (email+password); el rojo es solo señal visual.
- `auth.login.titleModel` (hoy "Login Modelo") → "Entra como modelo".
- La cinta (B1) y la pestaña roja (B2) ya cubren el login-model porque `isModelCtx` incluye `audience==='model'`.

### Opcional (no bloqueante)
- Focus ring de `Input` es verde `#00f59d`; en contexto modelo quedaría más fino en rojo, pero requiere condicionar el `Input` compartido. Se deja para una segunda pasada si el operador lo pide.

---

## C) i18n — claves nuevas/modificadas (es/en/fr/de/pt)

| Clave | ES (referencia) |
|---|---|
| `auth.modelRibbon.title` | Cuenta de modelo |
| `auth.modelRibbon.subtitle` | Para crear y emitir en directo |
| `auth.registerModel.title` (MOD) | Crea tu cuenta de modelo |
| `auth.registerModel.subtitle` (NEW) | Emite en directo y genera ingresos. Se requiere verificación de edad. |
| `auth.login.titleModel` (MOD) | Entra como modelo |

EN: "Model account" / "To create and go live" / "Create your model account" / "Go live and earn. Age verification required." / "Log in as a model".
FR (vous), DE (Sie formal), PT-BR (você): traducir en el mismo registro que el resto de `auth.*`.
**No** re-ejecutar el sync i18n completo (pisa QA); añadir claves a mano (Python, indent=2, ensure_ascii=False, `\n` final).

---

## D) Verificación / despliegue
- `npm test` de los componentes tocados (RegisterModel/Client, LoginModalContent) verdes.
- Ver en TEST: abrir `/modelos` → registro (cinta roja, subtítulo, botón rojo) y home → registro cliente (compacto, sin scroll en portátil). Móvil ≤560px OK.
- Deploy: `deploy-frontend.ps1 -Environment test -Surface product` (admin no afectado). Integrar a main antes.
- PROD: cuando el operador lo valide en TEST.

## Estado de ejecución
- [x] A) Compactado (LoginStyles + RegisterClientModelStyles) — 2026-08-23
- [x] B1) Cinta roja (`ModelRibbon`, esquinas superiores redondeadas para no asomar)
- [x] B2) Pestaña roja (`data-accent='model'`)
- [x] B3) Título+subtítulo modelo (`Subtitle` styled + `auth.registerModel.subtitle`)
- [x] B4) Botón rojo modelo (`ModelButton`)
- [x] B5) Login titleModel → "Entra como modelo"
- [x] C) i18n 5 idiomas (a mano; de paso arregladas traducciones auto malas FR/DE/PT)
- [x] Build de validación OK (compila; warnings pre-existentes ajenos)
- [ ] D) Tests CI + deploy TEST + validación operador
