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
  transition: background-color .12s ease, border-color .12s ease;

  &[data-selected="true"]{
    background: #f1f5f9;
    border-color: #d7dde5;
  }
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  background: #9ca3af;
  &.online  { background: #22c55e; }
  &.busy    { background: #f59e0b; }
  &.offline { background: #9ca3af; }
`;

/* =========================
   WhatsApp-like: botón chevron + menú centrado
   ========================= */

export const FavMenuTrigger = styled.button`
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background-color .12s ease, transform .08s ease;

  &:hover { background: rgba(0,0,0,0.06); }
  &:active { transform: translateY(1px); }

  &[data-open="true"]{
    background: rgba(0,0,0,0.08);
  }

  @media (max-width: 768px){
    padding: 8px;
  }
`;

export const FavMenu = styled.div`
  position: fixed;
  z-index: 9999;
  width: 220px;
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0,0,0,.14);
  overflow: hidden;

  @media (max-width: 768px){
    width: min(240px, calc(100vw - 20px));
    border-radius: 14px;
  }
`;

export const FavMenuItem = styled.button`
  width: 100%;
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  font-size: 14px;
  color: #111;
  text-align: left;

  /* WhatsApp-style danger hover */
  &:hover{
    background: #fff1f2;          /* rojo muy claro */
    color: #b91c1c;               /* rojo */
  }

  &:active{
    background: #ffe4e6;
  }

  @media (max-width: 768px){
    padding: 14px 14px;
    font-size: 14px;
  }
`;

export const FavMenuIcon = styled.span`
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
`;

export const FavMenuDivider = styled.div`
  height: 1px;
  background: #f1f5f9;
`;
