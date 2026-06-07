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

// Imagen de fondo reducida para que el "COMING SOON" no domine la
// pantalla ni se solape con HeroCopy (texto + tarjeta verifica-email,
// ambos en HeroContent, columna izquierda padding 52px/56px). En lugar
// de cubrir todo (cover) la imagen se sirve a tamaño parcial,
// centrada a la derecha; el resto del hero es un fondo solido oscuro
// con viñeta lateral suave para integrar el borde derecho sin que
// quede rectangular.
//
// AJUSTAR AQUI tamaños / posición de la imagen de fondo:
const PL_BG_FILL_COLOR        = '#0b0f14';        // mismo tono que HeroContainer; rellena lo que la imagen ya no cubre
const PL_BG_SIZE_DESKTOP      = 'auto 72%';       // alto = 72% del hero, ancho = proporcional (imagen pequeña)
const PL_BG_POSITION_DESKTOP  = '88% 50%';        // empujada a la derecha, centrada vertical
const PL_BG_SIZE_TABLET       = 'auto 60%';       // <= 1024 px: aún más pequeña
const PL_BG_POSITION_TABLET   = '92% 50%';
const PL_BG_SIZE_MOBILE       = 'auto 48%';       // <= 780 px: imagen pequeña arriba-derecha
const PL_BG_POSITION_MOBILE   = '50% 18%';        // mobile: arriba centro
/* ================================================================ */

export const PreLaunchBackground = styled.div`
  position: absolute;
  inset: 0;
  background-color: ${PL_BG_FILL_COLOR};
  background-image:
    radial-gradient(ellipse at 88% 50%, rgba(11,15,20,0) 0%, rgba(11,15,20,0.35) 60%, rgba(11,15,20,0.85) 100%),
    url('${ASSETS_BASE}/prelaunch/hero/prelaunch_desktop_v1.webp');
  background-size: 100% 100%, ${PL_BG_SIZE_DESKTOP};
  background-position: center center, ${PL_BG_POSITION_DESKTOP};
  background-repeat: no-repeat, no-repeat;
  filter: brightness(0.92) contrast(1.04) saturate(1.0);

  @media (max-width: 1024px) {
    background-size: 100% 100%, ${PL_BG_SIZE_TABLET};
    background-position: center center, ${PL_BG_POSITION_TABLET};
  }

  @media (max-width: 780px) {
    background-image:
      linear-gradient(180deg, rgba(11,15,20,0.0) 0%, rgba(11,15,20,0.0) 40%, rgba(11,15,20,0.55) 100%),
      url('${ASSETS_BASE}/prelaunch/hero/prelaunch_mobile_v1.webp');
    background-size: 100% 100%, ${PL_BG_SIZE_MOBILE};
    background-position: center center, ${PL_BG_POSITION_MOBILE};
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
