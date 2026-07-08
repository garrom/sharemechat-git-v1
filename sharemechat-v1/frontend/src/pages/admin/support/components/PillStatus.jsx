import React from 'react';
import styled from 'styled-components';

// Frente B.3.2 (ADR-046). Pill de color por estado de conversacion. Sin
// dependencia de i18n: recibe el label ya traducido para no acoplar el
// componente a la BdC de idioma.

const STATUS_COLORS = {
  OPEN: { bg: '#e0f2fe', fg: '#075985', border: '#bae6fd' },
  ESCALATED: { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d' },
  HUMAN_HANDLING: { bg: '#dcfce7', fg: '#166534', border: '#86efac' },
  RATE_LIMITED: { bg: '#fde68a', fg: '#7c2d12', border: '#fbbf24' },
  RESOLVED: { bg: '#e5e7eb', fg: '#374151', border: '#d1d5db' },
  ABANDONED: { bg: '#f3f4f6', fg: '#4b5563', border: '#e5e7eb' },
  DEFAULT: { bg: '#f3f4f6', fg: '#374151', border: '#d1d5db' },
};

const Pill = styled.span`
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: ${(p) => p.$colors.bg};
  color: ${(p) => p.$colors.fg};
  border: 1px solid ${(p) => p.$colors.border};
  white-space: nowrap;
`;

const PillStatus = ({ status, label }) => {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
  return <Pill $colors={colors}>{label || status}</Pill>;
};

export default PillStatus;
