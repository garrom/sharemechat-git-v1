# Fase 0 — Set de iconos SVG (APROBADO 2026-08-08)

Set base del rediseño de iconos del chat de favoritos. Estado: **aprobado por el operador** (sin cambios; futuras ampliaciones se añadirán más adelante). Este archivo es la **fuente canónica para implementar**: copiar de aquí los paths a los componentes de producción.

Referencia visual: `mocks/fase0-iconset.html` (mock completo con showcase, contexto de tarjetas y prueba de escala) y `mocks/fase0-iconset-static.html` (grid estático sin JS).

## Estilo

- Lienzo `viewBox="0 0 64 64"` por icono. Vector puro, escala nítida a cualquier tamaño (probado 24/40/64/96px).
- Lenguaje visual: formas planas, redondeadas, **2 tonos por color** (base + sombra) para dar volumen sin gradientes. Sombra externa opcional vía CSS `filter: drop-shadow(0 8px 12px rgba(0,0,0,.35))`.
- Sin dependencias, sin assets remotos. Todo inline en el repo.

## Paleta

| Rol | Base | Sombra / detalle |
|---|---|---|
| Rojo amor | `#ff4d6d` | `#e02a58` / highlight `#ff7d94` |
| Rosa | `#ff5c8a` | `#c22c53` / `#ff89ac` |
| Oro | `#ffd15c` | `#f0b429` / `#e0a52b` |
| Cielo | `#5cc8ff` | `#37a9e8` / `#8fdcff` / `#cdeeff` |
| Naranja fuego | `#ff7a1a` | detalle `#ffd15c` |
| Verde tallo | `#37bf74` | `#2fa565` / `#2c9a5e` |
| Violeta | `#a78bfa` | (rareza epic, UI) |
| Marrón peluche | `#c98a63` | `#b97a56` / `#e6c19c` |

Rareza (solo UI, no es color de icono): rare `#5cc8ff` · epic `#a78bfa` · legendary `#f5b942`.

## Inventario

**Emojis gratis (FREE_EMOJI / tier QUICK):** heart, star, fire, sparkle, rosebud, kiss.
**Regalos de pago (PAID_GIFT / tier PREMIUM):** rose, cocktail, teddy, diamond, ring, crown, rocket, gift.

> Nombres/precios/rareza mostrados en el mock son de ejemplo; los reales viven en BD (`gifts.name`, `gifts.cost`, `gifts.tier`, `gifts.featured`). Estos SVG son el **arte**, que reemplaza los `icon` remotos actuales (o se referencian localmente).

## Código fuente (symbols SVG)

Definir una vez en un `<svg><defs>…</defs></svg>` oculto y reusar con `<use href="#i-...">`, o convertir cada uno a componente/imagen según decida la Fase 1.

```html
<symbol id="i-heart" viewBox="0 0 64 64"><path d="M32 53C30 47 14 38 10 26 7 17 14 11 22 13 27 14 30 18 32 23 34 18 37 14 42 13 50 11 57 17 54 26 50 38 34 47 32 53Z" fill="#ff4d6d"/><path d="M22 13c-7-2-13 4-11 12 2 6 7 11 12 15-3-4-6-9-8-14-2-7 2-12 7-13Z" fill="#ff7d94" opacity=".55"/></symbol>

<symbol id="i-star" viewBox="0 0 64 64"><path d="M32 8 37.9 23.9 54.8 24.6 41.5 35.1 46.1 51.4 32 42 17.9 51.4 22.5 35.1 9.2 24.6 26.1 23.9Z" fill="#ffd15c"/><path d="M32 8 37.9 23.9 54.8 24.6 41.5 35.1 46.1 51.4 32 42Z" fill="#f0b429"/></symbol>

<symbol id="i-fire" viewBox="0 0 64 64"><path d="M33 6c8 12 15 16 13 29-1 11-8 19-14 21-6-2-13-9-13-20 0-7 5-9 7-14 2 6 4 6 4 1 0-9 0-12 3-17Z" fill="#ff7a1a"/><path d="M33 28c4 5 6 9 5 15-1 5-4 9-6 10-3-1-6-5-6-11 0-4 3-6 4-9 1 3 3 3 3-1 0-2 0-3 0-4Z" fill="#ffd15c"/></symbol>

<symbol id="i-sparkle" viewBox="0 0 64 64"><path d="M32 8C34 23 41 30 56 32 41 34 34 41 32 56 30 41 23 34 8 32 23 30 30 23 32 8Z" fill="#ffe08a"/><path d="M32 20c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12Z" fill="#fff6d8"/><circle cx="52" cy="14" r="3" fill="#ffd15c"/><circle cx="13" cy="50" r="2.4" fill="#ffd15c"/></symbol>

<symbol id="i-rosebud" viewBox="0 0 64 64"><path d="M32 44c-6 0-11-2-11-8 0-8 5-16 11-20 6 4 11 12 11 20 0 6-5 8-11 8Z" fill="#ff5c8a"/><path d="M32 44c-4 0-7-2-7-7 0-6 3-12 7-16 4 4 7 10 7 16 0 5-3 7-7 7Z" fill="#ff89ac"/><path d="M31 43h2v13h-2z" fill="#2fa565"/><path d="M33 50c4-1 8 1 9 5-4 1-8-1-9-5Z" fill="#37bf74"/></symbol>

<symbol id="i-kiss" viewBox="0 0 64 64"><path d="M12 27c6-9 15-6 20 0 5-6 14-9 20 0-5 1-9 2-14 3-2 0-4 0-6 0s-4 0-6 0c-5-1-9-2-14-3Z" fill="#ff3d6e"/><path d="M12 27c6 4 14 6 20 6s14-2 20-6c-3 8-11 15-20 15S15 35 12 27Z" fill="#e02a58"/><path d="M22 33c4 1 7 1 10 1s6 0 10-1c-3 3-6 4-10 4s-7-1-10-4Z" fill="#ff6b8f"/></symbol>

<symbol id="i-rose" viewBox="0 0 64 64"><path d="M31 40h2v18h-2z" fill="#2c9a5e"/><path d="M32 52c-7-2-13 1-14 8 7 2 13-1 14-8Z" fill="#37bf74"/><path d="M32 54c7-3 14 0 15 7-7 2-14-1-15-7Z" fill="#2fa565"/><circle cx="32" cy="24" r="16" fill="#e8456f"/><path d="M32 10c8 0 15 6 16 14 0-2-3-4-6-3 2-3-1-7-4-6 1-3-3-6-6-4-3-2-7 1-6 4-3-1-6 3-4 6-3-1-6 1-6 3 1-8 8-14 16-14Z" fill="#ff7096"/><path d="M32 16c5 0 9 4 8 9-1-2-3-3-5-2 1-2-1-4-3-3 0-2-3-3-4-1-2-1-4 1-3 3-2-1-4 1-4 2-1-5 4-9 9-9Z" fill="#ffa9c0"/><circle cx="32" cy="25" r="3.4" fill="#c22c53"/></symbol>

<symbol id="i-cocktail" viewBox="0 0 64 64"><path d="M14 15h36L32 37Z" fill="#dfe7ee"/><path d="M19 20h26L32 33Z" fill="#ff8a5c"/><path d="M31 36h2v16h-2z" fill="#cfd8e0"/><ellipse cx="32" cy="53" rx="11" ry="3.4" fill="#cfd8e0"/><path d="M43 15l6-7" stroke="#37bf74" stroke-width="2.4" stroke-linecap="round"/><circle cx="41" cy="20" r="3.4" fill="#ff4d6d"/></symbol>

<symbol id="i-diamond" viewBox="0 0 64 64"><path d="M20 16h24l10 12-22 26L10 28Z" fill="#5cc8ff"/><path d="M10 28h44L32 54Z" fill="#37a9e8"/><path d="M20 16 24 28 10 28ZM44 16 40 28 54 28ZM24 28h16l-8 26Z" fill="#8fdcff"/><path d="M24 28 32 20 40 28Z" fill="#cdeeff"/></symbol>

<symbol id="i-ring" viewBox="0 0 64 64"><path d="M32 22 24 30 32 38 40 30Z" fill="#8fdcff"/><path d="M32 22 27 30 32 38 37 30Z" fill="#cdeeff"/><circle cx="32" cy="42" r="15" fill="none" stroke="#ffd15c" stroke-width="6"/><circle cx="32" cy="42" r="15" fill="none" stroke="#f0b429" stroke-width="6" stroke-dasharray="14 80" stroke-linecap="round"/></symbol>

<symbol id="i-crown" viewBox="0 0 64 64"><path d="M10 44 12 20 24 33 32 16 40 33 52 20 54 44Z" fill="#ffd15c"/><path d="M10 44 12 20 24 33 32 16 40 33 52 20 54 44Z" fill="none" stroke="#e0a52b" stroke-width="1.5" stroke-linejoin="round"/><rect x="10" y="44" width="44" height="9" rx="2.5" fill="#f0b429"/><circle cx="32" cy="26" r="3" fill="#ff4d6d"/><circle cx="15" cy="27" r="2.4" fill="#5cc8ff"/><circle cx="49" cy="27" r="2.4" fill="#5cc8ff"/></symbol>

<symbol id="i-rocket" viewBox="0 0 64 64"><path d="M32 6c8 6 12 16 12 28l-4 8H24l-4-8C20 22 24 12 32 6Z" fill="#eef2f6"/><path d="M32 6c8 6 12 16 12 28l-4 8h-8V6Z" fill="#cdd6df"/><circle cx="32" cy="26" r="6" fill="#5cc8ff"/><circle cx="32" cy="26" r="6" fill="none" stroke="#2f8fce" stroke-width="1.5"/><path d="M24 40l-8 8 2-14ZM40 40l8 8-2-14Z" fill="#ff5c8a"/><path d="M27 50c1 5 3 8 5 8s4-3 5-8c-3 2-7 2-10 0Z" fill="#ff7a1a"/></symbol>

<symbol id="i-teddy" viewBox="0 0 64 64"><circle cx="18" cy="18" r="7" fill="#b97a56"/><circle cx="46" cy="18" r="7" fill="#b97a56"/><circle cx="18" cy="18" r="3.4" fill="#e0b48f"/><circle cx="46" cy="18" r="3.4" fill="#e0b48f"/><ellipse cx="32" cy="38" rx="18" ry="20" fill="#c98a63"/><ellipse cx="32" cy="44" rx="10" ry="11" fill="#e6c19c"/><circle cx="25" cy="28" r="2.6" fill="#3a2416"/><circle cx="39" cy="28" r="2.6" fill="#3a2416"/><circle cx="32" cy="36" r="3" fill="#3a2416"/></symbol>

<symbol id="i-gift" viewBox="0 0 64 64"><rect x="12" y="26" width="40" height="28" rx="3" fill="#ff5c8a"/><rect x="10" y="18" width="44" height="11" rx="3" fill="#ff789e"/><rect x="28" y="18" width="8" height="36" fill="#ffd15c"/><path d="M32 18c-2-8-14-8-12 0 3 3 8 2 12 0Zm0 0c2-8 14-8 12 0-3 3-8 2-12 0Z" fill="#f0b429"/></symbol>
```

## Pendiente al implementar (Fase 1+)

- Decidir formato de entrega en producción: `<symbol>`/`<use>` compartido, componentes React, o mapa `code → svg`. Recomendado: un módulo `giftIcons` que mapee el `code`/`animationKey` de BD al symbol, con fallback al `icon` remoto si no hay symbol local.
- Los emoji del composer (botones ☺/🎁) y el fondo del chat no se tocan en Fase 0.
