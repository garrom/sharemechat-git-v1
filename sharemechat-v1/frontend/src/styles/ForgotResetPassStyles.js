import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from './core/tokens';
import { inputBase, buttonBase, focusRing } from './core/mixins';

export const Container = styled.div`
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: ${colors.bg};
  padding: ${space.lg};
`;

export const Card = styled.div`
  width: 100%;
  max-width: 440px;
  background: ${colors.white};
  border: 1px solid ${colors.borderSoft};
  border-radius: ${radius.lg};
  box-shadow: ${shadow.card};
  padding: ${space.xl};
  @media (max-width: ${bp.md}) { padding: ${space.lg}; }
`;

export const Title = styled.h2`
  margin: 0 0 ${space.md};
  font-weight: 600;
  text-align: center;
`;

export const Paragraph = styled.p`
  margin: 0 0 ${space.md};
  color: ${colors.text};
`;

export const StatusOk = styled.div`
  color: ${colors.ok};
  margin-bottom: ${space.sm};
`;

export const StatusErr = styled.div`
  color: ${colors.error};
  margin-bottom: ${space.sm};
`;

export const Form = styled.form`
  display: grid;
  gap: ${space.sm};
`;

export const Input = styled.input`
  ${inputBase}
  font-size: 1rem;
`;

export const ButtonPrimary = styled.button`
  ${buttonBase}
  width: 100%;
  padding: 10px;
  background: ${colors.success};
  color: ${colors.white};
  font-size: 1rem;
  &:hover { background: ${colors.successHover}; }
  &:disabled { opacity: .7; cursor: not-allowed; }
`;

export const ButtonSecondary = styled.button`
  ${buttonBase}
  width: 100%;
  margin-top: ${space.sm};
  padding: 10px;
  background: #f8f9fa;
  color: ${colors.text};
  border: 1px solid ${colors.border};
  font-size: 1rem;
  &:hover { background: #f2f3f5; }
`;

export const LinkA = styled.a`
  color: #007bff;
  text-decoration: underline;
  &:focus { ${focusRing} }
`;
