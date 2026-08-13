import React from 'react';
import IconSupport from '../navbar/IconSupport';

/**
 * Avatar circular del bot de Soporte.
 *
 * Mismo lenguaje visual que `LetterAvatar` (FavoritesStyles): círculo con
 * gradiente coral→violeta y contenido en blanco. Dentro va el headset
 * (`IconSupport`), que hereda el blanco vía currentColor. Sustituye al
 * robot `icono-agente-ia.png` en la lista de favoritos y en el header del
 * chat de soporte, para que el icono de soporte sea el mismo en toda la app.
 */
const SupportAvatar = ({ size = 38 }) => (
  <div
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      color: '#fff',
      background: 'linear-gradient(135deg, #ff5c8a, #a78bfa)',
    }}
  >
    <IconSupport size={Math.round(size * 0.58)} />
  </div>
);

export default SupportAvatar;
