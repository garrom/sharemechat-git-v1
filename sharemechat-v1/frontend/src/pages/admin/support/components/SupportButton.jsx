import React from 'react';
import styled, { css } from 'styled-components';

// Frente B.3.2 (ADR-046). Boton local del dominio soporte con 3 variantes.
// No pretende resolver el design system global del admin, solo unifica los
// botones dentro del panel.

const variants = {
  primary: css`
    background: #1e3a8a;
    color: #fff;
    border-color: #1e3a8a;
    &:hover:not(:disabled) { background: #1e40af; border-color: #1e40af; }
  `,
  success: css`
    background: #15803d;
    color: #fff;
    border-color: #15803d;
    &:hover:not(:disabled) { background: #166534; border-color: #166534; }
  `,
  secondary: css`
    background: #fff;
    color: #1f2937;
    border-color: #d1d5db;
    &:hover:not(:disabled) { background: #f3f4f6; }
  `,
  danger: css`
    background: #dc2626;
    color: #fff;
    border-color: #dc2626;
    &:hover:not(:disabled) { background: #b91c1c; border-color: #b91c1c; }
  `,
};

const sizes = {
  sm: css`padding: 4px 10px; font-size: 0.78rem; border-radius: 6px;`,
  md: css`padding: 8px 14px; font-size: 0.88rem; border-radius: 8px;`,
  lg: css`padding: 10px 18px; font-size: 0.95rem; border-radius: 10px;`,
};

const StyledSupportButton = styled.button`
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  transition: background 120ms ease, border-color 120ms ease;
  ${(p) => sizes[p.$size] || sizes.md};
  ${(p) => variants[p.$variant] || variants.primary};

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const SupportButton = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  children,
  style,
  title,
}) => (
  <StyledSupportButton
    $variant={variant}
    $size={size}
    type={type}
    disabled={disabled}
    onClick={onClick}
    style={style}
    title={title}
  >
    {children}
  </StyledSupportButton>
);

export default SupportButton;
