import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { apiFetch } from '../config/http';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(8, 10, 14, 0.72);
`;

const Panel = styled.div`
  width: 100%;
  max-width: 520px;
  border-radius: 18px;
  padding: 24px 22px;
  color: #f4f6f8;
  background: linear-gradient(180deg, rgba(24, 28, 34, 0.98) 0%, rgba(12, 15, 20, 0.99) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
`;

const Title = styled.h3`
  margin: 0 0 10px;
  font-size: 1.25rem;
  line-height: 1.15;
`;

const Body = styled.p`
  margin: 0 0 10px;
  color: rgba(228, 232, 236, 0.82);
  line-height: 1.45;
`;

const Note = styled.p`
  margin: 0 0 18px;
  color: rgba(194, 201, 208, 0.7);
  font-size: 0.92rem;
  line-height: 1.4;
`;

const ErrorText = styled.p`
  margin: 0 0 16px;
  color: #ffb7b7;
  line-height: 1.4;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const AcceptButton = styled.button`
  min-width: 180px;
  padding: 11px 16px;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  color: #101418;
  background: linear-gradient(135deg, #f4d7b7 0%, #dfb07d 100%);
  opacity: ${p => (p.disabled ? 0.55 : 1)};
  pointer-events: ${p => (p.disabled ? 'none' : 'auto')};
`;

const AuthenticatedConsentModal = ({ open, requiredTermsVersion, refreshSession, onResolved }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError('');
  }, [open, requiredTermsVersion]);

  if (!open) return null;

  const handleAccept = async () => {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await apiFetch('/consent/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmAdult: true,
          acceptTerms: true,
          termsVersion: requiredTermsVersion,
        }),
      });

      const refreshedUser = await refreshSession?.();
      if (!refreshedUser?.consentCompliant) {
        throw new Error(i18n.t('consent.ageGate.errors.recordFailed'));
      }

      onResolved?.(refreshedUser);
    } catch (e) {
      setError(e?.message || i18n.t('consent.ageGate.errors.recordFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop role="dialog" aria-modal="true" aria-labelledby="account-consent-title">
      <Panel>
        <Title id="account-consent-title">Confirmacion obligatoria</Title>
        <Body>
          Debes confirmar que eres mayor de edad y aceptar la version vigente de los terminos antes de usar videochat, mensajes, llamadas o favoritos.
        </Body>
        <Note>
          Version requerida: {requiredTermsVersion || 'v1'}.
        </Note>
        {error ? <ErrorText role="alert">{error}</ErrorText> : null}
        <Actions>
          <AcceptButton type="button" onClick={handleAccept} disabled={busy}>
            {busy ? 'Guardando...' : 'Aceptar y continuar'}
          </AcceptButton>
        </Actions>
      </Panel>
    </Backdrop>
  );
};

export default AuthenticatedConsentModal;
