import styled from 'styled-components';
import { bp, radius, space } from './core/tokens';
import { buttonBase } from './core/mixins';

export const Wrap = styled.div`
  min-height: 100vh;
  display:flex; align-items:center; justify-content:center;
  background: #0d1117; color:#fff; padding: ${space.xl};
`;

export const Card = styled.div`
  width:100%;
  max-width: 720px;
  background:#161b22;
  border:1px solid #21262d;
  border-radius: 14px;
  padding: 28px;
  @media (max-width: ${bp.md}) { padding: 20px; }
`;

export const Title = styled.h1`
  margin:0 0 8px;
  font-size: clamp(1.75rem, 3vw, 2rem);
  font-weight: 800;
  letter-spacing: 0.2px;
`;

export const Sub = styled.p`
  margin:0 0 20px;
  color:#9aa1a9;
`;

export const Row = styled.div`
  display:flex; gap:10px; flex-wrap:wrap;
`;

export const Btn = styled.button`
  ${buttonBase}
  border:0; border-radius: ${radius.lg};
  padding:10px 14px; font-weight:700; cursor:pointer;
  background:${p=>p.$primary ? '#0d6efd' : '#30363d'};
  color:#fff;
  &:hover { filter: brightness(0.95); }
`;
