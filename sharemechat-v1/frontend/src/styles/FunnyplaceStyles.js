//FunnyplaceStyles.js
import styled from 'styled-components';
import { bp, colors, radius, space, shadow } from './core/tokens';
import { buttonBase } from './core/mixins';

export const Wrap = styled.div`
  display: grid;
  gap: ${space.md};
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${space.md};
`;

export const Avatar = styled.img.attrs(() => ({
  width: 40,
  height: 40,
}))`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #e9ecef;
`;

export const AvatarFallback = styled.div`
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #e9ecef;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: #6c757d; font-weight: 700;
`;

export const Title = styled.div`
  font-weight: 600;
  font-size: 1rem;
`;

export const Spacer = styled.div`
  margin-left: auto;
`;

export const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

export const Button = styled.button`
  ${buttonBase}
  padding: 6px 10px;
  border: none;
  border-radius: ${radius.md};
  cursor: pointer;
  background: #0d6efd;
  color: ${colors.white};
  font-weight: 600;
  &:disabled { opacity: .7; cursor: not-allowed; }
`;

export const Status = styled.div`
  color: ${({ $error, $muted }) =>
    $error ? '#dc3545' : $muted ? '#6c757d' : colors.text};
  font-size: 0.95rem;
`;

export const VideoNote = styled.div`
  color: #6c757d;
  font-size: 0.9rem;
  a { color: #0d6efd; text-decoration: underline; }
`;

export const VideoBox = styled.div`
  width: 100%;
  background: black;
  border-radius: 12px;
  border: 1px solid #222;
  box-shadow: ${shadow.card};
  overflow: hidden;

  /* Mantener aspecto y evitar saltos en carga */
  aspect-ratio: 16 / 9;

  @media (max-width: ${bp.md}) {
    border-radius: 10px;
  }
`;

export const VideoEl = styled.video`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  background: black;
`;
