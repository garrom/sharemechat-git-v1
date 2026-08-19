# Plan de implementación — Rediseño Favoritos — 2026-08-19

Referencias: `../favoritos-redesign-plan.md` (concepto + listado aprobado),
`design-spec.md` (valores exactos), `mocks/favoritos-final.html` (mock).

Principio: **todo aditivo/restyle sobre el andamiaje existente**; no romper las 3
zonas del centro (scroller único con overflow) ni el modo llamada. Se ejecuta por
fases con validación en TEST entre cada una; a `main`/PROD solo bajo OK explícito.

---

## Mapa de ficheros afectados

| Área | Fichero | Acción |
|---|---|---|
| Layout 3 columnas | `pages/dashboard/DashboardClient.jsx` (~L3229) | reintroducir columna derecha; estado del modelo seleccionado; pasar datos al spotlight |
| Columna izquierda | `pages/favorites/FavoritesClientList.jsx` | buscador, agrupación online/offline, preview último msg, hora, no-leídos numérico |
| Estilos izquierda | `styles/pages-styles/FavoritesStyles.js` | avatar 44, selección roja, preview/time/unread, search, grouplbl |
| Chat (centro) | `pages/dashboard/VideoChatFavoritosCliente.jsx` | cabecera (sacar inline), quitar gift bar fija, composer (+🎁, −llamar), separador día |
| Estilos chat | `styles/pages-styles/VideochatStyles.js` | fondo `StyledChatScroller`, cabecera styled, composer, retirar/relocar gift bar |
| Burbuja | `components/support/SupportMessageBubble.jsx` | restyle **condicionado a `P2P_ME/P2P_PEER`** (no tocar Soporte) |
| Spotlight (NUEVO) | `components/ModelSpotlight.jsx` | componente nuevo (cover, CTA, reputación, datos, regalos, ver perfil) |
| Estilos spotlight | `styles/components/ModelSpotlightStyles.js` (nuevo) | según `design-spec.md` §5 |
| i18n | `i18n/locales/es.json` + `en.json` | claves nuevas (§ i18n) |

Reutiliza (sin duplicar): `LikeHeart`, `RoyaltyBadge`, `ModelReputationCard`
(lógica de reputación), `ModelProfileExpanded` (modal "ver perfil completo"),
`getPublicProfile`, catálogo `gifts`, tarifa `currentModelRate`.

---

## Fase 0 — Andamiaje 3ª columna (sin estilo fino)
- En `DashboardClient.jsx`, bloque favoritos: montar una tercera columna a la
  derecha del `StyledCenter` cuando hay contacto seleccionado y NO es el bot.
  Reusar el patrón de `StyledRightColumn` (existe en `VideochatStyles.js`, hoy sin
  uso en favoritos) o uno nuevo.
- Elevar/derivar el modelo seleccionado (id, nickname, presencia, avatar) — ya
  existe `centerChatPeerId/Name` + `peerPresence`; el spotlight consume eso.
- **Móvil**: la 3ª columna NO se muestra inline; su contenido cae al
  `ModelProfileExpanded` (modal) vía el botón que ya existe. Decidir en Fase 3.
- Verificación: columna vacía maquetada, sin romper layout ni el modo llamada
  (`showFavoritesFullCall` sigue ocultando columnas).

## Fase 1 — Columna izquierda (conversaciones)
- **Buscador**: filtro cliente sobre `items` por nickname (sin backend).
- **Agrupación online/offline**: partir `items` por `presence` (`online`/`busy` →
  "En línea"; resto → "Desconectadas"). El bot va primero, fuera de grupos.
- **Preview último mensaje + hora**: ⚠ **verificar fuente de datos**. Hoy
  `/messages/conversations` se usa solo para `unreadCount`. Comprobar si ese
  endpoint ya devuelve `lastMessage`/`lastMessageAt`; si no, es el único punto que
  puede requerir backend (o segundo fetch). Documentar antes de implementar.
- **No-leídos numérico**: cambiar el punto azul por badge con `unreadCount` real
  (el mapa ya tiene el número, hoy se colapsa a booleano).
- **Restyle**: avatar 44, selección roja, tipografías — según `design-spec.md` §3.

## Fase 2 — Chat (centro)
- **Fondo**: aplicar el bloque exacto de `design-spec.md` §4 a
  `StyledChatScroller[data-bg='whatsapp']` (sustituye el beige `#e9e3db`).
- **Cabecera**: convertir `renderFavChatHeader()` (hoy estilos inline) a styled
  oscuro; **quitar "Ver perfil completo"** (se mueve al spotlight); mantener
  avatar+nombre+presencia+"Ver original".
- **Burbujas**: parametrizar `SupportMessageBubble` para las variantes `P2P_*`
  (propia `--me` grafito, modelo `--peer`); Soporte intacto.
- **Separador de día** en el hilo.
- **Composer**: añadir botón 🎁 (abre catálogo/gift picker existente) y **quitar
  el botón de llamar** (se mueve al CTA del spotlight); **retirar la gift bar fija**
  (`renderGiftBar()`) del bloque inferior.
- Riesgo: no alterar el capping de altura (scroller único con overflow).

## Fase 3 — Columna derecha (ModelSpotlight, nuevo)
- Componente `ModelSpotlight` con props del modelo seleccionado. Carga al pulsar
  contacto (mismo disparo que abre el chat). Secciones (design-spec §5):
  - **Cover** (foto grande + nombre + corona + presencia + edad).
  - **CTA "Iniciar videollamada"** con tarifa €/min real → cablear a
    `enterCallMode`/`handleCallInvite` del peer (mismo flujo que el botón llamar
    que se retiró del composer). Estado saldo suficiente/insuficiente.
  - **Reputación** (reusar lógica de `ModelReputationCard`/`LikeHeart` +
    `RoyaltyBadge`).
  - **Datos** (altura/cuerpo/pecho/idioma desde `getPublicProfile`).
  - **Regalos rápidos** (subset del catálogo `gifts`).
  - **Ver perfil completo** → abre `ModelProfileExpanded` (D1).
- **Móvil**: no se monta la columna; el acceso al perfil sigue por el modal.

## Fase 4 — i18n + responsive + limpieza
- Claves nuevas ES/EN (ver abajo). Sin literales hardcoded.
- Revisar breakpoints: en tablet/móvil, comportamiento de la 3ª columna.
- Retirar estilos muertos (gift bar antigua si queda huérfana).

## Fase 5 — Modo llamada (D22, decisión abierta)
- El árbol de llamada (`StyledCallCardDesktop`) no está cubierto por el mock.
  Decidir con el operador: rediseñar en línea con el nuevo lenguaje, o dejar.

---

## i18n — claves nuevas (borrador)
`dashboardClient.favorites.search.placeholder`, `.groups.online`,
`.groups.offline`, `.spotlight.videocall`, `.spotlight.ratePerMin`,
`.spotlight.balanceOk`, `.spotlight.balanceLow`, `.spotlight.dataTitle`,
`.spotlight.giftTitle`, `.spotlight.fullProfile`, y labels de datos
(`altura/cuerpo/pecho/idioma`) — reusar las de `modelProfileExpanded.*` si ya existen.

## Riesgos / puntos a confirmar antes de codear
1. **Preview último mensaje**: ¿lo da `/messages/conversations`? (posible único
   toque de backend). — bloqueante de Fase 1.
2. **SupportMessageBubble compartida**: condicionar por variante, test de Soporte
   no debe cambiar.
3. **Móvil / 3 columnas**: definir layout (probablemente 2 vistas + modal perfil).
4. **Modo llamada** (D22).
5. Tests: componentes nuevos (ModelSpotlight) con Jest; no romper los existentes.
