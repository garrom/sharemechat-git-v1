// src/styles/pages-styles/VideochatStyles.js
import styled, { createGlobalStyle } from 'styled-components'
import { colors } from '../core/tokens'

/* ==================================
 * ÍNDICE
 * 0. TOKENS (CSS VARIABLES)
 * 1. LAYOUT BASE
 * 2. NAVBAR
 * 3. ESTRUCTURA DE CONTENIDO (3 COLUMNAS) ← MODIFICADO
 * 4. ACCIONES / BOTONES GENERALES
 * 5. ÁREA DE VIDEO (LOCAL/REMOTO + DOCK)
 * 6. CHAT OVERLAY EN VIDEO
 * 7. REGALOS (PANEL Y GRID)
 * 8. LISTADOS / FILAS SELECCIONABLES
 * 9. VIDEOCHAT LAYOUT (2 COLUMNAS 50/50)
 * 10. FAVORITOS: GOBERNADORES DE ALTURA ← MODIFICADO
 * 11. STATS
 * ================================== */

/* --------------------------------
 * 0) TOKENS: CSS VARIABLES GLOBALES
 * -------------------------------- */
export const GlobalBlack = createGlobalStyle`
  :root{
    /* Marca y básicos */
    --c-black: #111418;
    --c-white: #ffffff;
    --c-bg: #0e0f12;    /* negro suave global (ya no forza fondo global) */

    /* Marca */
    --c-brand: #000000;
    --c-brand-on: #ffffff;

    /* Superficies / bordes */
    --c-surface: #f7f8fa;
    --c-surface-alt: #eceff3;
    --c-surface-3: #e9edf2;
    --c-border: #e9ecef;
    --c-border-dark: #333333;

    /* Texto */
    --c-text: #212529;
    --c-text-mut: #adb5bd;
    --c-text-on-dark: #e9ecef;

    /* Estados / semáforo */
    --c-success: #20c997;
    --c-warn: #ffc107;
    --c-danger: #ff0000;

    /* Acciones / botones */
    --c-action: #28a745;
    --c-action-hover: #218838;
    --c-danger-btn: #dc3545;
    --c-danger-hover: #c82333;

    /* Burbujas chat */
    --c-me-text: #0d6efd;
    --c-me-border: #b6d4fe;
    --c-peer-text: #b10d3a;
    --c-peer-border: #f5b5c1;

    /* Overlays / glas */
    --c-glass-dark: rgba(0,0,0,0.85);
    --c-glass-mid: rgba(0,0,0,0.35);
    --c-glass-light: rgba(0,0,0,0.25);

    /* UI helpers */
    --c-hover-bg: #f8f9fa;
    --c-selected-bg: #e7f1ff;
    --c-thumb-border: rgba(0,0,0,.12);

     /* Layout */
     --navbar-height: 52px;           /* altura base / móvil */
     --navbar-height-desktop: 64px;   /* altura navbar escritorio */
     --bottom-nav-height: 80px;       /* altura estándar tab 3 botones */

  }

  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  body {
    overflow-x: hidden;
  }
`;


/* --------------------------------
 * 1. LAYOUT BASE
 * -------------------------------- */

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  /* Usar dvh para iOS: evita que el teclado “coma” el vh */
  height: 100vh;
  background: var(--c-black);
  min-width: 48px;

  @supports (height: 100dvh) {
    height: 100dvh;
  }
`;

/* --------------------------------
 * 2. NAVBAR (SIN CAMBIOS AQUÍ)
 * -------------------------------- */

export const StyledNavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;



/* --------------------------------
 * 3. ESTRUCTURA DE CONTENIDO (3 COLUMNAS) ← MODIFICADO
 * -------------------------------- */

// MODIFICADO: gap + padding + OVERFLOW SEGÚN data-tab
export const StyledMainContent = styled.div`
  display: flex;
  flex: 1;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;

  /* Regla clave:
     - videochat: sin scroll interno (como antes)
     - resto (onboarding, documentos, etc.): permite scroll vertical */
  overflow: ${props =>
    props['data-tab'] === 'videochat' ? 'hidden' : 'auto'};

  @media (max-width: 768px) {
    padding: 0;
    gap: 0;
    /* En móvil permitimos scroll en cualquier caso */
    overflow: auto;
  }
`;


// NUEVO: estilo base para columnas plateadas
const ColumnBlock = styled.div`
  background: #d1d8e0;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

/** Columna izquierda */
export const StyledLeftColumn = styled(ColumnBlock)`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  padding: 12px;
  overflow-y: auto;
  border: none;

  &[data-surface="favorites-premium"] {
    background: linear-gradient(180deg, #f9fafb 0%, #f3f5f7 100%);
    border: 1px solid #e6e7ea;
    box-shadow: 0 10px 30px rgba(17, 24, 39, 0.06);
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }

  @media (max-width: 768px) {
    width: 48px;
    padding: 8px;
    &[data-rail] { width: 48px; padding: 8px; }
    & > *:not(:first-child):not(:nth-child(2)) { display: none !important; }
  }
`;

/** Área central */
export const StyledCenter = styled(ColumnBlock)`
  flex:1 1 auto;
  min-width:0;
  min-height:0;
  padding:0;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  justify-content:flex-start;
  position:relative;
  background-color:${p=>p['data-kind']==='blog'?'transparent':(p['data-mode']==='call'?colors.backsolid:'var(--c-surface)')};
  border-radius:${p=>p['data-kind']==='blog'?'0':'16px'};
  box-shadow:${p=>p['data-kind']==='blog'?'none':'0 8px 24px rgba(0,0,0,0.15)'};
  background-repeat:repeat;
  background-size:auto;
  @media (max-width:768px){
    width:100%;
    padding:0;
    border-radius:0;
  }
  @media (min-width:769px) and (max-width:1024px){
    width:50%;
  }
`;


export const StyledCenterVideochat = styled(StyledCenter)`
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    padding: 0;
    margin: 0;
    border-radius: 0;
  }
`;


/** Columna derecha */
export const StyledRightColumn = styled(ColumnBlock)`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  padding: 12px;
  overflow-y: auto;

  &[data-surface="favorites-premium"] {
    background: linear-gradient(180deg, #f9fafb 0%, #f3f5f7 100%);
    border: 1px solid #e6e7ea;
    box-shadow: 0 10px 30px rgba(17, 24, 39, 0.06);
  }

  @media (max-width: 1024px) { display: none; }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }
`;


export const StyledFavoritesShell = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

export const StyledFavoritesColumns = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
`;

/* --------------------------------
 * 4. ACCIONES / BOTONES GENERALES (SIN CAMBIOS)
 * -------------------------------- */

export const StyledIconWrapper = styled.span`
  margin-left: 8px;
  font-size: inherit;
`;

export const StyledIconBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: background .2s ease;
  &:hover { background: var(--c-hover-bg); }
`;

export const StyledTopActions = styled.div`
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

/* --------------------------------
 * 5. ÁREA DE VIDEO (SIN CAMBIOS)
 * -------------------------------- */

export const StyledVideoArea = styled.div`
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 360px;
  height: auto;
  min-width: 0;
  height: calc(100vh - 180px);
  max-height: calc(100vh - 180px);
  max-width: 960px;
  margin: 0 auto;
  padding: 0px;

  @media (max-width: 768px) {
    min-height: 0;
    height: 100%;
    max-height: 100%;
  }

  @media (min-width: 1400px) {
    max-width: 1280px;
    height: calc(100vh - 120px);
    max-height: calc(100vh - 120px);
  }

`;

export const StyledPrecallVideoArea = styled(StyledVideoArea)`
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;

  @media (max-width: 768px) {
    height: 100%;
    max-height: 100%;
    padding: 0;
  }
`;

export const StyledPrecallLocalStage = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #000;
`;

export const StyledCallVideoArea = styled(StyledVideoArea)`
  width: 100%;
  max-width: none;
  margin: 0;

  @media (min-width: 769px) {
    height: calc(100vh - 220px);
    max-height: calc(100vh - 220px);
  }
`;

export const StyledRemoteVideo = styled.div`
  width: 100%;
  height: 100%;
  z-index: 1;
  max-height: 100%;
  border-radius: 0;
  overflow: hidden;
  @media (min-width: 769px) {
    aspect-ratio: 16 / 9;
    border-radius: 16px;
  }

`;

export const StyledLocalVideo = styled.div`
  position: absolute;
  top: 0px;
  right: 0px;
  width: 24%;
  max-width: 260px;
  border-radius: 0px;
  overflow: hidden;
  z-index: 8;

  /* sin marco ni sombra */
  box-shadow: none;
  border: none;
`;


export const StyledLocalVideoDesktop = styled.div`
  position: absolute;
  top: 0;
  z-index: 8;
  overflow: hidden;
  border-radius: 0;
  box-shadow: none;
  border: none;
  /* Cuando NO hay remoto: ocupa toda la mitad izquierda (modo "grande") */
  &[data-has-remote="false"] {
    left: 0;
    width: 50%;
    height: 100%;
  }

  /* Cuando hay remoto: PiP arriba a la derecha */
  &[data-has-remote="true"] {
    right: 0;
    width: 24%;
    max-width: 260px;
    height: auto;
  }


`;

export const StyledPaneCenter = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StyledPaneCenterStack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;


export const StyledVideoTitle = styled.h5`
  position: absolute;
  top: 10px;
  left: 10px;
  color: var(--c-white);
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

export const StyledChatDock = styled.div`
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  min-height: 56px;
  padding: 8px 10px;
  border-top: 1px solid var(--c-border);
  border-radius: 0;
  box-shadow: none;
  margin: 0;
  background: var(--c-surface);
  z-index: 100;

  &[data-surface='call-dark'] {
    background: #111418;
    border-top: none;
    box-shadow: none;
    backdrop-filter: none;
  }

  /* DESKTOP: dock transparente */
  @media (min-width: 769px) {
    background: transparent;
    border-top: none;
  }

  @media (max-width: 768px) {
    position: sticky;
    left: 0;
    right: 0;
    bottom: 0;
    box-sizing: border-box;
    gap: 6px;
    padding: 8px 10px;
    height: auto;
    min-height: 56px;

    input {
      font-size: 13px;
    }

    button {
      padding-inline: 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    button[data-gift-button='true'] {
      background: rgba(255,255,255,0.18);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.22);
      box-shadow: 0 10px 24px rgba(0,0,0,0.20);
      backdrop-filter: blur(10px);
    }

    button[data-gift-button='true']:hover:not(:disabled),
    button[data-gift-button='true']:focus-visible {
      background: rgba(255,255,255,0.26);
      color: #ffffff;
      border-color: rgba(255,255,255,0.30);
    }

    button[data-gift-button='true']:active:not(:disabled) {
      background: rgba(255,255,255,0.22);
    }

    &[data-surface='call-dark'] button[data-send-button='true'] {
      background: #000000;
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 10px 24px rgba(0,0,0,0.28);
    }

    &[data-surface='call-dark'] button[data-send-button='true']:hover:not(:disabled),
    &[data-surface='call-dark'] button[data-send-button='true']:focus-visible {
      background: #0b0d10;
      color: #ffffff;
      border-color: rgba(255,255,255,0.20);
    }

    &[data-surface='call-dark'] button[data-send-button='true']:active:not(:disabled) {
      background: #050607;
    }

    &[data-surface='call-dark'] {
      background: #111418;
      border-top: none;
      box-shadow: none;
    }
  }

  @media (min-width: 769px) {
    background: transparent;
    border-top: none;
  }
`;


/* --------------------------------
 * 6. CHAT OVERLAY EN VIDEO (SIN CAMBIOS)
 * -------------------------------- */

export const StyledChatContainer = styled.div`
  position: absolute;
  inset: 0;
  padding: 12px;
  display: flex;
  align-items: flex-end;
  pointer-events: none;

  &[data-wide='true'] {
    pointer-events: auto;
  }
`;

export const StyledChatWhatsApp = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #ece5dd;
  background-image:
    linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.10) 100%),
    radial-gradient(circle at 0 0, rgba(0,0,0,0.022) 0, rgba(0,0,0,0.022) 2px, transparent 2px),
    radial-gradient(circle at 10px 10px, rgba(0,0,0,0.02) 0, rgba(0,0,0,0.02) 2px, transparent 2px);
  background-size: auto, 20px 20px, 20px 20px;
`;


export const StyledChatList = styled.div`
  width: 50%;
  min-width: 0;
  max-height: 350px;
  overflow-y: auto;
  margin-bottom: 10px;

  /* margen interno arriba*/
  padding-top: 12px;
  box-sizing: border-box;

  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { width: 0; height: 0; }

  @media (max-width: 768px) {
    max-height: 450px;
    padding-bottom: 72px;
  }
`;

export const StyledStatusText = styled.div`
  padding: 8px 12px;
  font-size: 0.9rem;
  color: ${p => (p.$tone === 'error' ? '#ffb3b3' : '#e9ecef')};
`;

export const StyledChatMessageRow = styled.div`
  display: flex;
  justify-content: ${p => (p.$side === 'me' ? 'flex-end' : p.$side === 'peer' ? 'flex-start' : 'flex-start')};
  margin: 10px 0;
`;

export const StyledChatBubble = styled.span`
  display: inline-block;
  padding: 10px 14px;
  border-radius: 18px;
  max-width: 80%;
  line-height: 1.58;
  font-family: var(--app-font, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji");
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.01em;
  word-break: break-word;

  /* WhatsApp-like */
  background: ${p => (p.$variant === 'me' ? '#d9fdd3' : 'rgba(255,255,255,0.98)')};
  color: ${p => (p.$variant === 'me' ? '#183024' : '#111827')};
  border: 1px solid ${p => (p.$variant === 'me' ? 'rgba(168, 221, 156, 0.95)' : 'rgba(15,23,42,0.08)')};
  box-shadow: ${p => (p.$variant === 'me' ? '0 10px 24px rgba(164, 213, 153, 0.22)' : '0 8px 22px rgba(0,0,0,0.10)')};
  margin-left: ${p => (p.$column && p.$variant === 'me' ? 'clamp(24px, 4vw, 56px)' : '0')};
  margin-right: ${p => (p.$column && p.$variant === 'peer' ? 'clamp(24px, 4vw, 56px)' : '0')};

  @media (max-width: 768px) {
    max-width: 88%;
    font-size: 14.5px;
    margin-left: ${p => (p.$column && p.$variant === 'me' ? '28px' : '0')};
    margin-right: ${p => (p.$column && p.$variant === 'peer' ? '28px' : '0')};
  }
`;


export const StyledChatControls = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  gap: 8px;
`;

export const StyledChatInput = styled.input`
  flex: 1 1 0%;
  min-width: 0;
  width: 0;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid transparent;
  border-radius: 12px;
  min-height: 40px;
  padding: 0 12px;
  font-size: 14px;
  line-height: 1.4;
  outline: none;

  &:focus {
    border-color: #0d6efd55;
    box-shadow: 0 0 0 3px #0d6efd22;
  }


`;

/* --------------------------------
 * 7. REGALOS (SIN CAMBIOS)
 * -------------------------------- */

export const StyledGiftsPanel = styled.div`
  position: absolute;
  right: 0;
  bottom: 44px;
  background: var(--c-glass-dark);
  width: min(420px, calc(100vw - 24px));
  max-height: min(68vh, 560px);
  padding: 14px;
  border-radius: 16px;
  z-index: 10;
  border: 1px solid var(--c-border-dark);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(10px);
  overflow: hidden;

  @media (max-width: 768px) {
    right: 0;
    width: min(100vw - 16px, 420px);
    max-height: min(60vh, 520px);
    padding: 12px;
    border-radius: 14px;
  }
`;

export const StyledGiftCatalog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  max-height: calc(min(68vh, 560px) - 28px);
  padding-right: 4px;

  @media (max-width: 768px) {
    max-height: calc(min(60vh, 520px) - 24px);
  }
`;

export const StyledGiftSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const StyledGiftSectionTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0));
  }
`;

export const StyledGiftGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 12px;

  button {
    position: relative;
    min-height: 152px;
    background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    padding: 10px 10px 12px;
    cursor: pointer;
    color: var(--c-white);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 8px;
    text-align: left;
    transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;

    &:hover {
      transform: translateY(-1px);
      border-color: rgba(255,255,255,0.28);
      background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05));
      box-shadow: 0 10px 22px rgba(0, 0, 0, 0.22);
    }

    .gift-card__badge {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(255, 208, 90, 0.18);
      border: 1px solid rgba(255, 208, 90, 0.34);
      color: #ffd46d;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .gift-card__media {
      width: 100%;
      aspect-ratio: 1 / 1;
      min-height: 84px;
      border-radius: 12px;
      background: radial-gradient(circle at top, rgba(255,255,255,0.16), rgba(255,255,255,0.05));
      border: 1px solid rgba(255,255,255,0.08);
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: 12px;
      box-sizing: border-box;
    }

    .gift-card__media img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      margin: 0;
    }

    .gift-card__meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .gift-card__name {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.2;
      color: rgba(255,255,255,0.96);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      min-height: 31px;
    }

    .gift-card__cost {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.72);
    }
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 10px;

    button {
      min-height: 144px;
      padding: 9px 9px 11px;
    }
  }
`;

export const StyledGiftMessage = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  min-width: ${p => (p.$premium ? '88px' : '72px')};
`;

export const StyledGiftIcon = styled.img`
  width: ${p => (p.$premium ? '88px' : '48px')};
  height: ${p => (p.$premium ? '88px' : '48px')};
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 14px 20px rgba(0, 0, 0, 0.18));

  @media (max-width: 768px) {
    width: ${p => (p.$premium ? '76px' : '44px')};
    height: ${p => (p.$premium ? '76px' : '44px')};
  }
`;

export const StyledChatMessagesInner = styled.div`
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 12px clamp(14px, 2vw, 24px) 16px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 10px 14px 14px;
  }
`;

/* --------------------------------
 * 8. LISTADOS / FILAS SELECCIONABLES (SIN CAMBIOS)
 * -------------------------------- */

export const StyledSelectableRow = styled.div`
  border-radius: 8px;
  padding: 8px;
  transition: background-color .15s ease, border-color .15s ease;
  border: 1px solid transparent;

  &:hover {
    background: var(--c-hover-bg);
  }

  &[data-selected="true"] {
    background: var(--c-selected-bg);
    border-color: var(--c-me-border);
  }
`;

/* --------------------------------
 * 9. VIDEOCHAT LAYOUT
 * -------------------------------- */

export const StyledSplit2 = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: ${props =>
    props['data-mode'] === 'full-remote' ? '0fr 1fr' : '1fr 1fr'};
  gap: ${props => (props['data-mode'] === 'full-remote' ? '0px' : '14px')};
  width: 100%;
  min-height: 0;
  min-width: 0;
  flex: 1;

  @media (max-width: 768px){
    grid-template-columns: 1fr;
    gap: 0;
  }
`;


export const StyledPane = styled.section`
  position: relative;
  background: transparent;
  border: 1px ${colors.green};
  border-radius: 10px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  height:100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  @media (min-width: 769px) {
    justify-content: center;
  }
  &[data-side="left"] {
    background: ${colors.backsolid};
    border: none;

    @media (max-width: 768px) {
      display: none;
    }
  }
  &[data-side="right"] {
    background: ${colors.backsolid};
    border: none;
  }
  &[data-side="right"][data-view="thumbs"]{
    align-items:stretch;
    justify-content:stretch;
    overflow:hidden;
  }
  &[data-side="right"][data-view="precall-stats"]{
    @media (min-width: 769px) {
      align-items:center;
      justify-content:center;
    }
  }

  /* En móvil */
  @media (max-width: 768px) {
    background: transparent;
    border-radius: 0 !important;
  }
`;

export const StyledRandomSearchControls = styled.div`
  position: absolute;
  top: 70%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  z-index: 5;

  @media (min-width: 769px) {
    top: 50%;
  }
`;

export const StyledRandomSearchCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

export const StyledSearchHint = styled.div`
  font-size: 0.85rem;
  color: #e9ecef;
`;


export const StyledThumbsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(80px, 1fr));
  gap: 10px;
  padding: 12px;
  width: 100%;
  box-sizing: border-box;
  /* ESCRITORIO: 3x3 siempre visible dentro del viewport */
  @media (min-width: 769px) {
    max-width: 960px;
    margin: 0 auto;
    /* Altura fija relativa a la ventana: ajustalo */
    //height: calc(100vh - 180px);
    grid-auto-rows: 1fr;
  }
  img,
  .thumb {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 10px;
    overflow: hidden;
    border: 2px solid var(--c-thumb-border);
    background: var(--c-black);
  }
  @media (max-width: 768px) {
    grid-template-columns: repeat(3, minmax(72px, 1fr));
    gap: 8px;
  }
`;

// === TEASER RANDOM card tipo TikTok  ===
export const StyledTeaserCenter=styled.div`
  position:relative;
  width:100%;
  height:100%;
  display:flex;
  align-items:stretch;
  justify-content:stretch;
  pointer-events:none;
`;

export const StyledTeaserInner=styled.div`
  width:100%;
  height:100%;
  max-width:none;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  justify-content:stretch;
  gap:0;
  pointer-events:auto;
`;

export const StyledTeaserCard=styled.div`
  position:relative;
  width:100%;
  height:100%;
  max-width:none;
  max-height:none;
  aspect-ratio:auto;
  border-radius:0;
  overflow:hidden;
  background:#000;
`;

export const StyledTeaserMediaButton = styled.button`
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  cursor: pointer;
  width: 100%;
  height: 100%;
  display: block;
`;

export const StyledTeaserNavSlot = styled.div`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  ${p => (p.$side === 'left' ? 'left: 10px;' : 'right: 10px;')}
`;

export const StyledTeaserFavoriteSlot = styled.div`
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 4;
`;

export const StyledCallStage = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

export const StyledCallTopBar = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 9;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
`;

export const StyledCallTopMeta = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--c-white);
  pointer-events: auto;
`;

export const StyledCallTopMetaText = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 1.15;
`;

export const StyledCallTopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
`;

export const StyledCallLocalVideo = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: 24%;
  max-width: 260px;
  overflow: hidden;
  z-index: 8;
  border-radius: 0;
  box-shadow: none;

  @media (min-width: 769px) {
    border-radius: 16px;
  }
`;

export const StyledCallBottomBar = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 9;
  pointer-events: none;

  @media (max-width: 768px) {
    left: 12px;
    right: 12px;
    bottom: 72px;
  }
`;

export const StyledCallBottomInner = styled.div`
  position: relative;
  min-height: 44px;
`;

export const StyledCallPrimaryActions = styled.div`
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: auto;

  @media (max-width: 768px) {
    gap: 12px;
  }
`;

export const StyledCallSecondaryActions = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  pointer-events: auto;
`;

export const StyledPrimaryCta = styled.button`
  appearance: none;
  border: 1px solid var(--c-black);
  background: var(--c-white);
  color: var(--c-black);
  font-weight: 700;
  font-size: 16px;
  padding: 14px 22px;
  border-radius: 12px;
  cursor: pointer;
  transition: background .18s ease, color .18s ease, box-shadow .18s ease, transform .06s ease;

  &:hover {
    background: var(--c-black);
    color: var(--c-white);
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }
  &:active {
    transform: translateY(1px);
  }
`;

/* --------------------------------
 * 10. FAVORITOS: GOBERNADORES DE ALTURA (SIN CAMBIOS)
 * -------------------------------- */

export const StyledCenterPanel = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0px;
  width: 100%;
`;

export const StyledCenterBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 0px;
  overflow: hidden;

  @media (max-width: 768px) {
    &[data-call="true"] {
      flex: 0 0 auto;
      min-height: auto;
      gap: 0;
      overflow: auto;
    }
  }
`;

export const StyledChatScroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: none;
  border-radius: 0px;
  padding: 0px;

  @media (max-width: 768px) {
    padding-top: 4px;
    scroll-padding-top: 12px;
    padding-bottom: 80px;
    scroll-padding-bottom: 80px;
  }


  /* fondo solo cuando se indique explícitamente */
  &[data-bg='whatsapp'] {
    border: none; /* sin borde en modo WhatsApp */
    background:
      linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 100%),
      url("data:image/svg+xml,%3Csvg%20width%3D%2296%22%20height%3D%2296%22%20viewBox%3D%220%200%2096%2096%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%0A%20%20%3Cg%20fill%3D%22none%22%20stroke%3D%22%23b2a79a%22%20stroke-width%3D%221.1%22%20stroke-opacity%3D%220.42%22%20stroke-linecap%3D%22round%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M14%2016h22a7%207%200%200%201%207%207v5a7%207%200%200%201-7%207h-7l-6%205v-5h-9a7%207%200%200%201-7-7v-5a7%207%200%200%201%207-7z%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M72%2018c-1.7-2.5-5.1-2.5-6.8%200-1.7-2.5-5.1-2.5-6.8%200-1.8%202.6-0.8%206%202.5%208.6l4.3%203.3%204.3-3.3c3.3-2.6%204.3-6%202.5-8.6z%22/%3E%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2256%22%20rx%3D%224%22%20ry%3D%224%22%20width%3D%2220%22%20height%3D%2226%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M15%2059h14M15%2064h9M15%2069h10%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M76%2060l2.5%205.1%205.2%200.8-3.7%203.7%200.9%205.1-4.9-2.6-4.9%202.6%200.9-5.1-3.7-3.7%205.2-0.8z%22/%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2248%22%20cy%3D%2210%22%20r%3D%222.4%22/%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2284%22%20cy%3D%2240%22%20r%3D%222.1%22/%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2242%22%20r%3D%222.1%22/%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2248%22%20cy%3D%2284%22%20r%3D%222.4%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M34%2040c3-2.2%206-2.2%209%200%203%202.2%206%202.2%209%200%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M56%2050c3-2.2%206-2.2%209%200%203%202.2%206%202.2%209%200%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M30%2030h0.1M35%2033h0.1M40%2030h0.1%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M64%2080h0.1M69%2083h0.1M74%2080h0.1%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M4%204l8%208M84%208l8-8%22/%3E%0A%20%20%20%20%3Cpath%20d%3D%22M8%2084l8%208M80%2088l8-8%22/%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E%0A");
    background-repeat: repeat;
    background-color: #e5ddd5;
    background-size: auto, 120px;
  }

  &[data-kind='favorites-chat'] {
    padding-top: 8px;

    @media (max-width: 768px) {
      padding-top: 4px;
    }
  }

  scrollbar-width: thin;
  &::-webkit-scrollbar { width: 8px; }

  overscroll-behavior: contain;
`;


// === Centro PRE-CALL: “Activar cámara” centrado ===
export const StyledPreCallCenter = styled.div`
  display: flex;
  /* No ocupes todo para evitar pantallas larguísimas en móvil */
  flex: 0 0 auto;
  min-height: 24vh;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
  @media (min-width: 769px) { display: none; }
`;

export const StyledHelperLine = styled.div`
  margin-top: 12px;
  color: #111; /* antes: #e9ecef */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: .95;
`;


export const StyledBottomActionsMobile = styled.div`
  position: static;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 16vh;
  gap: 10px;
  padding: 6px;
  z-index: 6;

  @media (min-width: 769px) { display: none; }
`;

export const StyledMobile3ColBar = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    position: fixed;
    top: var(--navbar-height);
    left: 0;
    right: 0;
    z-index: 100;
    margin: 0;
    padding: 12px 10px;
    min-height: 62px;
    background: var(--c-surface);
  }

  @media (min-width: 769px) {
    padding: 8px 12px;
    margin: 8px 12px;
  }
`;

export const StyledTopCenter = styled.div`
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StyledConnectedText = styled.div`
  justify-self: end;
  font-size: 14px;
  color: var(--c-text); /* negro sobre fondo claro */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 42vw; /* evita desbordes en móviles */
`;

export const StyledFloatingHangup = styled.div`
  position: absolute;
  /* centrado horizontal sobre el vídeo, por encima del dock de chat */
  left: 50%;
  transform: translateX(-50%);
  bottom: 72px;

  z-index: 8; /* por encima del video y del overlay de chat */
  display: flex;
  align-items: center;
  justify-content: center;

  @media (min-width: 769px) {
    display: none; /* solo móvil */
  }
`;


// CARD de llamada en escritorio: header + cuerpo 16:9 + footer chat
export const StyledCallCardDesktop = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  min-width: 0;

  border-radius: 16px;
  border: none;
  background: transparent;
  padding: 10px 12px 8px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;

  /* DESKTOP:*/
  @media (min-width: 769px) {
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(16,19,25,0.96) 0%, rgba(10,12,17,0.98) 100%);
    padding: 0;
    box-shadow:
      0 18px 44px rgba(0,0,0,0.34),
      0 1px 0 rgba(255,255,255,0.04) inset;
    backdrop-filter: blur(14px) saturate(130%);
  }

  @media (max-width: 768px) {
    background: transparent;
    box-shadow: none;
    padding: 0;
    border-radius: 0;
    border: none;
  }
`;


export const StyledCallFooterDesktop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  min-width: 0;

  @media (min-width: 769px) {
    position: relative;
    z-index: 3;
    width: 100%;
    padding-top: 0;
    box-sizing: border-box;
  }
`;

export const StyledChatDockActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

export const StyledCallComposer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;

  @media (min-width: 769px) {
    min-height: 64px;
    padding: 12px 14px 14px;
    background:
      linear-gradient(180deg, rgba(20,24,31,0.64) 0%, rgba(11,14,20,0.88) 100%);
    border-top: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 -1px 0 rgba(255,255,255,0.03) inset;
    backdrop-filter: blur(16px) saturate(145%);

    & > button {
      background: rgba(255,255,255,0.10);
      color: #fff;
      border-color: rgba(255,255,255,0.14);
      box-shadow: none;
    }

    & > button:hover:not(:disabled) {
      background: rgba(255,255,255,0.18);
      color: #fff;
    }
  }
`;

export const StyledChatDockMessageComposer = styled(StyledChatDock)`
  position: relative;
  min-width: 0;
  min-height: 64px;
  height: auto;
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: #111418;
  backdrop-filter: none;
  box-sizing: border-box;
  box-shadow: none;

  @media (min-width: 769px) {
    justify-content: center;
  }

  &[data-kind='favorites-chat'] {
    & > input {
      background: rgba(255,255,255,0.10);
      color: #f8fafc;
      border-color: transparent;
      box-shadow: none;
      min-height: 40px;
    }

    & > input::placeholder {
      color: rgba(226,232,240,0.72);
    }

    & > input:focus {
      border-color: transparent;
      box-shadow: none;
    }

    & > button,
    & > div > button {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      box-shadow: none;
    }
  }
`;

export const StyledIncomingCallOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

export const StyledIncomingCallCard = styled.div`
  width: 100%;
  max-width: 420px;
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.45);
`;

export const StyledIncomingCallTitle = styled.div`
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
`;

export const StyledIncomingCallText = styled.div`
  color: #e5e7eb;
  margin-bottom: 18px;
`;

export const StyledIncomingCallActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`;


/* --------------------------------
 * 11. STATS (NUEVO)
 * -------------------------------- */

export const StyledStatsWrap = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  color: var(--c-white);
  background: transparent;

  @media (max-width: 768px) {
    padding: 12px;
  }
`;


export const StyledStatsTopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

export const StyledStatsTitle = styled.div`
  font-size: 18px;
  font-weight: 900;
  letter-spacing: .2px;
  color: var(--c-white);
`;

export const StyledStatsActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const StyledStatsSelect = styled.select`
  height: 36px;
  border-radius: 10px;
  padding: 0 10px;
  border: 1px solid rgba(255,255,255,.18);
  background: var(--c-glass-mid);
  color: var(--c-white);
  outline: none;

  &:focus {
    box-shadow: 0 0 0 3px rgba(13,110,253,.18);
    border-color: rgba(13,110,253,.55);
  }
`;

export const StyledStatsBtn = styled.button`
  appearance: none;
  height: 36px;
  border-radius: 10px;
  padding: 0 12px;
  border: 1px solid rgba(255,255,255,.18);
  background: var(--c-glass-mid);
  color: var(--c-white);
  cursor: pointer;
  font-weight: 700;

  &:hover {
    background: rgba(0,0,0,.45);
  }
`;

export const StyledStatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`;

export const StyledStatsCard = styled.div`
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 16px;
  padding: 14px;
  box-sizing: border-box;
`;

export const StyledStatsCardLabel = styled.div`
  font-size: 12px;
  opacity: 0.9;
  color: rgba(255,255,255,0.78);
`;

export const StyledStatsCardValue = styled.div`
  margin-top: 2px;
  font-size: 18px;
  font-weight: 900;
  color: var(--c-white);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const StyledStatsInline = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 13px;
  opacity: 1;
  color: rgba(255,255,255,0.85);
  b { color: var(--c-white); }
`;


export const StyledStatsTable = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr 1fr;
  gap: 8px;
  font-size: 13px;
  color: var(--c-text-on-dark);

  @media (max-width: 768px) {
    grid-template-columns: 110px 1fr 1fr;
  }
`;

export const StyledStatsTableHead = styled.div`
  opacity: .7;
`;

export const StyledStatsPrecallCard = styled.div`
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 0;
  padding: 16px;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (max-width: 768px) {
    padding: 12px;
    gap: 10px;
  }
`;


export const StyledStatsPrecallGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  min-width: 0;
  box-sizing: border-box;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
`;

// === ESTADISTICA TIERS ===
export const StyledTierProgressCard = styled.div`
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 16px;
  padding: 14px;
  box-sizing: border-box;
`;

export const StyledTierProgressRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const StyledTierKpiCol = styled.div`
  min-width: 0;
`;

export const StyledTierKpiTitle = styled.div`
  font-weight: 900;
  color: var(--c-white);
  margin-bottom: 6px;
`;

export const StyledTierKpiLine = styled.div`
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  line-height: 1.45;

  b { color: var(--c-white); }
`;

export const StyledTierBarWrap = styled.div`
  margin-top: 12px;
`;

export const StyledTierBarTrack = styled.div`
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.14);
  overflow: hidden;
`;

export const StyledTierBarFill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(236,72,153,0.85) 0%, rgba(59,130,246,0.85) 55%, rgba(34,197,94,0.80) 100%);
`;

export const StyledTierBarLegend = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 900;
  color: rgba(255,255,255,0.80);
`;
