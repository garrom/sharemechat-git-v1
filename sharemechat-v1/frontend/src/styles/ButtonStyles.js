// src/styles/ButtonStyles.js
import styled, { css } from 'styled-components';
import { colors, radius } from './core/tokens';


/* ============================================================
 * ESTRUCTURA
 *  - Utilidades base
 *  - Botones genéricos (ActionButton)
 *  - Botones Videochat (desktop + móvil)
 *  - Botones Favoritos / Chat persistente
 *  - Botones Navbar
 *  - Aliases de compatibilidad (mantener imports existentes)
 * ============================================================ */

/* ========== UTILIDADES BASE ========== */

const focusRing = (color = '#20c99766') => css`
  &:focus-visible {
    outline: 2px solid ${color};
    outline-offset: 2px;
  }
`;

const variant = (fg, bg, border, hoverBg = null, hoverFg = null) => css`
  color: ${fg};
  background: ${bg};
  border-color: ${border};
  &:hover:not(:disabled) {
    ${hoverBg ? `background: ${hoverBg};` : ''}
    ${hoverFg ? `color: ${hoverFg};` : ''}
  }
`;

const shadowLift = css`
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
`;

/* Base compacta (texto) */
const ButtonBase = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid transparent;

  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  transition: transform .05s ease, filter .15s ease, background-color .15s ease, border-color .15s ease, color .15s ease;
  &:active { transform: translateY(1px); }
  &:disabled {
    opacity: .6;
    cursor: not-allowed;
    filter: grayscale(.2);
  }

  /* modo oscuro base */
  color: #111;
  background: #f8f9fa;
  border-color: #ced4da;

  &:hover:not(:disabled) { filter: brightness(0.98); }

  ${focusRing()}
`;

/* Base pill (laterales redondeados como Activar cámara) */
const PillButtonBase = styled(ButtonBase)`
  border-radius: 999px;
`;

/* Base para botones SOLO icono (cuadrados redondos) */
const IconButtonBase = styled.button`
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;

  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;

  background: #f8f9fa;
  color: #111;
  transition: transform .05s ease, filter .15s ease, background-color .15s ease, border-color .15s ease, color .15s ease;

  &:active { transform: translateY(1px); }
  &:disabled { opacity: .6; cursor: not-allowed; filter: grayscale(.2); }

  ${focusRing()}
`;

/* ========== BOTÓN GENÉRICO TEXTO ========== */

export const ActionButton = styled(PillButtonBase)`
  ${variant('#fff', '#28a745', '#218838', '#218838')}
`;

/* ========== VIDEOCHAT: DESKTOP + MÓVIL ========== */

/* Activar cámara (texto) */
export const ButtonActivarCam = styled(PillButtonBase)`
  ${variant(colors.black, colors.white, colors.white, colors.black, colors.white)}
  font-size: 16px;
  padding: 14px 22px;
  ${shadowLift}
`;

/* Activar cámara móvil*/
export const ButtonActivarCamMobile = styled(PillButtonBase)`
  ${variant(colors.black, colors.white, colors.white, colors.black, colors.white)}
  font-size: 16px;
  padding: 14px 22px;
  ${shadowLift}
`;

/* Buscar  */
export const ButtonBuscar = styled(PillButtonBase)`
  ${variant(colors.black, colors.white, colors.white, colors.black, colors.white)}
  padding: 14px 32px;
  font-size: 1rem;
  min-width: 180px;
  ${shadowLift}
`;

/* Next (mantiene texto) */
export const ButtonNext = styled(PillButtonBase)`
  ${variant('#111', '#ffc107', '#e0a800', '#ffca2c', '#111')}
`;

/* Stop (texto o icono; por defecto texto si lo pones) */
export const ButtonStop = styled(PillButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;

/* Añadir favorito (texto o icono) */
export const ButtonAddFavorite = styled(PillButtonBase)`
  ${variant('#fff', '#0dcaf0', '#0aa2c0', '#31d2f2')}
`;

/* Llamar (texto o icono) */
export const ButtonLlamar = styled(PillButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
`;

/* Colgar (texto o icono) */
export const ButtonColgar = styled(PillButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;

/* ========== FAVORITOS / CHAT PERSISTENTE ========== */

/* Enviar (dock chat) */
export const ButtonEnviar = styled(PillButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
`;

/* Regalo (dock chat) */
export const ButtonRegalo = styled(IconButtonBase)`
  ${variant('#111', '#ffe066', '#fcc419', '#ffd43b')}
  width: 36px; height: 36px; min-width: 36px; min-height: 36px; font-size: 14px;
`;


/* Volver (flecha atrás en móvil) */
export const ButtonVolver = styled(PillButtonBase)`
  ${variant('#000', '#ffffff', '#000000', '#f1f3f5')}
  border-width: 1px;
  border-style: solid;
`;

/* Aceptar / Rechazar para invitaciones */
export const ButtonAceptar = styled(PillButtonBase)`
  ${variant('#fff', '#198754', '#146c43', '#157347')}
`;
export const ButtonRechazar = styled(PillButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;

/* Toggle de regalos (equivalente a StyledGiftToggle) */
export const ButtonGiftToggle = styled(ActionButton)`
  padding: 10px 12px;
`;

/* ========== NAVBAR ========== */

export const NavButton = styled(PillButtonBase)`
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;

  /* Estilo homogéneo navbar / tabs */
  font-family: var(--font-nav);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  padding-inline: 16px;
  padding-block: 8px;

  &:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.35);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;



/* ========== ICON-ONLY VARIANTS (para cuando quites texto) ========== */
/* botones 100% icono (☎, ⛔, ⏹, 👤+ ) */

// llamar
export const BtnCall = styled(IconButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
`;
// colgar
export const BtnHangup = styled(IconButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;
// stop
export const BtnStopIcon = styled(IconButtonBase)`
  ${variant('#fff', '#6c757d', '#5c636a', '#666f76')}
`;
// añadir favoritos
export const BtnFavAdd = styled(IconButtonBase)`
  ${variant('#fff', '#0dcaf0', '#0aa2c0', '#31d2f2')}
`;
// videocamara
export const BtnRoundVideo = styled(IconButtonBase)`
  ${variant('#fff','#198754','#146c43','#157347')}
  width:72px;height:72px;font-size:22px;${shadowLift}
`;

// send
export const BtnSend = styled(IconButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
  width: 36px; height: 36px; min-width: 36px; min-height: 36px; font-size: 14px;
`;
