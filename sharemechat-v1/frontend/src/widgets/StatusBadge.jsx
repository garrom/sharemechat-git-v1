// src/widgets/StatusBadge.jsx
import React from 'react';
import styled from 'styled-components';
import {
  HiOutlineClock,          // pending
  HiOutlinePaperAirplane,  // sent
  HiOutlineCheckCircle,    // accepted (y active futuro)
  HiOutlinePauseCircle,    // inactive
  HiOutlineXCircle,        // rejected
} from 'react-icons/hi2';


const PALETTE = {
  pending:  { fg: '#f59f00' }, // amber
  sent:     { fg: '#1c7ed6' }, // blue
  accepted: { fg: '#37b24d' }, // green
  rejected: { fg: '#e03131' }, // red
  inactive: { fg: '#868e96' }, // gray
  active:   { fg: '#2f9e44' }, // green (reservado para futuro)
};


const ICONS = {
  pending:  HiOutlineClock,
  sent:     HiOutlinePaperAirplane,
  accepted: HiOutlineCheckCircle,
  rejected: HiOutlineXCircle,
  inactive: HiOutlinePauseCircle,
  // FUTURO: preparado, pero ahora NO se pinta (igual que inactive)
  active:   HiOutlineCheckCircle,
};

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  /* sin paddings/bordes para que quepa el nombre al máximo */
  color: ${(p) => p.$color || 'currentColor'};
`;

/**
 * Props:
 * - value: string ('pending' | 'sent' | 'accepted' | 'rejected' | 'inactive' | 'active')
 * - title: string opcional para tooltip (si no, autogenerado)
 * - size: número (px) => default 16
 */
export default function StatusBadge({ value, title, size = 16 }) {
  const key = String(value || '').toLowerCase();

  // Por ahora, NO pintamos 'inactive' ni 'active' (como pediste)
  if (key === 'inactive' || key === 'active') return null;

  const Icon = ICONS[key];
  if (!Icon) return null;

  const color = PALETTE[key]?.fg || undefined;
  const tooltip = title || key;

  return (
    <Wrap $color={color} title={tooltip} aria-label={tooltip}>
      <Icon size={size} />
    </Wrap>
  );
}
