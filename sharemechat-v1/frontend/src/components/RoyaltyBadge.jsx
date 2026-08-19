// src/components/RoyaltyBadge.jsx
//
// Card 1 Fase 3: insignias de realeza por likes (SVG propios). El código
// viene del backend (ModelLikeStateDTO.badgeCode): TIARA / DIADEM / CROWN /
// GEMS_CROWN / IMPERIAL. Se dibujan a mano porque no hay emoji para la
// progresión de coronas (solo existe uno). Colores planos para render
// consistente a tamaño pequeño.

import React from 'react';

const GOLD = '#d9ad44';
const GOLD_DEEP = '#c79a34';
const GOLD_HI = '#fff0c2';
const SILVER = '#cfd6e0';
const RUBY = '#e0455a';
const SAPPHIRE = '#4a86e0';
const EMERALD = '#3fc281';

const PATHS = {
  TIARA: (
    <>
      <path d="M9 30 Q24 21 39 30" fill="none" stroke={SILVER} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="13" cy="26" r="2" fill={SILVER} />
      <circle cx="35" cy="26" r="2" fill={SILVER} />
      <path d="M24 15 l3 5 -3 3 -3 -3 z" fill={SILVER} />
      <circle cx="24" cy="19" r="1.7" fill={RUBY} />
    </>
  ),
  DIADEM: (
    <>
      <path d="M8 32 L8 27 Q24 22 40 27 L40 32 Z" fill={GOLD} />
      <path d="M24 12 l4 9 -4 3 -4 -3 z" fill={GOLD} />
      <path d="M14 20 l3 6 -3 2 -3 -2 z" fill={GOLD} />
      <path d="M34 20 l3 6 -3 2 -3 -2 z" fill={GOLD} />
      <circle cx="24" cy="18" r="2.3" fill={SAPPHIRE} />
    </>
  ),
  CROWN: (
    <>
      <path d="M7 33 L7 20 L15 27 L24 13 L33 27 L41 20 L41 33 Z" fill={GOLD} />
      <rect x="7" y="31" width="34" height="4" rx="1" fill={GOLD_DEEP} />
      <circle cx="24" cy="13" r="2.1" fill={GOLD_HI} />
      <circle cx="15" cy="27" r="1.6" fill={GOLD_HI} />
      <circle cx="33" cy="27" r="1.6" fill={GOLD_HI} />
    </>
  ),
  GEMS_CROWN: (
    <>
      <path d="M6 33 L6 19 L15 27 L24 11 L33 27 L42 19 L42 33 Z" fill={GOLD} />
      <rect x="6" y="30" width="36" height="5" rx="1.5" fill={GOLD_DEEP} />
      <circle cx="15" cy="32.5" r="2" fill={EMERALD} />
      <circle cx="24" cy="32.5" r="2.3" fill={RUBY} />
      <circle cx="33" cy="32.5" r="2" fill={SAPPHIRE} />
      <path d="M24 6 l2.6 4 -2.6 2.6 -2.6 -2.6 z" fill={RUBY} />
    </>
  ),
  IMPERIAL: (
    <>
      <rect x="9" y="33" width="30" height="6" rx="2.5" fill={GOLD_DEEP} />
      <path d="M11 34 Q11 20 24 18 Q37 20 37 34 Z" fill={GOLD} />
      <path d="M13 31 Q24 13 35 31" fill="none" stroke={GOLD_HI} strokeWidth="1.8" />
      <circle cx="24" cy="12.5" r="3" fill={GOLD} stroke={GOLD_HI} strokeWidth="1" />
      <path d="M24 5.5 l0 5.5 M21.4 8.2 l5.2 0" stroke={GOLD_HI} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="36" r="2" fill={SAPPHIRE} />
      <circle cx="24" cy="36" r="2.3" fill={RUBY} />
      <circle cx="32" cy="36" r="2" fill={EMERALD} />
    </>
  ),
};

const RoyaltyBadge = ({ code, size = 26, title }) => {
  const paths = PATHS[code];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={Math.round(size * (44 / 48))}
      viewBox="0 0 48 44"
      role="img"
      aria-label={title || code}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
};

export default RoyaltyBadge;
