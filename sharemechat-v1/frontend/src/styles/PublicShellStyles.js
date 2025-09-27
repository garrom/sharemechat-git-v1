import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from './core/tokens';
import { buttonBase } from './core/mixins';

export const Center = styled.div`
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: ${colors.bg};
  padding: ${space.lg};
  text-align: center;
`;

export const Card = styled.div`
  width: 100%;
  max-width: 560px;
  background: ${colors.white};
  border: 1px solid ${colors.borderSoft};
  border-radius: ${radius.lg};
  box-shadow: ${shadow.card};
  padding: ${space.xl};
  @media (max-width: ${bp.md}) { padding: ${space.lg}; }
`;

export const Title = styled.h1`
  margin: 0 0 ${space.sm};
  font-size: clamp(1.5rem, 2.5vw, 2rem);
  font-weight: 700;
  color: ${({ $danger }) => ($danger ? '#dc3545' : colors.text)};
`;

export const Subtitle = styled.p`
  margin: 0 0 ${space.lg};
  color: ${colors.textMuted};
`;

export const ButtonPrimary = styled.button`
  ${buttonBase}
  padding: 10px 16px;
  background: #007bff;
  color: ${colors.white};
  border: none;
  border-radius: ${radius.md};
  &:hover { filter: brightness(0.95); }
`;
