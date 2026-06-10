# Brand assets — fuentes canónicas

Carpeta de **fuente única** para los assets de identidad visual de
SharemeChat. Cualquier rasterización (OG card, logo192, avatares,
banners, favicons) debe derivarse de los SVG de esta carpeta, NO de
copias servidas por la SPA ni de los assets ya publicados en buckets
S3.

Patrón análogo a `ops/legal-history/`: el repositorio conserva la
fuente autoritativa; las copias servidas pueden divergir si se
sobreescriben en producción, pero la verdad de marca vive aquí.

## Contenido

### `wordmark/SharemeChat_white.svg`
Wordmark monolítico "Sharemechat" — 286×30, `viewBox="0 0 286 30"`,
paths puros (sin `<text>`, no requiere fuente para rasterizar). Dos
colores:
- `Shareme` → `white`
- `chat` → `#B50A0A` (rojo de marca, "chat" sobre fondo oscuro)

Sin separación visual entre `Shareme` y `chat`: el wordmark es una
sola palabra de dos colores. Diseñado para fondos oscuros.

Copia servida por la SPA en `frontend/public/img/SharemeChat_white.svg`
(idéntica bit-a-bit). La copia servida queda como conveniencia para el
runtime; la fuente autoritativa es ésta.

### `monogram/logo_circular.svg`
Monograma circular abreviado "SChat" — 400×400. Composición:
- Fondo circular `#0A0A0A` (radio 190)
- Borde rojo `#FF1A1A` (radio 185, stroke-width 10)
- `S` en rojo `#FF1A1A`, `Chat` en blanco — ambos `<text>` con
  `font-family: Poppins, Arial, sans-serif`, `font-size: 98`,
  `font-weight: 700`, `letter-spacing: -6px`.

**Importante**: el texto del monograma es `<text>` con
`font-family: Poppins`, NO paths. Cualquier rasterizador necesita
**Poppins instalado o disponible vía `@font-face`** para que el
monograma coincida con el diseño. Cualquier sustituto (Arial, Segoe
UI, etc.) altera la marca y NO debe usarse.

## Tipografía oficial

**Poppins** (Google Fonts, OFL — gratuita). Cualquier texto añadido
fuera del SVG (tagline de OG card, banner social, etc.) debe usar
Poppins. Nunca sustitutos.

Pesos típicos:
- Tagline / texto corrido: `Poppins Medium` o `SemiBold`
- Wordmark / texto destacado: `Poppins Bold` o `ExtraBold`

## Paleta oficial

| Uso | Hex | Nota |
|---|---|---|
| Fondo de marca (oscuro) | `#0b0f14` | mismo `theme-color` del SPA + HeroContainer pre-launch |
| Rojo de marca (wordmark) | `#B50A0A` | "chat" del wordmark |
| Rojo de marca (monograma) | `#FF1A1A` | borde + "S" del monograma; tono más vibrante para los assets sociales |
| Texto principal | `#FFFFFF` | "Shareme" del wordmark, "Chat" del monograma |
| Fondo monograma | `#0A0A0A` | círculo interior del monograma (ligeramente más oscuro que el fondo de página) |

## Tagline oficial (EN)

> "1-to-1 Video Chat with Verified Models"

Mismo string que `<title>` y `<meta description>` de
`frontend/public/index.html`. Cualquier asset social o promocional que
incluya tagline debe usar este string exacto (no parafrasear).

## Regla de no-deriva

Si un asset publicado en producción (OG card, avatar, banner) deja de
casar con la marca, NO se edita el asset publicado: se regenera desde
los SVG de esta carpeta + Poppins + paleta de arriba, se reemplaza y
se invalida el CDN.
