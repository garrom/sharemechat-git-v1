// src/styles/ButtonStyles.js
import styled, { css } from 'styled-components';

/* ==================================
 *   BOTONES DASHBOARD CLIENTES Y MODELOS
 * ================================== */

// Base común para todos los botones de acción (esquinas redondeadas, padding, foco, disabled)
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

  /* Modo oscuro base del proyecto */
  color: #111;
  background: #f8f9fa;
  border-color: #ced4da;

  &:hover:not(:disabled) {
    filter: brightness(0.98);
  }

  &:focus-visible {
    outline: 2px solid #20c99766;
    outline-offset: 2px;
  }
`;

// Pequeña utilidad para variantes de color
const variant = (fg, bg, border, hoverBg = null, hoverFg = null) => css`
  color: ${fg};
  background: ${bg};
  border-color: ${border};
  &:hover:not(:disabled) {
    ${hoverBg ? `background: ${hoverBg};` : ''}
    ${hoverFg ? `color: ${hoverFg};` : ''}
  }
`;

/*-- Boton activar camara --*/
export const ButtonActivarCam = styled(ButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
`;

/*-- Boton buscar cliente --*/
export const ButtonBuscarCliente = styled(ButtonBase)`
  ${variant('#fff', '#6f42c1', '#5a32a3', '#643ab0')}
`;

/*-- Boton buscar modelo --*/
export const ButtonBuscarModelo = styled(ButtonBase)`
  ${variant('#fff', '#198754', '#146c43', '#157347')}
`;

/*-- Boton next --*/
export const ButtonNext = styled(ButtonBase)`
  ${variant('#111', '#ffc107', '#e0a800', '#ffca2c', '#111')}
`;

/*-- Boton stop --*/
export const ButtonStop = styled(ButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;

/*-- Boton añadir favoritos --*/
export const ButtonAddFavorite = styled(ButtonBase)`
  ${variant('#fff', '#0dcaf0', '#0aa2c0', '#31d2f2')}
`;

/*-- Boton llamar --*/
export const ButtonLlamar = styled(ButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
`;

/*-- Boton colgar --*/
export const ButtonColgar = styled(ButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;

/*-- Boton aceptar --*/
export const ButtonAceptar = styled(ButtonBase)`
  ${variant('#fff', '#198754', '#146c43', '#157347')}
`;

/*-- Boton rechazar --*/
export const ButtonRechazar = styled(ButtonBase)`
  ${variant('#fff', '#dc3545', '#b02a37', '#bb2d3b')}
`;

/* ==================================
 *   BOTONES MÓVIL (FAVORITOS)
 * ================================== */

/*-- Boton volver (flecha atrás en header móvil) --*/
export const ButtonVolver = styled(ButtonBase)`
  ${variant('#000', '#ffffff', '#000000', '#f1f3f5')}
  border-width: 1px;
  border-style: solid;
  border-color: #000000;
  padding: 8px 12px;
  border-radius: 8px;
`

/*-- Boton enviar (dock chat móvil) --*/
export const ButtonEnviar = styled(ButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
`

/*-- Boton regalo (dock chat móvil) --*/
export const ButtonRegalo = styled(ButtonBase)`
  ${variant('#111', '#ffe066', '#fcc419', '#ffd43b')}
`

/*-- Boton activar camara (móvil) --*/
export const ButtonActivarCamMobile = styled(ButtonBase)`
  ${variant('#fff', '#0d6efd', '#0a58ca', '#0b5ed7')}
  font-size: 16px;
  padding: 12px 16px;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
`

/* ==================================
 *   BOTONES DEL NAVBAR
 * ================================== */

// (De momento no migramos los del navbar; se añadirán aquí cuando toque)

