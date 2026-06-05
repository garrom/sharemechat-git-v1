// src/styles/public-styles/PreLaunchStyles.js
//
// Estilos de la pantalla pre-launch (ADR-009). Reutiliza la convencion
// de assets de la home (ASSETS_BASE -> CDN por entorno) y los tokens
// del hero (overlay, content layout, tipografia clara sobre oscuro).
//
// Convencion de imagen (igual que home/hero):
//   ${ASSETS_BASE}/prelaunch/hero/prelaunch_desktop_v1.webp   (desktop)
//   ${ASSETS_BASE}/prelaunch/hero/prelaunch_mobile_v1.webp    (mobile)
//
// El operador debe subir los dos webp a los buckets de assets de cada
// entorno (assets-sharemechat-test, assets-sharemechat-audit, etc.).
// Mientras no exista el fichero, el contenedor cae al color de fondo
// negro del HeroContainer (#0b0f14), que sigue siendo presentable.

import styled from 'styled-components';
import { ASSETS_BASE } from '../../config/runtimeEnv';

// Seccion equivalente a HomeHeroSection pero sin restar bottom-nav: en
// pre-launch no hay bottom nav del producto, asi que ocupamos altura
// completa (descontando solo la navbar superior).
export const PreLaunchSection = styled.section`
  position: relative;
  min-height: calc(100vh - var(--navbar-height-desktop));
  display: flex;
  flex-direction: column;

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

// Imagen de fondo siguiendo EXACTAMENTE la convencion de HeroBackground.
// Sin animacion slowZoom (no encaja con una pantalla de espera estatica).
export const PreLaunchBackground = styled.div`
  position: absolute;
  inset: 0;
  background-image: url('${ASSETS_BASE}/prelaunch/hero/prelaunch_desktop_v1.webp');
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  filter: brightness(0.92) contrast(1.04) saturate(1.0);

  @media (max-width: 780px) {
    background-image: url('${ASSETS_BASE}/prelaunch/hero/prelaunch_mobile_v1.webp');
    background-position: 60% center;
  }
`;

// Card de "verifica tu email", presentada como bloque oscuro translucido
// sobre el hero. Tokens alineados con HeroSecondaryCta / HeroEyebrow
// (mismo tono blanco transparente).
export const PreLaunchVerifyCard = styled.aside`
  margin-top: 26px;
  padding: 18px 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.86);
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 520px;
`;

export const PreLaunchVerifyTitle = styled.div`
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.92);
`;

export const PreLaunchVerifyBody = styled.p`
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.72);
`;

export const PreLaunchVerifyButton = styled.button`
  align-self: flex-start;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 14px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.20);
  cursor: pointer;
  transition: transform 0.2s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.16);
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
  color: ${(p) => (p.$kind === 'err' ? '#fca5a5' : '#86efac')};
`;
