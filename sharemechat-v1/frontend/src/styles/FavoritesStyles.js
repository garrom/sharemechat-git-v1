import styled from 'styled-components';

// Contenedor de lista
export const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

// Estados vacíos o cargando
export const StateRow = styled.div`
  padding: 12px;
  color: #6c757d;
  font-size: 14px;
`;

// Tarjeta de item (sin hover/sombra para evitar parpadeo)
export const ItemCard = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  margin-bottom: 8px;
`;

// Avatar con tamaño fijo → evita reflow/parpadeo
export const Avatar = styled.img.attrs(({ $size = 40 }) => ({
  width: $size,
  height: $size,
}))`
  width: ${({ $size = 40 }) => $size}px;
  height: ${({ $size = 40 }) => $size}px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #eee;
`;

// Bloque de info (nombre + meta)
export const Info = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;  /* permite ellipsis en hijos */
  flex: 1;       /* ocupa espacio entre avatar y badges */
`;


export const Name = styled.span`
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* ... si no cabe */
`;


export const Meta = styled.div`
  font-size: 12px;
  color: #6c757d;
`;

// Botonera de acciones (ej. Chatear / Quitar)
export const Actions = styled.div`
  display: flex;
  gap: 6px;
`;

// Botón genérico
export const Btn = styled.button`
  padding: 6px 10px;
  border: 1px solid #ddd;
  background: ${({ disabled }) => (disabled ? '#f8f9fa' : '#fff')};
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
`;

// Contenedor de badges (status/invited)
export const Badges = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;              /* espacio entre iconos */
  margin-left: auto;     /* empuja badges hacia la derecha */
`;


// Badge sencillo con variantes
export const Badge = styled.span`
  display: inline-block;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;

  ${({ $variant }) =>
    $variant === 'secondary' && `
      background: #6c757d;
    `}
  ${({ $variant }) =>
    $variant === 'warning' && `
      background: #ffc107; color: #212529;
    `}
  ${({ $variant }) =>
    $variant === 'danger' && `
      background: #dc3545;
    `}
  ${({ $variant }) =>
    $variant === 'success' && `
      background: #28a745;
    `}
`;

// DOT Contenedor para superponer el punto de presencia sobre el avatar
export const DotWrap = styled.div`
  position: relative;
  display: inline-block;
`;

// DOT Punto de presencia: verde=online, rojo=busy, gris=offline
export const PresenceDot = styled.span`
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: ${({ $p }) =>
    $p === 'busy' ? '#dc3545' :
    $p === 'online' ? '#28a745' :
    '#6c757d'};
`;

export const StatusDot = styled.span`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 auto;
  /* color por defecto (offline) */
  background: #9ca3af;

  &.online  { background: #22c55e; } /* verde */
  &.busy    { background: #f59e0b; } /* ámbar */
  &.offline { background: #9ca3af; } /* gris */
`;

