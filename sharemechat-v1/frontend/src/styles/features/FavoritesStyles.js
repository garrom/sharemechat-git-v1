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
  flex: 1;
  min-width: 0;
`;

export const Name = styled.div`
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  display: flex;
  gap: 6px;
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
