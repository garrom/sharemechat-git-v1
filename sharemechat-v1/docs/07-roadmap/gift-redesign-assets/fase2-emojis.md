# Fase 2 — Reacciones y emojis (APROBADO 2026-08-08)

Estado: **aprobado por el operador**. Referencia visual: `mocks/fase2-emojis.html`.

## Alcance (dos features nuevas)

Los emojis-regalo gratis ya viven en la barra de Fase 1. Esta fase añade **cosas que aún no existen**:

### 1. Reacciones sobre mensajes (estilo WhatsApp)
- Hover (desktop) / mantener pulsado (móvil) sobre un mensaje → botón 🙂 → picker rápido de emojis (`👍 ❤️ 😂 😮 😢 🙏`).
- La reacción se muestra como chip pegado a la burbuja; reaccionar con el mismo emoji incrementa contador.
- **Requiere persistencia:** tabla/columna de reacciones (p. ej. `message_reactions` con message_id, user_id, emoji) + propagación por WS para que ambos lados la vean en tiempo real. A detallar en implementación. Vendor-agnostic, sin terceros.

### 2. Selector de emojis en el input
- Botón 😊 en el composer abre un panel de emojis unicode que se insertan en el texto escrito.
- **Solo frontend**, sin backend.

## Distinción conceptual (importante)

- **Emojis (Fase 2):** unicode nativos, para reaccionar y escribir. No cuestan, no son "regalo".
- **Regalos SVG (Fase 0/1):** los iconos vectoriales que se envían como mensaje-regalo (gratis o de pago), en la barra del composer.
Son sistemas distintos que conviven en el mismo chat.

## Mapeo a código (para implementar)

- Fichero: `frontend/src/pages/dashboard/VideoChatFavoritosCliente.jsx` (render de mensajes `renderChatMessage` / `SupportMessageBubble`) + estilos.
- Reacciones: añadir affordance de hover en la burbuja, picker, y estado de reacciones por mensaje. Backend: endpoint + WS para persistir/emitir.
- Selector de texto: panel de emojis que hace `setCenterInput(v => v + emoji)`. Reutilizable también en el composer de llamada (Fase 4) si se quiere.
- Respeta `prefers-reduced-motion` en la animación del chip.

## Decisiones confirmadas por el operador

- Reacciones estilo WhatsApp: APROBADO.
- Selector de emojis en texto: APROBADO.
- Distinción emojis vs regalos: clara y aceptada.
