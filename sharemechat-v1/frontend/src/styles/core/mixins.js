// src/styles/core/mixins.js
import { colors, radius } from './tokens';

export const focusRing = `
  outline: 2px solid ${colors.primary};
  outline-offset: 2px;
`;

export const inputBase = `
  width: 100%;
  padding: 8px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.md};
  background: ${colors.white};
  color: ${colors.text};
  &:focus { ${focusRing} }
`;

export const buttonBase = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: ${radius.md};
  cursor: pointer;
  transition: 0.2s ease;
  user-select: none;
  border: 1px solid transparent;
`;

export const srOnly = `
  position: absolute !important;
  width: 1px; height: 1px;
  margin: -1px; border: 0; padding: 0;
  white-space: nowrap; clip-path: inset(100%);
  clip: rect(0 0 0 0); overflow: hidden;
`;
