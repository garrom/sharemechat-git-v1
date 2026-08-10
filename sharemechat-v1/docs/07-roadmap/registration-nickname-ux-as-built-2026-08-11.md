# As-built — UX de nickname en registro (2026-08-11)

> Estado: **HECHO y desplegado en TEST** (solo frontend). Rama `feat/streaming-layout`.
> Backend commiteado pero **NO desplegado**; **sin nivelar a main ni PROD** (pendiente decisión del operador).
> Frente independiente del rediseño streaming, cerrado en la misma rama.

## 1. Objetivo

Quitar fricción de registro alrededor del campo **nickname**, tras detectar que una modelo
no pudo completar el alta (escribió un espacio y el error, en español y poco claro, la bloqueó).
Tres sub-frentes encadenados.

## 2. Sub-frente A — i18n de errores (commit `31403b0`)

Los mensajes de error de nickname/email salían **siempre en español** porque:
1. El frontend mostraba `err.data.message` crudo del backend.
2. Client/Model no validaban el patrón client-side (Master sí).

Solución:
- `frontend/src/i18n/registerErrorMessage.js`: mapea el `code` estable del backend
  (`NICKNAME_TAKEN` / `EMAIL_TAKEN`) a claves i18n; fallback a `message` crudo.
- Los 3 modales (`RegisterClient/Model/Master ModalContent.jsx`) usan el helper en el `catch`.
- Backend: `GlobalExceptionHandler` hace `setCode("NICKNAME_TAKEN" / "EMAIL_TAKEN")` (patrón
  `setCode` ya existente). Requiere deploy backend para activar la traducción del caso
  "ya en uso"; el frontend es **forward-compatible** (cae a `message` hasta entonces).

## 3. Sub-frente B — normalizar el nickname en vez de rechazar (commit `dbe773c`)

En vez de rechazar espacios/caracteres no permitidos, se **corrigen automáticamente**.

Regla `normalizeNickname` (gemela front/back, idempotente):
- espacios (incl. NBSP) → guion `-`
- elimina todo lo que no sea `[\p{L}\p{N}._-]`
- colapsa guiones repetidos, limpia extremos, recorta a 30
- **preserva mayúsculas y acentos**

Ej.: `María del Mar` → `María-del-Mar`. Separador `-` (decidido con el operador; consistente
con el nick que Google Sign-In ya genera, `juan-abc123`). Login es por **email**, no por
nickname → normalizar es seguro.

- Frontend: `frontend/src/utils/normalizeNickname.js`. Los 3 modales envían el nick ya
  normalizado + muestran aviso vivo *"Se guardará como: X"* (styled `Hint`). Único error duro
  restante: `nicknameTooShort` (<3 tras normalizar). Clave `nicknamePattern` eliminada.
- Backend (defensa en profundidad): `com.sharemechat.util.NicknameNormalizer` (misma garantía
  anti-inyección que el antiguo `@Pattern`, saneando en vez de rechazar). DTOs client/model/master
  sin `@Pattern` en nickname + `@Size max 60`. `UserService`/`MasterService.sanitizeNickname`
  delegan al normalizador + guard `<3`.
- **No tocado**: `MasterModelInvitationService` (alta de modelo por admin, interno).

## 4. Sub-frente C — tooltip explicativo del nickname (commit `7d74158`)

Muchas personas no saben qué es un nickname ni qué poner. Se añade un icono `ⓘ` dentro del
campo que, al activarlo, muestra una explicación **flotando por encima** (overlay
`position:absolute`) **sin ocupar hueco** ni desplazar los campos siguientes.

- `frontend/src/components/InfoTooltip.jsx` (reutilizable): icono a la derecha del input, globo
  absolute. Desktop: hover (solo pointer mouse). Móvil: tap/toggle. Cierra al tocar fuera o Escape.
  Accesible (`aria-label`, `aria-expanded`, `role="tooltip"`). Evita el doble-disparo hover+click
  de móvil vía `pointerType`.
- Aplicado al nickname de los 3 modales (`paddingRight` para el icono).
- Copy genérico i18n es/en: `common.fieldInfo.nicknameHelp`
  ("Es el nombre público de tu cuenta. Podrás cambiarlo después.") + `common.fieldInfo.infoAriaLabel`.

## 5. Estado de despliegue

- **Frontend product**: desplegado en TEST de forma incremental (último bundle `main.17852d2a.js`).
  Manifest en `ops/deploy-state/test.yaml`.
- **Backend**: cambios commiteados (código estable) pero **NO desplegados**. El caso "ya en uso"
  seguirá en español hasta el deploy backend; el frontend es forward-compatible (sin regresión).
- La normalización backend (sub-frente B) es defensa en profundidad: el frontend ya envía el nick
  normalizado, así que la fricción está resuelta en TEST aun con el backend viejo.
- **Sin nivelar a main ni PROD.**

## 6. Pendientes

1. Merge de `feat/streaming-layout` a `main` (junto con el frente streaming) — coordinado.
2. Deploy backend (activa i18n del "ya en uso" + normalización servidor) con el deploy a PROD.
3. (Opcional) Aplicar la misma normalización/UX al alta admin (`MasterModelInvitationService`) si
   se decide.
