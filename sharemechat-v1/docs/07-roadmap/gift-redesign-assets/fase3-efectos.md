# Fase 3 — Efectos al enviar (APROBADO 2026-08-08)

Estado: **aprobado por el operador**. Referencia visual: `mocks/fase3-efectos.html`.

## Diseño aprobado

Al aparecer un mensaje-regalo por primera vez, se reproduce un efecto sobre el chat (~1–3 s) y luego el regalo queda como icono estático. El efecto lo determina el campo **`animation_key`** de BD (ya existe en la entidad `Gift` / `EmojiPublicDTO`).

### Efectos
- **Gratis (`float-hearts`):** corazones que suben y se desvanecen desde el regalo. (Aprobado tal cual.)
- **De pago (`confetti-party`):** **serpentinas + confeti** cayendo + pequeño estallido desde el regalo + glow. **Mismo efecto para TODOS los de pago** (sin variantes por precio).
- El **regalo de pago aparece grande y se achica rápido** al enviarse: pico ~2.7× y baja a tamaño normal en ~0.85 s (rápido, sin mantenerse grande).
- (Queda `coin-shower` como código latente por si en el futuro se quiere una variante premium, pero NO se usa: decisión del operador = un solo efecto de pago para todos.)

### Visibilidad
- **El efecto lo ven AMBOS** (emisor y receptor). Requiere **propagar `animation_key` por el WS de mensajes** para que el receptor lo dispare al recibir el mensaje-regalo. Ajuste pequeño, sin infra nueva, vendor-agnostic.

## Nota técnica crítica (aprendida en el mock)

Las partículas usan variables CSS por-instancia (`--dx`, `--rot`, `--tx`, `--ty`). **Deben asignarse con `el.style.setProperty('--dx', valor)`**, NO con `el.style['--dx'] = valor` (esto último NO funciona para custom properties y deja las partículas fuera de pantalla → efecto invisible). Bug detectado y corregido en el mock.

## Reproducible con el stack actual (verificado en package.json)

Sin librerías nuevas. React 17.0.2 + styled-components 6.1.19 + react-scripts 5.0.1:
- Animaciones → `keyframes` de styled-components.
- Capa de partículas → `useRef` al contenedor FX + `createElement`/`appendChild` en el handler (o partículas como estado React).
- Barrido dorado → `element.animate()` (WAAPI nativo).
- Respeta `prefers-reduced-motion`.

## Mapeo a código (para implementar)

- Leer `animation_key` en `renderGiftVisual` (`VideoChatFavoritosCliente.jsx`).
- Al montar el mensaje-regalo por primera vez → disparar `playGiftFx(animationKey)` sobre una capa FX del chat.
- Backend/WS: incluir `animation_key` (o el gift completo) en el payload del mensaje-regalo que viaja por el socket, para que el receptor lo reproduzca.
