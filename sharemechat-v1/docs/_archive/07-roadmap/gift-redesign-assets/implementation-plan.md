# Plan de implementación — Rediseño chat de favoritos + streaming

Estado: **plan aprobado, sin código aún**. El operador pidió plan detallado antes de tocar código. Se ejecuta por fases; cada fase = entregable probado en TEST y aprobado antes de la siguiente.

## Principios

- **Se trabaja primero en el worktree**; nivelación a `main` cuando el operador lo indique.
- **Coste cero, sin librerías nuevas.** Verificado en `frontend/package.json`: React 17.0.2 + styled-components 6.1.19 + react-scripts 5.0.1. Ninguna dependencia de animación.
- Vendor-agnostic. Deploy vía `ops/scripts/deploy-frontend.ps1` respetando el drift check (en CRITICAL, PARAR).
- Diseños de referencia: `gift-redesign-assets/mocks/` + specs `fase0..fase4` + `chat-puro-fullpage.html`.

## Mapa de ficheros

**Frontend**
- `frontend/src/pages/dashboard/DashboardClient.jsx` — tab favoritos, fetch catálogo (`/products/emojis/available`), layout de columnas (`StyledLeftColumn`/`StyledCenter`/`StyledRightColumn`).
- `frontend/src/pages/dashboard/VideoChatFavoritosCliente.jsx` — chat puro: picker, `renderGiftVisual`, composer.
- `frontend/src/pages/dashboard/VideoChatRandomCliente.jsx` — streaming/videochat.
- `frontend/src/pages/favorites/FavoritesClientList.jsx` — lista de contactos (**el menú contextual Ver perfil/Eliminar/Reportar/Bloquear YA existe**; solo restyle).
- `frontend/src/styles/pages-styles/VideochatStyles.js` — estilos.
- (nuevo) `frontend/src/components/gifts/` — módulo de iconos SVG + capa FX.

**Backend**
- `entity/Gift.java` — ya tiene columna `animation_key`.
- `service/EmojiCatalogService.java` + `dto/EmojiPublicDTO.java` — catálogo público (ya expone `animationKey`).
- `dto/MessageDTO.java` (`GiftSnapshotDTO`) — **NO expone `animationKey`** → hay que añadirlo (Fase 3).
- `service/MessageService.java` — construye el snapshot del regalo del mensaje (~L180-190).
- Realtime WS (`msgSocketEngine` front / `MessagesWsHandlerSupport` back) — transporta el mensaje con su snapshot.

## Fase 0 — Módulo de iconos SVG *(base, sin cambios de UI)*
- Crear `frontend/src/components/gifts/GiftIcon.jsx` (o defs `<symbol>` + `<use>`, o mapa `code → svg`).
- Mapear el `code` del gift (o `animation_key`) al symbol local; **fallback al `icon` remoto** si no hay symbol.
- Fuente SVG: `fase0-iconset.md`.
- Riesgo: **muy bajo**. Test: render a varios tamaños, fallback.

## Fase 1 — Barra de regalos siempre visible + modal
Ficheros: `VideoChatFavoritosCliente.jsx`, `VideochatStyles.js`.
- Quitar el popup togglable como vía principal (`showCenterGifts` / `renderGiftPicker`). El catálogo completo queda detrás del botón `+`.
- Barra fija en `StyledChatDockMessageComposer`: segmento `Gratis`/`Regalos` + tira scrollable + `+`.
- Filtrado por `tier`: QUICK=gratis (sin precio), PREMIUM=pago (mini-precio `fmtEUR(cost)`).
- **Modal de confirmación en PAID** (icono, nombre, precio, destinatario, saldo restante, Cancelar/Enviar). FREE directo. Saldo insuficiente → ofrecer recarga.
- Envío: reutiliza `sendGiftMsg(id)`.
- Ámbito: chat puro (desktop + móvil). Riesgo: **bajo** (UI local, sin backend). Test: enviar gratis/pago, scroll, modal, saldo insuficiente.

## Fase 3 — Efectos al enviar *(se implementa antes que Fase 2: menos backend)*
Front: `VideoChatFavoritosCliente.jsx` (`renderGiftVisual`) + capa FX + `keyframes` de styled-components.
- Leer `animation_key` del gift del mensaje; al montar el mensaje-regalo por 1ª vez → `playGiftFx(key)`.
- Efectos: `float-hearts` (gratis), `confetti-party` (pago). Regalo de pago grande (~2.7×) → normal rápido (~0.85 s).
- **Variables de partícula con `el.style.setProperty('--dx', ...)`** (NO `style['--dx']`).
- **Backend (para que lo vea el receptor):** añadir `animationKey` a `MessageDTO.GiftSnapshotDTO` y poblarlo en `MessageService` (~L184-190) desde `gift.getAnimationKey()`. El WS ya transporta el snapshot; con el campo dentro, el receptor reproduce el efecto al recibir. El emisor ya tiene el `animationKey` del catálogo.
- Riesgo: **bajo-medio** (1 campo backend + front). Test: efecto en emisor y receptor, `prefers-reduced-motion`.

## Fase 2 — Reacciones + selector de emojis
Front: `VideoChatFavoritosCliente.jsx` (render de mensajes) + estilos.
- **Selector de emojis en input:** panel unicode → `setCenterInput(v => v + emoji)`. **Solo frontend.** Riesgo bajo.
- **Reacciones sobre mensajes (estilo WhatsApp):** hover/mantener pulsado → picker → chip. **Requiere backend:**
  - Nueva tabla `message_reactions` (`message_id`, `user_id`, `emoji`, `created_at`) + migración Flyway `V(next)`.
  - Endpoint REST para poner/quitar + emisión por WS (tiempo real en ambos lados).
  - Front: estado de reacciones por mensaje, optimista + confirmación WS.
  - Riesgo: **medio** (BD + WS). Test: reaccionar, toggle, ver en ambos lados.

## Rediseño de página completa (chat puro)
Front: `DashboardClient.jsx` (layout tab favoritos) + `FavoritesClientList.jsx` + estilos.
- **Quitar `StyledRightColumn` vacía** en favoritos; el chat (`StyledCenter`) gana el ancho.
- Restyle de la lista de contactos (avatar, estado, preview, badge 24/7). Menú contextual: ya existe → solo restyle.
- Aplicar estética (navbar/columnas) según `chat-puro-fullpage.html`.
- Riesgo: **medio**. Test: selección, menú, empty state, responsive.

## Fase 4 — Streaming: vídeo ancho + chat lateral *(la más arriesgada, al final)*
Front: `VideoChatRandomCliente.jsx` + `VideochatStyles.js`.
- Sacar el chat del overlay (`StyledChatContainer` `inset:0`) a **columna lateral propia**.
- Ensanchar el vídeo: subir/eliminar `max-width` de `StyledCallCardDesktop` (1040px) y `StyledVideoArea` (960px / 1280px); cap por alto de viewport (`height:calc(100vh - X)`) + `max-width` del conjunto.
- ⚠ **Probar en pantallas grandes (1440p/4K)** — el intento previo rompió ahí. Riesgo: **ALTO** (estructural). Test: varias resoluciones, aspecto del vídeo, chat lateral, móvil (colapsa bajo el vídeo).

## Orden recomendado de implementación

`0 (iconos)` → `1 (barra+modal)` → `3 (efectos)` → `2 (reacciones)` → `rediseño página` → `4 (streaming)`.

Motivo del reorden vs numeración de diseño: la Fase 3 es casi todo frontend + un solo campo backend, mientras la Fase 2 (reacciones) necesita tabla + endpoint + WS. La Fase 4 va la última por ser estructural y de alto riesgo. **Reordenable si el operador prefiere otra cosa.**

## Resumen de cambios backend

- **Fase 3:** `GiftSnapshotDTO` + `MessageService` → añadir y poblar `animationKey` (mínimo).
- **Fase 2:** tabla `message_reactions` + migración Flyway + endpoint + emisión WS.
- **Resto de fases:** solo frontend.

## Deploy y verificación por fase

- Frontend: `ops/scripts/deploy-frontend.ps1 -Environment test -Surface product -AssumeYesNonCritical` (respeta drift check).
- Backend (Fases 2/3): compilar JAR, `scp` + `systemctl restart`, luego `ops/scripts/update-manifest-backend.ps1 -Environment test`. La migración de reacciones aplica al arrancar (Flyway).
- Cada fase se prueba en TEST antes de pasar a la siguiente. Nivelación worktree → main cuando el operador lo indique.
