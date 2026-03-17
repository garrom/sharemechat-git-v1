// src/pages/dashboard/DashboardUserClient.jsx
import React, { useState, useEffect, useRef } from 'react';
import i18n from '../../i18n';
import NavbarClient from '../../components/navbar/NavbarClient';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import { useAppModals } from '../../components/useAppModals';
import { useCallUi } from '../../components/CallUiContext';
import VideoChatRandomUser from './VideoChatRandomUser';
import TrialCooldownModal from '../../components/TrialCooldownModal';
import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';



import BlogContent from '../blog/BlogContent';
import { buildWsUrl, WS_PATHS } from '../../config/api';
import { apiFetch } from '../../config/http';

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

  // Modal de cooldown (sin más trials)
  const [showTrialCooldownModal, setShowTrialCooldownModal] = useState(false);
  const [trialRemainingMs, setTrialRemainingMs] = useState(null);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setCameraActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error al activar la cámara (USER):', err);
      setError(`${t('dashboardUserClient.errors.cameraActivate')} ${err.message}`);
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

  const handleGoVideochat = () => setActiveTab('videochat');

  const handleGoFavorites = async () => {
    await openPurchaseModal({ context: 'user-favorites' });
  };

  const handleGoBlog = () => setActiveTab('blog');

  // ======= Primer pago -> hacerme CLIENT (COOKIE AUTH) =======
  const handleFirstPayment = async () => {
    setError('');
    setStatusText('');

    const result = await openPurchaseModal({ context: 'first-payment-user' });
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    setLoadingFirstPayment(true);
    try {
      const res = await fetch('/api/transactions/first', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Primer pago (${pack.minutes} minutos) para activar cuenta premium`,
        }),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || t('dashboardUserClient.errors.firstPayment'));

      await alert({
        title: t('dashboardUserClient.firstPayment.success.title'),
        message: t('dashboardUserClient.firstPayment.success.message', { minutes: pack.minutes }),
        variant: 'success',
        size: 'sm',
      });

      history.push('/client');
    } catch (e) {
      const msgErr = e.message || t('dashboardUserClient.errors.firstPayment');
      setError(msgErr);
      await alert({ title: t('dashboardUserClient.common.errorTitle'), message: msgErr, variant: 'danger', size: 'sm' });
    } finally {
      setLoadingFirstPayment(false);
    }
  };

  // ======= WebSocket + WebRTC (trial) =======
  const handleStartMatch = () => {
    setError('');
    setStatusText('');
    setShowTrialCooldownModal(false);

    if (!cameraActive || !localStreamRef.current) {
      setError(t('dashboardUserClient.errors.activateCameraFirst'));
      return;
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
      setError(t('dashboardUserClient.errors.websocket'));
      setSearching(false);
    };

    s.onclose = () => {
      console.log('[USER][WS] CLOSE');
      clearPing();
      setSearching(false);
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
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject',
              },
            ],
          },
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
          setError(`${t('dashboardUserClient.errors.webrtc')} ${err.message}`);
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
        showLocaleSwitcher={false}
        showBalance={false}
        showAvatar={true}
        videochatDisabled={false}
        favoritesDisabled={true}
        blogDisabled={true}
        buyDisabled={loadingFirstPayment}
      />
      {/* ========= FIN NAVBAR  ======== */}

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
          />
        )}

        {activeTab === 'blog' && (
          <div style={{flex:1,minWidth:0,minHeight:0}}>
            <BlogContent mode="private" />
          </div>
        )}
      </StyledMainContent>

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
    </StyledContainer>
  );
};

export default DashboardUserClient;
