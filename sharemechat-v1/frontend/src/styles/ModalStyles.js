import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0 }
  to   { opacity: 1 }
`;
const scaleIn = keyframes`
  from { transform: translateY(-8px) scale(.98); opacity:.9 }
  to   { transform: translateY(0) scale(1); opacity:1 }
`;

/* Backdrop a toda pantalla */
export const Backdrop = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,.5);
  z-index: 1000;
  animation: ${fadeIn} .16s ease-out;
`;

/* Wrapper centrado */
export const Wrapper = styled.div`
  position: fixed; inset: 0;
  z-index: 1001;
  display: grid;
  place-items: center;
  padding: 24px;
`;

/* Caja del diálogo */
export const Dialog = styled.div`
  width: 100%;
  max-width: ${p => (
    p.$size === 'lg' ? '720px' :
    p.$size === 'sm' ? '360px' : '520px'
  )};
  background: #161b22;
  color: #e6edf3;
  border: 1px solid #21262d;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,.45);
  animation: ${scaleIn} .16s ease-out;

  /* variantes por data-attr */
  &[data-variant='success'] { border-color: #1f6f43; }
  &[data-variant='warning'] { border-color: #a37b28; }
  &[data-variant='danger']  { border-color: #7a2f2f; }
  &[data-variant='info']    { border-color: #2b4b7d; }
  &[data-variant='confirm'] { border-color: #2b4b7d; }
  &[data-variant='select']  { border-color: #2b4b7d; }

  @media (max-width: 768px) {
    border-radius: 10px;
    max-width: 94vw;
    margin: 0 auto;
  }
`;

export const Header = styled.div`
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #21262d;
`;

export const Title = styled.h3`
  margin: 0; font-size: 16px; font-weight: 700; line-height: 1.2;
  flex: 1;
`;

export const CloseBtn = styled.button`
  appearance: none; border: 0; background: transparent;
  color: #9aa1a9; cursor: pointer; font-size: 18px; line-height: 1;
  padding: 4px 6px; border-radius: 6px;
  &:hover { background: #1f242c; color: #c9d1d9; }
  &:focus-visible { outline: 2px solid #2f81f7; outline-offset: 2px; }
`;

export const Body = styled.div`
  padding: 14px 16px;
  font-size: 14px; line-height: 1.5;
  max-height: min(60vh, 520px);
  overflow: auto;

  /* lista de opciones (select) */
  &[data-kind='choices'] {
    display: grid; gap: 8px;
    button {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #30363d;
      background: #0d1117;
      color: #e6edf3; cursor: pointer;
      text-align: left;
      &:hover { background: #11161d; border-color:#3a3f46; }
    }
  }
`;

export const Footer = styled.div`
  padding: 12px 16px;
  border-top: 1px solid #21262d;
  display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;

  @media (max-width: 480px) {
    /* botones algo más pequeños en móvil (#7) */
    & > button { height: 34px; padding: 0 10px; font-size: 13px; }
  }
`;

/* Botón base del modal, consistente con tus estilos */
export const ModalBtn = styled.button`
  height: 36px; padding: 0 14px;
  border-radius: 8px; border: 1px solid #30363d;
  background: #0d1117; color: #e6edf3; cursor: pointer;
  font-weight: 600;
  transition: filter .15s ease, background .15s ease, border-color .15s ease;

  &:hover { filter: brightness(1.05); background:#11161d; }

  &[data-primary='true'] {
    background: #2f81f7; color: #fff; border-color:#2f81f7;
    &:hover { filter: brightness(0.97); }
  }

  &[data-danger='true'] {
    background: #c24038; color: #fff; border-color:#c24038;
    &:hover { filter: brightness(0.97); }
  }
`;
