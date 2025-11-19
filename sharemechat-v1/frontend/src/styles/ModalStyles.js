// src/styles/ModalStyles.js
import styled, { keyframes, css } from 'styled-components';

/* ============================
 * Animaciones base
 * ============================ */
const fadeIn = keyframes`
  from { opacity: 0 }
  to   { opacity: 1 }
`;

const scaleIn = keyframes`
  from {
    transform: translateY(4px) scale(.98);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
`;

/* ============================
 * Backdrop a pantalla completa
 * ============================ */
export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  animation: ${fadeIn} 0.18s ease-out;
`;

/* ============================
 * Wrapper centrado
 * ============================ */
export const Wrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: grid;
  place-items: center;
  padding: 24px;
  pointer-events: none; /* solo el diálogo recibe eventos */

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

/* ============================
 * Caja principal del diálogo
 * ============================ */
export const Dialog = styled.div`
  position: relative;
  pointer-events: auto;

  width: 100%;
  max-width: ${({ $size }) => (
    $size === 'lg' ? '720px' :
    $size === 'sm' ? '360px' :
    '520px'
  )};

  background: radial-gradient(circle at top left, #151823 0, #050509 55%);
  color: #e9ecef;

  border-radius: 14px;
  border: 1px solid #242a32;
  box-shadow:
    0 18px 45px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.02);

  animation: ${scaleIn} 0.18s ease-out;

  /* Pequeña línea superior de acento por variante */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    height: 3px;
    border-radius: 14px 14px 0 0;
    background: linear-gradient(90deg, #2f81f7, #00b4d8);
    opacity: 0.0;
    pointer-events: none;
  }

  &[data-variant='success']::before {
    opacity: 1;
    background: linear-gradient(90deg, #1f6f43, #2ecc71);
  }

  &[data-variant='warning']::before {
    opacity: 1;
    background: linear-gradient(90deg, #a37b28, #f1c40f);
  }

  &[data-variant='danger']::before {
    opacity: 1;
    background: linear-gradient(90deg, #7a2f2f, #e74c3c);
  }

  &[data-variant='info']::before,
  &[data-variant='confirm']::before,
  &[data-variant='select']::before {
    opacity: 1;
    background: linear-gradient(90deg, #205295, #2f81f7);
  }

  @media (max-width: 768px) {
    max-width: 94vw;
    border-radius: 12px;
  }
`;

/* ============================
 * Header
 * ============================ */
export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 14px 18px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);

  @media (max-width: 480px) {
    padding: 12px 14px 8px;
  }
`;

export const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  flex: 1;
  color: #f8f9fa;

  @media (max-width: 480px) {
    font-size: 15px;
  }
`;

export const CloseBtn = styled.button`
  appearance: none;
  border: 0;
  background: transparent;
  color: #9aa1a9;
  cursor: pointer;

  font-size: 18px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 999px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
    transform: scale(1.03);
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid #2f81f7;
    outline-offset: 2px;
  }
`;

/* ============================
 * Body
 * ============================ */
export const Body = styled.div`
  padding: 14px 18px 16px;
  font-size: 14px;
  line-height: 1.5;
  max-height: min(60vh, 520px);
  overflow: auto;

  color: #ced4da;

  @media (max-width: 480px) {
    padding: 12px 14px 14px;
    font-size: 13px;
  }

  /* Texto centrado por defecto (MVP genérico limpio) */
  &[data-kind='default'] {
    text-align: center;
  }

  /* Lista de opciones (modo selectOptions / compras, etc.) */
  &[data-kind='choices'] {
    display: grid;
    gap: 8px;
    padding-top: 8px;

    button {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #30363d;
      background: #0a0f16;
      color: #e6edf3;
      cursor: pointer;
      text-align: left;

      font-size: 14px;
      line-height: 1.4;

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        transform 0.08s ease,
        box-shadow 0.15s ease;

      &:hover {
        background: #101622;
        border-color: #3a3f46;
        box-shadow: 0 0 0 1px rgba(47, 129, 247, 0.28);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
        box-shadow: none;
      }
    }
  }
  /* Payout: sin scroll interno, nunca */
  &[data-kind='payout'] {
    max-height: none;
    overflow: visible;
  }
`;

/* ============================
 * Footer (botones)
 * ============================ */
export const Footer = styled.div`
  padding: 12px 18px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);

  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    padding: 10px 14px 12px;
    justify-content: center;

    & > button {
      height: 34px;
      padding: 0 10px;
      font-size: 13px;
      flex: 1 1 auto;
      max-width: 50%;
    }
  }
`;

/* ============================
 * Botón base del modal
 * ============================ */
export const ModalBtn = styled.button`
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #30363d;
  background: #0d1117;
  color: #e6edf3;
  cursor: pointer;

  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.02em;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.08s ease;

  &:hover {
    background: #11161d;
    border-color: #3a3f46;
    box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.35);
    transform: translateY(-0.5px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: none;
  }

  &:focus-visible {
    outline: 2px solid #2f81f7;
    outline-offset: 2px;
  }

  /* Primario */
  &[data-primary='true'] {
    background: #2f81f7;
    border-color: #2f81f7;
    color: #ffffff;
    box-shadow: 0 0 0 1px rgba(47, 129, 247, 0.45);

    &:hover {
      background: #2565c9;
      border-color: #2565c9;
      box-shadow: 0 0 0 1px rgba(37, 101, 201, 0.55);
    }
  }

  /* Peligro */
  &[data-danger='true'] {
    background: #c24038;
    border-color: #c24038;
    color: #ffffff;
    box-shadow: 0 0 0 1px rgba(194, 64, 56, 0.5);

    &:hover {
      background: #a73630;
      border-color: #a73630;
      box-shadow: 0 0 0 1px rgba(167, 54, 48, 0.55);
    }
  }
`;
