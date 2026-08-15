// src/styles/public-styles/PreLaunchStyles.js
//
// Estilos de la pantalla pre-launch (ADR-009). Rediseño 2026-08-16:
// se abandona el hero OSCURO con imagen pequeña a la derecha y se pasa a
// un "split hero" CLARO y cálido, alineado con el lenguaje de marca de los
// emails de registro (rojo #ea1d1d, aire editorial): texto a la izquierda,
// foto a la derecha (cover), tarjeta de verificación de email integrada.
//
// La imagen se sirve desde el CDN de assets por entorno (ASSETS_BASE):
//   ${ASSETS_BASE}/prelaunch/hero/coming_hero_v1.jpg
// El operador sube ese JPEG a los buckets de assets de cada entorno
// (assets-sharemechat-{test,audit,prod}). Si el fichero no existe, el panel
// cae a su color de fondo (rosa suave), presentable igualmente.
//
// El cierre real vive en el backend (ProductOperationalModeFilter +
// ProductOperationalModeWsInterceptor): aunque alguien fuerce el URL del
// dashboard, los endpoints sensibles responden 503 para no-allowlisted.
// Esta pantalla es solo la experiencia visible.

import styled from 'styled-components';
import { ASSETS_BASE } from '../../config/runtimeEnv';

export const COMING_HERO_URL = `${ASSETS_BASE}/prelaunch/hero/coming_hero_v1.jpg`;

// Sección a altura completa (descontando solo la navbar superior; en
// pre-launch no hay bottom-nav del producto).
export const PreLaunchSection = styled.section`
  position: relative;
  min-height: calc(100vh - var(--navbar-height-desktop));
  display: flex;
  background: #ffffff;

  @supports (min-height: 100dvh) {
    min-height: calc(100dvh - var(--navbar-height-desktop));
  }

  @media (max-width: 1360px) {
    min-height: calc(100vh - var(--navbar-height));

    @supports (min-height: 100dvh) {
      min-height: calc(100dvh - var(--navbar-height));
    }
  }
`;

// Split hero: texto | foto. En móvil se apila (foto arriba).
export const PreLaunchHero = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: stretch;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

export const PreLaunchCopy = styled.div`
  padding: 56px 52px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(180deg, #fffefe 0%, #fbf6f4 100%);

  @media (max-width: 860px) {
    padding: 40px 26px;
  }
`;

export const PreLaunchEyebrow = styled.p`
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 16px;
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #ea1d1d;

  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ea1d1d;
    box-shadow: 0 0 0 4px rgba(234, 29, 29, 0.14);
  }
`;

export const PreLaunchTitle = styled.h1`
  margin: 0 0 16px;
  font-size: 40px;
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #141820;

  @media (max-width: 860px) {
    font-size: 32px;
  }
`;

export const PreLaunchSubtitle = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: #4b5563;
  max-width: 44ch;
`;

// Panel derecho con la foto (cover). El color de fondo rosa suave cubre
// el hueco si la imagen aún no está en el CDN.
export const PreLaunchPic = styled.div`
  position: relative;
  background: #f4d9e4;
  min-height: 320px;

  & img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 42%;
    display: block;
  }

  @media (max-width: 860px) {
    order: -1;
    min-height: 280px;
  }
`;

// Card de "verifica tu email", en clave clara (blanco + filo rojo + botón
// rojo de marca), integrada bajo el subtítulo.
export const PreLaunchVerifyCard = styled.aside`
  margin-top: 30px;
  max-width: 440px;
  padding: 16px 18px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #efe1dd;
  border-left: 4px solid #ea1d1d;
  display: flex;
  flex-direction: column;
  gap: 11px;
`;

export const PreLaunchVerifyTitle = styled.div`
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #141820;
`;

export const PreLaunchVerifyBody = styled.p`
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: #5b6470;
`;

export const PreLaunchVerifyButton = styled.button`
  align-self: flex-start;
  min-height: 42px;
  padding: 0 20px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13.5px;
  color: #ffffff;
  background: #ea1d1d;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(234, 29, 29, 0.24);
  transition: transform 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    background: #cf1717;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.65;
    cursor: default;
  }
`;

export const PreLaunchVerifyFeedback = styled.div`
  font-size: 0.85rem;
  line-height: 1.5;
  color: ${(p) => (p.$kind === 'err' ? '#b42318' : '#166534')};
`;
