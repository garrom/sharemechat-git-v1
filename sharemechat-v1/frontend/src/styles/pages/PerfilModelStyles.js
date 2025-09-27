// src/styles/pages/PerfilModelStyles.js
import styled from 'styled-components';
import { radius } from '../core/tokens';

export const Video = styled.video`
  max-width: 100%;
  max-height: 300px;
  display: block;
  border-radius: ${radius.lg};
`;
