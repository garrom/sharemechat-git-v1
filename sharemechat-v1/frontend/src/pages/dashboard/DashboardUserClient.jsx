// src/pages/dashboard/DashboardUserClient.jsx
import React, { useState, useEffect, useRef } from 'react';
import i18n from '../../i18n';
import styled from 'styled-components';
import NavbarClient from '../../components/navbar/NavbarClient';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import { useAppModals } from '../../components/useAppModals';
import { useCallUi } from '../../components/CallUiContext';
import { ensureClientKycApproved } from '../../utils/clientKycGate';
import { checkPhysicalCamera, stopAllTracks } from '../../utils/virtualCameraGuard';
import VideoChatRandomUser from './VideoChatRandomUser';
import TrialCooldownModal from '../../components/TrialCooldownModal';
import OnboardingChecklist from '../../components/OnboardingChecklist';
import LivenessChallengeModal from '../../components/LivenessChallengeModal';
import { getLivenessStatus } from '../../api/livenessApi';
import { createNowPaymentsCheckout } from '../../api/billingApi';
import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';



import BlogContent from '../blog/BlogContent';
import { buildWsUrl, WS_PATHS } from '../../config/api';
import { apiFetch } from '../../config/http';
import { loadWebRtcPeerConfig } from '../../realtime/webrtcConfig';
import { getApiErrorMessage } from '../../utils/apiErrors';

const DashboardContentShell = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
`;

const EmailVerificationBanner = styled.aside`
  width: 100%;
  max-width: 430px;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(214, 174, 92, 0.34);
  background: rgba(255, 248, 232, 0.97);
  box-shadow: 0 10px 24px rgba(18, 24, 38, 0.08);
  backdrop-filter: blur(10px);

  @media (max-width: 768px) {
    padding: 9px 10px;
    border-radius: 12px;
    gap: 10px;
    align-items: stretch;
    flex-direction: column;
  }
`;

const EmailVerificationBannerText = styled.div`
  min-width: 0;
  display: grid;
  gap: 2px;
`;

const EmailVerificationBannerTitle = styled.div`
  font-size: 12px;
  line-height: 1.3;
  font-weight: 700;
  color: #7a4b00;
`;

const EmailVerificationBannerBody = styled.div`
  font-size: 11px;
  line-height: 1.4;
  color: rgba(122, 75, 0, 0.86);
`;

const EmailVerificationBannerButton = styled.button`
  flex-shrink: 0;
  align-self: center;
  padding: 7px 11px;
  border-radius: 999px;
  border: 1px solid rgba(214, 174, 92, 0.52);
  background: rgba(255, 255, 255, 0.72);
  color: #7a4b00;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.92);
    border-color: rgba(214, 174, 92, 0.74);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.72;
    cursor: default;
  }

  @media (max-width: 768px) {
    align-self: flex-start;
  }
`;

const DashboardUserClient = () => {
  const history = useHistory();
  const { alert, openPurchaseModal, openReportAbuseModal } = useAppModals();
  const { setInCall } = useCallUi();

  const t = (key, options) => i18n.t(key, options);

  const [userName, setUserName] = useState('Usuario');
  const [user, setUser] = useState(null);

  // Estado de streaming trial
  const [cameraActive, setCameraActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('');
  const [activeTab, setActiveTab] = useState('videochat');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [loadingFirstPayment, setLoadingFirstPayment] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [webrtcPeerConfig, setWebrtcPeerConfig] = useState(null);
  const [webrtcConfigReady, setWebrtcConfigReady] = useState(false);

  // Modal de cooldown (sin más trials)
  const [showTrialCooldownModal, setShowTrialCooldownModal] = useState(false);
  const [trialRemainingMs, setTrialRemainingMs] = useState(null);

  // ADR-050 Fase B: modal de liveness challenge. Se abre antes del
  // startMatch cuando no hay pass vigente, o al recibir close code 4031.
  const [livenessModalOpen, setLivenessModalOpen] = useState(false);

  // Report (Trial): modelo actual (para reportar sin bloquear)
  const [currentModelId, setCurrentModelId] = useState(null);
  const currentModelIdRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideoWrapRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const stopAllRef = useRef(() => {});


  // ======= Responsive (móvil) =======
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ======= Carga de usuario (COOKIE AUTH) =======
  useEffect(() => {
    let active = true;

    loadWebRtcPeerConfig()
      .then((config) => {
        if (!active) return;
        setWebrtcPeerConfig(config);
        setWebrtcConfigReady(true);
      })
      .catch((err) => {
        console.error('[WEBRTC][config][TrialUser] load failed', err);
        if (!active) return;
        setWebrtcPeerConfig(null);
        setWebrtcConfigReady(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (res.status === 401) {
          history.push('/');
          return;
        }

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || t('dashboardUserClient.errors.loadUser'));
        }

        const data = await res.json();
        setUser(data);
        setUserName(data.nickname || data.name || data.email || t('dashboardUserClient.user.defaultName'));
      } catch (e) {
        console.error('Error cargando usuario USER:', e);
        history.push('/');
      }
    })();
  }, [history]);

  // Mantener ref viva del modelo actual
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // ======= Unión de streams a los <video> =======
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    } else if (localVideoRef.current && !cameraActive) {
      localVideoRef.current.srcObject = null;
    }
  }, [cameraActive, remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    } else if (remoteVideoRef.current && !remoteStream) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // === Sincronizar flag global inCall (solo RANDOM trial, sin calling) ===
  useEffect(() => {
    const hayRandom = !!remoteStream;
    setInCall(hayRandom);

    return () => {
      setInCall(false);
    };
  }, [remoteStream, setInCall]);

  // ======= Helpers =======
  const clearPing = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const closeSocket = () => {
    try {
      if (socketRef.current) socketRef.current.close();
    } catch {
      /* noop */
    }
    socketRef.current = null;
    clearPing();
  };

  const toggleFullscreen = (el) => {
    if (!el) return;
    const d = document;
    const isFs =
      d.fullscreenElement ||
      d.webkitFullscreenElement ||
      d.mozFullScreenElement ||
      d.msFullscreenElement;

    if (!isFs) {
      const req =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen;
      try {
        req && req.call(el);
      } catch {
        /* noop */
      }
    } else {
      const exit =
        d.exitFullscreen ||
        d.webkitExitFullscreen ||
        d.mozCancelFullScreen ||
        d.msExitFullscreen;
      try {
        exit && exit.call(d);
      } catch {
        /* noop */
      }
    }
  };

  // ======= Cámara local =======
  const handleActivateCamera = async () => {
    setError('');
    setStatusText('');
    // Gate Age Verification (sub-frente Didit cliente, 2026-06-20). Si el
    // user no tiene client_kyc_status=APPROVED, ensureClientKycApproved
    // guarda return path en sessionStorage y redirige a /client-kyc;
    // abortamos ANTES de pedir cámara al navegador para no asustar al
    // usuario con el popup de permisos solo para luego rechazarlo.
    if (!ensureClientKycApproved(user, history, '/dashboard-user-client')) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Anti-fraude camara Fase A (2026-07-13): bloquear virtual cameras
      // conocidas (OBS, ManyCam, Snap, etc.) tambien en trial cliente para
      // consistencia con DashboardClient y DashboardModel.
      const cameraCheck = await checkPhysicalCamera(stream);
      if (!cameraCheck.allowed) {
        console.warn(
          `[USER_TRACE_MEDIA] role=user action=activateCamera guard=blocked reason=${cameraCheck.reason} label=${cameraCheck.deviceLabel || 'unknown'} rule=${cameraCheck.matchedRule || 'none'}`
        );
        stopAllTracks(stream);
        localStreamRef.current = null;
        setCameraActive(false);
        const dev = cameraCheck.deviceLabel;
        const message = cameraCheck.reason === 'no-device-id'
          ? t('common.media.virtualCameraBlocked.unknownDevice')
          : (dev
              ? t('common.media.virtualCameraBlocked.message', { device: dev })
              : t('common.media.virtualCameraBlocked.genericMessage'));
        await alert({
          title: t('common.media.virtualCameraBlocked.title'),
          message: `${message}\n\n${t('common.media.virtualCameraBlocked.guidance')}`,
          variant: 'danger',
          size: 'sm',
        });
        return;
      }

      localStreamRef.current = stream;
      setCameraActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error al activar la cámara (USER):', err);
      setError(t('dashboardUserClient.errors.cameraActivate'));
      setCameraActive(false);
      localStreamRef.current = null;
    }
  };

  // ======= STOP / limpieza completa =======
  const stopAll = () => {
    setSearching(false);
    setStatusText('');
    setError('');

    clearPing();

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        /* noop */
      }
      peerRef.current = null;
    }

    if (remoteStream) {
      try {
        remoteStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      setRemoteStream(null);
    }

    closeSocket();

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      localStreamRef.current = null;
    }

    setCameraActive(false);
    setCurrentModelId(null);
  };

  useEffect(() => {
    stopAllRef.current = stopAll;
  }, [stopAll]);

  useEffect(() => {
    const handleAuthLogout = () => {
      stopAllRef.current();
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
      stopAllRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleProfile = () => {
    history.push('/perfil-client');
  };


  const handleLogout = async () => {
    stopAll();
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/');
  };

  const handleGoVideochat = () => {
    stopAll();
    setActiveTab('videochat');
  };

  const handleGoFavorites = async () => {
    await openPurchaseModal({ context: 'user-favorites' });
  };

  const handleGoBlog = () => {
    stopAll();
    setActiveTab('blog');
  };

  const handleResendEmailVerification = async () => {
    setError('');
    setStatusText('');
    setResendingVerification(true);
    try {
      const response = await apiFetch('/email-verification/resend', { method: 'POST' });
      const message = typeof response === 'string'
        ? response
        : (response?.message || t('dashboardUserClient.emailVerification.resendSuccess'));
      setStatusText(message);
      await alert({
        title: t('dashboardUserClient.actions.goPremium'),
        message,
        variant: 'success',
        size: 'sm',
      });
    } catch (e) {
      const message = getApiErrorMessage(e, t('dashboardUserClient.emailVerification.resendError'));
      setError(message);
      await alert({
        title: t('dashboardUserClient.common.errorTitle'),
        message,
        variant: 'danger',
        size: 'sm',
      });
    } finally {
      setResendingVerification(false);
    }
  };

  // ======= Primer pago -> hacerme CLIENT (COOKIE AUTH) =======
  const handleFirstPayment = async () => {
    setError('');
    setStatusText('');

    if (!ensureClientKycApproved(user, history, '/dashboard-user-client')) return;

    if (!user?.emailVerifiedAt) {
      const message = t('dashboardUserClient.emailVerification.premiumRequired');
      setError(message);
      await alert({
        title: t('dashboardUserClient.actions.goPremium'),
        message,
        variant: 'warning',
        size: 'sm',
      });
      return;
    }

    const result = await openPurchaseModal({ context: 'first-payment-user' });
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;

    // ADR-051 Fase 4: crea checkout en NOWPayments y redirige al hosted
    // page. El backend detecta firstPayment por rol USER y promueve
    // USER->CLIENT en creditPackWithBonus cuando llegue el webhook.
    // El usuario vuelve a /checkout/success y desde ahi vuelve al
    // dashboard con rol ya CLIENT.
    setLoadingFirstPayment(true);
    try {
      const { invoiceUrl } = await createNowPaymentsCheckout(pack.id);
      if (!invoiceUrl) throw new Error('missing_invoice_url');
      window.location.href = invoiceUrl;
    } catch (e) {
      const code = e?.data?.code || '';
      const msgErr = code === 'PSP_UNAVAILABLE'
        ? t('checkout.errors.pspUnavailable')
        : getApiErrorMessage(e, t('dashboardUserClient.errors.firstPayment'));
      setError(msgErr);
      await alert({ title: t('dashboardUserClient.common.errorTitle'), message: msgErr, variant: 'danger', size: 'sm' });
      setLoadingFirstPayment(false);
    }
  };

  // ======= WebSocket + WebRTC (trial) =======
  const handleStartMatch = async () => {
    setError('');
    setStatusText('');
    setShowTrialCooldownModal(false);

    if (!webrtcConfigReady || !Array.isArray(webrtcPeerConfig?.iceServers) || webrtcPeerConfig.iceServers.length === 0) {
      console.error('[WEBRTC][config][TrialUser] unavailable for random match');
      setError(t('dashboardUserClient.errors.webrtc'));
      return;
    }

    if (!cameraActive || !localStreamRef.current) {
      setError(t('dashboardUserClient.errors.activateCameraFirst'));
      return;
    }

    // ADR-050 Fase B: gate liveness antes de conectar WS. Si el backend
    // tiene liveness.enabled=false, status devuelve hasCurrentPass=true
    // como fallback y el modal ni se abre. Si esta enabled y no hay pass,
    // abrimos modal; onSuccess reintenta handleStartMatch.
    try {
      const status = await getLivenessStatus();
      if (!status || !status.hasCurrentPass) {
        setLivenessModalOpen(true);
        return;
      }
    } catch {
      // Fail-open frontend: si /status falla, seguimos. El guard WS
      // 4031 aun bloqueara si el backend exige pass.
    }

    // WS por cookie-auth: NO token en querystring
    closeSocket();
    setSearching(true);

    const wsUrl = buildWsUrl(WS_PATHS.match);
    console.log('[USER][WS] ->', wsUrl);

    const s = new WebSocket(wsUrl);
    socketRef.current = s;

    s.onopen = () => {
      console.log('[USER][WS] OPEN');

      clearPing();
      pingIntervalRef.current = setInterval(() => {
        try {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        } catch {
          /* noop */
        }
      }, 30000);

      const lang = String(user?.lang || user?.language || navigator.language || 'es')
        .toLowerCase()
        .split('-')[0];
      const country = String(user?.country || 'ES').toUpperCase();
      s.send(JSON.stringify({ type: 'set-role', role: 'client', lang, country }));

      s.send(JSON.stringify({ type: 'start-match' }));
    };

    s.onerror = (e) => {
      console.error('[USER][WS] ERROR', e);
      setSearching(false);
    };

    s.onclose = (event) => {
      console.log('[USER][WS] CLOSE code=', event && event.code, 'reason=', event && event.reason);
      clearPing();
      setSearching(false);
      // ADR-050 Fase B: close code 4031 LIVENESS_REQUIRED. El backend
      // rechaza el matching si el user no tiene pass vigente. Abrimos el
      // modal; onSuccess reintenta handleStartMatch.
      if (event && event.code === 4031) {
        setLivenessModalOpen(true);
        return;
      }
      // Backend close-code 4030 CLIENT_KYC_REQUIRED (sub-frente Didit
      // cliente, 2026-06-20). Defensa en profundidad: si el gate frontend
      // se saltó (race, manipulación) el backend cierra el WS aquí.
      if (event && event.code === 4030) {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem('client_kyc_return_url', '/dashboard-user-client');
          }
        } catch { /* noop */ }
        history.push('/client-kyc?return=' + encodeURIComponent('/dashboard-user-client'));
      }
    };

    s.onmessage = async (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === 'match') {
        console.log('[USER][WS] match=', data);

        const mid =
          Number(data?.peerUserId) ||
          Number(data?.modelUserId) ||
          Number(data?.peerId) ||
          null;

        setCurrentModelId(Number.isFinite(mid) && mid > 0 ? mid : null);

        try {
          if (peerRef.current) peerRef.current.destroy();
        } catch {
          /* noop */
        }
        peerRef.current = null;

        try {
          if (remoteStream) remoteStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* noop */
        }
        setRemoteStream(null);

        const peer = new Peer({
          initiator: true,
          trickle: true,
          stream: localStreamRef.current,
          config: webrtcPeerConfig,
        });

        peer.on('signal', (signal) => {
          if (signal?.type === 'candidate' && signal?.candidate?.candidate === '') return;
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'signal', signal }));
          }
        });

        peer.on('stream', (stream) => {
          console.log('[USER][Peer] remote stream recibido');
          setRemoteStream(stream);
          setSearching(false);
          setStatusText('');
        });

        peer.on('error', (err) => {
          console.error('[USER][Peer] error:', err);
          setError(t('dashboardUserClient.errors.webrtc'));
          setSearching(false);
        });

        peerRef.current = peer;
        return;
      }

      if (data.type === 'signal' && peerRef.current) {
        peerRef.current.signal(data.signal);
        return;
      }

      if (data.type === 'no-model-available') {
        console.log('[USER][WS] no-model-available');
        setStatusText(t('dashboardUserClient.status.noModelsAvailable'));
        setSearching(false);
        return;
      }

      if (data.type === 'trial-unavailable') {
        console.log('[USER][WS] trial-unavailable', data);

        setSearching(false);
        setStatusText(t('dashboardUserClient.status.trialUnavailable'));

        setTrialRemainingMs(typeof data.remainingMs === 'number' ? data.remainingMs : null);
        setShowTrialCooldownModal(true);

        closeSocket();
        return;
      }

      if (data.type === 'peer-disconnected') {
        console.log('[USER][WS] peer-disconnected', data);
        const reason = data.reason || '';
        setError('');

        try {
          if (peerRef.current) peerRef.current.destroy();
        } catch {
          /* noop */
        }
        peerRef.current = null;

        try {
          if (remoteStream) remoteStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* noop */
        }
        setRemoteStream(null);
        setSearching(false);
        setCurrentModelId(null);

        if (reason === 'trial-ended') {
          setStatusText(t('dashboardUserClient.status.trialEnded'));
          try {
            await openPurchaseModal({ context: 'trial-ended' });
          } catch {
            /* noop */
          }
        } else if (reason === 'cooldown') {
          setStatusText(t('dashboardUserClient.status.cooldown'));
        } else {
          setStatusText(t('dashboardUserClient.status.connectionClosed'));
        }

        return;
      }

      // ADR-050 fix rematcheo (2026-07-15): auto-cut por moderacion o admin kill.
      // Backend saco al usuario de las waiting queues y limpio su role. Trial
      // user tambien recibe este mensaje. Desactivamos flujo silenciosamente
      // sin mensaje al usuario (decision operador 2026-07-15).
      if (data.type === 'admin-kicked') {
        console.log('[USER][WS] admin-kicked', data);
        try {
          if (peerRef.current) peerRef.current.destroy();
        } catch { /* noop */ }
        peerRef.current = null;
        try {
          if (remoteStream) remoteStream.getTracks().forEach((t) => t.stop());
        } catch { /* noop */ }
        setRemoteStream(null);
        setSearching(false);
        setCurrentModelId(null);
        setError('');
        setStatusText('');
        return;
      }
    };
  };

  // ======= NEXT =======
  const handleNext = () => {
    setError('');
    setStatusText('');

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError(t('dashboardUserClient.errors.noServerConnection'));
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'next' }));
    } catch (e) {
      console.error('[USER] Error enviando NEXT:', e);
      setError(t('dashboardUserClient.errors.next'));
      return;
    }

    try {
      if (peerRef.current) peerRef.current.destroy();
    } catch {
      /* noop */
    }
    peerRef.current = null;

    try {
      if (remoteStream) remoteStream.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    setRemoteStream(null);
    setSearching(true);
    setStatusText(t('dashboardUserClient.status.searchingNewModel'));
    setCurrentModelId(null);
  };

  // ======= REPORT (TRIAL): solo reportar, sin bloquear =======
  const handleReportPeer = async () => {
    const id = Number(currentModelIdRef.current);
    if (!Number.isFinite(id) || id <= 0) {
      await alert({
        title: t('dashboardUserClient.report.title'),
        message: t('dashboardUserClient.report.modelNotIdentified'),
        variant: 'warning',
        size: 'sm',
      });
      return;
    }

    const displayName = t('dashboardUserClient.report.displayName');

    const report = await openReportAbuseModal({ displayName });
    if (!report?.confirmed) return;

    try {
      await apiFetch('/reports/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: id,
          streamRecordId: null,
          reportType: report.reportType || 'ABUSE',
          description: report.description || '',
          alsoBlock: false,
        }),
      });

      try {
        handleNext();
      } catch {
        stopAll();
      }

      await alert({
        title: t('dashboardUserClient.report.sentTitle'),
        message: t('dashboardUserClient.report.sentMessage'),
        variant: 'success',
        size: 'sm',
      });
    } catch (e) {
      await alert({
        title: t('dashboardUserClient.common.errorTitle'),
        message: e?.message || t('dashboardUserClient.report.sendError'),
        variant: 'danger',
        size: 'sm',
      });
    }
  };

  const displayName = userName || t('dashboardUserClient.user.defaultName');
  return (
    <StyledContainer>
      <GlobalBlack />

      {/* ========= INICIO NAVBAR  ======== */}
      <NavbarClient
        activeTab={activeTab}
        displayName={displayName}
        balanceTextDesktop={null}
        balanceTextMobile={null}
        avatarUrl={null}
        showBottomNav={true}
        onBrandClick={(e) => e.preventDefault()}
        onGoVideochat={handleGoVideochat}
        onGoFavorites={handleGoFavorites}
        onGoBlog={handleGoBlog}
        profileDisabled={true}
        onBuy={handleFirstPayment}
        onLogout={handleLogout}
        buyLabel={t('dashboardUserClient.actions.goPremium')}
        showLocaleSwitcher={true}
        showBalance={false}
        showAvatar={true}
        videochatDisabled={false}
        favoritesDisabled={true}
        blogDisabled={true}
        buyDisabled={loadingFirstPayment}
      />
      {/* ========= FIN NAVBAR  ======== */}

      <DashboardContentShell>
        {/* ADR-049 Subpasada 2F: widget de onboarding para guiar al
            cliente por los 2 pasos que faltan (KYC edad + primer pago)
            hasta acceso pleno. Se auto-oculta cuando ambos pasos estan
            completos o cuando el usuario lo dismissa. Solo vive aqui
            (DashboardUserClient); al promocionar a role=CLIENT el
            usuario pasa a DashboardClient donde el widget no existe. */}
        <OnboardingChecklist onLoadBalance={handleFirstPayment} />
        <StyledMainContent data-tab={activeTab}>
          {activeTab === 'videochat' && (
            <VideoChatRandomUser
              isMobile={isMobile}
              cameraActive={cameraActive}
              remoteStream={remoteStream}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              searching={searching}
              stopAll={stopAll}
              handleStartMatch={handleStartMatch}
              handleNext={handleNext}
              toggleFullscreen={toggleFullscreen}
              remoteVideoWrapRef={remoteVideoWrapRef}
              handleActivateCamera={handleActivateCamera}
              statusText={statusText}
              error={error}
              openPurchaseModal={openPurchaseModal}
              handleReportPeer={handleReportPeer}
              emailNoticeSlot={!user?.emailVerifiedAt ? (
                <EmailVerificationBanner aria-live="polite" role="status">
                  <EmailVerificationBannerText>
                    <EmailVerificationBannerTitle>
                      {t('dashboardUserClient.emailVerification.noticeTitle')}
                    </EmailVerificationBannerTitle>
                    <EmailVerificationBannerBody>
                      {t('dashboardUserClient.emailVerification.noticeBody')}
                    </EmailVerificationBannerBody>
                  </EmailVerificationBannerText>
                  <EmailVerificationBannerButton
                    type="button"
                    onClick={handleResendEmailVerification}
                    disabled={resendingVerification}
                  >
                    {resendingVerification
                      ? t('dashboardUserClient.emailVerification.resending')
                      : t('dashboardUserClient.emailVerification.resend')}
                  </EmailVerificationBannerButton>
                </EmailVerificationBanner>
              ) : null}
            />
          )}

          {activeTab === 'blog' && (
            <div style={{flex:1,minWidth:0,minHeight:0}}>
              <BlogContent mode="private" />
            </div>
          )}
        </StyledMainContent>
      </DashboardContentShell>

      <TrialCooldownModal
        open={showTrialCooldownModal}
        remainingMs={trialRemainingMs}
        onClose={() => setShowTrialCooldownModal(false)}
        onPurchase={async () => {
          setShowTrialCooldownModal(false);
          try {
            await openPurchaseModal({ context: 'trial-exhausted' });
          } catch {
            /* noop */
          }
        }}
      />

      <LivenessChallengeModal
        open={livenessModalOpen}
        localStream={localStreamRef.current}
        onSuccess={() => {
          setLivenessModalOpen(false);
          // Tras pass, reintentar el flujo desde el principio. El proximo
          // getLivenessStatus devolvera hasCurrentPass=true.
          handleStartMatch();
        }}
        onCancel={() => setLivenessModalOpen(false)}
      />
    </StyledContainer>
  );
};

export default DashboardUserClient;
