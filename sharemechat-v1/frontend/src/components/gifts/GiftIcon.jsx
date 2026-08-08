// GiftIcon.jsx
// Componente unico para pintar un icono-regalo del chat. Resuelve por el
// `code` del regalo (de BD):
//   1. Regalo de PAGO (premium)  -> vector SVG propio (look premium/marca).
//   2. Emoji GRATIS (quick)      -> emoji unicode nativo (mejor aspecto y
//      universal; mismo criterio que el selector de emojis del composer).
//   3. Si no casa ninguno        -> fallback al `iconUrl` remoto (retrocompat
//      con el catalogo .webp servido por /products/emojis/available).
// Requiere <GiftIconDefs/> montado una vez para el caso SVG.
//
// Mapeo alineado con el catalogo real ACTIVO de BD (tabla gifts):
//   pago:   corona, diamante, labios, rosa
//   gratis: flirty, hot, kiss, laugh, love, ok, sad, wow, basic
import React from 'react';

// Slugs con icono vectorial propio (deben existir como <symbol id="gi-<slug>">).
export const GIFT_ICON_SLUGS = new Set([
  'heart', 'star', 'fire', 'sparkle', 'rosebud', 'kiss',
  'rose', 'cocktail', 'teddy', 'diamond', 'ring', 'crown', 'rocket', 'gift',
]);

// Regalos de PAGO: code de BD -> slug SVG propio.
const CODE_TO_SLUG = {
  corona: 'crown',
  diamante: 'diamond',
  labios: 'kiss',   // "labios" = lips; el SVG gi-kiss son unos labios
  rosa: 'rose',
};

// Emojis GRATIS: code de BD -> emoji unicode nativo.
const CODE_TO_EMOJI = {
  flirty: '\u{1F609}', // guiño
  hot: '\u{1F975}',    // acalorado
  kiss: '\u{1F618}',   // beso
  laugh: '\u{1F602}',  // risa con lagrimas
  love: '\u{1F60D}',   // ojos de corazon
  ok: '\u{1F44C}',     // ok mano
  sad: '\u{1F622}',    // triste
  wow: '\u{1F62E}',    // sorpresa
  basic: '\u{1F642}',  // sonrisa simple
};

export function hasLocalGiftIcon(slug) {
  return !!slug && GIFT_ICON_SLUGS.has(String(slug).toLowerCase());
}

export function resolveGiftSlug(code) {
  const c = code != null ? String(code).toLowerCase() : null;
  if (!c) return null;
  if (CODE_TO_SLUG[c]) return CODE_TO_SLUG[c];
  if (GIFT_ICON_SLUGS.has(c)) return c; // por si el code ya es un slug propio
  return null;
}

export default function GiftIcon({ code, slug, iconUrl, alt = '', size = 48, className, style }) {
  // Acepta `code` (de BD, preferido) o `slug` (uso directo / retrocompat).
  const raw = code != null ? code : slug;
  const c = raw != null ? String(raw).toLowerCase() : null;

  // 1) Regalo de pago con vector propio.
  const resolvedSlug = resolveGiftSlug(c);
  if (resolvedSlug) {
    return (
      <svg className={className} style={{ display: 'block', width: size, height: size, ...style }} role="img" aria-label={alt || resolvedSlug}>
        <use href={`#gi-${resolvedSlug}`} />
      </svg>
    );
  }

  // 2) Emoji gratis nativo.
  if (c && CODE_TO_EMOJI[c]) {
    return (
      <span
        className={className}
        role="img"
        aria-label={alt || c}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.92),
          lineHeight: 1,
          userSelect: 'none',
          ...style,
        }}
      >
        {CODE_TO_EMOJI[c]}
      </span>
    );
  }

  // 3) Fallback al icono remoto actual.
  if (iconUrl) {
    return (
      <img
        className={className}
        style={{ objectFit: 'contain', display: 'block', width: size, height: size, ...style }}
        src={iconUrl}
        alt={alt}
      />
    );
  }

  return null;
}
