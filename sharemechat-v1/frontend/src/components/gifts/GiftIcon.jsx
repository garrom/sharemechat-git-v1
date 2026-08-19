// GiftIcon.jsx
// Componente unico para pintar un icono-regalo del chat. Resuelve por el
// `code` del regalo (de BD):
//   1. GRATIS (caritas del boton 😊 + objetos gratis de la barra) -> emoji
//      unicode nativo. Decision de producto (opcion A): los gratis se pintan
//      SIEMPRE como emoji, los mande el cliente o la modelo, para que el mismo
//      objeto se vea IGUAL con independencia del emisor (en random la modelo
//      solo puede enviar por chat/emoji, y asi el cliente lo iguala).
//   2. Regalo de PAGO (premium) -> vector SVG propio (look premium/marca).
//   3. Si no casa ninguno       -> vector generico de regalo (#gi-gift). Se
//      IGNORA a proposito el `iconUrl` remoto (.webp del render viejo -> 404).
// Requiere <GiftIconDefs/> montado una vez para el caso SVG (pago).
//
// Catalogo real ACTIVO de BD (tabla gifts):
//   pago (SVG):     rosa, cocktail, teddy, gift, ring, corona, rocket, diamante
//   gratis objeto:  heart, star, fire, sparkle, rosebud, labios (emoji)
//   gratis carita:  flirty, hot, kiss, laugh, love, ok, sad, wow, basic (emoji)
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

// Regalos de PAGO: code de BD -> emoji unicode nativo.
// Decisión de producto (2026-08-19): TODO el catálogo activo se pinta como emoji
// nativo (gratis Y pago) para homogeneidad de tamaño/alineación — SVG y emoji no
// casaban en tamaño. Los símbolos SVG de GiftIconDefs quedan como legacy no usado
// por el catálogo vivo (se conservan por si un code no tuviera emoji).
export const PREMIUM_CODE_TO_EMOJI = {
  rosa: '🌹',
  cocktail: '🍸',
  teddy: '🧸',
  gift: '🎁',
  ring: '💍',
  corona: '👑',
  rocket: '🚀',
  diamante: '💎',
};

// Objetos GRATIS de la barra: code de BD -> emoji unicode nativo (opcion A).
// A diferencia de las caritas, estos SI son objetos y SIGUEN en la barra de
// regalos (no en el selector 😊) -> por eso NO se anaden a FACE_GIFT_CODES.
// Se exporta para que el envio del modelo en random (por chat) use el MISMO
// caracter que aqui, y el objeto se vea identico lo mande quien lo mande.
export const OBJECT_CODE_TO_EMOJI = {
  heart: '❤️',  // corazon
  star: '⭐',         // estrella
  fire: '\u{1F525}',      // fuego
  sparkle: '✨',      // destello
  rosebud: '\u{1F339}',   // rosa
  labios: '\u{1F48B}',    // beso/labios
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

// Emoji nativo del regalo por su code (gratis carita/objeto + pago). Se usa para
// los efectos (burst) y cualquier sitio que necesite el caracter, para que TODO
// sea emoji homogeneo (no SVG). null si el code no tiene emoji mapeado.
export function resolveGiftEmoji(code) {
  const c = code != null ? String(code).toLowerCase() : null;
  if (!c) return null;
  return CODE_TO_EMOJI[c] || OBJECT_CODE_TO_EMOJI[c] || PREMIUM_CODE_TO_EMOJI[c] || null;
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

  // 1) GRATIS -> emoji nativo (caritas del 😊 + objetos gratis de la barra).
  //    Va ANTES que el SVG: un objeto gratis (heart/star/...) se pinta emoji
  //    aunque tambien tenga slug SVG. Opcion A: el mismo objeto se ve igual lo
  //    mande el cliente (regalo real) o la modelo (chat/emoji en random).
  const emojiChar = c ? (CODE_TO_EMOJI[c] || OBJECT_CODE_TO_EMOJI[c] || PREMIUM_CODE_TO_EMOJI[c]) : null;
  if (emojiChar) {
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
        {emojiChar}
      </span>
    );
  }

  // 2) Regalo de PAGO con vector propio de marca.
  const resolvedSlug = resolveGiftSlug(c);
  if (resolvedSlug) {
    return (
      <svg className={className} style={{ display: 'block', width: size, height: size, ...style }} role="img" aria-label={alt || resolvedSlug}>
        <use href={`#gi-${resolvedSlug}`} />
      </svg>
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
