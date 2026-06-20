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
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  DashboardUserModelShell,
  DashboardUserModelPage,
  DashboardUserModelStack,
  DashboardHeroCard,
  DashboardHeroKicker,
  DashboardHeroTitle,
  DashboardHeroLead,
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
  DashboardInlineNotice,
  DashboardInlineNoticeText,
  DashboardLinkBox,
  DashboardCheckboxRow,
  DashboardActions,
  DashboardPrimaryButton,
  DashboardSecondaryButton,
} from '../../styles/pages-styles/DashboardUserModelStyles';

// Sub-bucket sub-frente A (2026-06-20): sesion KYC en curso (kyc_status
// intermedio o terminal sin promocion). Estos kyc_status indican que el
// modelo ya inicio una sesion Didit y aun no es terminal; el boton
// "Iniciar verificacion" debe ocultarse para evitar re-intentos.
// PENDING aqui = sesion creada en BD pero sin webhook terminal todavia
// (Didit envia "Not Started" -> "In Progress" -> "In Review" antes del
// terminal "Approved"/"Declined"). Solo APPROVED y REJECTED son terminales
// desde la vista del backend.
const KYC_SESSION_IN_PROGRESS_STATUSES = new Set(['PENDING']);

const DashboardUserModel = () => {
  const history = useHistory();
  const { user: sessionUser, loading: sessionLoading } = useSession();

  const t = (key, options) => i18n.t(key, options);

  const [userName, setUserName] = useState('');

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

  // Sub-frente A: ultima sesion KYC del user (GET /api/kyc/sessions/me/latest).
  // null = sin sesion. {id, sessionType, kycStatus, providerStatus, ...} = sesion existente.
  const [latestKycSession, setLatestKycSession] = useState(null);

  const getVerificationStatusLabel = (status) => {
    const normalizedStatus = String(status || 'PENDING').toUpperCase();
    if (normalizedStatus === 'APPROVED') return t('dashboardUserModel.info.statuses.approved');
    if (normalizedStatus === 'REJECTED') return t('dashboardUserModel.info.statuses.rejected');
    return t('dashboardUserModel.info.statuses.pending');
  };

  const getKycModeLabel = (mode) => {
    const normalizedMode = String(mode || '').toUpperCase();
    if (normalizedMode === 'DIDIT') return t('dashboardUserModel.kyc.modes.didit');
    if (normalizedMode === 'MANUAL') return t('dashboardUserModel.kyc.modes.manual');
    return normalizedMode || t('dashboardUserModel.kyc.notAvailable');
  };

  // Bucket UI: discrimina cuatro estados visibles del modelo en onboarding.
  // - 'pre-verif': verificationStatus NULL/PENDING + sin sesion KYC en curso -> boton iniciar.
  // - 'kyc-in-progress': sesion KYC con kyc_status intermedio (PENDING tras crear) -> sin boton.
  // - 'awaiting-admin': verificationStatus APPROVED + role USER -> esperando promocion admin.
  // - 'promoted': role MODEL -> ya es modelo activo, useEffect redirige a /model.
  const getModelStateBucket = (verificationStatus, role, latestSession) => {
    const r = String(role || '').toUpperCase();
    const v = String(verificationStatus || '').toUpperCase();
    if (r === 'MODEL') return 'promoted';
    if (v === 'APPROVED') return 'awaiting-admin';
    if (latestSession
        && String(latestSession.sessionType || '').toUpperCase() === 'MODEL'
        && KYC_SESSION_IN_PROGRESS_STATUSES.has(String(latestSession.kycStatus || '').toUpperCase())) {
      return 'kyc-in-progress';
    }
    return 'pre-verif';
  };

  const stateBucket = getModelStateBucket(sessionUser?.verificationStatus, sessionUser?.role, latestKycSession);
  const isAwaitingAdmin = stateBucket === 'awaiting-admin';
  const isKycInProgress = stateBucket === 'kyc-in-progress';

  // Redirect cuando el usuario ya es MODEL. El dashboard de modelo activo
  // vive en /model (App.jsx:171, RequireRole role="MODEL").
  useEffect(() => {
    if (sessionLoading) return;
    if (stateBucket === 'promoted') {
      history.push('/model');
    }
  }, [stateBucket, sessionLoading, history]);

  useEffect(() => {
    if (sessionLoading) return;

    if (!sessionUser) {
      history.push('/');
      return;
    }

    setUserName(sessionUser.nickname || sessionUser.name || sessionUser.email || t('dashboardUserModel.user.defaultName'));
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
        const entry = await apiFetch('/kyc/config/product/model-onboarding');
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

  // Sub-frente A: fetch latest kyc session al mount. Si 204 -> latestKycSession=null.
  // Si 200 -> rellena estado y getModelStateBucket podra evaluar 'kyc-in-progress'.
  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) return;

    let cancelled = false;

    const loadLatestKyc = async () => {
      try {
        const entry = await apiFetch('/kyc/sessions/me/latest');
        if (cancelled) return;
        setLatestKycSession(entry || null);
      } catch (e) {
        if (cancelled) return;
        setLatestKycSession(null);
      }
    };

    loadLatestKyc();

    return () => {
      cancelled = true;
    };
  }, [sessionUser, sessionLoading]);

  const handleAcceptContract = async () => {
    if (!sessionUser?.emailVerifiedAt) {
      setVerificationError(t('dashboardUserModel.emailVerification.notice'));
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
        const entry = await apiFetch('/kyc/config/product/model-onboarding');
        const mode = String(entry?.activeMode || '').toUpperCase();
        setKycMode(mode);
      } catch {
        setKycMode('');
      }
    } catch (e) {
      setContractErr(getApiErrorMessage(e, t('dashboardUserModel.contract.errors.accept')));
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
      setVerificationError(t('dashboardUserModel.emailVerification.notice'));
      return;
    }

    setRoutingKyc(true);
    setKycRouteErr('');

    try {
      const entry = await apiFetch('/kyc/config/product/model-onboarding');
      const mode = String(entry?.activeMode || '').toUpperCase();

      setKycMode(mode);

      if (mode === 'MANUAL') {
        history.push('/model-documents');
        return;
      }

      if (mode === 'DIDIT') {
        history.push('/model-kyc-didit');
        return;
      }

      setKycRouteErr(
        t('dashboardUserModel.kyc.errors.unsupportedMode', {
          mode: mode || t('dashboardUserModel.kyc.notAvailable'),
        })
      );
    } catch (e) {
      setKycRouteErr(getApiErrorMessage(e, t('dashboardUserModel.kyc.errors.load')));
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
      setVerificationMessage(
        response?.message || t('dashboardUserModel.emailVerification.resendSuccess')
      );
    } catch (e) {
      setVerificationError(
        getApiErrorMessage(e, t('dashboardUserModel.emailVerification.resendError'))
      );
    } finally {
      setResendingVerification(false);
    }
  };

  const handleRefreshAfterKyc = () => {
    // Re-fetch tanto session (via reload) como latest session. La forma mas
    // simple y robusta es recargar la pagina: re-evalua sessionUser desde
    // /api/users/me y latestKycSession desde /api/kyc/sessions/me/latest.
    window.location.reload();
  };

  const displayName = userName || t('dashboardUserModel.user.defaultName');
  const mustAcceptContract = contractAccepted === false;
  const mustVerifyEmail = !sessionUser?.emailVerifiedAt;
  const canAcceptContract = openedContract && confirmChecked && !accepting;
  const disabledNoop = () => {};
  const verificationStatus = String(sessionUser?.verificationStatus || 'PENDING').toUpperCase();

  const mainButtonLabel =
    kycMode === 'DIDIT'
      ? t('dashboardUserModel.kyc.actions.goDidit')
      : kycMode === 'MANUAL'
      ? t('dashboardUserModel.kyc.actions.uploadDocumentsManual')
      : t('dashboardUserModel.kyc.actions.updateOrUploadDocuments');

  const heroTitle = isKycInProgress
    ? t('dashboardUserModel.kycInProgress.heroTitle')
    : isAwaitingAdmin
    ? t('dashboardUserModel.awaitingAdmin.heroTitle')
    : t('dashboardUserModel.title');

  const heroLead = isKycInProgress
    ? t('dashboardUserModel.kycInProgress.heroLead')
    : isAwaitingAdmin
    ? t('dashboardUserModel.awaitingAdmin.heroLead')
    : (
        <>
          {t('dashboardUserModel.footerHint.prefix')}{' '}
          <strong>{t('dashboardUserModel.footerHint.role')}</strong>.
        </>
      );

  const kycPanelTitle = isKycInProgress
    ? t('dashboardUserModel.kycInProgress.heroTitle')
    : isAwaitingAdmin
    ? t('dashboardUserModel.awaitingAdmin.panelTitle')
    : mainButtonLabel;

  const kycPanelBody = isKycInProgress
    ? t('dashboardUserModel.kycInProgress.heroLead')
    : isAwaitingAdmin
    ? t('dashboardUserModel.awaitingAdmin.panelBody')
    : t('dashboardUserModel.info.verificationStatus', {
        status: getVerificationStatusLabel(sessionUser?.verificationStatus),
      });

  const verificationPillLabel = isAwaitingAdmin
    ? t('dashboardUserModel.awaitingAdmin.pillCompactAwaitingReview')
    : getVerificationStatusLabel(sessionUser?.verificationStatus);

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
                <DashboardHeroTitle>{heroTitle}</DashboardHeroTitle>
                <DashboardHeroLead>{heroLead}</DashboardHeroLead>

                {mustVerifyEmail && (
                  <DashboardInlineNotice>
                    <DashboardInlineNoticeText>
                      {t('dashboardUserModel.emailVerification.notice')}
                    </DashboardInlineNoticeText>
                    <DashboardSecondaryButton
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                    >
                      {resendingVerification
                        ? t('dashboardUserModel.emailVerification.resending')
                        : t('dashboardUserModel.emailVerification.resend')}
                    </DashboardSecondaryButton>
                  </DashboardInlineNotice>
                )}
                {verificationMessage && (
                  <DashboardMessage>{verificationMessage}</DashboardMessage>
                )}
                {verificationError && (
                  <DashboardMessage $type="error">{verificationError}</DashboardMessage>
                )}
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
                        disabled={contractAccepted === true}
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

                    {contractErr && (
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
                            ? t('dashboardUserModel.emailVerification.notice')
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
                    </DashboardActions>
                  </DashboardPanelBody>
                </DashboardPanel>

                <DashboardPanel>
                  <DashboardPanelHeader>
                    <DashboardPanelEyebrow>
                      {isAwaitingAdmin
                        ? t('dashboardUserModel.awaitingAdmin.panelEyebrow')
                        : t('dashboardUserModel.kyc.activeMethod').replace(':', '')}
                    </DashboardPanelEyebrow>
                    <DashboardPanelTitle>{kycPanelTitle}</DashboardPanelTitle>
                    <DashboardPanelSubtitle>{kycPanelBody}</DashboardPanelSubtitle>
                  </DashboardPanelHeader>

                  <DashboardPanelBody>
                    <DashboardMessage>
                      {t('dashboardUserModel.info.verificationStatus', { status: '' }).replace(': ', '')}{' '}
                      <DashboardStatusPill $status={isAwaitingAdmin ? 'APPROVED' : verificationStatus}>
                        {verificationPillLabel}
                      </DashboardStatusPill>
                    </DashboardMessage>

                    {kycMode && !isAwaitingAdmin && !isKycInProgress && (
                      <DashboardMessage>
                        {t('dashboardUserModel.kyc.activeMethod')} <strong>{getKycModeLabel(kycMode)}</strong>
                      </DashboardMessage>
                    )}

                    {kycRouteErr && (
                      <DashboardMessage $type="error">
                        {kycRouteErr}
                      </DashboardMessage>
                    )}

                    {!isAwaitingAdmin && !isKycInProgress && (
                      <DashboardActions>
                        <DashboardPrimaryButton
                          type="button"
                          onClick={handleUploadDocs}
                          disabled={mustVerifyEmail || mustAcceptContract || routingKyc}
                          title={
                            mustVerifyEmail
                              ? t('dashboardUserModel.emailVerification.notice')
                              : mustAcceptContract
                              ? t('dashboardUserModel.contract.mustAcceptFirst')
                              : undefined
                          }
                        >
                          {routingKyc ? t('dashboardUserModel.kyc.actions.opening') : mainButtonLabel}
                        </DashboardPrimaryButton>

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
                    )}

                    {isKycInProgress && (
                      <DashboardActions>
                        <DashboardSecondaryButton
                          type="button"
                          onClick={handleRefreshAfterKyc}
                        >
                          {t('dashboardUserModel.kycInProgress.refreshAction')}
                        </DashboardSecondaryButton>
                      </DashboardActions>
                    )}
                  </DashboardPanelBody>
                </DashboardPanel>
              </DashboardGrid>
            </DashboardUserModelStack>
          </DashboardUserModelPage>
        </DashboardUserModelShell>
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardUserModel;
