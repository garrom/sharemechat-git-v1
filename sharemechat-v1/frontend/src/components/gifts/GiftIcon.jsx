// GiftIcon.jsx
// Componente unico para pintar un icono-regalo del chat. Resuelve por el
// `code` del regalo (de BD):
//   1. Regalo de PAGO (premium)  -> vector SVG propio (look premium/marca).
//   2. Emoji GRATIS (quick)      -> emoji unicode nativo (mejor aspecto y
//      universal; mismo criterio que el selector de emojis del composer).
//   3. Si no casa ninguno        -> vector generico de regalo (#gi-gift). Se
//      IGNORA a proposito el `iconUrl` remoto: el catalogo .webp del render
//      viejo no existe para la mayoria de codes -> 404 -> imagen rota. El
//      generico siempre esta disponible via <GiftIconDefs/>.
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

// Regalos de PAGO (y objetos gratis): code de BD -> slug SVG propio.
const CODE_TO_SLUG = {
  corona: 'crown',
  diamante: 'diamond',
  labios: 'kiss',   // "labios" = lips; el SVG gi-kiss son unos labios
  rosa: 'rose',
  destello: 'sparkle', // alias defensivo: si el code llega como "destello" (nombre ES) igualmente resuelve al SVG gi-sparkle
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

// Codigos-carita: regalos gratis que son una CARA (no un objeto). Se excluyen
// de la barra de regalos porque esas caras ya viven en el selector de emojis
// del composer (boton 😊); no deben ofrecerse tambien como "regalo".
// Coincide exactamente con las claves de CODE_TO_EMOJI (todas son caras/gestos).
// OJO: "labios" (SVG de labios) es un OBJETO, no carita -> NO entra aqui.
export const FACE_GIFT_CODES = new Set(Object.keys(CODE_TO_EMOJI));

export function isFaceGiftCode(code) {
  const c = code != null ? String(code).toLowerCase() : null;
  return !!c && FACE_GIFT_CODES.has(c);
}

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

export default function GiftIcon({ code, slug, alt = '', size = 48, className, style }) {
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
          fontSize: Math.round(size * 0.8), // emoji nativo mas pequeno que su hueco: iguala peso visual con los SVG (48 -> ~38)
          lineHeight: 1,
          userSelect: 'none',
          ...style,
        }}
      >
        {CODE_TO_EMOJI[c]}
      </span>
    );
  }

  // 3) Sin code resoluble: NO usamos el `iconUrl` remoto. Es un `.webp` del
  //    render VIEJO que hoy no se genera para la mayoria de codes -> 404 ->
  //    imagen rota "no disponible" (intermitente segun si el .webp existe o no
  //    en S3). Caemos a un vector generico de regalo, SIEMPRE disponible via
  //    <GiftIconDefs/>. Asi el fallback nunca muestra una imagen rota.
  return (
    <svg className={className} style={{ display: 'block', width: size, height: size, ...style }} role="img" aria-label={alt || 'gift'}>
      <use href="#gi-gift" />
    </svg>
  );
}
