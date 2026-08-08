# Fase 1 — Barra de regalos siempre visible (APROBADO 2026-08-08)

Estado: **aprobado por el operador**. Referencia visual: `mocks/fase1-giftbar.html`.

## Idea

Formato tipo LiveJasmin: los regalos/emojis viven en el composer del chat de favoritos y están **siempre visibles**, sin popup. Se elimina el paso de "pulsar botón para abrir el catálogo".

## Diseño aprobado

- **Barra fija** dentro del composer, encima de la fila de input.
- **Segmento `Gratis` / `Regalos`** para separar los dos tipos (FREE_EMOJI sin precio / PAID_GIFT con precio).
- **Mini-precio dorado** en la esquina inferior-derecha de cada regalo de pago (monetización visible de un vistazo).
- **Scroll lateral** horizontal en la tira cuando hay muchos + botón **`+`** para abrir el catálogo completo (el catálogo completo/grid puede reutilizar el panel actual, ya como vista "ver más", no como única vía).
- Iconos = set SVG de Fase 0 (`fase0-iconset.md`).
- **Modal de confirmación (obligatorio en regalos de pago):** al pulsar un PAID_GIFT NO se envía directo; se abre un modal que muestra icono grande, nombre, precio, destinatario y saldo restante, con `Cancelar` / `Enviar regalo`. Los FREE_EMOJI se envían directos (sin modal, son gratis). Precios definitivos vendrán de BD.
  - Contemplar saldo insuficiente: si `cost > saldo`, el modal debe ofrecer recargar en lugar de confirmar (a detallar en implementación).
- Al confirmar → se envía al chat (en Fase 1 con un `pop` suave; los efectos grandes son Fase 3).
- Respeta `prefers-reduced-motion`.

## Mapeo a código (para implementar)

Fichero: `frontend/src/pages/dashboard/VideoChatFavoritosCliente.jsx` + `frontend/src/styles/pages-styles/VideochatStyles.js`.

- **Quitar** el toggle popup: estado `showCenterGifts` + `renderGiftPicker()` como popup absoluto (`StyledGiftsPanel`). El catálogo completo pasa a ser la vista del botón `+` (opcional, puede seguir siendo un panel, pero ya no es la vía principal).
- **Añadir** una barra fija en `StyledChatDockMessageComposer` (chat puro, no llamada): segmento categoría + tira scrollable + `+`.
- Datos: mismo `gifts` que ya llega de `/products/emojis/available`. Filtrar por `category`/`tier`:
  - `Gratis` → `tier==='QUICK'` (FREE_EMOJI), sin precio.
  - `Regalos` → `tier==='PREMIUM'` (PAID_GIFT), con `fmtEUR(cost)` mini.
- Envío: reutiliza `sendGiftMsg(id)` existente.
- **Ámbito Fase 1:** solo el chat puro de favoritos (desktop y móvil). El composer de llamada (`StyledChatDock` / `StyledCallComposer`) se aborda en Fase 4.

## Decisiones abiertas confirmadas por el operador

- Separación con **segmento** (no una sola fila mezclada): APROBADO.
- **Mini-precio** en la esquina del icono de pago: APROBADO.
- **Modal de confirmación** en regalos de pago antes de enviar/cobrar: APROBADO (nuevo requisito del operador).
- La barra suma ~64px de alto; aceptable en chat puro. En modo llamada se resolverá en Fase 4.

## Relación con otras fases

- **Fase 2 (emojis gratis):** la tira de emojis gratis YA queda integrada en el segmento `Gratis` de esta barra. Revisar si Fase 2 aporta algo adicional (p. ej. reacciones sobre burbujas) o se absorbe aquí.
- **Fase 3 (efectos):** el `pop` de envío se sustituye/amplía con los efectos por `animation_key`.
