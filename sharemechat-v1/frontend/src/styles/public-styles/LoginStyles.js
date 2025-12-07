// src/styles/public-styles/LoginStyles.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from '../core/tokens';
import { buttonBase, focusRing } from '../core/mixins';

/* CONTENEDOR FULL SCREEN (fondo negro, como la web) */
export const StyledContainer = styled.div`
  min-height: 100vh;
  padding: ${space.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  @media (max-width: ${bp.md}) { padding: ${space.md}; }
`;

/* CARD LOGIN */
export const StyledForm = styled.form`
  position: relative;
  width: 100%;
  max-width: 520px;
  padding: 28px 28px;
  border-radius: 24px;
  background: ${colors.backsolid || '#020617'};
  border: 1px solid #0b1120;
  box-shadow: 0 32px 80px rgba(0,0,0,0.8);
  color: #e5e7eb;

  /* clave para la SIMETRÍA vertical */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px; /* mismo espacio entre todos los elementos del form */

  @media (max-width: ${bp.md}) {
    max-width: 100%;
    padding: 24px 20px;
    border-radius: 20px;
  }
`;

export const FormTitle = styled.h2`
  margin: 0;
  font-weight: 700;
  font-size: 1.7rem;
  text-align: left;
  color: #f9fafb;
`;

/* Bloque mensajes */
export const Status = styled.div`
  color: #9ca3af;
  font-size: 0.9rem;
`;

export const StyledError = styled.p`
  color: #f97373;
  font-size: 0.9rem;
  margin: 0;
`;

/* Wrapper campo (ya no usamos margin-bottom, lo controla gap del form) */
export const Field = styled.div`
  width: 100%;
`;

/* INPUTS: gris neutro, sin azules, con bordes suaves */
export const StyledInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-size: 1rem;
  border-radius: 18px;

  background: #2a2a2a;
  border: 1px solid #3a3a3a;    /* gris medio */
  color: #f5f5f5;

  padding: 13px 16px;
  outline: none;

  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    border-color: #00f59d;
    box-shadow: 0 0 0 1px #00f59d;
    background: #232323;
  }

  &:disabled {
    opacity: .7;
    background: #1f1f1f;
    cursor: not-allowed;
  }
`;

export const FieldError = styled.div`
  color: #fca5a5;
  font-size: 0.78rem;
  margin-top: 4px;
`;

/* BOTÓN VERDE PASTILLA, TIPO AZAR */
export const StyledButton = styled.button`
  ${buttonBase}
  width: 100%;
  padding: 14px 18px;
  margin-top: 4px;
  border-radius: 999px;
  background: #00f59d;
  border: 0;
  color: #020617;
  font-size: 1rem;
  font-weight: 700;

  &:hover:not(:disabled) {
    background: #1bffac;
    transform: translateY(0);
    box-shadow: 0 18px 40px rgba(0,245,157,0.36);
  }

  &:disabled {
    opacity: .6;
    cursor: wait;
    box-shadow: none;
  }
`;

/* LINKS DEBAJO (alineados y con mismo espacio gracias al gap) */
export const StyledLinkButton = styled.button`
  ${buttonBase}
  width: 100%;
  padding: 8px 4px;
  background: transparent;
  border: 0;
  color: #9ca3af;
  font-size: 0.9rem;
  justify-content: flex-start;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover:not(:disabled) { color: #e5e7eb; }
  &:focus-visible { ${focusRing} }
`;

/* LOGO centrado arriba, respetando el gap del form */
export const StyledBrand = styled.a`
  display: block;
  margin: 0 auto;
  width: 220px;
  height: 56px;
  background: url('/img/SharemeChat_2.svg') no-repeat center / contain;
  text-indent: -9999px;
  overflow: hidden;
  line-height: 0;
  color: transparent;

  &:hover { opacity: .96; }
  &:focus-visible {
    outline: 2px solid rgba(34,197,94,.6);
    outline-offset: 2px;
  }

  @media (max-width: ${bp.md}) {
    width: 190px;
    height: 48px;
  }
  @media (max-width: 420px) {
    width: 170px;
    height: 42px;
  }
`;

// X para cerrar
export const CloseBtn = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: none;
  background: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 6px 18px rgba(0,0,0,0.5);
  transition: background .15s ease, transform .05s ease, box-shadow .15s ease;
  color: #f9fafb; /* <- X en blanco */

  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    box-shadow: 0 10px 26px rgba(0,0,0,0.65);
  }

  &:active {
    transform: translateY(1px);
  }
`;



