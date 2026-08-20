# Catálogo de regalos (gifts) — fuente única

> **Fuente de verdad del catálogo.** Antes vivía solo en la BD (dato manual,
> drift entre entornos) y en la cabeza de quien lo tocaba. Desde 2026-08-20 el
> catálogo se **versiona** y **viaja con el deploy** (migración Flyway). No se
> siembra a mano por entorno.

## Modelo mental

- Un **regalo** es una fila de la tabla `gifts`, identificada por su **`code`**
  (obligatorio y único desde V55). Es lo que se envía con precio (o gratis) en la
  **barra de regalos** del chat.
- **Decisión de producto (2026-08-19): todo el catálogo se pinta como EMOJI
  nativo** (gratis y de pago). El frontend `components/gifts/GiftIcon.jsx`
  resuelve el emoji **por `code`**. Los SVG propios quedaron como legacy no usado.
- La columna `icon` guarda el **emoji** del regalo (autodescriptivo). Las URLs
  `.webp` del render viejo están obsoletas; el frontend NO las usa.

## Qué NO es un regalo

Las **caritas del selector de emojis** del chat (botón 😊) son emojis de
conversación, **gratis e ilimitados**, y **NO** son regalos: no están en la tabla
`gifts` ni se ofrecen en la barra de regalos. Son un sistema aparte (frontend).

## Catálogo canónico (sembrado por `V55__gifts_catalog_canonical.sql`)

**De pago (premium):**

| code | emoji | nombre | precio (€) | featured |
|---|---|---|---|---|
| `rosa` | 🌹 | Rosa | 1.00 | |
| `cocktail` | 🍸 | Cóctel | 3.00 | |
| `teddy` | 🧸 | Osito | 5.00 | |
| `gift` | 🎁 | Caja de regalos | 8.00 | |
| `ring` | 💍 | Anillo | 12.00 | |
| `corona` | 👑 | Corona | 15.00 | ★ |
| `rocket` | 🚀 | Cohete | 20.00 | |
| `diamante` | 💎 | Diamante | 25.00 | ★ |

**Gratis (objetos de la barra):**

| code | emoji | nombre |
|---|---|---|
| `heart` | ❤️ | Corazón |
| `star` | ⭐ | Estrella |
| `fire` | 🔥 | Fuego |
| `sparkle` | ✨ | Destello |
| `labios` | 💋 | Labios |

> Nota: `rosebud` (otra rosa gratis) se retiró — la rosa ya existe como regalo de
> pago. Las emojis del `GiftIcon` deben coincidir con estos `code`.

> **V56 (2026-08-20):** `V56__gifts_deactivate_legacy.sql` desactiva
> (`active=0`) cualquier fila fuera de estos 13 `code`. En TEST/AUDIT quedaban
> 8 "caras" legacy de tier `quick` (basic/flirty/hot/laugh/love/ok/sad/wow) que
> el frontend ya ocultaba; ahora también salen del catálogo servido. En PROD es
> no-op (arrancó vacío). Tras V55+V56, el catálogo **activo** es exactamente
> estos 13. No se borran filas (FK de historial intactas), solo se desactivan.

## Esquema

`gifts.code` es `VARCHAR(64) NOT NULL` con `UNIQUE KEY uq_gifts_code` (identidad
del regalo; antes era opcional y no único, de ahí los duplicados históricos).
Precio en `cost DECIMAL(10,2)`; `tier` = `premium` (pago) / `quick` (gratis);
`active` para publicar/ocultar; `sort_order` para el orden en la barra.

## Cómo cambiar el catálogo (sin notitas)

1. Añade/edita el emoji por `code` en `GiftIcon.jsx` (si es un `code` nuevo).
2. Crea una **nueva migración** `V<n>__...sql` con el `INSERT ... ON DUPLICATE KEY
   UPDATE` del cambio (mismo patrón que V55). Idempotente por `UNIQUE(code)`.
3. Actualiza esta tabla.
4. El deploy la aplica en todos los entornos. **Nunca** editar `gifts` a mano.
