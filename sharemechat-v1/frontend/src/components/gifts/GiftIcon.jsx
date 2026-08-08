// GiftIcon.jsx
// Componente único para pintar un icono-regalo. Si el `code`/`slug` del
// regalo coincide con uno de los iconos SVG propios (Fase 0), lo pinta
// vectorial (nítido a cualquier tamaño, sin peso de red). Si no, cae al
// `iconUrl` remoto (retrocompat con el catálogo actual servido por
// /products/emojis/available). Requiere <GiftIconDefs/> montado una vez
// en la vista.
//
// Uso:
//   <GiftIconDefs />                       // una vez, cerca de la raíz
//   <GiftIcon slug="rose" size={48} />     // vectorial propio
//   <GiftIcon slug={g.code} iconUrl={g.icon} alt={g.name} size={40} />
//
// El mapeo real gift(BD) -> slug se resuelve al cablear (Fase 1): o bien el
// `code` de BD ya casa con estos slugs, o se define un mapa en ese punto.
import React from 'react';

// Slugs con icono vectorial propio disponible (deben existir como
// <symbol id="gi-<slug>"> en GiftIconDefs).
export const GIFT_ICON_SLUGS = new Set([
  // free
  'heart', 'star', 'fire', 'sparkle', 'rosebud', 'kiss',
  // paid
  'rose', 'cocktail', 'teddy', 'diamond', 'ring', 'crown', 'rocket', 'gift',
]);

export function hasLocalGiftIcon(slug) {
  return !!slug && GIFT_ICON_SLUGS.has(String(slug).toLowerCase());
}

export default function GiftIcon({ slug, iconUrl, alt = '', size = 48, className, style }) {
  const normalized = slug ? String(slug).toLowerCase() : null;
  const dimStyle = { width: size, height: size, display: 'block', ...style };

  if (hasLocalGiftIcon(normalized)) {
    return (
      <svg className={className} style={dimStyle} role="img" aria-label={alt || normalized}>
        <use href={`#gi-${normalized}`} />
      </svg>
    );
  }

  if (iconUrl) {
    return (
      <img
        className={className}
        style={{ ...dimStyle, objectFit: 'contain' }}
        src={iconUrl}
        alt={alt}
      />
    );
  }

  return null;
}
