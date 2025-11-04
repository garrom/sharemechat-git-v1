// src/styles/RegisterClientModelStyles.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from '../core/tokens';
import { inputBase, buttonBase, focusRing } from '../core/mixins';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: ${colors.bg};
  padding: ${space.lg};
`;

export const Form = styled.form`
  background-color: ${colors.white};
  padding: ${space.xl};
  border-radius: ${radius.lg};
  box-shadow: ${shadow.card};
  width: 100%;
  max-width: 440px;

  @media (max-width: ${bp.md}) {
    padding: ${space.lg};
    max-width: 100%;
  }
`;

export const Title = styled.h2`
  margin: 0 0 ${space.lg};
  font-weight: 600;
  text-align: center;
`;

export const Error = styled.p`
  color: ${colors.error};
  margin: ${space.sm} 0;
  font-size: 0.95rem;
`;

export const Field = styled.div`
  margin-bottom: ${space.sm};
`;

export const Input = styled.input`
  ${inputBase}
  font-size: 1rem;
`;

export const FieldError = styled.div`
  color: ${colors.danger};
  font-size: 0.8rem;
  margin-top: 4px;
`;

export const Button = styled.button`
  ${buttonBase}
  width: 100%;
  padding: 10px;
  background-color: ${colors.success};
  color: ${colors.white};
  font-size: 1rem;
  &:hover { background-color: ${colors.successHover}; }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
`;

export const LinkButton = styled.button`
  ${buttonBase}
  width: 100%;
  margin-top: ${space.sm};
  background: transparent;
  color: #007bff;
  border: none;
  font-size: 0.95rem;
  text-decoration: underline;
  justify-content: flex-start;

  &:focus { ${focusRing} }
`;

export const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: ${space.sm} 0;
  cursor: pointer;
  user-select: none;
`;

export const CheckInput = styled.input`
  margin-top: 2px;
`;

export const CheckText = styled.span`
  color: ${colors.text};
  a { color: #007bff; text-decoration: underline; }
`;

export const StyledBrand = styled.a`
  display: block;                /* ocupa todo el ancho disponible */
  margin: 0 auto ${space.lg};    /* centrado + separación con el título */
  width: 240px;                  /* tamaño grande del logo */
  height: 60px;
  background: url('/img/SharemeChat_2.svg') no-repeat center / contain;

  /* oculta el texto interno si dejas “SharemeChat” dentro */
  text-indent: -9999px;
  overflow: hidden;
  line-height: 0;
  color: transparent;

  &:hover { opacity: .96; }
  &:focus-visible {
    outline: 2px solid rgba(13,110,253,.35);
    outline-offset: 2px;
  }

  @media (max-width: ${bp.md}) {
    width: 200px;
    height: 50px;
  }
  @media (max-width: 420px) {
    width: 170px;
    height: 42px;
  }
`;

