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
  color: rgba(231,235,240,0.6);
  font-size: 14px;
`;

// Tarjeta de item (sin hover/sombra para evitar parpadeo)
export const ItemCard = styled.li`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: #e7ebf0;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  margin-bottom: 1px;
  transition: background-color .12s ease, border-color .12s ease;

  &:hover { background: rgba(255,255,255,0.05); }

  /* Rediseño favoritos (2026-08-19): selección con rojo de marca. */
  &[data-selected="true"]{
    background: linear-gradient(90deg, rgba(234,29,29,0.15), rgba(234,29,29,0.03));
    border-color: rgba(234,29,29,0.34);
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

// Avatar de letra: para perfiles sin foto, círculo con la inicial (coherente
// con la cabecera del chat). Evita el placeholder genérico avatarChica.png.
export const LetterAvatar = styled.div`
  width: ${({ $size = 38 }) => $size}px;
  height: ${({ $size = 38 }) => $size}px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: ${({ $size = 38 }) => Math.round($size * 0.42)}px;
  line-height: 1;
  background: linear-gradient(135deg, #ff5c8a, #a78bfa);
  text-transform: uppercase;
  user-select: none;
`;

// Bloque de info (nombre + meta)
export const Info = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;  /* permite ellipsis en hijos */
  flex: 1;       /* ocupa espacio entre avatar y badges */
`;

export const Name = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 14.5px;
  font-weight: 600;
  color: #e2e7ec;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* ... si no cabe */
`;

/* Rediseño favoritos (2026-08-19): buscador, agrupación online/offline,
   preview del último mensaje + hora + no-leídos numérico. */
export const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 11px;
  padding: 8px 12px;
  margin: 0 2px 6px;

  .ic { color: #8b94a1; font-size: 13px; }
  input {
    flex: 1; min-width: 0;
    background: none; border: 0; outline: none;
    color: #eaeef3; font-size: 13.5px;
  }
  input::placeholder { color: #8b94a1; }
`;

export const GroupLabel = styled.div`
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: #8b94a1;
  padding: 10px 8px 5px;
`;

export const ItemBody = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ItemTopRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

export const ItemPrevRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
`;

export const Time = styled.span`
  flex: 0 0 auto;
  font-size: 11px;
  color: #8b94a1;
`;

export const Preview = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: #8b94a1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const UnreadBadge = styled.span`
  flex: 0 0 auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ea1d1d;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
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

// 2026-08-08: Badge eliminado por huérfano (Fase E limpieza). Los badges
// vivos usan AdminStyles.Badge (cluster admin) y otras variantes locales.

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
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2.5px solid #0f1217;
  background: #8891a0;
  &.online  { background: #22c55e; }
  &.busy    { background: #f59e0b; }
  &.offline { background: #8891a0; }
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
  color: rgba(231,235,240,0.55);
  transition: background-color .12s ease, transform .08s ease, color .12s ease;

  &:hover { background: rgba(255,255,255,0.08); color: #fff; }
  &:active { transform: translateY(1px); }

  &[data-open="true"]{
    background: rgba(255,255,255,0.12);
    color: #fff;
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
