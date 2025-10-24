// src/styles/subpages/PerfilClientModelStyle.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from '../core/tokens';
import { inputBase, buttonBase } from '../core/mixins';

export const PageWrap = styled.div`
  max-width: 720px;
  margin: ${space.xl} auto;
  /* Añadimos padding-bottom generoso para dar aire en la parte baja */
  padding: 0 ${space.lg} calc(${space.xl} * 2);

  @media (max-width: ${bp.md}) {
    margin: ${space.lg} auto;
    padding: 0 ${space.md} ${space.xl};
  }
`;


export const Title = styled.h2`
  margin: 0 0 ${space.lg};
  font-weight: 600;
`;

export const Message = styled.p`
  margin: ${space.sm} 0;
  color: ${({ type }) =>
    type === 'error' ? colors.error : type === 'ok' ? colors.ok : colors.text};
  ${({ $muted }) => $muted && `
    margin: 0;
    color: ${colors.textMuted};
  `}
`;

export const Form = styled.form`
  display: grid;
  gap: ${space.md};
`;
export const FormRow = styled.div`
  display: grid;
  gap: ${space.xs};
`;
export const Label = styled.label`
  font-size: 0.95rem;
`;
export const Input = styled.input`
  ${inputBase}
`;
export const Textarea = styled.textarea`
  ${inputBase}
  resize: vertical;
  min-height: 110px;
`;

export const ButtonPrimary = styled.button`
  ${buttonBase}
  background: ${colors.success};
  color: ${colors.white};
  &:hover { background: ${colors.successHover}; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;
export const ButtonDangerOutline = styled.button`
  ${buttonBase}
  border: 1px solid ${colors.danger};
  background: ${colors.white};
  color: ${colors.danger};
  &:hover { background: #fff5f5; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;
export const ButtonRow = styled.div`
  display: flex;
  gap: ${space.sm};
  align-items: center;
  flex-wrap: wrap;
`;

export const FileInput = styled.input` display: none; `;
export const FileLabel = styled.label`
  ${buttonBase}
  border: 1px solid ${colors.border};
  background: ${colors.white};
  &:hover { background: #fafafa; }
`;

export const Hr = styled.hr`
  margin: ${space.xl} 0;
  border: 0;
  border-top: 1px solid ${colors.borderSoft};
`;

export const SectionCard = styled.section`
  border: 1px solid ${colors.borderSoft};
  border-radius: ${radius.lg};
  padding: ${space.lg};
  box-shadow: ${shadow.card};
  background: ${colors.white};
`;

export const SectionTitle = styled.h3`
  margin: 0 0 ${space.md};
  font-weight: 600;
`;

export const FileName = styled.div`
  margin-top: 6px;
  a { color: inherit; text-decoration: underline; }
`;

export const Photo = styled.img`
  max-width: 220px;
  width: 100%;
  height: auto;
  border-radius: ${radius.lg};
  display: block;
`;

export const Hint = styled.p`
  margin-top: ${space.sm};
  color: ${colors.textMuted};
  font-size: 0.95rem;
`;

export const BackButton = styled.button`
  ${buttonBase}
  border: 1px solid ${colors.white};
  background: transparent;
  color: ${colors.white};
  margin-left: ${space.sm};
  &:hover { background: ${colors.primaryHover}; }
  @media (max-width: ${bp.md}) { margin-left: 0; }
`;

export const PhotoBlock = styled.div`
  margin-bottom: ${space.md};
`;