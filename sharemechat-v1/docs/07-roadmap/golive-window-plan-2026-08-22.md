# Plan go-live: modal "Muy pronto" + rediseño de la ventana Random (2026-08-22)

> Registro exhaustivo del frente go-live/ventana tras el replanteamiento del
> operador (2026-08-22). Marcar `[x]` a medida que se cierra cada punto.

## Contexto y decisiones de fondo

- **Objetivo de la ventana horaria:** evitar **salas vacías** en Random. El dolor
  lo sufre sobre todo el **cliente** (paga y no encuentra modelo); también la
  modelo, pero el foco es el cliente.
- **Enfoque acordado (replanteamiento 2026-08-22):**
  - **Cliente = llave dura** del Random ("Sala aleatoria abierta de X:XX a Y:YY").
  - **Modelo = recomendación blanda** (no se bloquea; se le sugiere la franja).
  - Se auto-regula: fuera de la franja el Random del cliente está cerrado → la
    modelo no recibe clientes random igualmente, sin necesidad de bloquearla.
  - **La ventana es SOLO para Random, NO para 1 a 1** (en favoritos llamas a
    alguien concreto que está online; no hay sala vacía).
- **Prioridad:** la **ventana es importante pero NO urgente**. Lo urgente para
  PROD es la **restricción de streaming "Muy pronto"** (Fase B, ya hecha), pero
  con el modal enriquecido al nivel del mock aprobado.
- Cambio de enfoque respecto a la Fase C ya implementada: la Fase C actual gatea
  al **MODELO en duro**; el rediseño mueve el gate duro al **CLIENTE** y deja la
  modelo como recomendación.

---

## A. URGENTE (para PROD) — dos avisos SEPARADOS

**DECISIÓN OPERADOR 2026-08-22:** "Muy pronto" (cuenta atrás) y "foto/vídeo
obligatorios" son DOS avisos DISTINTOS. NO se mezclan (el mock los juntaba; se
descarta esa mezcla). El horario NO va en ninguno de los dos (aparcado).

### A.1 — Modal "Muy pronto" (cuenta atrás, temporal)
- [x] Ya funciona en TEST. Se queda **simple** (sin horario, sin foto/vídeo dentro).
- [ ] **Botón en ROJO de marca `#ea1d1d`** (como el mock). *(decidido)*

### A.2 — Modal "Necesitas foto y vídeo" (obligatorio para emitir, permanente, aparte)
El impedimento por dentro YA existe (una modelo sin foto/vídeo aprobados no
emite). Falta el **aviso propio y claro** en pantalla.
- [ ] **Backend `/me`:** exponer si la modelo tiene **foto Y vídeo aprobados**
      (reutiliza `existsApprovedPrincipalActiveByUserAndType(PIC/VIDEO)`).
- [ ] **Frontend:** modal PROPIO (no variante de "Muy pronto") que bloquea emitir
      y le dice que suba foto y vídeo. Botón rojo también.
- [ ] **Cuándo aparece:** DECISIÓN pendiente — (a) proactivo al entrar a emitir
      [recomendado] vs (b) solo al pulsar emitir.
- [ ] **i18n** de las etiquetas en es/en/fr/de/pt (a mano).

## B. FIX inmediato — ventana solo Random, no 1 a 1

- [ ] **Frontend:** quitar el check de ventana de `enterCallMode` en
      `DashboardModel.jsx` (el botón de videollamada 1 a 1 no debe llevar ventana).
      *(Backend: el 1 a 1 en `MessagesWsHandlerSupport` ya NO tiene gate de ventana.)*

## C. NO URGENTE — rediseño de la ventana (cliente = llave, modelo = recomendación)

**IDEA CONFIRMADA OPERADOR 2026-08-22:** la ventana **podría ser bloqueante para
el CLIENTE en Random, pero quizás NO en 1 a 1** (en 1 a 1 no hay sala vacía). Esa
es la dirección; a concretar cuando se retome con calma. Ventana **DESACTIVADA en
TEST** (2026-08-22): `MODEL_WINDOW_ENABLED=false`, y `PRODUCT_GOLIVE_MODEL_ENABLED`
devuelto a `false` (coming-soon normal).

### Backend
- [ ] **Quitar el gate DURO de ventana del MODELO** en `MatchingHandlerSupport`:
      `set-role` (rama modelo), `start-match` (rama modelo), y `canMatch`
      (lado modelo). La modelo puede estar disponible siempre.
- [ ] **Añadir gate DURO de ventana al CLIENTE en Random:** `set-role` (rama
      cliente) + `start-match` (rama cliente) [+ `canMatch` lado cliente si
      procede]. Fuera de ventana → mensaje `random-window-closed`.
- [ ] Reutilizar/renombrar `ModelWindowService` → window por bloque/país (ya
      calcula `isWithinWindow(country)`); revisar naming `MODEL_WINDOW_*` →
      ¿`RANDOM_WINDOW_*`? (decidir).
- [ ] **`/me`:** exponer la ventana del **CLIENTE** (su bloque) para el gate de
      botón + modal; y para la modelo como **recomendación** (sin bloqueo).
- [ ] Grace se mantiene (sesiones en curso no se cortan).

### Frontend
- [ ] Quitar el gate de ventana de los botones del **MODELO**
      (`DashboardModel.handleStartMatch`).
- [ ] Añadir gate de ventana al **CLIENTE Random**:
      `DashboardClient.handleStartMatch` + `DashboardUserClient.handleStartMatch`
      → modal "Sala aleatoria abre de X a Y (tu hora)" (reutiliza el panel de
      horario en hora local ya construido).
- [ ] **Modelo: recomendación blanda** (banner/nota "Recomendamos conectarte de
      X a Y — más clientes"), sin bloquear.
- [ ] i18n de los textos nuevos (5 idiomas).

### Tests
- [ ] Mover el test del gate de matching de modelo → cliente. `ModelWindowServiceTest`
      se mantiene (lógica de ventana intacta). Añadir tests del gate cliente.

## D. Decisiones abiertas (para el operador)

1. **"Muy pronto":** ¿solo checklist foto/vídeo (recomendado) o también panel de horario?
2. **Botón del modal:** ¿rojo de marca o azul (consistente con el resto de modales)?
3. **PROD:** ¿subir primero solo **Fase B "Muy pronto" enriquecida + arreglos**
   (llamada 1a1, botón enviar, admin-locale, i18n), y la **ventana en 2ª tanda**?
4. **Ventana:** ¿confirmado **cliente = llave dura + modelo = recomendación**?
5. **Bloque A (América):** lista de países ya acordada — mantener.

## E. Estado de TEST a restaurar (se dejó así para pruebas 2026-08-22)

- `PRODUCT_GOLIVE_MODEL_ENABLED=true` (puesto para poder ver la ventana) →
  **restaurar a `false`** (coming-soon) salvo decisión distinta.
- `MODEL_WINDOW_ENABLED=true`, franja `22:00-06:00` (valor de prueba) →
  **restaurar a `false`** (o franja real `18:00-02:00`) según rediseño.
- `PRODUCT_GOLIVE_CLIENT_ENABLED=false` (sin cambios).

## F. Ya HECHO y en TEST (contexto para PROD)

- [x] Fase B: gate streaming coming-soon por rol (modelo emitir + foto/vídeo WS;
      cliente USER videochat/trial + pago via checkout PSP). Modal "Muy pronto"
      (versión plana).
- [x] Gate 1 a 1 (`call:invite`/`call:accept` en `MessagesWsHandlerSupport`).
- [x] Botón del composer del modelo = ENVIAR (antes llamada).
- [x] admin-locale es/en (otra sesión).
- [x] i18n modal coming-soon (5 idiomas).
- [x] Fase C ventana (versión **modelo-hard, A REDISEÑAR** según C) — en main + TEST,
      off por defecto.
