// src/styles/LoginStyles.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from '../core/tokens';
import { inputBase, buttonBase, focusRing } from '../core/mixins';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: ${colors.bg};
  padding: ${space.lg};
`;

export const StyledForm = styled.form`
  background-color: ${colors.white};
  padding: ${space.xl};
  border-radius: ${radius.lg};
  box-shadow: ${shadow.card};
  width: 100%;
  max-width: 420px;

  @media (max-width: ${bp.md}) {
    padding: ${space.lg};
    max-width: 100%;
  }
`;

export const FormTitle = styled.h2`
  margin: ${space.xs} 0 ${space.lg};
  font-weight: 600;
  text-align: center;
`;


export const Status = styled.div`
  color: ${colors.textMuted};
  margin-bottom: ${space.sm};
  font-size: 0.95rem;
`;

export const StyledError = styled.p`
  color: ${colors.error};
  margin: ${space.sm} 0;
  font-size: 0.95rem;
`;

export const Field = styled.div`
  margin-bottom: ${space.sm};
`;

export const StyledInput = styled.input`
  ${inputBase}
  font-size: 1rem;
`;

export const FieldError = styled.div`
  color: ${colors.danger};
  font-size: 0.8rem;
  margin-top: 4px;
`;

export const StyledButton = styled.button`
  ${buttonBase}
  width: 100%;
  padding: 10px;
  background-color: ${colors.success};
  color: ${colors.white};
  font-size: 1rem;
  &:hover { background-color: ${colors.successHover}; }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
`;

export const StyledLinkButton = styled.button`
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

export const StyledBrand = styled.a`
  display: block;                /* ocupa todo el ancho disponible */
  margin: 0 auto ${space.lg};    /* centrado horizontal con margen abajo */
  width: 240px;                  /* tamaño más grande */
  height: 60px;                  /* alto más grande */
  background: url('/img/SharemeChat_2.svg') no-repeat center / contain;

  /* oculta el texto si lo dejas dentro */
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

