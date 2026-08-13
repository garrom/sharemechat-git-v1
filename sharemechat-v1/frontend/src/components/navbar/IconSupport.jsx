import React from 'react';

/**
 * Icono de "Soporte" (auriculares con micrófono, estilo línea).
 *
 * Sustituye al robot `icono-agente-ia.png` como botón de soporte en el
 * navbar (desktop y móvil). El robot se mantiene aparte como avatar del
 * bot dentro del chat de soporte y las listas de favoritos.
 *
 * Usa `stroke: currentColor` a propósito: hereda el color del texto de
 * cada contexto, así se adapta solo al fondo de cada sitio —claro sobre
 * el navbar oscuro (#111418), oscuro sobre la píldora blanca del menú
 * móvil (NavButton), y blanco en el hover inverso— sin hardcodear.
 *
 * Decorativo (aria-hidden): el botón/enlace contenedor ya aporta la
 * etiqueta accesible "Soporte".
 */
const IconSupport = ({ size = 24, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block' }}
    {...rest}
  >
    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
    <path d="M4 13h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M20 13h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1z" />
    <path d="M18 19a4 4 0 0 1-4 3h-2" />
  </svg>
);

export default IconSupport;
