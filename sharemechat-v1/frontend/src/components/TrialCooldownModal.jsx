// src/components/TrialCooldownModal.jsx
import React from 'react';
import {
  Backdrop,
  Wrapper,
  Dialog,
  Header,
  Title,
  CloseBtn,
  Body,
  Footer,
  ModalBtn,
} from '../styles/ModalStyles';

/**
 * Convierte milisegundos en texto humano:
 *  - "1 h 20 min"
 *  - "3 días"
 *  - "15 min"
 */
function formatRemaining(remainingMs) {
  if (remainingMs == null) return 'unos minutos';

  const totalSec = Math.max(0, Math.round(remainingMs / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  if (days >= 1) {
    if (hours >= 1) {
      return `${days} día${days > 1 ? 's' : ''} y ${hours} hora${hours > 1 ? 's' : ''}`;
    }
    return `${days} día${days > 1 ? 's' : ''}`;
  }

  if (hours >= 1) {
    if (minutes >= 1) {
      return `${hours} h ${minutes} min`;
    }
    return `${hours} hora${hours > 1 ? 's' : ''}`;
  }

  // Menos de 1h → minutos (mínimo 1)
  const mins = Math.max(minutes, 1);
  return `${mins} min`;
}

/**
 * Modal que se muestra cuando el USER ha agotado sus trials.
 *
 * Props:
 *  - open          : boolean → si se muestra o no
 *  - remainingMs   : número (ms hasta el siguiente trial) o null
 *  - onClose       : () => void
 *  - onPurchase    : () => void   // aquí llamas a openPurchaseModal(...)
 */
export default function TrialCooldownModal({
  open,
  remainingMs,
  onClose,
  onPurchase,
}) {
  if (!open) return null;

  const remainingText = formatRemaining(remainingMs);

  return (
    <>
      <Backdrop onClick={onClose} />

      <Wrapper>
        <Dialog data-variant="info" $size="sm">
          <Header>
            <Title>Has agotado tus pruebas gratuitas</Title>
            <CloseBtn onClick={onClose} aria-label="Cerrar modal">
              ×
            </CloseBtn>
          </Header>

          <Body data-kind="default">
            <p style={{ marginBottom: 8 }}>
              Ya has utilizado las <strong>3 pruebas gratuitas</strong> disponibles.
            </p>
            <p style={{ marginBottom: 8 }}>
              Podrás volver a probar el videochat gratuito en{' '}
              <strong>{remainingText}</strong>.
            </p>
            <p style={{ marginTop: 12 }}>
              Si no quieres esperar, puedes hacerte <strong>Premium</strong> y
              chatear sin límite con todas las modelos.
            </p>
          </Body>

          <Footer>
            <ModalBtn onClick={onClose}>Más tarde</ModalBtn>
            <ModalBtn
              data-primary="true"
              onClick={onPurchase}
            >
              Hazme Premium
            </ModalBtn>
          </Footer>
        </Dialog>
      </Wrapper>
    </>
  );
}
