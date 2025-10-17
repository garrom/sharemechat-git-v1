// src/widgets/Icon.jsx
import React from 'react';

// Tamaños estandarizados
const SIZES = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
};

/**
 * Icon wrapper: renderiza cualquier icono de react-icons con tamaño consistente
 * Uso: <Icon as={HiOutlineTrash} size="sm" title="Eliminar" />
 */
export default function Icon({ as: Component, size = 'md', title, style, ...rest }) {
  if (!Component) return null;
  const px = typeof size === 'number' ? size : (SIZES[size] || SIZES.md);
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      title={title}
      style={{ display:'inline-flex', lineHeight: 0, ...style }}
    >
      <Component size={px} {...rest} />
    </span>
  );
}
