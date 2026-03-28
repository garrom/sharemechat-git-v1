// src/consent/AgeGateModal.jsx
import React, { useState } from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import {
  TERMS_VERSION,
  ensureConsentId,
  logAgeGateAccept,
  logTermsAccept,
  setLocalAgeOk,
  setLocalTermsOk
} from './consentClient';

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: rgba(0, 0, 0, 0.74);
  z-index: 1500;
  padding: 20px 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const Modal = styled.div`
  margin: auto 0;
  width: 100%;
  max-width: 620px;
  max-height: calc(100vh - 40px);
  padding: 24px 24px 20px;
  box-sizing: border-box;
  overflow-y: auto;
  color: #f8fafc;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.985) 0%, rgba(2, 6, 23, 0.985) 100%);

  @media (max-width: 640px) {
    max-height: calc(100vh - 24px);
    margin: 0;
    padding: 20px 16px 16px;
    border-radius: 20px;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
`;

const HeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`;

const Badge18 = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  min-width: 66px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.28);
  color: #fff7ed;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Title = styled.h3`
  margin: 0;
  color: #f9fafb;
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.02em;

  @media (max-width: 640px) {
    font-size: 1.26rem;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  max-width: 500px;
  color: #cbd5e1;
  font-size: 0.95rem;
  line-height: 1.55;
`;

const WarningPanel = styled.div`
  margin: 0 0 18px;
  padding: 14px 15px;
  border-radius: 18px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.16);
`;

const WarningTitle = styled.p`
  margin: 0 0 7px;
  color: #fee2e2;
  font-size: 0.88rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  line-height: 1.3;
  text-transform: uppercase;
`;

const WarningText = styled.p`
  margin: 0;
  color: #fecaca;
  font-size: 0.91rem;
  line-height: 1.55;
`;

const Section = styled.div`
  margin: 0 0 18px;
`;

const SectionTitle = styled.p`
  margin: 0 0 10px;
  color: #f8fafc;
  font-size: 0.95rem;
  font-weight: 700;
`;

const RuleList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
`;

const RuleItem = styled.li`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  color: #e5e7eb;
  font-size: 0.93rem;
  line-height: 1.5;

  &::before {
    content: '';
    flex: 0 0 7px;
    width: 7px;
    height: 7px;
    margin-top: 8px;
    border-radius: 999px;
    background: #fb7185;
  }
`;

const ReportBox = styled.div`
  margin: 0 0 18px;
  padding: 12px 0 0;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
`;

const ReportText = styled.p`
  margin: 0;
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1.55;

  a {
    color: #f8fafc;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

const LegalLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 16px;
`;

const LegalLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.42);
  color: #dbe4f0;
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 600;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.06s ease;

  &:hover {
    background: rgba(30, 41, 59, 0.78);
    border-color: rgba(148, 163, 184, 0.42);
  }

  &:active {
    transform: translateY(1px);
  }
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0;
  padding: 14px 15px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.52);

  input {
    margin-top: 4px;
    transform: scale(1.2);
  }

  span {
    color: #e5e7eb;
    font-size: 0.92rem;
    line-height: 1.55;
  }

  a {
    color: #ffffff;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

const Small = styled.small`
  display: block;
  margin-top: 10px;
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.5;
`;

const ErrorText = styled.p`
  margin: 10px 0 0;
  color: #fecaca;
  font-size: 0.84rem;
  line-height: 1.4;
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;

  @media (max-width: 640px) {
    flex-direction: column-reverse;
  }
`;

const Button = styled.button`
  min-width: ${p => (p.variant === 'primary' ? '250px' : '140px')};
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  opacity: ${p => (p.disabled ? 0.6 : 1)};
  pointer-events: ${p => (p.disabled ? 'none' : 'auto')};
  font-size: 0.92rem;
  font-weight: 800;
  color: ${p => (p.variant === 'primary' ? '#ffffff' : '#e5e7eb')};
  background: ${p => (p.variant === 'primary'
    ? 'linear-gradient(135deg,#ef4444 0%,#f97316 100%)'
    : 'rgba(2, 6, 23, 0.85)')};
  border: ${p => (p.variant === 'primary' ? 'none' : '1px solid #4b5563')};
  transition: background 0.16s ease, transform 0.06s ease, box-shadow 0.16s ease, border-color 0.16s ease;

  &:hover {
    background: ${p => (p.variant === 'primary'
      ? 'linear-gradient(135deg,#f97316 0%,#fb7185 100%)'
      : '#111827')};
    box-shadow: ${p => (p.variant === 'primary' ? '0 12px 34px rgba(249,115,22,0.26)' : 'none')};
    border-color: ${p => (p.variant === 'primary' ? 'none' : '#6b7280')};
  }

  &:active {
    transform: translateY(1px);
  }

  @media (max-width: 640px) {
    width: 100%;
    min-width: 0;
  }
`;

const AgeGateModal = ({ onAccepted }) => {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError('');
    try {
      ensureConsentId();
      const ageLogged = await logAgeGateAccept();
      if (!ageLogged) {
        throw new Error(i18n.t('consent.ageGate.errors.recordFailed'));
      }
      await logTermsAccept();
      setLocalAgeOk();
      setLocalTermsOk();
      if (onAccepted) onAccepted();
    } catch (e) {
      setError(e?.message || i18n.t('consent.ageGate.errors.recordFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop role="dialog" aria-modal="true" aria-labelledby="agegate-title">
      <Modal>
        <HeaderRow>
          <HeaderCopy>
            <Badge18>{i18n.t('consent.ageGate.badge')}</Badge18>
            <Title id="agegate-title">{i18n.t('consent.ageGate.title')}</Title>
            <Subtitle>{i18n.t('consent.ageGate.subtitle')}</Subtitle>
          </HeaderCopy>
        </HeaderRow>

        <WarningPanel>
          <WarningTitle>{i18n.t('consent.ageGate.zeroTolerance.title')}</WarningTitle>
          <WarningText>{i18n.t('consent.ageGate.zeroTolerance.body')}</WarningText>
        </WarningPanel>

        <Section>
          <SectionTitle>{i18n.t('consent.ageGate.conditionsTitle')}</SectionTitle>
          <RuleList>
            <RuleItem>{i18n.t('consent.ageGate.conditions.age')}</RuleItem>
            <RuleItem>{i18n.t('consent.ageGate.conditions.noMinorAccess')}</RuleItem>
            <RuleItem>{i18n.t('consent.ageGate.conditions.cameraAdults')}</RuleItem>
            <RuleItem>{i18n.t('consent.ageGate.conditions.enforcement')}</RuleItem>
          </RuleList>
        </Section>

        <ReportBox>
          <ReportText>
            {i18n.t('consent.ageGate.report.prefix')}{' '}
            <a href="mailto:contact@sharemechat.com">{i18n.t('consent.ageGate.report.email')}</a>
            {i18n.t('consent.ageGate.report.suffix')}
          </ReportText>
        </ReportBox>

        <LegalLinks>
          <LegalLink href="/legal?tab=terms" target="_blank" rel="noreferrer">
            {i18n.t('consent.ageGate.links.terms')}
          </LegalLink>
          <LegalLink href="/legal?tab=privacy" target="_blank" rel="noreferrer">
            {i18n.t('consent.ageGate.links.privacy')}
          </LegalLink>
          <LegalLink href="/legal?tab=cookies" target="_blank" rel="noreferrer">
            {i18n.t('consent.ageGate.links.cookies')}
          </LegalLink>
        </LegalLinks>

        <CheckboxRow>
          <input
            id="agegate-check"
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            {i18n.t('consent.ageGate.checkbox.prefix')}{' '}
            <a href="/legal?tab=terms" target="_blank" rel="noreferrer">
              {i18n.t('consent.ageGate.checkbox.terms')}
            </a>{' '}
            {i18n.t('consent.ageGate.checkbox.and')}{' '}
            <a href="/legal?tab=privacy" target="_blank" rel="noreferrer">
              {i18n.t('consent.ageGate.checkbox.privacy')}
            </a>{' '}
            {i18n.t('consent.ageGate.checkbox.suffix')}
          </span>
        </CheckboxRow>

        <Small>{i18n.t('consent.ageGate.auditNote', { version: TERMS_VERSION })}</Small>
        {error && <ErrorText role="alert">{error}</ErrorText>}

        <ButtonRow>
          <Button type="button" onClick={() => window.history.back()} disabled={busy}>
            {i18n.t('consent.ageGate.actions.exit')}
          </Button>
          <Button type="button" variant="primary" onClick={handleContinue} disabled={!checked || busy}>
            {busy ? i18n.t('consent.ageGate.actions.saving') : i18n.t('consent.ageGate.actions.accept')}
          </Button>
        </ButtonRow>
      </Modal>
    </Backdrop>
  );
};

export default AgeGateModal;
