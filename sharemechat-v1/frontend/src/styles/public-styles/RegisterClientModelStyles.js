// src/styles/public-styles/RegisterClientModelStyles.js
import styled from 'styled-components';
import { bp, colors, space } from '../core/tokens';
import { buttonBase, focusRing } from '../core/mixins';

/* CONTENEDOR FULL SCREEN (igual que StyledContainer de Login) */
export const Container = styled.div`
  min-height: 100vh;
  padding: ${space.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  @media (max-width: ${bp.md}) { padding: ${space.md}; }
`;

/* CARD REGISTRO (clonado del StyledForm de Login) */
export const Form = styled.form`
  position: relative;
  width: 100%;
  max-width: 520px;
  padding: 28px 28px;
  border-radius: 24px;
  background: ${colors.backsolid || '#020617'};
  border: 1px solid #0b1120;
  box-shadow: 0 32px 80px rgba(0,0,0,0.8);
  color: #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  @media (max-width: ${bp.md}) {
    max-width: 100%;
    padding: 24px 20px;
    border-radius: 20px;
  }
`;

/* TÍTULO (igual que FormTitle) */
export const Title = styled.h2`
  margin: 0;
  font-weight: 700;
  font-size: 1.7rem;
  text-align: left;
  color: #f9fafb;
`;

/* MENSAJE ERROR (igual estilo Login) */
export const Error = styled.p`
  color: #f97373;
  font-size: 0.9rem;
  margin: 0;
`;

/* CAMPOS */
export const Field = styled.div`
  width: 100%;
`;

/* INPUT OSCURO (clonado de StyledInput de Login) */
export const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-size: 1rem;
  border-radius: 18px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  color: #f5f5f5;
  padding: 13px 16px;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
  &::placeholder { color: #9ca3af; }
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

/* BOTÓN VERDE PASTILLA (igual que StyledButton) */
export const Button = styled.button`
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

/* LINKS DEBAJO (igual enfoque que StyledLinkButton) */
export const LinkButton = styled.button`
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
  margin-top: 4px;
  &:hover:not(:disabled) { color: #e5e7eb; }
  &:focus-visible { ${focusRing} }
`;

/* CHECKBOXES LEGALES */
export const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 6px 0;
  cursor: pointer;
  user-select: none;
`;

export const CheckInput = styled.input`
  margin-top: 4px;
`;

export const CheckText = styled.span`
  color: #d1d5db;
  font-size: 0.9rem;
  a { color: #38bdf8; text-decoration: underline; }
`;

/* El StyledBrand del registro ya no lo usamos dentro del card,
   porque ahora el logo está solo en el navbar, como en Login.
   Si lo necesitas más adelante, se puede reactivar. */
export const StyledBrand = styled.a`
  display: none;
`;
