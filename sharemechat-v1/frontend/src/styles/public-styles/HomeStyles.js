// src/styles/public-styles/HomeStyles.js
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import { colors } from '../core/tokens';

/* TOKENS GLOBALES BÁSICOS (copiados de VideochatStyles) */
export const GlobalBlack = createGlobalStyle`
  :root{
    --c-black: #111418;
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

const slowZoom = keyframes`
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.05);
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

export const HomePageStack = styled.main`
  width: 100%;
`;

export const HomeHeroSection = styled.section`
  position: relative;
  min-height: calc(100vh - var(--navbar-height-desktop));
  display: flex;
  flex-direction: column;

  @supports (min-height: 100dvh) {
    min-height: calc(100dvh - var(--navbar-height-desktop));
  }

  @media (max-width: 1360px) {
    min-height: calc(100vh - var(--navbar-height) - var(--bottom-nav-height));

    @supports (min-height: 100dvh) {
      min-height: calc(100dvh - var(--navbar-height) - var(--bottom-nav-height));
    }
  }
`;

export const HeroContainer = styled.div`
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0b0f14;
`;


export const HeroBackground = styled.div`
  position: absolute;
  inset: 0;
  background-image: url('https://assets.test.sharemechat.com/home/hero/hero_desktop_v1.webp');
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  filter: brightness(0.93) contrast(1.06) saturate(1.02);
  animation: ${slowZoom} 14s ease-in-out infinite alternate;

  @media (max-width: 780px) {
    background-image: url('https://assets.test.sharemechat.com/home/hero/hero_mobile_v1.webp');
    background-size: cover;
    background-position: 60% center;
  }
`;


export const HeroOverlay = styled.div`
  position: absolute;
  inset: 0;

  background:
    linear-gradient(
      to right,
      rgba(4, 5, 9, 0.92) 0%,
      rgba(4, 5, 9, 0.80) 28%,
      rgba(4, 5, 9, 0.48) 50%,
      rgba(4, 5, 9, 0.14) 70%,
      rgba(4, 5, 9, 0.10) 100%
    ),
    linear-gradient(
      to top,
      rgba(4, 5, 9, 0.36) 0%,
      rgba(4, 5, 9, 0.04) 35%,
      rgba(4, 5, 9, 0.08) 100%
    );
`;


export const HeroContent = styled.div`
  position: relative;
  z-index: 2;
  width: min(620px, 100%);
  min-height: calc(100vh - var(--navbar-height-desktop));
  display: flex;
  align-items: center;
  padding: 52px 56px;
  @media (max-width: 768px) {
    align-items: flex-end;
    padding: 34px 24px;
    min-height: 760px;
  }
`;


export const HeroCopy = styled.div`
  max-width: 520px;
`;


export const HeroEyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  &::before {
    content: "";
    width: 34px;
    height: 1px;
    background: linear-gradient(90deg, rgba(234,29,29,0.95), rgba(234,29,29,0.08));
  }
`;


export const HeroTitle = styled.h1`
  margin: 0 0 18px;
  font-size: clamp(42px, 6vw, 74px);
  line-height: 0.95;
  letter-spacing: -0.05em;
  font-weight: 800;
  span {
    color: #ea1d1d;
  }
`;


export const HeroSubtitle = styled.p`
  margin: 0 0 16px;

  color: rgba(255, 255, 255, 0.82);
  font-size: clamp(17px, 2vw, 21px);
  line-height: 1.55;
`;


export const HeroCtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
`;


export const HeroSecondaryCta = styled.button`
  min-height: 54px;
  padding: 0 24px;

  border-radius: 999px;

  font-weight: 800;
  font-size: 15px;

  color: #ffffff;
  background: rgba(255, 255, 255, 0.06);

  border: 1px solid rgba(255, 255, 255, 0.12);

  cursor: pointer;

  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;


export const HeroMeta = styled.p`
  margin: 0 0 30px;

  color: rgba(255, 255, 255, 0.64);
  font-size: 15px;
  line-height: 1.5;
`;


export const HomeLandingSection = styled.section`
  min-height: calc(100vh - var(--navbar-height-desktop));
  width: 100%;

  @supports (min-height: 100dvh) {
    min-height: calc(100dvh - var(--navbar-height-desktop));
  }

  @media (max-width: 1360px) {
    min-height: calc(100vh - var(--navbar-height) - var(--bottom-nav-height));

    @supports (min-height: 100dvh) {
      min-height: calc(100dvh - var(--navbar-height) - var(--bottom-nav-height));
    }
  }
`;

export const HomeLandingSectionWhite = styled(HomeLandingSection)`
  background: #ffffff;
`;

export const HomeLandingSectionPastel = styled(HomeLandingSection)`
  background: #f7f8f4;
`;

export const HomeSectionInner = styled.div`
  width: min(1180px, calc(100% - 48px));
  min-height: inherit;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  align-items: center;
  gap: 56px;
  padding: 72px 0;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    gap: 32px;
    width: min(100%, calc(100% - 32px));
    padding: 44px 0;
  }
`;

export const HomeSectionInnerReverse = styled(HomeSectionInner)`
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

export const HomeSectionText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 500px;

  @media (max-width: 960px) {
    max-width: none;
    order: 2;
  }
`;

export const HomeSectionTextRight = styled(HomeSectionText)`
  @media (max-width: 960px) {
    order: 2;
  }
`;

export const HomeSectionVisual = styled.div`
  position: relative;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 960px) {
    min-height: 300px;
    order: 1;
  }
`;

export const HomeSectionEyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: #475569;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

export const HomeSectionTitle = styled.h2`
  margin: 0;
  color: #0f172a;
  font-size: clamp(2rem, 3.4vw, 3.3rem);
  line-height: 0.98;
  font-weight: 800;
  letter-spacing: -0.04em;
`;

export const HomeSectionBody = styled.p`
  margin: 0;
  color: #475569;
  font-size: 1.02rem;
  line-height: 1.7;
  max-width: 520px;
`;

export const HomeFeatureList = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 6px;
`;

export const HomeFeaturePill = styled.div`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: #0f172a;
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
  font-size: 0.92rem;
  font-weight: 700;
`;

export const HomeVisualStage = styled.div`
  position: relative;
  width: min(100%, 560px);
  height: 100%;
  min-height: 420px;

  @media (max-width: 960px) {
    min-height: 300px;
  }
`;

export const HomeVisualCard = styled.div`
  position: absolute;
  border-radius: 30px;
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.12);
  overflow: hidden;
`;

export const HomeVisualShine = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.85), transparent 34%),
    linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0));
  pointer-events: none;
`;

export const HomeVisualMainPortrait = styled(HomeVisualCard)`
  inset: 18px 58px 18px 58px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,251,0.98) 100%);

  @media (max-width: 960px) {
    inset: 14px 42px 14px 42px;
  }
`;

export const HomeVisualMiniCard = styled(HomeVisualCard)`
  width: 150px;
  height: 190px;
  background:
    linear-gradient(180deg, rgba(245,247,250,0.98) 0%, rgba(236,242,247,0.98) 100%);

  &[data-pos='left'] {
    left: 0;
    bottom: 34px;
    transform: rotate(-8deg);
  }

  &[data-pos='right'] {
    right: 4px;
    top: 26px;
    transform: rotate(8deg);
  }

  @media (max-width: 960px) {
    width: 110px;
    height: 146px;
  }
`;

export const HomeVisualAvatar = styled.div`
  position: absolute;
  left: 50%;
  top: 52%;
  width: 48%;
  aspect-ratio: 3 / 4;
  transform: translate(-50%, -50%);
  border-radius: 28px;
  background:
    radial-gradient(circle at 50% 28%, rgba(255,255,255,0.9) 0 14%, transparent 14.5%),
    radial-gradient(circle at 50% 62%, rgba(255,255,255,0.8) 0 28%, transparent 28.5%),
    linear-gradient(180deg, #dbe6ef 0%, #bccddc 100%);
`;

export const HomeVisualCardTop = styled.div`
  position: absolute;
  left: 22px;
  right: 22px;
  top: 18px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(226,232,240,0.95), rgba(241,245,249,0.7));
`;

export const HomeVisualCardBottom = styled.div`
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 24px;
  display: grid;
  gap: 10px;
`;

export const HomeVisualLine = styled.div`
  height: 10px;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.85);

  &:nth-child(2) {
    width: 78%;
  }

  &:nth-child(3) {
    width: 56%;
  }
`;

export const HomeCallWindow = styled(HomeVisualCard)`
  inset: 24px 10px 24px 10px;
  border-radius: 32px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,251,0.98) 100%);
`;

export const HomeCallTopbar = styled.div`
  position: absolute;
  top: 18px;
  left: 18px;
  right: 18px;
  height: 46px;
  border-radius: 18px;
  background: rgba(241, 245, 249, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.18);
`;

export const HomeCallVideo = styled.div`
  position: absolute;
  left: 24px;
  right: 24px;
  top: 82px;
  bottom: 82px;
  border-radius: 26px;
  background:
    radial-gradient(circle at 50% 34%, rgba(255,255,255,0.85) 0 11%, transparent 11.5%),
    radial-gradient(circle at 50% 67%, rgba(255,255,255,0.7) 0 22%, transparent 22.5%),
    linear-gradient(180deg, #d8e2ea 0%, #b8c8d8 100%);
  overflow: hidden;
`;

export const HomeCallFloating = styled.div`
  position: absolute;
  right: 42px;
  bottom: 106px;
  width: 124px;
  height: 154px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 28%, rgba(255,255,255,0.86) 0 15%, transparent 15.5%),
    radial-gradient(circle at 50% 66%, rgba(255,255,255,0.76) 0 26%, transparent 26.5%),
    linear-gradient(180deg, #dbe8f2 0%, #c7d7e5 100%);
  border: 1px solid rgba(255,255,255,0.5);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);

  @media (max-width: 960px) {
    width: 96px;
    height: 120px;
    right: 30px;
    bottom: 96px;
  }
`;

export const HomeCallControls = styled.div`
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
`;

export const HomeCallControl = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
`;

export const HomePanelLarge = styled(HomeVisualCard)`
  inset: 34px 22px 22px 22px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,248,251,0.98) 100%);
`;

export const HomePanelSmall = styled(HomeVisualCard)`
  width: 200px;
  height: 160px;
  right: -6px;
  bottom: 20px;
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(235,241,246,0.98) 100%);

  @media (max-width: 960px) {
    width: 146px;
    height: 120px;
    right: 4px;
  }
`;

export const HomePanelChart = styled.div`
  position: absolute;
  left: 26px;
  right: 26px;
  top: 28px;
  height: 180px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(236,242,247,0.95) 0%, rgba(226,232,240,0.95) 100%);
`;

export const HomePanelBars = styled.div`
  position: absolute;
  left: 30px;
  right: 30px;
  bottom: 30px;
  display: flex;
  align-items: flex-end;
  gap: 12px;
`;

export const HomePanelBar = styled.div`
  flex: 1;
  border-radius: 999px 999px 16px 16px;
  background: linear-gradient(180deg, #c9d6e2 0%, #aebfd1 100%);

  &:nth-child(1) { height: 74px; }
  &:nth-child(2) { height: 132px; }
  &:nth-child(3) { height: 102px; }
  &:nth-child(4) { height: 152px; }
`;

export const HomePanelSmallHeader = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  top: 16px;
  height: 14px;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.95);
`;

export const HomePanelSmallBody = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  top: 48px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 32%, rgba(255,255,255,0.84) 0 16%, transparent 16.5%),
    radial-gradient(circle at 50% 72%, rgba(255,255,255,0.72) 0 24%, transparent 24.5%),
    linear-gradient(180deg, #d7e3ed 0%, #c3d3e1 100%);
`;

export const HomeProfileGrid = styled.div`
  position: relative;
  width: min(100%, 540px);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;

  @media (max-width: 960px) {
    gap: 14px;
  }
`;

export const HomeProfileCard = styled.div`
  position: relative;
  min-height: 170px;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,247,250,0.98) 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.1);
  overflow: hidden;

  &:nth-child(2),
  &:nth-child(3) {
    transform: translateY(22px);
  }

  @media (max-width: 960px) {
    min-height: 136px;
  }
`;

export const HomeProfileAvatar = styled.div`
  position: absolute;
  left: 50%;
  top: 44%;
  width: 54%;
  aspect-ratio: 1 / 1.18;
  transform: translate(-50%, -50%);
  border-radius: 24px;
  background:
    radial-gradient(circle at 50% 30%, rgba(255,255,255,0.86) 0 15%, transparent 15.5%),
    radial-gradient(circle at 50% 66%, rgba(255,255,255,0.76) 0 26%, transparent 26.5%),
    linear-gradient(180deg, #dce7ef 0%, #bfd0de 100%);
`;

export const HomeProfileMeta = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: grid;
  gap: 8px;
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
    gap: 0;
    padding: 0;
  }

  /* SOLO MÓVIL: ocultar el pane izquierdo completo (no solo el contenido) */
  @media (max-width: 768px){
    & > section[data-side="left"]{
      display: none;
    }
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
    padding: 0;
    max-height: none;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    justify-content: stretch;
    align-items: stretch;
  }

  /* SOLO MÓVIL: el media del pane derecho debe ser full y sin radios */
  @media (max-width: 768px) {
    &[data-side="right"]{
      overflow: hidden;
    }

    &[data-side="right"] .home-hero-media{
      border-radius: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
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

/* OVERLAY CTA HOME – SOLO MÓVIL (encima del vídeo) */
export const StyledHomeMobileOverlay = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 64px;
    z-index: 20;

    justify-content: center;
    align-items: center;
    pointer-events: none;

    & > div {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
  }
`;


export const HeroPrimaryCta = styled.button`
  min-height: 54px;
  padding: 0 24px;
  border-radius: 999px;
  border: none;
  font-weight: 800;
  font-size: 15px;
  color: #0b1020;
  background: #ffffff;
  box-shadow: 0 14px 34px rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;


/* OCULTAR HERO IZQUIERDO EN MÓVIL */
export const HideOnMobile = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`;