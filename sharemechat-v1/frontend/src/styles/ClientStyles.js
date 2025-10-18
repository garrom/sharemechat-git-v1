//ClientStyles.js
import styled from 'styled-components';

// Contenedor principal
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f2f5;
  min-width: 48px;
`;

// Navbar
export const StyledNavbar = styled.nav`
  background-color: #2B2F33;
  color: white;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(180deg, #2B2F33 0%, #272B30 100%);
`;

// Botón de la Navbar
export const StyledNavButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  /* Tamaño unificado */
  height: 36px;
  padding: 0 14px;
  white-space: nowrap;

  /* Tipografía y estética */
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  border-radius: 8px;

  /* Estilo coherente con el navbar actual */
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.85);
  color: #fff;

  /* Espacios y transiciones */
  gap: 8px;
  margin: 0;
  cursor: pointer;
  transition: background-color .2s ease, border-color .2s ease, color .2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.12);
    border-color: #fff;
  }

  /* Iconos dentro del botón */
  & > svg {
    width: 16px;
    height: 16px;
    display: block;
  }

  /* Evita dobles márgenes si usas StyledIconWrapper como label */
  & > span {
    margin: 0;
    font-size: inherit;
  }
`;

// Barra contenedora de las pestañas
export const StyledTabsBar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin-bottom: 0;
  }
`;


// Botón de pestaña: icono grande, sin texto
export const StyledTabIcon = styled.button`
  --tab-bg: #f8f9fa;
  --tab-fg: #495057;
  --tab-border: #dee2e6;
  --tab-bg-hover: #eef1f4;
  --tab-active-bg: #0d6efd;
  --tab-active-fg: #ffffff;

  width: 32px;
  height: 32px;
  border-radius: 2px;
  border: 1px solid var(--tab-border);
  background: var(--tab-bg);
  color: var(--tab-fg);

  display: inline-flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transition: background-color .18s ease, color .18s ease, border-color .18s ease, transform .06s ease;

  &:hover { background: var(--tab-bg-hover); }
  &:active { transform: translateY(1px); }

  &[data-active="true"] {
    background: var(--tab-active-bg);
    border-color: var(--tab-active-bg);
    color: var(--tab-active-fg);
  }

  /* icono más grande */
  & > svg {
    width: 20px;
    height: 20px;
    display: block;
  }

  /* accesibilidad */
  &:focus-visible {
    outline: 2px solid rgba(13,110,253,.45);
    outline-offset: 2px;
  }

  @media (max-width: 1024px) {
    width: 30px;
    height: 30px;
    & > svg { width: 18px; height: 18px; }
  }
`;


// Contenido principal
export const StyledMainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 12px;              /* separa columnas sin bloques grises */
  padding: 12px 12px 16px;/* margen interior uniforme */
  box-sizing: border-box; /* evita desbordes */
`;


// Columna izquierda
export const StyledLeftColumn = styled.aside`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  background-color: #ffffff;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  overflow-y: auto;

  /* tablets */
  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }

  /* móvil: modo rail compacto cuando se marca data-rail */
  @media (max-width: 768px) {
    width: 48px;
    padding: 8px;
    box-shadow: none;

    /* si quieres que solo se aplique en dashboards donde lo marques */
    &[data-rail] {
      width: 48px;
      padding: 8px;
    }

    & > *:not(:first-child):not(:nth-child(2)) {
      display: none !important;
    }
  }
`;


// Área central
export const StyledCenter = styled.main`
  flex: 1 1 auto;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  position: relative;
  background-color: #f7f8fa;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);

  /* Patrón opcional (sutil). Sustituye la URL cuando elijas uno */
  background-image: url('/img/patterns/paper-1.png');
  background-repeat: repeat;
  background-size: auto;
  background-blend-mode: normal;


;

  @media (max-width: 768px) {
    width: 100%;
    padding: 10px;
    min-width: 0;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 50%;
  }
`;

// Columna derecha
export const StyledRightColumn = styled.aside`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  background-color: #ffffff;
  padding: 16px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
  overflow-y: auto;

  @media (max-width: 1024px) { display: none; } /* limpia vista en tablet/móvil */

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }
`;

// Botón de acción
export const StyledActionButton = styled.button`
  background-color: #28a745;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  &:hover {
    background-color: #218838;
  }
  &[style*='backgroundColor: #dc3545'] {
    background-color: #dc3545;
    &:hover {
      background-color: #c82333;
    }
  }
`;

// Estilo para íconos
export const StyledIconWrapper = styled.span`
  margin-right: 8px;
  font-size: 18px;
`;

// Contenedor para cámara local
export const StyledLocalVideo = styled.div`
  position: absolute;
  top: 14px;
  right: 28px;
  width: 10%;
  z-index: 2;
`;

// Contenedor para cámara remota
export const StyledRemoteVideo = styled.div`
  width: 100%;
  height: 100%;
  z-index: 1;
`;

export const StyledVideoArea = styled.div`
  position: relative;
  width: 100%;
  height: calc(100% - 60px); /* deja sitio al dock sin solape */
  min-height: 360px;
`;

export const StyledChatDock = styled.div`
  /* El 5% restante para el dock de entrada */
  height: 60px;           /* fijo = coherencia visual */
  min-height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;

  // background: #ffffff;
  border-top: 1px solid #e9ecef;
  padding: 1px 1px;
  border-radius: 1px;
  box-shadow: 0 -2px 8px rgba(0,0,0,.06);
`;

// Contenedor para el chat (overlay en el video remoto)
export const StyledChatContainer = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  width: clamp(300px, 38vw, 560px);
  background:transparent;
  color: #ffffff;
  padding: 12px;
  border-radius: 8px;
  z-index: 2;
  box-shadow: 0 -2px 8px rgba(0,0,0,.06);

  @media (max-width: 1024px) {
    width: clamp(280px, 46vw, 520px);
  }
  @media (max-width: 768px) {
    left: 8px;
    right: 8px;
    width: auto;
  }
  /* Modo “ancho”: se pega a los bordes, sin sombra ni radios */
  &[data-wide="true"] {
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    padding: 8px 10px;
    border-radius: 0;
    box-shadow: none;
  }
`;

/** Lista de mensajes dentro del chat del streaming */
export const StyledChatList = styled.div`
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 10px;

  /* Oculta scrollbar (firefox + webkit) para aspecto limpio */
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
`;

/** Fila de mensajes **/
 export const StyledChatMessageRow = styled.div`
   display: flex;
   justify-content: ${p => (p.$me ? 'flex-end' : 'flex-start')};
   justify-content: flex-start;
   margin: 6px 0;
 `;

/** Burbuja del mensaje */
export const StyledChatBubble = styled.span`
  display: inline-block;
  padding: 6px 10px;
  border-radius: 10px;
  background: #ffffff;
  color: ${p => (p.$variant === 'me' ? '#0d6efd' : '#b10d3a')};
  border: 1px solid ${p => (p.$variant === 'me' ? '#b6d4fe' : '#f5b5c1')};

  font-family: var(--app-font, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji");

  max-width: 80%;
  line-height: 1.35;

  & > strong {
    margin-right: 6px;
    opacity: .9;
    font-weight: 600;
  }
`;


/** Pie de controles del chat (input + botones) */
export const StyledChatControls = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  gap: 8px;
`;

/** Input del chat */
export const StyledChatInput = styled.input`
  flex: 1;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px;
  outline: none;

  &:focus {
    border-color: #0d6efd55;
    box-shadow: 0 0 0 3px #0d6efd22;
  }
`;

/** Botón para abrir regalos (icono regalo) */
export const StyledGiftToggle = styled(StyledActionButton)`
  padding: 10px 12px;
`;

/** Panel flotante de regalos */
export const StyledGiftsPanel = styled.div`
  position: absolute;
  right: 0;
  bottom: 44px;
  background: rgba(0,0,0,0.85);
  padding: 10px;
  border-radius: 8px;
  z-index: 10;
  border: 1px solid #333;
`;

/** Grid de regalos */
export const StyledGiftGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 80px);
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;

  button {
    background: transparent;
    border: 1px solid #555;
    border-radius: 8px;
    padding: 6px;
    cursor: pointer;
    color: #fff;

    img { width: 32px; height: 32px; display: block; margin: 0 auto; }
    div { font-size: 12px; }
    div:last-child { opacity: .8; }
  }
`;

export const StyledGiftIcon = styled.img`
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin-left: 6px;
`;


/** Botón de icono (sidebar izquierda) */
export const StyledIconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: background .2s ease;
  &:hover { background: #f1f3f5; }
`;

/** Fila de acciones bajo "activar cámara" */
export const StyledTopActions = styled.div`
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

/** Título flotante encima del video remoto */
export const StyledVideoTitle = styled.h5`
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  z-index: 2;
  margin: 0;
`;

export const StyledTitleAvatar = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  vertical-align: middle;
  margin-right: 8px;
  border: 1px solid rgba(255,255,255,0.35);
`;


/** Grupo de acciones a la derecha de la navbar */
export const StyledNavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/** Avatar en la navbar */
export const StyledNavAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
  cursor: pointer;
`;

// FILA SELECCIONABLE PARA LISTADOS
export const StyledSelectableRow = styled.div`
  border-radius: 8px;
  padding: 8px;
  transition: background-color .15s ease, border-color .15s ease;
  border: 1px solid transparent;

  /* Hover genérico (cuando NO está seleccionado) */
  &:hover {
    background: #f8f9fa;
  }

  /* Estado seleccionado con data-attr estandar */
  &[data-selected="true"] {
    background: #e7f1ff;   /* azul muy suave */
    border-color: #b6d4fe;  /* borde azul suave */
  }
`;

// MARCA/LOGO
export const StyledBrand = styled.a`
  display: inline-block;
  width: 200px;
  height: 36px;
  background-image: url('/img/SharemeChat.svg'); /* <- AQUÍ el nombre del fichero */
  background-repeat: no-repeat;
  background-position: left center;
  background-size: contain;

  /* Texto oculto (accesible para screen readers) */
  text-indent: -9999px;
  overflow: hidden;
  white-space: nowrap;

  outline: none;
  border-radius: 6px;
  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(13,110,253,.35);
  }

  @media (max-width: 1024px) { width: 136px; height: 26px; }
  @media (max-width: 768px)  { width: 120px; height: 24px; }
`;