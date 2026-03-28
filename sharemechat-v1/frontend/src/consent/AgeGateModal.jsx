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
  --agegate-safe-bottom: 118px;

  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: rgba(10, 8, 7, 0.42);
  z-index: 1500;
  padding: 14px 14px var(--agegate-safe-bottom);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 640px) {
    --agegate-safe-bottom: 132px;
    padding: 12px 12px var(--agegate-safe-bottom);
  }
`;

const Modal = styled.div`
  width: 100%;
  max-width: 592px;
  max-height: calc(100vh - 28px - var(--agegate-safe-bottom));
  margin: 0 auto auto;
  padding: 16px 16px 16px;
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: #f5eee8;
  border-radius: 18px;
  border: 1px solid rgba(190, 172, 157, 0.18);
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.34);
  background:
    radial-gradient(circle at top left, rgba(122, 72, 58, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(28, 22, 20, 0.96) 0%, rgba(17, 13, 13, 0.97) 100%);

  @media (max-width: 640px) {
    max-height: calc(100vh - 24px - var(--agegate-safe-bottom));
    padding: 14px 14px 14px;
    border-radius: 16px;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
`;

const HeaderCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const Badge18 = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  min-width: 54px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(191, 156, 129, 0.22);
  background: rgba(93, 57, 45, 0.32);
  color: rgba(247, 235, 226, 0.9);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Title = styled.h3`
  margin: 0;
  color: #faf4ee;
  font-size: 1.08rem;
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.02em;

  @media (max-width: 640px) {
    font-size: 0.98rem;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  max-width: 500px;
  color: rgba(232, 221, 213, 0.78);
  font-size: 0.75rem;
  line-height: 1.34;
`;

const WarningPanel = styled.div`
  margin: 0 0 8px;
  padding: 8px 9px;
  border-radius: 14px;
  border: 1px solid rgba(173, 140, 119, 0.16);
  background: rgba(73, 49, 42, 0.24);
`;

const WarningTitle = styled.p`
  margin: 0 0 3px;
  color: rgba(244, 226, 212, 0.92);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
`;

const WarningText = styled.p`
  margin: 0;
  color: rgba(228, 211, 198, 0.78);
  font-size: 0.72rem;
  line-height: 1.28;
`;

const Section = styled.div`
  margin: 0 0 8px;
`;

const SectionTitle = styled.p`
  margin: 0 0 5px;
  color: #f3ebe4;
  font-size: 0.73rem;
  font-weight: 600;
`;

const RuleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RuleLine = styled.div`
  position: relative;
  padding-left: 12px;
  color: rgba(230, 221, 214, 0.82);
  font-size: 0.73rem;
  line-height: 1.28;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 7px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: rgba(184, 136, 105, 0.62);
  }
`;

const ReportBox = styled.div`
  margin: 0 0 8px;
  padding: 7px 0 0;
  border-top: 1px solid rgba(171, 153, 139, 0.1);
`;

const ReportText = styled.p`
  margin: 0;
  color: rgba(224, 214, 207, 0.72);
  font-size: 0.72rem;
  line-height: 1.28;

  a {
    color: #f6ede5;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

const LegalLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 0 0 8px;
`;

const LegalLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(176, 157, 144, 0.16);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(233, 223, 216, 0.82);
  text-decoration: none;
  font-size: 0.68rem;
  font-weight: 500;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.06s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.045);
    border-color: rgba(201, 173, 154, 0.24);
  }

  &:active {
    transform: translateY(1px);
  }
`;

const AcknowledgeToggle = styled.button`
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 8px 9px;
  border-radius: 14px;
  border: 1px solid ${p => (p.$active ? 'rgba(202, 167, 142, 0.34)' : 'rgba(171, 153, 139, 0.14)')};
  background: ${p => (p.$active ? 'rgba(97, 60, 49, 0.26)' : 'rgba(255, 255, 255, 0.025)')};
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.06s ease, box-shadow 0.16s ease;

  &:hover {
    border-color: rgba(202, 167, 142, 0.26);
    background: rgba(255, 255, 255, 0.04);
  }

  &:active {
    transform: translateY(1px);
  }
`;

const AcknowledgeIndicator = styled.span`
  position: relative;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 999px;
  border: 1px solid ${p => (p.$active ? 'rgba(226, 201, 181, 0.48)' : 'rgba(176, 157, 144, 0.28)')};
  background: ${p => (p.$active ? 'linear-gradient(180deg, rgba(184, 134, 110, 0.9) 0%, rgba(118, 75, 62, 0.92) 100%)' : 'rgba(255, 255, 255, 0.03)')};
  box-shadow: ${p => (p.$active ? '0 0 0 3px rgba(149, 94, 76, 0.1)' : 'none')};

  &::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 3px;
    width: 4px;
    height: 8px;
    border-right: 2px solid rgba(255, 248, 241, 0.96);
    border-bottom: 2px solid rgba(255, 248, 241, 0.96);
    transform: rotate(45deg);
    opacity: ${p => (p.$active ? 1 : 0)};
    transition: opacity 0.14s ease;
  }
`;

const AcknowledgeText = styled.div`
  color: rgba(236, 227, 220, 0.86);
  font-size: 0.73rem;
  line-height: 1.28;

  a {
    color: #f6ede5;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

const Small = styled.small`
  display: block;
  margin-top: 5px;
  color: rgba(184, 170, 160, 0.64);
  font-size: 0.66rem;
  line-height: 1.24;
`;

const ErrorText = styled.p`
  margin: 5px 0 0;
  color: #efc4b3;
  font-size: 0.71rem;
  line-height: 1.24;
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;

  @media (max-width: 640px) {
    flex-direction: column-reverse;
  }
`;

const Button = styled.button`
  min-width: ${p => (p.variant === 'primary' ? '212px' : '112px')};
  padding: 9px 14px;
  border: 1px solid ${p => (p.variant === 'primary' ? 'rgba(197, 165, 142, 0.24)' : 'rgba(176, 157, 144, 0.14)')};
  border-radius: 999px;
  cursor: pointer;
  opacity: ${p => (p.disabled ? 0.56 : 1)};
  pointer-events: ${p => (p.disabled ? 'none' : 'auto')};
  font-size: 0.8rem;
  font-weight: 600;
  color: ${p => (p.variant === 'primary' ? '#fbf3eb' : 'rgba(234, 223, 214, 0.86)')};
  background: ${p => (p.variant === 'primary'
    ? 'linear-gradient(135deg, rgba(126, 79, 64, 0.98) 0%, rgba(166, 120, 95, 0.98) 100%)'
    : 'rgba(255, 255, 255, 0.03)')};
  transition: background 0.16s ease, transform 0.06s ease, box-shadow 0.16s ease, border-color 0.16s ease;

  &:hover {
    background: ${p => (p.variant === 'primary'
      ? 'linear-gradient(135deg, rgba(141, 90, 73, 0.98) 0%, rgba(183, 136, 108, 0.98) 100%)'
      : 'rgba(255, 255, 255, 0.05)')};
    box-shadow: ${p => (p.variant === 'primary' ? '0 10px 24px rgba(114, 73, 57, 0.2)' : 'none')};
    border-color: ${p => (p.variant === 'primary' ? 'rgba(209, 180, 158, 0.3)' : 'rgba(201, 173, 154, 0.22)')};
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

  const toggleChecked = () => {
    if (busy) return;
    setChecked(prev => !prev);
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
          <RuleBlock>
            <RuleLine>{i18n.t('consent.ageGate.conditions.age')}</RuleLine>
            <RuleLine>{i18n.t('consent.ageGate.conditions.noMinorAccess')}</RuleLine>
            <RuleLine>{i18n.t('consent.ageGate.conditions.cameraAdults')}</RuleLine>
            <RuleLine>{i18n.t('consent.ageGate.conditions.enforcement')}</RuleLine>
          </RuleBlock>
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

        <AcknowledgeToggle
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={i18n.t('consent.ageGate.actions.accept')}
          $active={checked}
          onClick={toggleChecked}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              toggleChecked();
            }
          }}
        >
          <AcknowledgeIndicator aria-hidden="true" $active={checked} />
          <AcknowledgeText>
            {i18n.t('consent.ageGate.checkbox.prefix')}{' '}
            <a href="/legal?tab=terms" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {i18n.t('consent.ageGate.checkbox.terms')}
            </a>{' '}
            {i18n.t('consent.ageGate.checkbox.and')}{' '}
            <a href="/legal?tab=privacy" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {i18n.t('consent.ageGate.checkbox.privacy')}
            </a>{' '}
            {i18n.t('consent.ageGate.checkbox.suffix')}
          </AcknowledgeText>
        </AcknowledgeToggle>

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