// src/styles/VideoChatStyles.js
import styled from 'styled-components';
import { colors, radius, space } from './core/tokens';

export const VideoContainer = styled.div`
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 */
  background: #000;
  border-radius: 12px;
  overflow: hidden;
`;

export const RemoteVideo = styled.video`
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const LocalVideo = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 10%;
  aspect-ratio: 16 / 9;
  border: 3px solid white;
  border-radius: 12px;
  overflow: hidden;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);

  video { width: 100%; height: 100%; object-fit: cover; }
`;

export const Overlay = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
  z-index: 10;
`;

export const Controls = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
  z-index: 10;
`;

export const ControlButton = styled.button`
  background: ${props => props.danger ? colors.danger : colors.primary};
  color: white;
  border: none;
  padding: ${space.md} ${space.lg};
  border-radius: ${radius.xl};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: ${space.sm};
  min-width: 140px;
  box-shadow: ${props => props.elevated ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'};

  &:hover { background: ${props => props.danger ? colors.dangerHover : colors.primaryHover}; }
  &:disabled { opacity: 0.5; }
`;