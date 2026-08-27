# Fase 4 — Streaming: vídeo ancho + chat lateral (APROBADO 2026-08-08)

Estado: **aprobado por el operador** (mock validado). La más estructural y de mayor riesgo → se implementa la última. Referencia visual: `mocks/fase4-streaming.html` (stage) y `mocks/videochat-fullpage.html` (**página completa con navbar**, consistente con el chat puro).

## Diseño aprobado

- **Vídeo a ancho completo:** hoy el vídeo está limitado a una franja centrada (`StyledCallCardDesktop` max-width 1040px; `StyledVideoArea` max-width 960px / 1280px >1400px). Pasa a usar el ancho disponible.
- **Chat como columna lateral propia** (derecha), en vez de overlay sobre el vídeo (`StyledChatContainer` `inset:0`).
- La columna lateral reutiliza barra de regalos (Fase 1), emojis/reacciones (Fase 2) y efectos (Fase 3). Mismo lenguaje que el chat puro.
- Responsive: en pantallas estrechas el chat baja debajo del vídeo.
- Chat a la **derecha** (formato LiveJasmin). Ancho de columna orientativo ~360px (ajustable).

## ⚠ Restricción documentada (operador)

Un intento previo de ensanchar el vídeo **rompía en pantallas grandes**. Vía de solución: cap por alto de viewport (`height:calc(100vh - X)`) + `max-width` del conjunto, y **probar en 1440p/4K** antes de dar la fase por buena.

## Mapeo a código

Ficheros: `frontend/src/pages/dashboard/VideoChatRandomCliente.jsx` + `frontend/src/styles/pages-styles/VideochatStyles.js`.
- Reestructurar el bloque desktop `remoteStream && !isMobile`: video pane (ancho) + chat pane lateral.
- Sacar `StyledChatContainer`/`StyledChatList` del overlay a la columna lateral.
- Revisar `max-width`/`height` de `StyledCallCardDesktop`, `StyledVideoArea`, `StyledCallVideoArea`.
- Detalle completo en `implementation-plan.md`.

## Alcance

Solo streaming/videochat. El chat puro NO se toca aquí (queda centrado, ya rediseñado por su cuenta).
