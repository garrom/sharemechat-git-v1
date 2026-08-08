# Plan por fases — Iconos comerciales, efectos y layout de chat (2026-08-08)

**Estado:** EN EJECUCIÓN. Fases 0, 1 y 3 + reestructura de catálogo **IMPLEMENTADAS y desplegadas en TEST** (chat puro de favoritos, cliente y modelo). Pendientes: Fase 2 (reacciones + selector emojis), Fase 4 (streaming), rediseño de página completa (navbar/contactos), nivelación a `main`.

> **As-built (lo realmente implementado + desvíos):** `gift-redesign-assets/as-built-2026-08-09.md`. Este plan es el diseño; el as-built es la ejecución. Desvío principal: las caras gratis son emoji unicode nativo (no SVG dibujados); los efectos se derivan del `tier` (no de `animation_key`).

**Origen:** frente iniciado tras cerrar el bug de scroll del dashboard favoritos (ver `docs/04-operations/scroll-dashboard-favoritos-investigation-2026-08-08.md`). El operador quiere hacer los iconos del chat de favoritos más comerciales y añadir efectos al enviarlos.

**Convención de persistencia:** cada fase que el operador apruebe se guarda en el repo bajo `gift-redesign-assets/` (spec + mock de referencia), para que la implementación siempre tenga la fuente. Los mocks en scratchpad/artifacts son efímeros; el repo es la fuente de verdad.

**Diseño cerrado (2026-08-08):** las 5 fases (0-4) + el rediseño de página completa del chat puro están aprobados y documentados.
- **Plan de implementación detallado:** `gift-redesign-assets/implementation-plan.md`.
- **Mock de página completa (chat puro):** `gift-redesign-assets/mocks/chat-puro-fullpage.html`.
- **Mock streaming (Fase 4):** `gift-redesign-assets/mocks/fase4-streaming.html`.

---

## 1. Objetivo

Rediseñar los iconos del **chat de favoritos (chat puro, sin streaming)** y su interacción:
- Iconos más atractivos/comerciales (estilo vector plano premium).
- Regalos **siempre visibles** en el composer (barra inferior), sin tener que pulsar un botón para desplegarlos.
- Efectos visuales al enviar un regalo (primeros ~1–3 s).

**Referencia de formato:** LiveJasmin — franja inferior de regalos siempre visible con scroll lateral + `+` para ver más. Se replica el **formato/layout**, NO sus assets (los iconos los dibuja la IA, propios).

## 2. Restricciones acordadas (coste cero)

- Sin coste económico: **nada de suscripciones, servicios de terceros ni creativos externos.**
- Todos los iconos nuevos son **SVG vectoriales creados por la IA**, versionados en el repo (o incrustados). Estilo icono/vector plano premium (carga rápida, anima mejor). No es ilustración fotorrealista de estudio.
- Sin librerías nuevas de frontend: efectos = CSS keyframes + spawner ligero de partículas. Respetar `prefers-reduced-motion`.
- Trabajo = tiempo de desarrollo, no dinero.

## 3. Modelo actual (fuente ya leída)

- Tabla única `gifts` sirve ambos tipos. Discriminador: columna `tier`.
  - `tier=QUICK` → `category=FREE_EMOJI` (gratis; lo ven MODEL y CLIENT).
  - `tier=PREMIUM` → `category=PAID_GIFT` (de pago; solo CLIENT).
- Endpoint: `GET /api/products/emojis/available` (`EmojiCatalogService`), filtra por rol.
- Campo **`animation_key`** ya existe en la entidad `Gift` y viaja en `EmojiPublicDTO`, pero el frontend **no lo usa** hoy. Es el gancho para los efectos (Fase 3).
- Picker actual: `frontend/src/pages/dashboard/VideoChatFavoritosCliente.jsx` — hoy popup togglable (`showCenterGifts` → `renderGiftPicker` → `StyledGiftsPanel` absoluto).
- Regalo en chat: `renderGiftVisual` → `StyledGiftMessage` + `StyledGiftIcon` (solo `<img>` estático, sin animación).
- Los iconos NO están en el repo: el campo `icon` es una URL remota (S3/CloudFront); el catálogo se siembra por BD/admin.

## 4. Alcance por fases

### Fase 0 · Set de iconos SVG *(base de todo)* — ✅ APROBADA (2026-08-08)
Set de 14 iconos vectoriales propios (6 free + 8 paid) en estilo vector coherente. Aprobado sin cambios; ampliaciones futuras se añadirán más adelante.
- **Fuente canónica para implementar + código SVG:** `gift-redesign-assets/fase0-iconset.md`.
- **Mocks de referencia visual (persistidos en repo):** `gift-redesign-assets/mocks/` (`fase0-iconset.html`, `fase0-iconset-static.html`, `concepto-general.html`).

### Fase 1 · Barra de regalos siempre visible — ✅ APROBADA (2026-08-08)
Tira horizontal fija en el composer con segmento `Gratis`/`Regalos`, scroll lateral, mini-precio en los de pago y `+` para el catálogo completo (formato LiveJasmin). Ámbito: chat puro de favoritos.
- **Spec + mapeo a código:** `gift-redesign-assets/fase1-giftbar.md`. **Mock:** `gift-redesign-assets/mocks/fase1-giftbar.html`.
- Toca `VideoChatFavoritosCliente.jsx` + `VideochatStyles.js`; elimina `showCenterGifts`/`renderGiftPicker` como vía principal.
- Nota: la barra suma ~64px de alto; ok en chat puro, en modo llamada se resuelve en Fase 4.

### Fase 2 · Emojis (reacciones + selector en texto) — ✅ APROBADA (2026-08-08)
Spec: `gift-redesign-assets/fase2-emojis.md`. Mock: `gift-redesign-assets/mocks/fase2-emojis.html`.
Redefinida (los emojis-regalo gratis ya viven en la barra de Fase 1). Cubre dos features NUEVAS aprobadas por el operador:
1. **Reacciones sobre mensajes** (estilo WhatsApp): hover/mantener pulsado un mensaje → picker rápido de emojis → se añade un chip de reacción a la burbuja.
2. **Selector de emojis en el input**: botón emoji en el composer que abre un panel para insertar emojis dentro del texto escrito.
- Usan emojis unicode nativos (no los SVG-regalo de Fase 0; son cosas distintas). Sin coste, sin backend nuevo para el picker de texto. Las reacciones sí requieren persistencia (tabla/columna de reacciones + WS) — a detallar en implementación.

### Fase 3 · Efectos al enviar — ✅ APROBADA (2026-08-08)
Spec: `gift-redesign-assets/fase3-efectos.md`. Mock: `gift-redesign-assets/mocks/fase3-efectos.html`.
- Gratis → `float-hearts`. Pago → `confetti-party` (serpentinas + confeti, igual para todos los de pago). Regalo de pago aparece grande (~2.7×) y baja a normal rápido (~0.85 s).
- **Lo ven AMBOS** (emisor y receptor) → propagar `animation_key` por el WS.
- Nota técnica: variables de partícula con `setProperty`, no `style['--x']`. Sin librerías nuevas (React 17 + styled-components 6).

### Fase 4 · Chat como bloque lateral *(solo streaming — la más estructural, va la última)*
**Aclaración de alcance (operador, 2026-08-08):**
- El **chat puro de favoritos** se queda **CENTRADO tal cual**. NO se mueve a un lado. Es solo chat y así debe permanecer.
- La idea de "chat a un lado como bloque aparte" aplica **solo al streaming/videochat**, no al chat puro.

**Restricción documentada del streaming (a resolver en esta fase):**
En el videochat/streaming actual el área de vídeo ocupa solo una franja del ancho disponible, no todo. Causa conocida: un intento previo de ampliarlo daba **problemas en pantallas grandes** (formatos amplios). Al llegar a esta fase habrá que reabrir el ancho del vídeo resolviendo bien el caso pantalla grande, y encajar el chat como bloque lateral fuera del vídeo.

## 5. Orden recomendado

Fase 0 → 1 → 2 → 3 → 4. Cada fase es un entregable independiente que el operador valida antes de pasar a la siguiente. La Fase 4 (estructural, solo streaming) se aborda al final, cuando lo demás esté sólido.

## 6. Reglas de operación (recordatorio)

- Responder en español, sin `Co-Authored-By:` en commits, sin exponer secretos.
- Deploy frontend: `ops/scripts/deploy-frontend.ps1 -Environment test -Surface product -AssumeYesNonCritical`.
- Cierre de bloques con línea `ESTADO: COMPLETADO / ESPERANDO INPUT OPERADOR / BLOQUEADO POR ERROR`.
