//ModelStyles.js
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
  background-color: #75345B;
  color: white;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  border-radius: 2px;            /* <- radio 2px */
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
`;

// Columna izquierda
export const StyledLeftColumn = styled.aside`
  width: 20%;
  background-color: #ffffff;
  padding: 20px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }

  @media (max-width: 768px) {
    width: 56px;
    padding: 8px;
    box-shadow: none;

    &[data-rail] {
      width: 56px;
      padding: 8px;
    }

    & > *:not(:first-child):not(:nth-child(2)) {
      display: none !important;
    }
  }
`;


// Área central
export const StyledCenter = styled.main`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60%;
  min-width: 640px;
  min-height: 480px;
  max-width: 90%;
  position: relative;
  background-color: #D3D3D3;

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
  width: 20%;
  background-color: #ffffff;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  overflow-y: auto;

  @media (max-width: 768px) {
    display: none;
  }

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
  height: 95%;
  min-height: 360px;
`;

export const StyledChatDock = styled.div`
  height: 5%;
  min-height: 56px;
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

// Contenedor para el chat
export const StyledChatContainer = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  width: clamp(300px, 38vw, 560px);
  background: transparent;
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
`;

export const StyledChatList = styled.div`
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 10px;
`;

export const StyledChatMessageRow = styled.div`
  display: flex;
  justify-content: ${p => (p.$me ? 'flex-end' : 'flex-start')};
  margin: 6px 0;
`;

/** Burbuja del mensaje */
export const StyledChatBubble = styled.span`
  display: inline-block;
  padding: 6px 10px;
  border-radius: 10px;
  background: ${p => (p.$me ? '#0D6EFD40' : '#343A4040')};
  color: #fff;
  max-width: 80%;
  line-height: 1.35;
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

export const StyledGiftToggle = styled(StyledActionButton)`
  padding: 10px 12px;
`;

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

// === FILA SELECCIONABLE PARA LISTADOS (favoritos/contactos) ===
export const StyledSelectableRow = styled.div`
  border-radius: 8px;
  padding: 8px;
  transition: background-color .15s ease, border-color .15s ease;
  border: 1px solid transparent;

  &:hover {
    background: #f1f3f5;
  }

  &[data-selected="true"] {
    background: #e7f1ff;
    border-color: #b6d4fe;
  }
`;
