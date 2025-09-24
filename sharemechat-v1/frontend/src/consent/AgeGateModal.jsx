// src/consent/AgeGateModal.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import { TERMS_VERSION, ensureConsentId, logAgeGateAccept, logTermsAccept, setLocalAgeOk, setLocalTermsOk } from './consentClient';

const Backdrop = styled.div`
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55); z-index: 1000; padding: 16px;
`;

const Modal = styled.div`
  width: 100%; max-width: 520px; background: #fff; border-radius: 12px; box-shadow: 0 10px 28px rgba(0,0,0,0.18);
  padding: 20px;
`;

const Title = styled.h3`
  margin: 0 0 12px; font-weight: 700; color: #212529;
`;

const Text = styled.p`
  margin: 0 0 12px; color: #495057; line-height: 1.5;
`;

const CheckboxRow = styled.label`
  display: flex; align-items: center; gap: 10px; margin: 12px 0;
  input { transform: scale(1.2); }
  span { color: #212529; }
`;

const ButtonRow = styled.div`
  display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;
`;

const Button = styled.button`
  border: 0; border-radius: 8px; padding: 10px 14px; cursor: pointer;
  font-weight: 600;
  background: ${p => p.variant === 'primary' ? '#0d6efd' : '#e9ecef'};
  color: ${p => p.variant === 'primary' ? '#fff' : '#212529'};
  opacity: ${p => p.disabled ? 0.65 : 1};
  pointer-events: ${p => p.disabled ? 'none' : 'auto'};
`;

const Small = styled.small`
  display: block; color: #6c757d;
`;

const AgeGateModal = ({ onAccepted }) => {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    if (!checked || busy) return;
    setBusy(true);
    try {
      ensureConsentId();
      // Registra evidencia en backend
      await logAgeGateAccept();
      await logTermsAccept();
      // Flags locales para no re-pedir hasta cambio de versión
      setLocalAgeOk();
      setLocalTermsOk();
      onAccepted && onAccepted();
    } catch (_) {
      // Incluso si falla el beacon, mantenemos UX (pero lo ideal es que no falle)
      setLocalAgeOk();
      setLocalTermsOk();
      onAccepted && onAccepted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop role="dialog" aria-modal="true" aria-labelledby="agegate-title">
      <Modal>
        <Title id="agegate-title">Contenido solo para mayores de 18</Title>
        <Text>
          Para continuar, confirma que eres mayor de edad y que aceptas los Términos y Condiciones (versión <b>{TERMS_VERSION}</b>) y la Política de Privacidad.
        </Text>
        <CheckboxRow>
          <input
            id="agegate-check"
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
          />
          <span>Confirmo que tengo 18+ y acepto los Términos y Condiciones.</span>
        </CheckboxRow>
        <Small>
          Al pulsar “Entrar” se registrará tu aceptación (evento anónimo) para fines de cumplimiento.
        </Small>
        <ButtonRow>
          <Button onClick={() => window.history.back()} disabled={busy}>Salir</Button>
          <Button variant="primary" onClick={handleContinue} disabled={!checked || busy}>
            {busy ? 'Guardando…' : 'Entrar'}
          </Button>
        </ButtonRow>
      </Modal>
    </Backdrop>
  );
};

export default AgeGateModal;
