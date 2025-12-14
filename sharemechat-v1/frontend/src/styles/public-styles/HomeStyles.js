// src/styles/public-styles/HomeStyles.js
import styled, { createGlobalStyle } from 'styled-components';
import { colors } from '../core/tokens';

/* TOKENS GLOBALES BÁSICOS (copiados de VideochatStyles) */
export const GlobalBlack = createGlobalStyle`
  :root{
    --c-black: #000000;
    --c-white: #ffffff;
    --c-bg: #0e0f12;

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

    --c-hover-bg: #f8f9fa;
    --c-selected-bg: #e7f1ff;
    --c-thumb-border: rgba(0,0,0,.12);

    --navbar-height: 52px;
    --navbar-height-desktop: 64px;
    --bottom-nav-height: 80px;
  }

  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  body {
    overflow-x: hidden;
    background: var(--c-black);
  }
`;

/* CONTENEDOR CENTRAL TIPO VIDEOCHAT (copiado de StyledCenterVideochat) */
export const StyledCenterVideochat = styled.div`
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;

  @supports (height: 100dvh) {
    height: 100dvh;
  }

  @media (max-width: 768px) {
    padding: 0;
    margin: 0;
    border-radius: 0;
  }
`;

/* GRID 2 COLUMNAS 50/50 (copiado de StyledSplit2) */
export const StyledSplit2 = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  width: 100%;
  min-height: 0;
  flex: 1;
  padding: 16px;
  box-sizing: border-box;

  @media (max-width: 768px){
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
`;

/* PANE GENÉRICO (copiado de StyledPane, adaptado a home) */
export const StyledPane = styled.section`
  position: relative;
  background: ${colors.backsolid};
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: auto;
  max-height: 800px;
  justify-content: center;
  align-items: center;
  padding: 24px;
  box-shadow: 0 18px 45px rgba(0,0,0,0.55);
  box-sizing: border-box;

  @media (max-width: 768px) {
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.45);
  }
`;

/* GRID DE THUMBS (copiado de StyledThumbsGrid) */
export const StyledThumbsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(80px, 1fr));
  gap: 10px;
  width: 100%;
  max-width: 480px;
  box-sizing: border-box;

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

/* CTA PRINCIPAL (copiado de StyledPrimaryCta) */
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

/* CTA SECUNDARIO SIMPLE */
export const StyledSecondaryCta = styled.button`
  appearance: none;
  border: 1px solid rgba(255,255,255,0.45);
  background: transparent;
  color: #e5e7eb;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
  margin-left: 12px;
  transition: background .18s ease, color .18s ease, border-color .18s ease;

  &:hover {
    background: rgba(0,0,0,0.35);
    border-color: #fff;
    color: #fff;
  }
`;

/* CONTENIDO TEXTO HOME (hero) */
export const HomeHeroText = styled.div`
  max-width: 460px;
  color: #f9fafb;
  text-align: left;

  h1 {
    font-size: 2.2rem;
    line-height: 1.1;
    margin: 0 0 12px;
    font-weight: 800;
  }

  p {
    font-size: 0.98rem;
    line-height: 1.5;
    margin: 0 0 16px;
    color: #d1d5db;
  }

  @media (max-width: 768px) {
    text-align: center;

    h1 {
      font-size: 1.35rem;
      line-height: 1.1;
      margin: 0 0 10px;
    }

    p {
      font-size: 0.85rem;
      line-height: 1.35;
      margin: 0 0 12px;
    }
  }

`;

// === COOKIE BANNER (estilo Azar) ===
export const CookieBar = styled.div`
  position:fixed;
  left:0;
  right:0;
  bottom:0;
  z-index:2000;
  padding:14px 24px;
  background:#111111;
  border-top:1px solid #333333;
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  box-sizing:border-box;
  font-size:0.85rem;
`;

export const CookieText = styled.p`
  flex:1 1 320px;
  margin:0;
  line-height:1.5;
  color:#f9fafb;
  strong{font-weight:700;}
  a{color:#ffffff;text-decoration:underline;}
`;

export const CookieActions = styled.div`
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
`;

export const CookieBtnSecondary = styled.button`
  appearance:none;
  border:1px solid #ffffff;
  background:transparent;
  color:#ffffff;
  font-size:0.85rem;
  font-weight:600;
  padding:8px 16px;
  border-radius:2px;
  cursor:pointer;
  white-space:nowrap;
  transition:background .16s ease,color .16s ease,border-color .16s ease;
  &:hover{background:#ffffff10;}
`;

export const CookieBtnPrimary = styled.button`
  appearance:none;
  border:none;
  background:#ffffff;
  color:#000000;
  font-size:0.85rem;
  font-weight:700;
  padding:8px 18px;
  border-radius:2px;
  cursor:pointer;
  white-space:nowrap;
  transition:background .16s ease,transform .06s ease,box-shadow .16s ease;
  &:hover{background:#f3f3f3;box-shadow:0 4px 14px rgba(0,0,0,0.35);}
  &:active{transform:translateY(1px);}
`;

export const CookieLinkPlain = styled.button`
  appearance:none;
  border:none;
  background:transparent;
  color:#e5e7eb;
  font-size:0.83rem;
  text-decoration:underline;
  cursor:pointer;
  padding:0;
  margin-left:10px;
  white-space:nowrap;
  &:hover{color:#ffffff;}
`;
