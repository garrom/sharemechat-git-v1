import styled, { createGlobalStyle } from 'styled-components';

/* ==================================
 * 0. TOKENS (CSS VARIABLES)
 * ================================== */
export const GlobalBlack = createGlobalStyle`
  :root{
    --c-black: #000000;
    --c-white: #ffffff;
    --c-brand: #000000;
    --c-brand-on: #ffffff;
    --c-surface: #f7f8fa;
    --c-surface-alt: #eceff3;
    --c-surface-3: #e9edf2;
    --c-border: #e9ecef;
    --c-border-dark: #333333;
    --c-text: #212529;
    --c-text-mut: #adb5bd;
    --c-text-on-dark: #e9ecef;
    --c-success: #20c997;
    --c-warn: #ffc107;
    --c-danger: #ff0000;
    --c-action: #28a745;
    --c-action-hover: #218838;
    --c-danger-btn: #dc3545;
    --c-danger-hover: #c82333;
    --c-me-text: #0d6efd;
    --c-me-border: #b6d4fe;
    --c-peer-text: #b10d3a;
    --c-peer-border: #f5b5c1;
    --c-glass-dark: rgba(0,0,0,0.85);
    --c-glass-mid: rgba(0,0,0,0.35);
    --c-glass-light: rgba(0,0,0,0.25);
    --c-hover-bg: #f1f3f5;
    --c-selected-bg: #e7f1ff;
    --c-thumb-border: rgba(0,0,0,.12);
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
    background: var(--c-black);
  }
  body { overflow-x: hidden; }
`;

/* ==================================
 * 1. LAYOUT BASE
 * ================================== */
export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--c-black);
  min-width: 48px;
`;

// MODIFICADO: gap + padding
export const StyledMainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;

  /* hueco para el BottomNav en móvil */
  @media (max-width: 768px) {
    padding-bottom: 72px;
  }
`;

/* ==================================
 * 2. NAVBAR (SIN CAMBIOS)
 * ================================== */

export const StyledNavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const StyledNavAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
  cursor: pointer;
`;

export const StyledNavTab = styled.button`
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: none;
  background: var(--c-black);
  color: var(--c-white);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background-color .18s ease, color .18s ease, border-color .18s ease, transform .06s ease;

  &:hover {
    background: #111;
    color: var(--c-white);
  }
  &:active { transform: translateY(1px); }

  &[data-active="true"] {
    background: var(--c-white);
    color: var(--c-black);
  }

  /* Ocultar SOLO los tabs superiores en móvil */
  @media (max-width: 768px) {
    display: none !important;
  }
`;


/* ==================================
 * 3. BLOQUE COMÚN: PLATEADO + SOMBRA
 * ================================== */
// NUEVO: estilo base para las 3 columnas
const ColumnBlock = styled.div`
  background: #d1d8e0;                     // ← PLATEADO CLARO
  border-radius: 16px;                      // ← Bordes redondeados
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); // ← Sombra flotante
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

/* ==================================
 * 3. COLUMNAS (MODIFICADAS)
 * ================================== */

// IZQUIERDA: lista de favoritos
export const StyledLeftColumn = styled(ColumnBlock)`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  padding: 12px;
  overflow-y: auto;
  border: none; // eliminamos borde viejo

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }

  @media (max-width: 768px) {
    width: 56px;
    padding: 8px;
    &[data-rail] { width: 56px; padding: 8px; }
    & > *:not(:first-child):not(:nth-child(2)) { display: none !important; }
  }
`;

// CENTRO: chat, videollamada, etc.
export const StyledCenter = styled(ColumnBlock)`
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  position: relative;

  background-color: var(--c-surface);
  background-image: url('/img/patterns/paper-1.png');
  background-repeat: repeat;
  background-size: auto;

  @media (max-width: 768px) {
    width: 100%;
    padding: 10px;
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 50%;
  }
`;

// DERECHA: vacía (pero visible en desktop)
export const StyledRightColumn = styled(ColumnBlock)`
  flex: 0 0 22%;
  max-width: 320px;
  min-width: 220px;
  padding: 12px;
  overflow-y: auto;

  @media (max-width: 1024px) { display: none; }

  @media (min-width: 769px) and (max-width: 1024px) {
    width: 25%;
  }
`;

// VIDEOCHAT: sin bordes ni fondo (fondo negro global)
export const StyledCenterVideochat = styled(StyledCenter)`
  background-color: var(--c-bg);
  border: none;
  border-radius: 0;
  box-shadow: none;
`;

/* ==================================
 * FAVORITOS: WRAPPERS
 * ================================== */
export const StyledFavoritesShell = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  // padding eliminado → ya lo da StyledCenter
`;

export const StyledFavoritesColumns = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
`;

/* ==================================
 * 4. BOTONES Y ACCIONES (SIN CAMBIOS)
 * ================================== */
export const StyledActionButton = styled.button`
  background-color: var(--c-action);
  color: var(--c-white);
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover { background-color: var(--c-action-hover); }

  &[style*='backgroundColor: #dc3545'],
  &[style*='background-color: #dc3545'] {
    background-color: var(--c-danger-btn);
    &:hover { background-color: var(--c-danger-hover); }
  }

  &:disabled {
    opacity: .55;
    cursor: not-allowed;
    pointer-events: none;
    filter: grayscale(15%);
  }
`;

export const StyledIconWrapper = styled.span`
  margin-right: 8px;
  font-size: 18px;
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

/* ==================================
 * 5. VIDEO + DOCK (SIN CAMBIOS)
 * ================================== */
export const StyledLocalVideo = styled.div`
  position: absolute;
  top: 14px;
  right: 28px;
  width: 20%;
  z-index: 2;
`;

export const StyledRemoteVideo = styled.div`
  width: 100%;
  height: 100%;
  z-index: 1;
`;

export const StyledVideoArea = styled.div`
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 360px;
  height: auto;
  min-width: 0;
`;


export const StyledChatDock = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  min-height: 56px;
  padding: 0;
  border-top: 1px solid var(--c-border);
  border-radius: 0;
  box-shadow: none;
  margin: 0;
`;

/* ==================================
 * 6. CHAT OVERLAY (SIN CAMBIOS)
 * ================================== */
export const StyledChatContainer = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  width: clamp(300px, 38vw, 560px);
  background: transparent;
  color: var(--c-white);
  padding: 12px;
  border-radius: 8px;
  z-index: 2;

  @media (max-width: 1024px) { width: clamp(280px, 46vw, 520px); }
  @media (max-width: 768px) { left: 8px; right: 8px; width: auto; }

  &[data-wide="true"] {
    left: 0; right: 0; bottom: 0; width: auto;
    padding: 8px 10px; border-radius: 0; box-shadow: none;
  }
`;

export const StyledChatList = styled.div`
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { width: 0; height: 0; }
`;

export const StyledChatMessageRow = styled.div`
  display: flex;
  justify-content: flex-start;
  margin: 6px 0;
`;

export const StyledChatBubble = styled.span`
  display: inline-block;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--c-white);
  color: ${p => (p.$variant === 'me' ? 'var(--c-me-text)' : 'var(--c-peer-text)')};
  border: 1px solid ${p => (p.$variant === 'me' ? 'var(--c-me-border)' : 'var(--c-peer-border)')};
  font-family: var(--app-font, system-ui);
  max-width: 80%;
  line-height: 1.35;

  & > strong { margin-right: 6px; opacity: .9; font-weight: 600; }
`;

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

/* ==================================
 * 7-11. RESTO (SIN CAMBIOS)
 * ================================== */
// ... (GiftToggle, GiftsPanel, SelectableRow, Split2, Pane, ThumbsGrid, PrimaryCta, Brand, CenterPanel, CenterBody, ChatScroller)

export const StyledGiftToggle = styled(StyledActionButton)` padding: 10px 12px; `;

export const StyledGiftsPanel = styled.div`
  position: absolute;
  right: 0; bottom: 44px;
  background: var(--c-glass-dark);
  padding: 10px; border-radius: 8px; z-index: 10;
  border: 1px solid var(--c-border-dark);
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
    color: var(--c-white);
    img { width: 32px; height: 32px; display: block; margin: 0 auto; }
    div { font-size: 12px; }
    div:last-child { opacity: .8; }
  }
`;

export const StyledGiftIcon = styled.img`
  width: 24px; height: 24px; vertical-align: middle; margin-left: 6px;
`;

export const StyledSelectableRow = styled.div`
  border-radius: 8px; padding: 8px;
  transition: background-color .15s ease, border-color .15s ease;
  border: 1px solid transparent;

  &:hover { background: var(--c-hover-bg); }

  &[data-selected="true"] {
    background: var(--c-selected-bg);
    border-color: var(--c-me-border);
  }
`;

export const StyledSplit2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  width: 100%;
  min-height: 0;
  flex: 1;

  @media (max-width: 768px){ grid-template-columns: 1fr; }
`;

export const StyledPane = styled.section`
  position: relative;
  background: linear-gradient(180deg, var(--c-surface-3) 0%, #dee4eb 100%);
  border: 1px solid #bcc6d1;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &[data-side="left"] {
    @media (max-width: 768px) { display: none; }
  }
`;

export const StyledThumbsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(80px,1fr));
  gap: 10px;
  padding: 12px;
  width: 100%;
  box-sizing: border-box;

  img, .thumb{
    display:block; width:100%; aspect-ratio:3/4;
    object-fit:cover; border-radius:10px;
    overflow:hidden; border:2px solid var(--c-thumb-border);
    background: var(--c-black);
  }

  @media (max-width: 768px){
    grid-template-columns: repeat(3, minmax(72px,1fr));
    gap: 8px;
  }
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
  &:active { transform: translateY(1px); }
`;


export const StyledCenterPanel = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px;
  width: 100%;
`;

export const StyledCenterBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
`;

export const StyledChatScroller = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--c-border-dark);
  border-radius: 8px;
  padding: 10px;
  background: rgba(0,0,0,0.2);
  scrollbar-width: thin;
  &::-webkit-scrollbar { width: 8px; }
`;