// src/consent/AgeGateModal.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import { TERMS_VERSION, ensureConsentId, logAgeGateAccept, logTermsAccept, setLocalAgeOk, setLocalTermsOk } from './consentClient';

const Backdrop = styled.div`
  position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,0.72);z-index:1500;padding:16px;
`;

const Modal = styled.div`
  width:100%;max-width:540px;
  background:radial-gradient(140% 180% at 0% 0%,#b91c1c 0%,#020617 38%,#020617 100%);
  border-radius:16px;
  border:1px solid rgba(148,163,184,0.45);
  box-shadow:0 24px 70px rgba(0,0,0,0.85);
  padding:22px 22px 18px;
  color:#f9fafb;
  box-sizing:border-box;
`;

const HeaderRow = styled.div`
  display:flex;align-items:center;gap:12px;margin-bottom:10px;
`;

const Badge18 = styled.span`
  display:inline-flex;align-items:center;justify-content:center;
  padding:4px 10px;border-radius:999px;
  border:1px solid rgba(248,250,252,0.35);
  font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;
  color:#f9fafb;background:rgba(15,23,42,0.55);
`;

const Title = styled.h3`
  margin:0;font-weight:800;color:#f9fafb;font-size:1.15rem;line-height:1.25;
`;

const Text = styled.p`
  margin:8px 0 14px;color:#e5e7eb;line-height:1.5;font-size:0.92rem;
  a{color:#f9fafb;text-decoration:underline;}
`;

const CheckboxRow = styled.label`
  display:flex;align-items:flex-start;gap:10px;margin:10px 0 8px;
  input{margin-top:3px;transform:scale(1.2);}
  span{color:#e5e7eb;font-size:0.9rem;line-height:1.4;}
`;

const Small = styled.small`
  display:block;color:#9ca3af;font-size:0.78rem;margin-top:4px;
`;

const ButtonRow = styled.div`
  display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:18px;
`;

const Button = styled.button`
  border:0;border-radius:999px;padding:9px 16px;cursor:pointer;
  font-weight:700;font-size:0.88rem;
  background:${p=>p.variant==='primary'?'#ef4444':'#020617'};
  color:${p=>p.variant==='primary'?'#ffffff':'#e5e7eb'};
  border:${p=>p.variant==='primary'?'none':'1px solid #4b5563'};
  opacity:${p=>p.disabled?0.6:1};
  pointer-events:${p=>p.disabled?'none':'auto'};
  transition:background .16s ease,transform .06s ease,box-shadow .16s ease,border-color .16s ease;
  &:hover{background:${p=>p.variant==='primary'?'#f97316':'#111827'};box-shadow:${p=>p.variant==='primary'?'0 10px 32px rgba(0,0,0,0.65)':'none'};border-color:${p=>p.variant==='primary'?'none':'#6b7280'};}
  &:active{transform:translateY(1px);}
`;

const AgeGateModal = ({ onAccepted }) => {
  const [checked,setChecked] = useState(false);
  const [busy,setBusy] = useState(false);

  const handleContinue = async () => {
    if (!checked || busy) return;
    setBusy(true);
    try {
      ensureConsentId();
      await logAgeGateAccept();
      await logTermsAccept();
      setLocalAgeOk();
      setLocalTermsOk();
      onAccepted && onAccepted();
    } catch (_) {
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
        <HeaderRow>
          <Badge18>18+ Solo adultos</Badge18>
          <Title id="agegate-title">Contenido solo para mayores de 18 años</Title>
        </HeaderRow>
        <Text>
          SharemeChat ofrece videochat 1 a 1 con modelos adultos. Para continuar, confirma que tienes al menos 18 años y que aceptas nuestros Términos y Condiciones (versión <b>{TERMS_VERSION}</b>) y la Política de Privacidad.
        </Text>
        <CheckboxRow>
          <input id="agegate-check" type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />
          <span>Confirmo que tengo 18 años o más y que acepto los Términos y Condiciones y la Política de Privacidad de SharemeChat.</span>
        </CheckboxRow>
        <Small>Registraremos esta aceptación de forma anónima para cumplir con la normativa aplicable sobre contenidos para adultos.</Small>
        <ButtonRow>
          <Button type="button" onClick={()=>window.history.back()} disabled={busy}>Salir</Button>
          <Button type="button" variant="primary" onClick={handleContinue} disabled={!checked || busy}>{busy ? 'Guardando…' : 'Soy mayor de 18 y acepto'}</Button>
        </ButtonRow>
      </Modal>
    </Backdrop>
  );
};

export default AgeGateModal;
