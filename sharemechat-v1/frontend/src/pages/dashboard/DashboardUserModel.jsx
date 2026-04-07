import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';
import { useHistory } from 'react-router-dom';
import NavbarModel from '../../components/navbar/NavbarModel';
import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';
import { getApiErrorMessage, isEmailNotVerifiedError } from '../../utils/apiErrors';
import {
  DashboardUserModelShell,
  DashboardUserModelPage,
  DashboardUserModelStack,
  DashboardHeroCard,
  DashboardHeroKicker,
  DashboardHeroTitle,
  DashboardHeroLead,
  DashboardStatusRow,
  DashboardStatusCard,
  DashboardStatusLabel,
  DashboardStatusValue,
  DashboardStatusText,
  DashboardStatusPill,
  DashboardGrid,
  DashboardPanel,
  DashboardPanelHeader,
  DashboardPanelEyebrow,
  DashboardPanelTitle,
  DashboardPanelSubtitle,
  DashboardPanelBody,
  DashboardHint,
  DashboardMessage,
  DashboardLinkBox,
  DashboardCheckboxRow,
  DashboardActions,
  DashboardPrimaryButton,
  DashboardSecondaryButton,
  DashboardFooterCard,
  DashboardFooterList,
  DashboardFooterItem,
  DashboardFooterItemTitle,
  DashboardFooterItemBody,
} from '../../styles/pages-styles/DashboardUserModelStyles';

const DashboardUserModel = () => {
  const history = useHistory();
  const { user: sessionUser, loading: sessionLoading } = useSession();

  const t = (key, options) => i18n.t(key, options);

  const [userName, setUserName] = useState('');
  const [info, setInfo] = useState('');

  const [contractCurrent, setContractCurrent] = useState(null);
  const [contractAccepted, setContractAccepted] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [contractErr, setContractErr] = useState('');

  const [openedContract, setOpenedContract] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [routingKyc, setRoutingKyc] = useState(false);
  const [kycRouteErr, setKycRouteErr] = useState('');
  const [kycMode, setKycMode] = useState('');
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');

  const getVerificationStatusLabel = (status) => {
    const normalizedStatus = String(status || 'PENDING').toUpperCase();
    if (normalizedStatus === 'APPROVED') return t('dashboardUserModel.info.statuses.approved');
    if (normalizedStatus === 'REJECTED') return t('dashboardUserModel.info.statuses.rejected');
    return t('dashboardUserModel.info.statuses.pending');
  };

  const getKycModeLabel = (mode) => {
    const normalizedMode = String(mode || '').toUpperCase();
    if (normalizedMode === 'VERIFF') return t('dashboardUserModel.kyc.modes.veriff');
    if (normalizedMode === 'MANUAL') return t('dashboardUserModel.kyc.modes.manual');
    return normalizedMode || t('dashboardUserModel.kyc.notAvailable');
  };

  useEffect(() => {
    if (sessionLoading) return;

    if (!sessionUser) {
      history.push('/');
      return;
    }

    setUserName(sessionUser.nickname || sessionUser.name || sessionUser.email || t('dashboardUserModel.user.defaultName'));
    setInfo(
      t('dashboardUserModel.info.verificationStatus', {
        status: getVerificationStatusLabel(sessionUser.verificationStatus),
      })
    );
  }, [sessionUser, sessionLoading, history]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) return;

    let cancelled = false;

    const run = async () => {
      try {
        const cur = await apiFetch('/consent/model-contract/current');
        const st = await apiFetch('/consent/model-contract/status');

        if (cancelled) return;

        setContractCurrent(cur || null);
        setContractAccepted(Boolean(st?.accepted));

        if (Boolean(st?.accepted)) {
          setOpenedContract(true);
          setConfirmChecked(true);
        } else {
          setOpenedContract(false);
          setConfirmChecked(false);
        }
      } catch (e) {
        if (cancelled) return;
        setContractErr(t('dashboardUserModel.contract.errors.load'));
        setContractAccepted(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [sessionUser, sessionLoading]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) return;
    if (contractAccepted !== true) return;

    let cancelled = false;

    const loadKycMode = async () => {
      try {
        const entry = await apiFetch('/kyc/config/model-onboarding');
        if (cancelled) return;

        const mode = String(entry?.activeMode || '').toUpperCase();
        setKycMode(mode);
      } catch (e) {
        if (cancelled) return;
        setKycMode('');
      }
    };

    loadKycMode();

    return () => {
      cancelled = true;
    };
  }, [sessionUser, sessionLoading, contractAccepted]);

  const handleAcceptContract = async () => {
    if (!sessionUser?.emailVerifiedAt) {
      setVerificationError('Debes validar tu email antes de aceptar el contrato de modelo.');
      return;
    }

    setAccepting(true);
    setContractErr('');

    try {
      await apiFetch('/consent/model-contract/accept', { method: 'POST' });
      setContractAccepted(true);
      setOpenedContract(true);
      setConfirmChecked(true);

      try {
        const entry = await apiFetch('/kyc/config/model-onboarding');
        const mode = String(entry?.activeMode || '').toUpperCase();
        setKycMode(mode);
      } catch {
        setKycMode('');
      }
    } catch (e) {
      if (isEmailNotVerifiedError(e)) {
        setVerificationError('Debes validar tu email antes de aceptar el contrato de modelo.');
      } else {
        setContractErr(getApiErrorMessage(e, t('dashboardUserModel.contract.errors.accept')));
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/');
  };

  const handleUploadDocs = async () => {
    if (!sessionUser?.emailVerifiedAt) {
      setVerificationError('Debes validar tu email antes de continuar el onboarding de modelo.');
      return;
    }

    setRoutingKyc(true);
    setKycRouteErr('');

    try {
      const entry = await apiFetch('/kyc/config/model-onboarding');
      const mode = String(entry?.activeMode || '').toUpperCase();

      setKycMode(mode);

      if (mode === 'MANUAL') {
        history.push('/model-documents');
        return;
      }

      if (mode === 'VERIFF') {
        history.push('/model-kyc');
        return;
      }

      setKycRouteErr(
        t('dashboardUserModel.kyc.errors.unsupportedMode', {
          mode: mode || t('dashboardUserModel.kyc.notAvailable'),
        })
      );
    } catch (e) {
      if (isEmailNotVerifiedError(e)) {
        setVerificationError('Debes validar tu email antes de continuar el onboarding de modelo.');
      } else {
        setKycRouteErr(getApiErrorMessage(e, t('dashboardUserModel.kyc.errors.load')));
      }
    } finally {
      setRoutingKyc(false);
    }
  };

  const handleResendVerification = async () => {
    setVerificationError('');
    setVerificationMessage('');
    setResendingVerification(true);
    try {
      const response = await apiFetch('/email-verification/resend', { method: 'POST' });
      setVerificationMessage(response?.message || 'Hemos reenviado el email de validacion.');
    } catch (e) {
      setVerificationError(getApiErrorMessage(e, 'No se pudo reenviar el email de validacion.'));
    } finally {
      setResendingVerification(false);
    }
  };

  const displayName = userName || t('dashboardUserModel.user.defaultName');
  const mustAcceptContract = contractAccepted === false;
  const mustVerifyEmail = !sessionUser?.emailVerifiedAt;
  const canAcceptContract = openedContract && confirmChecked && !accepting;
  const disabledNoop = () => {};
  const verificationStatus = String(sessionUser?.verificationStatus || 'PENDING').toUpperCase();

  const mainButtonLabel =
    kycMode === 'VERIFF'
      ? t('dashboardUserModel.kyc.actions.goVeriff')
      : kycMode === 'MANUAL'
      ? t('dashboardUserModel.kyc.actions.uploadDocumentsManual')
      : t('dashboardUserModel.kyc.actions.updateOrUploadDocuments');

  if (sessionLoading) {
    return (
      <StyledContainer>
        <GlobalBlack />
        <StyledMainContent>
          <DashboardUserModelShell>
            <DashboardUserModelPage>
              <DashboardMessage>
                {t('dashboardUserModel.loading.session')}
              </DashboardMessage>
            </DashboardUserModelPage>
          </DashboardUserModelShell>
        </StyledMainContent>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <GlobalBlack />

      <NavbarModel
        activeTab="videochat"
        displayName={displayName}
        queueText={null}
        balanceTextDesktop={null}
        balanceTextMobile={null}
        avatarUrl={null}
        showBottomNav={true}
        onBrandClick={(e) => e.preventDefault()}
        onGoVideochat={disabledNoop}
        onGoFavorites={disabledNoop}
        onGoBlog={disabledNoop}
        onGoStats={disabledNoop}
        onProfile={() => {}}
        profileDisabled={true}
        onWithdraw={disabledNoop}
        onLogout={handleLogout}
        showLocaleSwitcher={true}
        showBalance={false}
        showQueue={false}
        showAvatar={true}
        videochatDisabled={true}
        favoritesDisabled={true}
        blogDisabled={true}
        statsDisabled={true}
        withdrawDisabled={true}
      />

      <StyledMainContent data-tab="onboarding">
        <DashboardUserModelShell>
          <DashboardUserModelPage>
            <DashboardUserModelStack>
              <DashboardHeroCard>
                <DashboardHeroKicker>{displayName}</DashboardHeroKicker>
                <DashboardHeroTitle>{t('dashboardUserModel.title')}</DashboardHeroTitle>
                <DashboardHeroLead>
                  {t('dashboardUserModel.footerHint.prefix')}{' '}
                  <strong>{t('dashboardUserModel.footerHint.role')}</strong>.
                </DashboardHeroLead>

                {mustVerifyEmail && (
                  <DashboardMessage $type="error">
                    Debes validar tu email antes de continuar con el onboarding de modelo.
                  </DashboardMessage>
                )}
                {verificationMessage && (
                  <DashboardMessage>{verificationMessage}</DashboardMessage>
                )}
                {verificationError && (
                  <DashboardMessage $type="error">{verificationError}</DashboardMessage>
                )}

                <DashboardStatusRow>
                  <DashboardStatusCard>
                    <DashboardStatusLabel>{t('dashboardUserModel.info.verificationStatus', { status: '' }).replace(': ', '')}</DashboardStatusLabel>
                    <DashboardStatusValue>
                      <DashboardStatusText>{getVerificationStatusLabel(sessionUser?.verificationStatus)}</DashboardStatusText>
                      <DashboardStatusPill $status={verificationStatus}>
                        {getVerificationStatusLabel(sessionUser?.verificationStatus)}
                      </DashboardStatusPill>
                    </DashboardStatusValue>
                  </DashboardStatusCard>

                  <DashboardStatusCard>
                    <DashboardStatusLabel>{t('dashboardUserModel.kyc.activeMethod').replace(':', '')}</DashboardStatusLabel>
                    <DashboardStatusValue>
                      <DashboardStatusText>
                        {kycMode ? getKycModeLabel(kycMode) : t('dashboardUserModel.kyc.notAvailable')}
                      </DashboardStatusText>
                      <DashboardStatusPill $status={contractAccepted === true ? 'APPROVED' : 'PENDING'}>
                        {contractAccepted === true
                          ? t('dashboardUserModel.contract.actions.accept')
                          : t('dashboardUserModel.contract.mustAcceptFirst')}
                      </DashboardStatusPill>
                    </DashboardStatusValue>
                  </DashboardStatusCard>
                </DashboardStatusRow>
              </DashboardHeroCard>

              <DashboardGrid>
                <DashboardPanel>
                  <DashboardPanelHeader>
                    <DashboardPanelEyebrow>{t('dashboardUserModel.contract.viewPdf')}</DashboardPanelEyebrow>
                    <DashboardPanelTitle>{t('dashboardUserModel.contract.mustAcceptMessage')}</DashboardPanelTitle>
                    <DashboardPanelSubtitle>
                      {t('dashboardUserModel.contract.checkbox')}
                    </DashboardPanelSubtitle>
                  </DashboardPanelHeader>

                  <DashboardPanelBody>
                    {contractCurrent?.url && (
                      <DashboardLinkBox>
                        <a
                          href={contractCurrent.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setOpenedContract(true)}
                        >
                          {t('dashboardUserModel.contract.viewPdf')}
                        </a>
                      </DashboardLinkBox>
                    )}

                    <DashboardCheckboxRow>
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                      />
                      <span>{t('dashboardUserModel.contract.checkbox')}</span>
                    </DashboardCheckboxRow>

                    {contractAccepted === false && (
                      <DashboardHint>
                        {t('dashboardUserModel.contract.mustAcceptMessage')}
                      </DashboardHint>
                    )}

                    {contractAccepted === true && (
                      <DashboardMessage>
                        {t('dashboardUserModel.contract.actions.accept')}
                      </DashboardMessage>
                    )}

                    {contractAccepted === null && contractErr && (
                      <DashboardMessage $type="error">
                        {contractErr}
                      </DashboardMessage>
                    )}

                    {contractErr && contractAccepted !== null && (
                      <DashboardMessage $type="error">
                        {contractErr}
                      </DashboardMessage>
                    )}

                    <DashboardActions>
                      <DashboardPrimaryButton
                        type="button"
                        onClick={handleAcceptContract}
                        disabled={mustVerifyEmail || !canAcceptContract || contractAccepted === true}
                        title={
                          accepting
                            ? t('dashboardUserModel.contract.actions.accepting')
                            : mustVerifyEmail
                            ? 'Debes validar tu email antes de aceptar el contrato'
                            : !openedContract
                            ? t('dashboardUserModel.contract.tooltips.openPdfFirst')
                            : !confirmChecked
                            ? t('dashboardUserModel.contract.tooltips.checkToContinue')
                            : t('dashboardUserModel.contract.actions.accept')
                        }
                      >
                        {accepting
                          ? t('dashboardUserModel.contract.actions.accepting')
                          : t('dashboardUserModel.contract.actions.accept')}
                      </DashboardPrimaryButton>
                      {mustVerifyEmail && (
                        <DashboardSecondaryButton
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                        >
                          {resendingVerification ? 'Reenviando...' : 'Reenviar email de validacion'}
                        </DashboardSecondaryButton>
                      )}
                    </DashboardActions>
                  </DashboardPanelBody>
                </DashboardPanel>

                <DashboardPanel>
                  <DashboardPanelHeader>
                    <DashboardPanelEyebrow>{t('dashboardUserModel.kyc.activeMethod')}</DashboardPanelEyebrow>
                    <DashboardPanelTitle>{mainButtonLabel}</DashboardPanelTitle>
                    <DashboardPanelSubtitle>
                      {info || t('dashboardUserModel.contract.mustAcceptMessage')}
                    </DashboardPanelSubtitle>
                  </DashboardPanelHeader>

                  <DashboardPanelBody>
                    {kycMode && (
                      <DashboardMessage>
                        {t('dashboardUserModel.kyc.activeMethod')} <strong>{getKycModeLabel(kycMode)}</strong>
                      </DashboardMessage>
                    )}

                    <DashboardHint>
                      {t('dashboardUserModel.footerHint.prefix')}{' '}
                      <strong>{t('dashboardUserModel.footerHint.role')}</strong>.
                    </DashboardHint>

                    {kycRouteErr && (
                      <DashboardMessage $type="error">
                        {kycRouteErr}
                      </DashboardMessage>
                    )}

                    <DashboardActions>
                      <DashboardPrimaryButton
                        type="button"
                        onClick={handleUploadDocs}
                        disabled={mustVerifyEmail || mustAcceptContract || routingKyc}
                        title={mustVerifyEmail ? 'Debes validar tu email antes de continuar' : mustAcceptContract ? t('dashboardUserModel.contract.mustAcceptFirst') : undefined}
                      >
                        {routingKyc ? t('dashboardUserModel.kyc.actions.opening') : mainButtonLabel}
                      </DashboardPrimaryButton>

                      {mustVerifyEmail && (
                        <DashboardSecondaryButton
                          type="button"
                          onClick={handleResendVerification}
                          disabled={resendingVerification}
                        >
                          {resendingVerification ? 'Reenviando...' : 'Reenviar email de validacion'}
                        </DashboardSecondaryButton>
                      )}

                      {mustAcceptContract && (
                        <DashboardSecondaryButton
                          type="button"
                          disabled
                          title={t('dashboardUserModel.contract.mustAcceptFirst')}
                        >
                          {t('dashboardUserModel.contract.mustAcceptFirst')}
                        </DashboardSecondaryButton>
                      )}
                    </DashboardActions>
                  </DashboardPanelBody>
                </DashboardPanel>
              </DashboardGrid>

              <DashboardFooterCard>
                <DashboardPanelHeader>
                  <DashboardPanelTitle>
                    {t('dashboardUserModel.footerHint.prefix')}{' '}
                    <strong>{t('dashboardUserModel.footerHint.role')}</strong>.
                  </DashboardPanelTitle>
                  <DashboardPanelSubtitle>
                    {info || t('dashboardUserModel.contract.mustAcceptMessage')}
                  </DashboardPanelSubtitle>
                </DashboardPanelHeader>

                <DashboardFooterList>
                  <DashboardFooterItem>
                    <DashboardFooterItemTitle>{t('dashboardUserModel.contract.viewPdf')}</DashboardFooterItemTitle>
                    <DashboardFooterItemBody>
                      {t('dashboardUserModel.contract.checkbox')}
                    </DashboardFooterItemBody>
                  </DashboardFooterItem>
                  <DashboardFooterItem>
                    <DashboardFooterItemTitle>{t('dashboardUserModel.kyc.activeMethod').replace(':', '')}</DashboardFooterItemTitle>
                    <DashboardFooterItemBody>
                      {kycMode ? getKycModeLabel(kycMode) : t('dashboardUserModel.kyc.notAvailable')}
                    </DashboardFooterItemBody>
                  </DashboardFooterItem>
                  <DashboardFooterItem>
                    <DashboardFooterItemTitle>{t('dashboardUserModel.info.verificationStatus', { status: '' }).replace(': ', '')}</DashboardFooterItemTitle>
                    <DashboardFooterItemBody>
                      {getVerificationStatusLabel(sessionUser?.verificationStatus)}
                    </DashboardFooterItemBody>
                  </DashboardFooterItem>
                </DashboardFooterList>
              </DashboardFooterCard>
            </DashboardUserModelStack>
          </DashboardUserModelPage>
        </DashboardUserModelShell>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardUserModel;
