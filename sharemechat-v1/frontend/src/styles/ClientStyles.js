//ClientStyles.js
import styled, { createGlobalStyle } from 'styled-components';

/* ==================================
 * ÍNDICE
 * 1. LAYOUT BASE
 * 2. NAVBAR
 * 3. ESTRUCTURA DE CONTENIDO (3 COLUMNAS)
 * 4. ACCIONES / BOTONES GENERALES
 * 5. ÁREA DE VIDEO (LOCAL/REMOTO + DOCK)
 * 6. CHAT OVERLAY EN VIDEO
 * 7. REGALOS (PANEL Y GRID)
 * 8. LISTADOS / FILAS SELECCIONABLES
 * 9. VIDEOCHAT LAYOUT (2 COLUMNAS 50/50)
 * ================================== */

/* --------------------------------
 * LAYOUT BASE
 * -------------------------------- */

// Contenedor principal
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #000;     /* fondo negro sólido */
  min-width: 48px;
`;


/* --------------------------------
 * NAVBAR
 * -------------------------------- */

export const StyledNavbar = styled.nav`
  color: white;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  /* Transparente para fusionarse con el fondo del container */
  background: transparent;
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

/** Marca/Logo */
export const StyledBrand = styled.a`
  display: inline-block;
  width: 200px;
  height: 36px;
  background-image: url('/img/SharemeChat.svg');
  background-repeat: no-repeat;
  background-position: left center;
  background-size: contain;

  /* Texto oculto (accesible) */
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

/** Botón de la Navbar */
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

/** Botón-text para tabs en el navbar (hover invertido) */
export const StyledNavTab = styled.button`
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  height: 34px;
  padding: 0 14px;
  border-radius: 999px;

  border: none;
  background: #000;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;

  transition: background-color .18s ease, color .18s ease, border-color .18s ease, transform .06s ease;

  &:hover {
    background: #111;
    color: #fff;

  }
  &:active { transform: translateY(1px); }

  /* Estado activo (por accesibilidad/estilo) */
  &[data-active="true"] {
    background: #fff;
    color: #000;
  }
`;


/* --------------------------------
 * ESTRUCTURA DE CONTENIDO (3 COLUMNAS)
 * -------------------------------- */

export const StyledMainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
  padding: 0;
  box-sizing: border-box;
`;

/** Columna izquierda */
export const StyledLeftColumn = styled.aside`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  background: linear-gradient(180deg, #f7f8fa 0%, #eceff3 100%);
  color: #e9ecef;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  box-shadow: none;
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

    &[data-rail] {
      width: 48px;
      padding: 8px;
    }

    & > *:not(:first-child):not(:nth-child(2)) {
      display: none !important;
    }
  }
`;

/** Área central */
export const StyledCenter = styled.main`
  flex: 1 1 auto;
  min-width: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  position: relative;

  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;

  @media (max-width: 768px) {
    padding: 10px;
  }
`;


/** Columna derecha */
export const StyledRightColumn = styled.aside`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  background: linear-gradient(180deg, #f7f8fa 0%, #eceff3 100%);
  color: #e9ecef;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  box-shadow: none;
  overflow-y: auto;

  @media (max-width: 1024px) { display: none; } /* limpia vista en tablet/móvil */

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }
`;

/* --------------------------------
 * ACCIONES / BOTONES GENERALES
 * -------------------------------- */

export const StyledActionButton = styled.button`
  background-color: #28a745;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover { background-color: #218838; }

  /* Danger inline */
  &[style*='backgroundColor: #dc3545'] {
    background-color: #dc3545;
    &:hover { background-color: #c82333; }
  }

  /* Estado deshabilitado universal */
  &:disabled {
    opacity: .55;
    cursor: not-allowed;
    pointer-events: none;
    filter: grayscale(15%);
  }
`;

/** Estilo para íconos sueltos */
export const StyledIconWrapper = styled.span`
  margin-right: 8px;
  font-size: 18px;
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

/* --------------------------------
 * ÁREA DE VIDEO (LOCAL/REMOTO + DOCK)
 * -------------------------------- */

export const StyledVideoArea = styled.div`
  position: relative;
  width: 100%;
  height: calc(100% - 60px); /* deja sitio al dock sin solape */
  min-height: 360px;
`;

/** Contenedor para cámara remota */
export const StyledRemoteVideo = styled.div`
  width: 100%;
  height: 100%;
  z-index: 1;
`;

/** Contenedor para cámara local (PIP) */
export const StyledLocalVideo = styled.div`
  position: absolute;
  top: 14px;
  right: 28px;
  width: 20%;
  z-index: 2;
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

/** Dock inferior del área de video (input/chat) */
export const StyledChatDock = styled.div`
  height: 60px;
  min-height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #e9ecef;
  padding: 0 8px;
  border-radius: 0;
  box-shadow: none;
  margin: 0;
`;

/* --------------------------------
 * CHAT OVERLAY EN VIDEO
 * -------------------------------- */

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
  &::-webkit-scrollbar { width: 0; height: 0; }
`;

/** Fila de mensajes */
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

/* --------------------------------
 * REGALOS (PANEL Y GRID)
 * -------------------------------- */

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

/* --------------------------------
 * LISTADOS / FILAS SELECCIONABLES
 * -------------------------------- */

export const StyledSelectableRow = styled.div`
  border-radius: 8px;
  padding: 8px;
  transition: background-color .15s ease, border-color .15s ease;
  border: 1px solid transparent;

  /* Hover genérico (cuando NO está seleccionado) */
  &:hover {
    background: #f8f9fa;
  }

  /* Estado seleccionado con data-attr estándar */
  &[data-selected="true"] {
    background: #e7f1ff;   /* azul muy suave */
    border-color: #b6d4fe;  /* borde azul suave */
  }
`;

/* --------------------------------
 * VIDEOCHAT LAYOUT (2 COLUMNAS 50/50)
 * -------------------------------- */

export const StyledSplit2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;   /* 50/50 estable */
  gap: 14px;
  width: 100%;
  min-height: 0;                     /* evita overflow en contenedor flex */

  @media (max-width: 768px) {
    grid-template-columns: 1fr;      /* móvil: 1 sola columna (solo pane derecho) */
  }
`;

/** Panel contenedor simétrico (lado izq/der) */
export const StyledPane = styled.section`
  position: relative;
  background: linear-gradient(180deg, #e9edf2 0%, #dee4eb 100%);
  border: 1px solid #bcc6d1;
  border-radius: 10px;
  overflow: hidden;

  /* Mobile: oculta el pane izquierdo para que solo se vea el remoto */
  &[data-side="left"] {
    @media (max-width: 768px) {
      display: none;
    }
  }
`;

/** Grid de miniaturas (estado pre-cámara en el pane derecho) */
export const StyledThumbsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(80px, 1fr));
  gap: 10px;
  padding: 12px;
  width: 100%;
  box-sizing: border-box;

  img,
  .thumb {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 10px;
    overflow: hidden;
    border: 2px solid rgba(0,0,0,.12);
    background: #000;
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(3, minmax(72px, 1fr));
    gap: 8px;
  }
`;

/** Botón CTA estilo “blanco -> negro” (activar cámara) */
export const StyledPrimaryCta = styled.button`
  appearance: none;
  border: 1px solid #000;
  background: #fff;
  color: #000;
  font-weight: 700;
  font-size: 16px;
  padding: 14px 22px;
  border-radius: 12px;
  cursor: pointer;
  transition: background .18s ease, color .18s ease, box-shadow .18s ease, transform .06s ease;

  &:hover {
    background: #000;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }
  &:active {
    transform: translateY(1px);
  }
`;

//Este export siempre al final del fichero
export const GlobalBlack = createGlobalStyle`
  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #000;
  }
  body {
    overflow-x: hidden;
  }
`;