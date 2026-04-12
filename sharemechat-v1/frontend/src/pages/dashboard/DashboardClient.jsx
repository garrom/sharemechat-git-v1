// DashboardClient.jsx
import React, { useState, useRef, useEffect,useLayoutEffect, useCallback } from 'react';
import i18n from '../../i18n';
import { getResolvedLocale } from '../../i18n/localeUtils';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesClientList from '../favorites/FavoritesClientList';
import { useAppModals } from '../../components/useAppModals';
import { useCallUi } from '../../components/CallUiContext';
import BlogContent from '../blog/BlogContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faVideo, faFilm, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import {
  StyledContainer,StyledIconWrapper,StyledMainContent,
  StyledLeftColumn,StyledCenter,StyledRightColumn,
  StyledLocalVideo,StyledRemoteVideo,
  StyledChatContainer,StyledNavGroup,
  StyledTopActions,StyledVideoTitle,StyledTitleAvatar,
  StyledChatDock,StyledChatList,StyledChatMessageRow,
  StyledChatBubble,StyledChatControls,StyledChatInput,
  StyledGiftsPanel,StyledGiftGrid,
  StyledGiftIcon,StyledIconBtn,StyledSelectableRow,
  StyledVideoArea,StyledSplit2,
  StyledPane,StyledThumbsGrid, StyledCenterPanel,
  StyledCenterBody,StyledChatScroller, StyledCenterVideochat,
  StyledFavoritesShell,StyledFavoritesColumns,GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';
import NavbarClient from '../../components/navbar/NavbarClient';
import {
  ButtonActivarCam,ButtonBuscarModelo,
  ButtonBuscarCliente,ButtonNext,
  ButtonStop, ButtonAddFavorite,
  ButtonLlamar,ButtonColgar,
  ButtonAceptar,ButtonRechazar,
  ButtonVolver, ButtonEnviar,
  ButtonRegalo,ButtonActivarCamMobile,
  StyledActionButton,StyledGiftToggle,NavButton
} from '../../styles/ButtonStyles';
import VideoChatRandomCliente from './VideoChatRandomCliente';
import VideoChatFavoritosCliente from './VideoChatFavoritosCliente';
import { apiFetch } from '../../config/http';
import { useSession } from '../../components/SessionProvider';
import { buildWsUrl, WS_PATHS } from '../../config/api';
import { createMatchSocketEngine } from '../../realtime/matchSocketEngine';
import { createMsgSocketEngine } from '../../realtime/msgSocketEngine';
import useActiveInteraction from '../../domain/useActiveInteraction';
import { attachMediaObserver, createIdleMediaState, createMediaStateSnapshot, resetMediaObserver } from '../../utils/mediaState';
import AuthenticatedConsentModal from '../../consent/AuthenticatedConsentModal';
import { isAdminSurface } from '../../utils/runtimeSurface';
import { canAccessBackoffice } from '../../utils/backofficeAccess';

const DashboardClient = () => {

  const {
    alert,
    confirm,
    openPurchaseModal,
    openActiveSessionGuard,
    openBlockReasonModal,
    openReportAbuseModal,
    openNextWaitModal
  } = useAppModals();
  const { inCall, setInCall } = useCallUi();
  const { user: sessionUser, updateUiLocale, refresh } = useSession();
  const {
    interaction,
    activateFavoritesChat,
    clearInteraction
  } = useActiveInteraction();
  const [cameraActive, setCameraActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [randomLocalMediaState, setRandomLocalMediaState] = useState(() => createIdleMediaState('random:idle'));
  const [randomRemoteMediaState, setRandomRemoteMediaState] = useState(() => createIdleMediaState('random:remote-idle'));
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('videochat');
  const [currentModelId, setCurrentModelId] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [saldoError, setSaldoError] = useState('');
  const [status, setStatus] = useState('');
  const [nexting, setNexting] = useState(false);
  const [favReload, setFavReload] = useState(0);
  const [selectedFav, setSelectedFav] = useState(null);
  const [gifts,setGifts]=useState([]);
  const [giftsLoaded, setGiftsLoaded] = useState(false);
  const [giftRenderReady, setGiftRenderReady] = useState(false);
  const [showGifts,setShowGifts]=useState(false);
  const [showCenterGifts,setShowCenterGifts]=useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [modelNickname, setModelNickname] = useState('Modelo');
  const [modelAvatar, setModelAvatar] = useState('');
  const [targetPeerId, setTargetPeerId] = useState(null);
  const [targetPeerName, setTargetPeerName] = useState('');
  // Modo del panel de contacto (chat o llamada)
  const [contactMode, setContactMode] = useState(null); // 'chat' | 'call' | null
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  // ====== CALLING (1-a-1) ======
  const [callCameraActive, setCallCameraActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callPeerId, setCallPeerId] = useState(null);
  const [callPeerName, setCallPeerName] = useState('');
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [callLocalMediaState, setCallLocalMediaState] = useState(() => createIdleMediaState('call:idle'));
  const [callRemoteMediaState, setCallRemoteMediaState] = useState(() => createIdleMediaState('call:remote-idle'));
  const [callError, setCallError] = useState('');
  const [callRole, setCallRole] = useState(null); // 'caller' | 'callee'
  const [callStreamRecordId, setCallStreamRecordId] = useState(null);
  const [callPeerAvatar, setCallPeerAvatar] = useState('');
  const callLocalVideoRef = useRef(null);
  const callRemoteVideoRef = useRef(null);
  const callLocalStreamRef = useRef(null);
  const callPeerRef = useRef(null);
  const callPingRef = useRef(null);
  const callRingTimeoutRef = useRef(null);
  const callRoleRef = useRef(null);
  const callPeerIdRef = useRef(null);
  const callStreamRecordIdRef = useRef(null);
  const callTargetLockedRef = useRef(false);
  const remoteVideoWrapRef = useRef(null);
  const callRemoteWrapRef  = useRef(null);
  const vcListRef = useRef(null);
  const callListRef = useRef(null);
  const chatEndRef = useRef(null);
  const callStatusRef = useRef(callStatus);
  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);

  const msgSocketRef = useRef(null);
  const centerListRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  const [wsReady, setWsReady] = useState(false);
  const [centerChatPeerId, setCenterChatPeerId] = useState(null);
  const [centerChatPeerName, setCenterChatPeerName] = useState('');
  const [centerMessages, setCenterMessages] = useState([]);
  const [centerInput, setCenterInput] = useState('');
  const [centerLoading, setCenterLoading] = useState(false);
  const msgPingRef = useRef(null);
  const msgReconnectRef = useRef(null);
  const centerSeenIdsRef = useRef(new Set());
  const meIdRef = useRef(null);
  const peerIdRef = useRef(null);
  const lastSentRef = useRef({ text: null, at: 0 });
  const matchGraceRef = useRef(false);
  const mediaReadySentRef = useRef(false);
  const randomTechMediaReadySentRef = useRef(false);
  const callTechMediaReadySentRef = useRef(false);
  const activePeerRef = useRef({ id: null, name: '' });
  const matchEngineRef = useRef(null);
  const msgEngineRef = useRef(null);
  const cameraActiveRef = useRef(false);
  const stopAllRef = useRef(() => {});
  const closeMsgSocketRef = useRef(() => {});
  const randomLocalMediaCleanupRef = useRef(() => {});
  const randomRemoteMediaCleanupRef = useRef(() => {});
  const callLocalMediaCleanupRef = useRef(() => {});
  const callRemoteMediaCleanupRef = useRef(() => {});
  const bypassProductConsent = isAdminSurface() || canAccessBackoffice(sessionUser);
  const consentRequired = !bypassProductConsent && !!sessionUser?.consentRequired;
  const consentVersion = sessionUser?.requiredTermsVersion || 'v1';
  const sensitiveEnabled = !!sessionUser && !consentRequired;

  const guardSensitiveAction = useCallback((options = {}) => {
    if (sensitiveEnabled) return false;

    const message = options.message || 'Debes aceptar el consentimiento obligatorio antes de usar esta funcionalidad.';
    if (typeof options.setError === 'function') options.setError(message);
    if (typeof options.alertUser === 'function') options.alertUser(message);
    return true;
  }, [sensitiveEnabled]);

  const resetRandomTechMediaReadySignal = useCallback(() => {
    randomTechMediaReadySentRef.current = false;
  }, []);

  const resetCallTechMediaReadySignal = useCallback(() => {
    callTechMediaReadySentRef.current = false;
  }, []);

  const sendRandomTechMediaReady = useCallback(() => {
    if (randomTechMediaReadySentRef.current) return;
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'tech-media-ready' }));
    randomTechMediaReadySentRef.current = true;
  }, []);

  const sendCallTechMediaReady = useCallback(() => {
    const streamId = Number(callStreamRecordIdRef.current);
    const withUserId = Number(callPeerIdRef.current);

    if (callTechMediaReadySentRef.current) return;
    if (msgSocketRef.current?.readyState !== WebSocket.OPEN) return;
    if (!Number.isFinite(streamId) || streamId <= 0) return;
    if (!Number.isFinite(withUserId) || withUserId <= 0) return;

    msgSocketRef.current.send(JSON.stringify({
      type: 'call:tech-media-ready',
      with: withUserId,
      streamRecordId: streamId,
    }));
    callTechMediaReadySentRef.current = true;
  }, []);


  const isEcho = (incoming) => {
    const now = Date.now();
    return (
      incoming === lastSentRef.current.text &&
      now - lastSentRef.current.at < 1500
    );
  };

  const fmtEUR = (v) =>
    new Intl.NumberFormat(getResolvedLocale(i18n), { style: 'currency', currency: 'EUR' })
      .format(Number(v || 0));

  const getGiftIcon = (gift) => {
    if (!gift) return null;

    if (gift.icon) return gift.icon;

    const lookupId = Number(gift.giftId ?? gift.id);
    const found = gifts.find(gg => Number(gg.id) === lookupId);
    return found?.icon || null;
  };


  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);


  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);


  useEffect(() => {
    const selectedConversation = Number(targetPeerId) > 0
      ? {
          peerId: Number(targetPeerId),
          displayName: targetPeerName || selectedFav?.nickname || selectedFav?.name || selectedFav?.email || null,
          avatarUrl: selectedFav?.avatarUrl || null,
          status: selectedFav?.status || null,
          invited: selectedFav?.invited || null,
        }
      : null;

    if (!selectedConversation) {
      clearInteraction();
      return;
    }

    const peerMeta = {
      userId: selectedConversation.peerId,
      displayName: selectedConversation.displayName,
      avatarUrl: selectedConversation.avatarUrl,
    };

    const favoriteRelation = {
      status: selectedConversation.status,
      invited: selectedConversation.invited,
    };

    activateFavoritesChat(peerMeta, favoriteRelation, {
      source: 'favorites'
    });

    console.log('[ActiveInteraction] synced favorites chat', {
      peerId: peerMeta.userId
    });
  }, [
    targetPeerId,
    targetPeerName,
    selectedFav?.nickname,
    selectedFav?.name,
    selectedFav?.email,
    selectedFav?.avatarUrl,
    selectedFav?.status,
    selectedFav?.invited,
    activateFavoritesChat,
    clearInteraction
  ]);


  useEffect(() => {
    console.log('[ActiveInteraction] current state', interaction);
  }, [interaction]);


  useEffect(() => {
    // Match engine (Client)
    matchEngineRef.current = createMatchSocketEngine({
      buildWsUrl,
      WS_PATHS,

      socketRef,
      pingIntervalRef,
      peerRef,
      localStreamRef: localStream,

      getRemoteStream: () => remoteStream,
      getIsMobile: () => isMobile,
      getSessionUser: () => sessionUser,

      setSearching,
      setError,
      setStatus,
      setRemoteStream,
      setMessages,
      setNexting,

      openNextWaitModal,

      role: 'client',
      initiator: true,

      cameraActiveGetter: () => cameraActiveRef.current,

      // Client: set-role básico + start-match onopen (como tu código original)
      getRolePayload: () => {
        const lang = String(sessionUser?.lang || sessionUser?.language || navigator.language || 'es').toLowerCase().split('-')[0];
        const country = String(sessionUser?.country || 'ES').toUpperCase();
        return { type: 'set-role', role: 'client', lang, country };
      },

      startMatchOnOpen: true,

      // Client: ping más agresivo en arranque
      useFastPingOnOpen: true,
      pingFastEveryMs: 5000,
      pingEveryMs: 15000,

      // Client: ICE config (sin inventar: uso EXACTO lo que ya tenías)
      peerConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },

      // Grace como en tu client
      onMatchGrace: (mobile) => {
        matchGraceRef.current = true;
        setTimeout(() => { matchGraceRef.current = false; }, mobile ? 3000 : 1500);
      },

      // Meta por rol: currentModelId
      onMatchMeta: (data) => {
        mediaReadySentRef.current = false;
        resetRandomTechMediaReadySignal();
        try {
          if (data.peerRole === 'model' && Number.isFinite(Number(data.peerUserId))) {
            setCurrentModelId(Number(data.peerUserId));
          } else {
            setCurrentModelId(null);
          }
        } catch { setCurrentModelId(null); }
      },

      // Chat (igual que tú)
      isEcho,

      onChatMessage: (data) => {
        if (!isEcho(data.message)) {
          setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
        }
      },

      // Gift (igual que tú)
      onGiftMessage: (data) => {
        const mine = Number(data.fromUserId) === Number(sessionUser?.id);

        setMessages((p) => [
          ...p,
          {
            from: mine ? 'me' : 'peer',
            text: '',
            gift: data.gift
              ? {
                  giftId: Number(data.gift.giftId ?? data.gift.id),
                  id: Number(data.gift.giftId ?? data.gift.id),
                  code: data.gift.code ?? null,
                  name: data.gift.name ?? '',
                  icon: data.gift.icon ?? null,
                  cost: data.gift.cost ?? null,
                  tier: data.gift.tier ?? null,
                  featured: data.gift.featured ?? null,
                }
              : null,
          }
        ]);

        if (mine && data.newBalance != null) {
          const nb = Number.parseFloat(String(data.newBalance));
          if (Number.isFinite(nb)) setSaldo(nb);
        }
      },

      onGiftError: async (data) => {
        if (
          typeof data?.message === 'string' &&
          data.message.toLowerCase().includes('saldo insuficiente')
        ) {
          console.log('[GIFT][random][no-balance] message=', data.message);
          await handleGiftInsufficientBalance(data.message);
        }
      },

      // No model available (tu client)
      noPeerAvailableType: 'no-model-available',
      onNoPeerAvailable: () => {
        setError('');
        setSearching(true);
      },

      // No balance (tu client)
      onNoBalance: async () => {
        setSearching(false);
        setError('');
        try { await handlePurchaseFromRandom(); } catch (e) { console.error(e); }
      },

      // Peer disconnected (tu client)
      onPeerDisconnectedPost: async (data) => {
        const reason = data.reason || '';
        resetRandomTechMediaReadySignal();

        setCurrentModelId(null);
        setRemoteStream(null);
        setMessages([]);

        if (reason === 'low-balance') {
          setStatus('');
          setSearching(false);
          try { await handlePurchaseFromRandom(); } catch (e) { console.error(e); }
          return;
        }

        setStatus(i18n.t('dashboardClient.status.searchingNewModel'));
        setSearching(true);

        try {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'start-match' }));
            socketRef.current.send(JSON.stringify({ type: 'stats' }));
          }
        } catch {}
      },
    });

    // Msg engine (Client)
    msgEngineRef.current = createMsgSocketEngine({
      buildWsUrl,
      WS_PATHS,

      msgSocketRef,
      msgPingRef,
      msgReconnectRef,

      setReady: setWsReady,
      clearMsgTimers,

      callStatusRef,
      callPeerIdRef,

      onMessage: (ev) => {
        handleMsgSocketMessageClient(ev);
      },
    });
  }, [
  ]);


  useEffect(() => {
    meIdRef.current = Number(sessionUser?.id || 0) || null;
  }, [sessionUser?.id]);


  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);


  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);


  useLayoutEffect(() => {
    const el = centerListRef?.current;
    if (!el) return;
    // Intenta autoscroll si ya está cerca del fondo o si es primera carga
    const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 120;
    if (nearBottom || !centerMessages.length) {
      el.scrollTop = el.scrollHeight;
    }
  }, [centerMessages, centerLoading, showCenterGifts]);


  // Cargar foto de perfil del cliente
  useEffect(() => {
    if (!sessionUser?.id) return;
    (async () => {
      try {
        const d = await apiFetch('/clients/documents/me');
        setProfilePic(d?.urlPic || null);

      } catch {
        /* noop */
      }
    })();
  }, [sessionUser?.id]);

  useEffect(() => {
    if (!sessionUser?.id || !currentModelId) return;
    (async () => {
      try {
        const d = await apiFetch(`/users/${currentModelId}`);
        const nn = d?.nickname || d?.name || d?.email || 'Modelo';
        setModelNickname(nn);
      } catch {/* noop */}
    })();
  }, [sessionUser?.id, currentModelId]);


  useEffect(() => {
    if (!sessionUser?.id || !currentModelId) return;
    (async () => {
      try {
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(currentModelId)}`);

        const url = map?.[currentModelId] || '';
        setModelAvatar(url);
      } catch {/* noop */}
    })();
  }, [sessionUser?.id, currentModelId]);

  // [CALL][Client] Solo aseguramos UI (nombre) y socket. El peer “verdadero”
  useEffect(() => {
    if (contactMode !== 'call') return;
    const peerId = Number(activePeerRef.current?.id);
    if (!Number.isFinite(peerId) || peerId <= 0) return;
    const nm = activePeerRef.current?.name || callPeerName || targetPeerName || 'Usuario';
    setCenterChatPeerName(nm);
    openMsgSocket?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactMode]);


  // Mantener compatibilidad: reflejar target -> centerChat
  useEffect(() => {
    if (Number(targetPeerId) > 0) {
      const id = Number(targetPeerId);
      const name = targetPeerName || 'Usuario';

      setCenterChatPeerId(id);
      setCenterChatPeerName(name);

      // NUEVO: mantener ref sincronizado en modo compat
      activePeerRef.current = { id, name };
    } else {
      setCenterChatPeerId(null);
      setCenterChatPeerName('');

      activePeerRef.current = { id: null, name: '' };
    }
  }, [targetPeerId, targetPeerName]);


  useEffect(() => {
      peerIdRef.current = Number(centerChatPeerId) || null;
  }, [centerChatPeerId]);

  useEffect(() => {
    if (localVideoRef.current && localStream.current) {
      localVideoRef.current.srcObject = localStream.current;
    }
  }, [cameraActive,remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      const tracks = remoteStream.getTracks ? remoteStream.getTracks() : [];
      const trackSummary = tracks.map((t) => `${t.kind}:${t.id}`).join(',');
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=bindRemoteVideo streamId=${remoteStream.id || 'null'} trackCount=${tracks.length} tracks=${trackSummary} assignSrcObject=true`
      );
      remoteVideoRef.current.srcObject = remoteStream;
    } else if (remoteVideoRef.current) {
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=bindRemoteVideo streamId=null trackCount=0 tracks= assignSrcObject=false clearSrcObject=true`
      );
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteStream) {
      setRandomRemoteMediaState(createMediaStateSnapshot(remoteStream, {
        status: 'received',
        lastReason: 'peer:stream',
      }));
      attachMediaObserver(remoteStream, setRandomRemoteMediaState, randomRemoteMediaCleanupRef, 'peer:stream');
      return () => resetMediaObserver(randomRemoteMediaCleanupRef);
    }

    resetMediaObserver(randomRemoteMediaCleanupRef);
    setRandomRemoteMediaState((prev) => (
      prev.status === 'lost'
        ? prev
        : createMediaStateSnapshot(null, { status: 'idle', lastReason: 'remote:cleared' })
    ));
  }, [remoteStream]);

  useEffect(() => {
    if (!remoteStream || !currentModelId) {
      resetRandomTechMediaReadySignal();
    }
  }, [remoteStream, currentModelId, resetRandomTechMediaReadySignal]);

  // CALLING: enlazar local stream a su video
  useEffect(() => {
    if (callLocalVideoRef.current && callLocalStreamRef.current) {
      console.log('[CALL][cam] bind local stream to video');
      callLocalVideoRef.current.srcObject = callLocalStreamRef.current;
    }
  }, [callCameraActive,callStatus]);

  // CALLING: enlazar remote stream a su video
  useEffect(() => {
    if (callRemoteVideoRef.current && callRemoteStream) {
      console.log('[CALL][remote] bind remote stream to video');
      callRemoteVideoRef.current.srcObject = callRemoteStream;
    } else if (callRemoteVideoRef.current) {
      callRemoteVideoRef.current.srcObject = null;
    }
  }, [callRemoteStream]);

  useEffect(() => {
    if (callRemoteStream) {
      setCallRemoteMediaState(createMediaStateSnapshot(callRemoteStream, {
        status: 'received',
        lastReason: 'call:peer-stream',
      }));
      attachMediaObserver(callRemoteStream, setCallRemoteMediaState, callRemoteMediaCleanupRef, 'call:peer-stream');
      return () => resetMediaObserver(callRemoteMediaCleanupRef);
    }

    resetMediaObserver(callRemoteMediaCleanupRef);
    setCallRemoteMediaState((prev) => (
      prev.status === 'lost'
        ? prev
        : createMediaStateSnapshot(null, { status: 'idle', lastReason: 'call:remote-cleared' })
    ));
  }, [callRemoteStream]);

  useEffect(() => {
    if (callStatus === 'idle') {
      resetCallTechMediaReadySignal();
    }
  }, [callStatus, resetCallTechMediaReadySignal]);

  useEffect(() => {
    resetCallTechMediaReadySignal();
  }, [callPeerId, callStreamRecordId, resetCallTechMediaReadySignal]);

  useEffect(() => {
    if (randomLocalMediaState.status !== 'live') return;
    if (randomRemoteMediaState.status !== 'live') return;
    if (!Number.isFinite(Number(currentModelId)) || Number(currentModelId) <= 0) return;
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    if (randomTechMediaReadySentRef.current) return;
    sendRandomTechMediaReady();
  }, [
    currentModelId,
    randomLocalMediaState.status,
    randomRemoteMediaState.status,
    sendRandomTechMediaReady,
  ]);

  useEffect(() => {
    if (callLocalMediaState.status !== 'live') return;
    if (callRemoteMediaState.status !== 'live') return;
    if (!Number.isFinite(Number(callPeerId)) || Number(callPeerId) <= 0) return;
    if (msgSocketRef.current?.readyState !== WebSocket.OPEN) return;
    if (!Number.isFinite(Number(callStreamRecordId)) || Number(callStreamRecordId) <= 0) return;
    if (callStatus !== 'connecting' && callStatus !== 'in-call') return;
    if (callTechMediaReadySentRef.current) return;
    sendCallTechMediaReady();
  }, [
    callPeerId,
    callLocalMediaState.status,
    callRemoteMediaState.status,
    callStreamRecordId,
    callStatus,
    sendCallTechMediaReady,
  ]);

  useEffect(() => () => {
    resetMediaObserver(randomLocalMediaCleanupRef);
    resetMediaObserver(randomRemoteMediaCleanupRef);
    resetMediaObserver(callLocalMediaCleanupRef);
    resetMediaObserver(callRemoteMediaCleanupRef);
  }, []);

  useEffect(() => {
    const el = centerListRef.current;
    if (!el) return;
    queueMicrotask(() => { el.scrollTop = el.scrollHeight; });
  }, [centerMessages, centerLoading, centerChatPeerId]);

  useEffect(() => {
    const el = vcListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (callStatus !== 'in-call') return;
    const el = callListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [centerMessages, callStatus]);


  // [CALL][Client] target dinámico desde Favoritos (chat central) o favorito seleccionado
  useEffect(() => {
    // Si hay llamada activa O hay lock, no recalculamos target
    if (callStatus !== 'idle') {
      console.log('[CALL][effect] target-from-favorites skipped (status!=idle)');
      return;
    }
    if (callTargetLockedRef.current) {
      console.log('[CALL][effect] target-from-favorites skipped (locked)');
      return;
    }

    const targetId = Number(targetPeerId) || null;
    const legacyVisualId = Number(centerChatPeerId) || null;

    if (targetId) {
      const id = targetId;
      const name =
        targetPeerName ||
        activePeerRef.current?.name ||
        centerChatPeerName ||
        selectedFav?.nickname ||
        selectedFav?.name ||
        selectedFav?.email ||
        'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id;
      setCallPeerName(name);
      console.log('[CALL][Client] target <- targetPeerId:', id, name);
    } else if (legacyVisualId) {
      const id = legacyVisualId;
      const name =
        centerChatPeerName ||
        targetPeerName ||
        activePeerRef.current?.name ||
        'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id;
      setCallPeerName(name);
      console.log('[CALL][Client] target <- centerChatPeerId fallback:', id, name);
    } else {
      setCallPeerId(null);
      callPeerIdRef.current = null;
      setCallPeerName('');
      console.log('[CALL][Client] sin target: abre un chat de Favoritos para elegir destinatario');
    }
  }, [
    callStatus,
    targetPeerId,
    targetPeerName,
    centerChatPeerId,
    centerChatPeerName,
    selectedFav?.id,
    selectedFav?.nickname,
    selectedFav?.name,
    selectedFav?.email
  ]);


  // [CALL] Si tenemos peerId pero no nombre coherente
  useEffect(() => {
    const id = Number(callPeerId);
    if (!Number.isFinite(id) || id <= 0) return;

    // Si ya tenemos un nombre (nickname/name/email), no volvemos a pedirlo
    if (callPeerName) return;

    (async () => {
      try {
        console.log('[CALL] Resolviendo nombre remoto via /api/users/', id);
        const d = await apiFetch(`/users/${id}`);

        const nn = d?.nickname || d?.name || d?.email || 'Usuario';
        setCallPeerName(nn);
      } catch {/* noop */}
    })();
  }, [callPeerId, callPeerName]);


  // [CALL] Avatar del destinatario
  useEffect(() => {
    const id = Number(callPeerId);
    if (!Number.isFinite(id) || id <= 0) return;

    (async () => {
      try {
        console.log('[CALL] Resolviendo avatar remoto via /api/users/avatars?ids=', id);
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(id)}`);

        setCallPeerAvatar(map?.[id] || '');
      } catch {/* noop */}
    })();
  }, [callPeerId]);

  // [CALL][Client] Anti-deriva: con llamada activa, target <- call
  useEffect(() => {
    if (callStatus === 'idle') return;
    const cId = Number(callPeerId);
    if (Number.isFinite(cId) && cId > 0 && Number(targetPeerId) !== cId) {
      console.log('[CALL][drift] targetPeerId != callPeerId -> forzar target');
      setTargetPeerId(cId);
      setTargetPeerName(callPeerName || 'Usuario');
    }
  }, [callStatus, callPeerId, callPeerName, targetPeerId]);


  useEffect(() => {
    const loadSaldo = async () => {
      setLoadingSaldo(true);
      setSaldoError('');
      try {
        const data = await apiFetch('/clients/me');
        setSaldo(data.saldoActual);
      } catch (e) {
        setSaldoError(e.message);
        setSaldo(null);
      } finally {
        setLoadingSaldo(false);
      }
    };

    loadSaldo();
  }, []);


  useEffect(()=>{
    apiFetch('/gifts')
      .then(arr=>{
        setGifts(Array.isArray(arr)?arr:[]);
        setGiftsLoaded(true);
      })
      .catch(()=>{
        // marcamos como "cargado" aunque falle, así no nos quedamos bloqueados
        setGiftsLoaded(true);
      });
  },[]);

  useEffect(() => {
    if (!giftsLoaded) { setGiftRenderReady(false); return; }
    const t = setTimeout(() => setGiftRenderReady(true), 200); // 200ms de margen
    return () => clearTimeout(t);
  }, [giftsLoaded]);


  // carga historial del chat central al cambiar peer
  useEffect(() => {
    const peer = Number(targetPeerId);
    if (!peer || activeTab !== 'favoritos') return;
    // Guard contra carreras
    const expectedPeer = peer;
    let canceled = false;

    const load = async () => {
      setCenterLoading(true);
      try {
        const data = await apiFetch(`/messages/with/${expectedPeer}`);

        if (canceled) return;
        if (Number(targetPeerId) !== expectedPeer) return;
        if (activeTab !== 'favoritos') return;

        const normalized = (data || []).map(raw => {
          const m = {
            id: raw.id,
            senderId: Number(raw.senderId ?? raw.sender_id),
            recipientId: Number(raw.recipientId ?? raw.recipient_id),
            body: raw.body,
            createdAt: raw.createdAt ?? raw.created_at,
            readAt: raw.readAt ?? raw.read_at ?? null,
            gift: raw.gift
              ? {
                  giftId: Number(raw.gift.giftId ?? raw.gift.id),
                  id: Number(raw.gift.giftId ?? raw.gift.id),
                  code: raw.gift.code ?? null,
                  name: raw.gift.name ?? '',
                  icon: raw.gift.icon ?? null,
                  cost: raw.gift.cost ?? null,
                  tier: raw.gift.tier ?? null,
                  featured: raw.gift.featured ?? null,
                }
              : null,
          };

          if (!m.gift && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            try {
              const parts = m.body.slice(2, -2).split(':');
              if (parts.length >= 3 && parts[0] === 'GIFT') {
                m.gift = {
                  giftId: Number(parts[1]),
                  id: Number(parts[1]),
                  name: parts.slice(2).join(':'),
                  icon: null,
                  cost: null,
                  tier: null,
                  featured: null,
                };
              }
            } catch {}
          }

          return m;
        });

        centerSeenIdsRef.current = new Set((normalized || []).map(m => m.id));
        setCenterMessages(normalized.reverse());

        try {
          await apiFetch(`/messages/with/${expectedPeer}/read`, { method: 'POST' });

          try {
            window.dispatchEvent(new CustomEvent('chat-read', {
              detail: { peerId: Number(expectedPeer) }
            }));
          } catch {/* noop */}
        } catch {}

        queueMicrotask(() => {
          const el = centerListRef?.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      } catch (e) {
        console.warn('Historial chat CLIENT error:', e?.message);
        setCenterMessages([]);
      } finally {
        if (!canceled) setCenterLoading(false);
      }
    };

    load();

    return () => {
      canceled = true;
    };
  }, [targetPeerId, activeTab]);


  //Sincronizar flag global inCall (RANDOM + CALLING)
  useEffect(() => {
    const hayRandom = !!remoteStream;
    const hayCalling =
      callStatus === 'connecting' ||
      callStatus === 'in-call' ||
      callStatus === 'ringing' ||
      callStatus === 'incoming';

    const nextInCall = hayRandom || hayCalling;
    setInCall(nextInCall);

    return () => {
      // En desmontaje del Dashboard limpiamos el flag por seguridad
      setInCall(false);
    };
  }, [remoteStream, callStatus, setInCall]);


  const clearMsgTimers = useCallback(() => {
    if (msgPingRef.current) {
      clearInterval(msgPingRef.current);
      msgPingRef.current = null;
    }
    if (msgReconnectRef.current) {
      clearTimeout(msgReconnectRef.current);
      msgReconnectRef.current = null;
    }
  }, []);

  const handleGiftInsufficientBalance = async (message) => {
    try {
      await alert({
        title: 'Saldo insuficiente para regalos',
        message: message || 'No tienes saldo suficiente para enviar este regalo.',
        variant: 'warning',
      });
    } catch (e) {
      console.error('Error mostrando alerta de saldo insuficiente para regalos:', e);
    }

    try {
      await handlePurchaseFromGift();
    } catch (e) {
      console.error('Error en handlePurchaseFromGift:', e);
    }
  };

  const closeMsgSocket = useCallback(() => {
    try { if (msgSocketRef.current) msgSocketRef.current.close(); } catch {}
    msgSocketRef.current = null;
    setWsReady(false);
    clearMsgTimers();
  }, [clearMsgTimers]);


  const openMsgSocket = () => {
    if (guardSensitiveAction()) return;
    msgEngineRef.current?.open();
  };

  useEffect(() => {
      if (!sensitiveEnabled) {
        closeMsgSocket();
        return undefined;
      }
      openMsgSocket();
      return () => closeMsgSocket();
  }, [closeMsgSocket, sensitiveEnabled]);

  useEffect(() => {
    const handleAuthLogout = () => {
      stopAllRef.current();
      closeMsgSocketRef.current();
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopAllRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    return () => {
      clearInteraction();
    };
  }, [clearInteraction]);


  // === Fullscreen helper (genérico) ===
  const toggleFullscreen = (el) => {
    if (!el) return;
    const d = document;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement || d.msFullscreenElement;
    if (!isFs) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      try { req && req.call(el); } catch {}
    } else {
      const exit = d.exitFullscreen || d.webkitExitFullscreen || d.mozCancelFullScreen || d.msExitFullscreen;
      try { exit && exit.call(d); } catch {}
    }
  };


  const handleActivateCamera = async () => {
    if (guardSensitiveAction({ setError })) return;
    console.log(
      `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=activateCamera start=true`
    );
    resetMediaObserver(randomLocalMediaCleanupRef);
    setRandomLocalMediaState(createMediaStateSnapshot(null, {
      status: 'requesting',
      lastReason: 'getUserMedia:start',
    }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      const tracks = stream.getTracks ? stream.getTracks() : [];
      const trackSummary = tracks.map((t) => `${t.kind}:${t.id}`).join(',');
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=activateCamera success=true trackCount=${tracks.length} tracks=${trackSummary}`
      );
      localStream.current = stream;
      setRandomLocalMediaState(createMediaStateSnapshot(stream, {
        status: 'obtained',
        lastReason: 'getUserMedia:success',
      }));
      attachMediaObserver(stream, setRandomLocalMediaState, randomLocalMediaCleanupRef, 'getUserMedia:success');
      setCameraActive(true);
    } catch (err) {
      console.warn(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=activateCamera success=false message=${err?.message || 'unknown'}`
      );
      setError('No se pudo activar la cámara. Revisa los permisos e inténtalo de nuevo.');
      setRandomLocalMediaState(createMediaStateSnapshot(null, {
        status: 'lost',
        lastReason: 'getUserMedia:error',
      }));
      console.error(err);
    }
  };


  const handleLogout = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;

    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // noop (aunque falle, limpiamos cliente)
    }

    stopAll();
    history.push('/');
  };


  const handleStartMatch = () => {
    if (guardSensitiveAction({ setError })) return;
    matchEngineRef.current?.start();
  };


  const handleMsgSocketMessageClient = (ev) => {
    try {
      const data = JSON.parse(ev.data);

      // ====== MENSAJES / REGALOS ======
      if (data.type === 'msg:gift' && data.gift) {
        const me = Number(meIdRef.current);
        const peer = Number(activePeerRef.current?.id);
        const from = Number(data.from);
        const to = Number(data.to);

        const belongsToThisChat =
          (from === peer && to === me) || (from === me && to === peer);

        if (!me || !peer || !belongsToThisChat) return;

        const mid = data.messageId;
        if (mid && centerSeenIdsRef.current.has(mid)) return;
        if (mid) centerSeenIdsRef.current.add(mid);

        const normalizedGift = {
          giftId: Number(data.gift.giftId ?? data.gift.id),
          id: Number(data.gift.giftId ?? data.gift.id),
          code: data.gift.code ?? null,
          name: data.gift.name ?? '',
          icon: data.gift.icon ?? null,
          cost: data.gift.cost ?? null,
          tier: data.gift.tier ?? null,
          featured: data.gift.featured ?? null,
        };

        setCenterMessages(prev => [
          ...prev,
          {
            id: mid || `${Date.now()}`,
            senderId: from,
            recipientId: to,
            body: `[[GIFT:${normalizedGift.giftId}:${normalizedGift.name}]]`,
            gift: normalizedGift,
          }
        ]);

        queueMicrotask(() => {
          const el = centerListRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });

        return;
      }

      if (data.type === 'msg:new' && data.message) {
        const m = normMsg(data.message);

        if (!m.gift && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
          try {
            const parts = m.body.slice(2, -2).split(':');
            if (parts.length >= 3 && parts[0] === 'GIFT') {
              m.gift = {
                giftId: Number(parts[1]),
                id: Number(parts[1]),
                name: parts.slice(2).join(':'),
                icon: null,
                cost: null,
                tier: null,
                featured: null,
              };
            }
          } catch {}
        }

        const me = Number(meIdRef.current);
        const peer = Number(activePeerRef.current?.id);
        if (!me || !peer) return;

        const belongsToThisChat =
          (m.senderId === peer && m.recipientId === me) ||
          (m.senderId === me && m.recipientId === peer);

        if (belongsToThisChat) {
          if (m.id && centerSeenIdsRef.current.has(m.id)) return;
          if (m.id) centerSeenIdsRef.current.add(m.id);

          setCenterMessages(prev => [...prev, m]);

          queueMicrotask(() => {
            const el = centerListRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        }

        return;
      }

      // ====== GIFT / MENSAJES: saldo insuficiente ======
      if (
        (data.type === 'gift:error' || data.type === 'msg:error') &&
        typeof data.message === 'string' &&
        data.message.toLowerCase().includes('saldo insuficiente')
      ) {
        console.log('[GIFT][no-balance] message=', data.message);

        (async () => {
          await handleGiftInsufficientBalance(data.message);
        })();

        return;
      }

      // ====== CALLING: EVENTOS call:* ======
      if (data.type === 'call:incoming') {
        const id = Number(data.from);
        const name = String(data.displayName || 'Usuario');

        console.log('[CALL][incoming][Client] from=', id, 'name=', name);

        if (activeTabRef.current !== 'videochat' && activeTabRef.current !== 'favoritos') {
          try {
            if (msgSocketRef.current?.readyState === WebSocket.OPEN && Number.isFinite(id) && id > 0) {
              msgSocketRef.current.send(JSON.stringify({
                type: 'call:reject',
                with: id,
                reason: 'unavailable'
              }));
            }
          } catch (e) {
            console.error('[CALL][incoming:auto-reject][Client] error', e);
          }

          (async () => {
            try {
              await alert({
                title: 'Llamada entrante',
                message: `${name} te ha intentado llamar. Para recibir llamadas, entra en Favoritos o Videochat.`,
                variant: 'info',
              });
            } catch (e) {
              console.error('[CALL][incoming:auto-reject][Client][modal] error', e);
            }
          })();

          return;
        }

        callTargetLockedRef.current = true;

        setActivePeer(id, name, 'call', null);

        setCallPeerId(id);
        callPeerIdRef.current = id;
        setCallPeerName(name);

        setSelectedFav(null);

        setCallStatus('incoming');
        setCallError('');
        return;
      }

      if (data.type === 'call:ringing') {
        console.log('[CALL][ringing] to=', callPeerId);

        setCallStatus('ringing');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        callRingTimeoutRef.current = setTimeout(() => {
          console.log('[CALL][ringing] timeout -> cancel local');
          handleCallEnd(true);
        }, 45000);

        return;
      }

      if (data.type === 'call:accepted') {
        console.log('[CALL][accepted]', { peer: callPeerIdRef.current, role: callRoleRef.current });

        if (callRingTimeoutRef.current) {
          clearTimeout(callRingTimeoutRef.current);
          callRingTimeoutRef.current = null;
        }

        const acceptedStreamRecordId = Number(data?.streamRecordId);
        if (!Number.isFinite(acceptedStreamRecordId) || acceptedStreamRecordId <= 0) {
          cleanupCall('ended');
          return;
        }
        resetCallTechMediaReadySignal();
        setCallStreamRecordId(acceptedStreamRecordId);
        callStreamRecordIdRef.current = acceptedStreamRecordId;

        const peer = Number(callPeerIdRef.current);
        if (Number.isFinite(peer) && peer > 0) {
          console.log('[CALL][lock] accepted -> keep lock [Client]; peer=', peer);

          const nm = callPeerName || activePeerRef.current?.name || 'Usuario';
          activePeerRef.current = { id: peer, name: nm };

          setTargetPeerId(peer);
          setTargetPeerName(nm);

          setCenterChatPeerName(nm);
        }

        const initiator = (callRoleRef.current === 'caller');
        wireCallPeer(initiator);

        setCallStatus('in-call');
        setCallError('');

        if (callPingRef.current) clearInterval(callPingRef.current);

        callPingRef.current = setInterval(() => {
          try {
            if (msgSocketRef.current?.readyState === WebSocket.OPEN) {
              msgSocketRef.current.send(JSON.stringify({ type: 'call:ping' }));
              console.log('[CALL][ping] sent (in-call loop)');
            }
          } catch {}
        }, 30000);

        return;
      }

      if (data.type === 'call:signal' && data.signal) {
        console.log('[CALL][signal:in][Client]', data.signal?.type || (data.signal?.candidate ? 'candidate' : 'unknown'));

        if (callPeerRef.current) {
          callPeerRef.current.signal(data.signal);
        }

        return;
      }

      if (data.type === 'call:rejected') {
        console.log('[CALL][rejected]');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        setCallStatus('idle');
        setCallError('');

        (async () => {
          try {
            await alert({
              title: 'Llamada rechazada',
              message: data.reason === 'unavailable'
                ? 'La otra persona no está disponible en este momento.'
                : 'La otra persona ha rechazado tu llamada.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal de rechazo:', e);
          }
        })();

        return;
      }

      if (data.type === 'call:canceled') {
        console.log('[CALL][canceled] reason=', data.reason);

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        cleanupCall('canceled');
        return;
      }

      if (data.type === 'call:ended') {
        console.log('[CALL][ended] reason=', data.reason);

        const reason = data.reason;
        cleanupCall('ended');

        if (reason === 'low-balance') {
          (async () => {
            try {
              await handlePurchaseFromCalling();
            } catch (e) {
              console.error('Error en handlePurchaseFromCalling (ended/low-balance):', e);
            }
          })();
        }

        return;
      }

      if (data.type === 'call:no-balance') {
        console.log('[CALL][no-balance]');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError('');

        (async () => {
          try {
            await handlePurchaseFromCalling();
          } catch (e) {
            console.error('Error en handlePurchaseFromCalling:', e);
          }
        })();

        return;
      }

      if (data.type === 'call:busy') {
        console.log('[CALL][busy]', data);

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        (async () => {
          try {
            await alert({
              title: 'Usuario ocupado',
              message: 'El usuario está en otra llamada o en streaming.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal de ocupado:', e);
          }
        })();

        return;
      }

      if (data.type === 'call:offline') {
        console.log('[CALL][offline]');

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        (async () => {
          try {
            await alert({
              title: 'Usuario no disponible',
              message: 'El usuario no está conectado en este momento.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal de offline:', e);
          }
        })();

        return;
      }

      if (data.type === 'call:error') {
        console.log('[CALL][error]', data.message);

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError(String(data.message || 'Error en la llamada'));

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        return;
      }
    } catch (e) {
      // silenciar parse errors
    }
  };



  const handleNext = () => {
    if (guardSensitiveAction({ setError })) return;
    // Guard: si estamos ya en transición de NEXT, no spameamos
    if (nexting) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        setNexting(true);
        resetRandomTechMediaReadySignal();
        socketRef.current.send(JSON.stringify({ type: 'next' }));
      } catch (e) {
        console.error('Error enviando NEXT:', e);
        setNexting(false);
        setError('No se pudo pasar a la siguiente persona. Inténtalo de nuevo.');
        return;
      }
    } else {
      setNexting(false);
      setError('No se pudo conectar. Inténtalo de nuevo.');
      return;
    }

  };


  const sendChatMessage = () => {
    if (guardSensitiveAction({ setError })) return;
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput.trim() };
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      lastSentRef.current = { text: message.message, at: Date.now() };
      socketRef.current.send(JSON.stringify(message));
      setMessages(prev => [...prev, { from: 'me', text: message.message }]);
      setChatInput('');
    }
  };

  const sendRandomMediaReady = () => {
    if (guardSensitiveAction()) return;
    if (mediaReadySentRef.current) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'media-ready' }));
      mediaReadySentRef.current = true;
    }
  };


  const handleProfile = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;

    stopAll();
    history.push('/perfil-client');
  };


  const stopAll = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // CALLING primero para hacer el teardown más determinista antes de limpiar random/favoritos
    try { handleCallEnd(true); } catch {}
    resetRandomTechMediaReadySignal();

    // RANDOM
    if (localStream.current) {
      setRandomLocalMediaState(createMediaStateSnapshot(localStream.current, {
        status: 'lost',
        lastReason: 'random:stopAll',
      }));
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    } else {
      setRandomLocalMediaState(createMediaStateSnapshot(null, {
        status: 'idle',
        lastReason: 'random:stopAll-idle',
      }));
    }
    resetMediaObserver(randomLocalMediaCleanupRef);
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
    if (socketRef.current) {
      try { socketRef.current.close(); } catch {}
      socketRef.current = null;
    }
    setCurrentModelId(null);
    setCameraActive(false);
    setSearching(false);
    if (remoteStream) {
      setRandomRemoteMediaState(createMediaStateSnapshot(remoteStream, {
        status: 'lost',
        lastReason: 'random:stopAll',
      }));
    } else {
      setRandomRemoteMediaState(createMediaStateSnapshot(null, {
        status: 'idle',
        lastReason: 'random:remote-stopAll-idle',
      }));
    }
    resetMediaObserver(randomRemoteMediaCleanupRef);
    setRemoteStream(null);
    setError('');
    setMessages([]);

    // FAVORITOS
    activePeerRef.current = { id: null, name: '' };
    setTargetPeerId(null);
    setTargetPeerName('');
    setSelectedFav(null);
    setContactMode(null);
    setCenterChatPeerId(null);
    setCenterChatPeerName('');
    setCenterMessages([]);
    setCenterInput('');
    setShowGifts(false);
    setShowCenterGifts(false);
    console.log('[FAVORITES_CONTEXT][Client][stopAll] cleared');
  };

  stopAllRef.current = stopAll;
  closeMsgSocketRef.current = closeMsgSocket;


  const handleAddBalance = async () => {
    const result = await openPurchaseModal({ context: 'navbar-comprar' });
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    try {
      setLoadingSaldo(true);

      await apiFetch('/transactions/add-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (${pack.minutes} minutos)`,
        }),
      });

      await alert({
        title: 'Saldo actualizado',
        message: `Se ha añadido el pack de ${pack.minutes} minutos.`,
        variant: 'success',
      });

      const data = await apiFetch('/clients/me');
      setSaldo(data.saldoActual);
      setSaldoError('');
    } catch (e) {
      console.error(e);
      await alert({
        title: 'Error',
        message: e.message || 'Error al añadir saldo.',
        variant: 'danger',
      });
      setSaldoError(e.message || 'Error al cargar saldo');
      setSaldo(null);
    } finally {
      setLoadingSaldo(false);
    }
  };


  const handlePurchaseFromRandom = async () => {
    const result = await openPurchaseModal({ context: 'random' });
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    try {
      setLoadingSaldo(true);

      await apiFetch('/transactions/add-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (random ${pack.minutes} minutos)`,
        }),
      });

      const data = await apiFetch('/clients/me');
      setSaldo(data.saldoActual);
      setSaldoError('');

      await alert({
        title: 'Saldo actualizado',
        message: `Se ha añadido el pack de ${pack.minutes} minutos. Vuelve a pulsar "Iniciar videochat" para empezar el streaming.`,
        variant: 'success',
      });
    } catch (e) {
      console.error(e);
      setSaldoError(e.message || 'Error al cargar saldo');
      await alert({
        title: 'Error',
        message: e.message || 'Error al añadir saldo.',
        variant: 'danger',
      });
    } finally {
      setLoadingSaldo(false);
    }
  };


  const handlePurchaseFromCalling = async () => {
    const result = await openPurchaseModal({ context: 'calling' });
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    try {
      setLoadingSaldo(true);

      await apiFetch('/transactions/add-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (llamada 1 a 1, ${pack.minutes} minutos)`,
        }),
      });

      const data = await apiFetch('/clients/me');
      setSaldo(data.saldoActual);
      setSaldoError('');

      await alert({
        title: 'Saldo actualizado',
        message: `Se ha añadido el pack de ${pack.minutes} minutos. Vuelve a intentar la llamada.`,
        variant: 'success',
      });
    } catch (e) {
      console.error(e);
      setSaldoError(e.message || 'Error al cargar saldo');
      await alert({
        title: 'Error',
        message: e.message || 'Error al añadir saldo.',
        variant: 'danger',
      });
    } finally {
      setLoadingSaldo(false);
    }
  };


  const handlePurchaseFromGift = async () => {
    const result = await openPurchaseModal({ context: 'gift' });
    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    try {
      setLoadingSaldo(true);

      await apiFetch('/transactions/add-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (envío de regalos, ${pack.minutes} minutos)`,
        }),
      });

      const data = await apiFetch('/clients/me');
      setSaldo(data.saldoActual);
      setSaldoError('');

      await alert({
        title: 'Saldo actualizado',
        message: 'Se ha añadido saldo para que puedas enviar regalos.',
        variant: 'success',
      });
    } catch (e) {
      console.error(e);
      setSaldoError(e.message || 'Error al cargar saldo');
      await alert({
        title: 'Error',
        message: e.message || 'Error al añadir saldo.',
        variant: 'danger',
      });
    } finally {
      setLoadingSaldo(false);
    }
  };


  // REPORT/ABUSE (RANDOM) - CLIENT SIDE
  const handleReportPeer = async () => {
    const id = Number(currentModelId);

    if (!Number.isFinite(id) || id <= 0) {
      await alert({
        title: 'Reportar abuso',
        message: 'No se pudo identificar a la modelo actual.',
        variant: 'warning',
      });
      return;
    }

    const displayName = modelNickname || `Usuario #${id}`;

    const report = await openReportAbuseModal({ displayName });
    if (!report?.confirmed) return;

    try {
      await apiFetch('/reports/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: id,
          streamRecordId: null, // cuando tengas streamId real, lo metes aquí
          reportType: report.reportType || 'ABUSE',
          description: report.description || '',
          alsoBlock: !!report.alsoBlock,
        }),
      });

      // UX moderación: salimos del match actual tras reportar
      if (remoteStream) {
        try {
          if (!matchGraceRef.current) {
            handleNext();
          }
        } catch {
          stopAll();
        }
      } else {
        setSearching(false);
      }

      await alert({
        title: 'Reporte enviado',
        message: report.alsoBlock
          ? 'Gracias. Hemos recibido tu reporte y el usuario ha sido bloqueado.'
          : 'Gracias. Hemos recibido tu reporte y lo revisaremos.',
        variant: 'success',
      });
    } catch (e) {
      console.error('Error reportando abuso:', e);
      await alert({
        title: 'Error',
        message: e?.message || 'No se pudo enviar el reporte.',
        variant: 'danger',
      });
    }
  };


  // BLOQUEOS (RANDOM) - CLIENT SIDE
  const handleBlockPeer = async () => {
    const id = Number(currentModelId);
    if (!Number.isFinite(id) || id <= 0) {
      await alert({ title:'Bloquear', message:'No se pudo identificar a la modelo actual.', variant:'warning' });
      return;
    }
    const displayName = modelNickname || `Usuario #${id}`;
    const pick = await openBlockReasonModal({ displayName });
    if (!pick?.confirmed) return;

    try {

      await apiFetch(`/blocks/${id}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ reason: pick.reason || '' }) });
    } catch {}

    if (remoteStream) {
      try { if (!matchGraceRef.current) handleNext(); } catch { stopAll(); }
    } else {
      setSearching(false);
    }
    await alert({ title:'Bloquear', message:'Modelo bloqueada.', variant:'success' });
  };


  const streamingActivo = !!remoteStream;
  const showCallMedia = callStatus === 'in-call';

  // Llamada 1 a 1 en curso (no solo cámara encendida)
  const callEnCurso =
    callStatus === 'connecting' ||
    callStatus === 'in-call' ||
    callStatus === 'ringing' ||
    callStatus === 'incoming';

  const showFavoritesFullCall =
    !isMobile &&
    activeTab === 'favoritos' &&
    contactMode === 'call' &&
    callEnCurso;


  // Confirmación genérica al intentar salir de una comunicación activa
  const confirmarSalidaSesionActiva = async () => {
    const hayLlamada =
      callStatus === 'in-call' ||
      callStatus === 'connecting' ||
      callStatus === 'ringing';
    return openActiveSessionGuard({
      hasStreaming: !!remoteStream,
      hasCalling: hayLlamada,
    });
  };


  const handleGoBlog = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    setActiveTab('blog');
  };


  const handleGoFavorites = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    setActiveTab('favoritos');
  };


  const handleGoVideochat = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    setActiveTab('videochat');
  };


  const handleLogoClick = (e) => {
    // nos lleva a tab videochat
    e.preventDefault();
    if (streamingActivo || callStatus !== 'idle') {
      alert('Tienes una LLAMADA activa. Pulsa STOP para salir.');
      return;
    }
    setActiveTab('videochat');
  };


  // Cambiar a modo llamada sobre el target actual
  const enterCallMode = () => {
    if (guardSensitiveAction({ setError: setCallError })) return;
    if (!Number(targetPeerId)) {
      setCallError('Selecciona un contacto primero.');
      return;
    }
    // Regla de permiso actual (accepted+active)
    const inv = String(selectedFav?.invited || '').toLowerCase();
    const st  = String(selectedFav?.status  || '').toLowerCase();
    const isAcceptedForCall = (st === 'active' && inv === 'accepted');
    if (!isAcceptedForCall) {
      setCallError('Llamadas bloqueadas: la relación no está aceptada o activa.');
      return;
    }
    const id = Number(targetPeerId);
    const name = targetPeerName || 'Usuario';
    // Fuente de verdad única también en call
    setActivePeer(id, name, 'call', selectedFav);
    // Sincronizar universo CALL con el target
    setCallPeerId(id);
    callPeerIdRef.current = id;
    setCallPeerName(name);
    setCallError('');
  };


  const handleAddFavorite = async (explicitModelId) => {
    if (guardSensitiveAction()) return;
    const modelId = explicitModelId || currentModelId;

    if (!modelId) {
      await alert({
        variant: 'warning',
        title: 'Favoritos',
        message: 'No se pudo identificar a la modelo actual.',
      });
      return;
    }

    try {
      // PRE (cookies): sin token, apiFetch ya va con credentials: 'include'
      await apiFetch(`/favorites/models/${modelId}`, { method: 'POST' });

      // 204 => consultamos meta para mensaje contextual
      try {
        const meta = await apiFetch('/favorites/models/meta');

        const found = (meta || [])
          .map(d => ({
            id: d?.user?.id,
            invited: d?.invited,
            status: d?.status
          }))
          .find(x => Number(x.id) === Number(modelId));

        const inv = String(found?.invited || '').toLowerCase();

        if (inv === 'pending') {
          await alert({
            variant: 'success',
            title: 'Solicitud enviada',
            message: 'Se activará cuando la modelo acepte.',
          });
        } else if (inv === 'accepted') {
          await alert({
            variant: 'success',
            title: 'Favoritos',
            message: 'Ya estáis en favoritos mutuamente.',
          });
        } else if (inv === 'rejected') {
          await alert({
            variant: 'warning',
            title: 'Favoritos',
            message: 'La modelo rechazó previamente la invitación.',
          });
        } else {
          await alert({
            variant: 'success',
            title: 'Favoritos',
            message: 'Solicitud procesada.',
          });
        }
      } catch {
        await alert({
          variant: 'success',
          title: 'Favoritos',
          message: 'Solicitud enviada.',
        });
      }

      // refrescar listas
      setFavReload(x => x + 1);
    } catch (e) {
      const msg = String(e?.message || '');
      const code = String(e?.code || e?.error || e?.data?.code || e?.data?.error || '').toLowerCase();
      const isAlreadyFavorite =
        e?.status === 409 ||
        msg.toLowerCase() === 'already_favorites' ||
        code === 'already_favorites';

      if (isAlreadyFavorite) {
        await alert({
          variant: 'info',
          title: i18n.t('dashboardClient.favoriteAlerts.title'),
          message: i18n.t('dashboardClient.favoriteAlerts.modelAlreadyFavorite'),
        });
        return;
      }

      console.error(e);
      await alert({
        variant: 'danger',
        title: 'Error',
        message: e.message || 'No se pudo añadir a favoritos.',
      });
    }
  };


  const openChatWith = (peerId, displayName) => {
    if (guardSensitiveAction()) return;
    const peer = Number(peerId);

    if (streamingActivo) {
      alert('No puedes abrir el chat central mientras hay streaming. Pulsa Stop si quieres cambiar.');
      return;
    }
    if (!Number.isFinite(peer) || peer <= 0) {
      console.warn('[openChatWith][Client] peerId inválido:', peerId);
      return;
    }
    // SIMÉTRICO a Model: esta función NO carga histórico.
    // El histórico lo carga el useEffect(targetPeerId, activeTab).
    setActiveTab('favoritos');
    setCenterChatPeerName(displayName || 'Usuario');
    // Mantengo limpieza “optimista” para UX (mientras carga)
    setCenterMessages([]);
    centerSeenIdsRef.current = new Set();
    setCenterLoading(true);
    openMsgSocket();
  };


  const normMsg = (raw) => ({
    id: raw.id,
    senderId: Number(raw.senderId ?? raw.sender_id),
    recipientId: Number(raw.recipientId ?? raw.recipient_id),
    body: raw.body,
    createdAt: raw.createdAt ?? raw.created_at,
    readAt: raw.readAt ?? raw.read_at ?? null,
    gift: raw.gift
      ? {
          giftId: Number(raw.gift.giftId ?? raw.gift.id),
          id: Number(raw.gift.giftId ?? raw.gift.id),
          code: raw.gift.code ?? null,
          name: raw.gift.name ?? '',
          icon: raw.gift.icon ?? null,
          cost: raw.gift.cost ?? null,
          tier: raw.gift.tier ?? null,
          featured: raw.gift.featured ?? null,
        }
      : null,
  });


  const sendCenterMessage = () => {
    if (guardSensitiveAction()) return;
    const body = String(centerInput || '').trim();
    if (!body) return;
    const interactionTo = Number(interaction?.actionTarget?.messageToUserId) || null;
    const refTo = Number(activePeerRef.current?.id) || null;
    const targetTo = Number(targetPeerId) || null;
    const legacyVisualTo = Number(centerChatPeerId) || null;
    const legacyTo = refTo || targetTo || legacyVisualTo;
    const finalTo = interactionTo || legacyTo;

    console.log('[PEER_AUTHORITY][Client][sendCenterMessage]', {
      interactionTo,
      refTo,
      targetTo,
      legacyVisualTo,
      finalTo,
      source: interactionTo ? 'interaction' : refTo ? 'activePeerRef' : targetTo ? 'targetPeerId' : 'centerChatPeerId'
    });

    if (!Number.isFinite(finalTo) || finalTo <= 0) {
      console.warn('[sendCenterMessage][Client] destinatario inválido', {
        interactionTo,
        activePeer: activePeerRef.current,
        centerChatPeerId,
        targetPeerId,
        finalTo,
      });
      return;
    }
    const s = msgSocketRef.current;
    if (s && s.readyState === WebSocket.OPEN) {
      const payload = { type: 'msg:send', to: finalTo, body };
      try {
        s.send(JSON.stringify(payload));
        setCenterInput('');
      } catch (e) {
        console.warn('[sendCenterMessage][Client] error enviando WS', e);
        alert('No se pudo enviar el mensaje. Reintenta.');
      }
    } else {
      alert('Chat de mensajes desconectado. Reabre el panel.');
    }
  };


  const setActivePeer = (peerId, peerName, mode, favUser = null) => {
    if (guardSensitiveAction()) return;
    const id = Number(peerId);
    const name = peerName || 'Usuario';
    if (!Number.isFinite(id) || id <= 0) {
      console.warn('[ActivePeer][Client] peerId inválido:', peerId);
      return;
    }
    const prevId = Number(activePeerRef.current?.id) || null;
    const isSamePeer = prevId === id;

    // Autoridad viva (id + name)
    activePeerRef.current = { id, name };
    // Fuente de verdad React
    setTargetPeerId(id);
    setTargetPeerName(name);
    // preservar avatar si viene de favoritos
    if (favUser?.avatarUrl) {
      setCallPeerAvatar(favUser.avatarUrl);
    }

    if (favUser) {
      setSelectedFav(favUser);
    }
    setContactMode(mode || 'chat');
    setActiveTab('favoritos');

    if (!isSamePeer) {
      centerSeenIdsRef.current = new Set();
      setCenterMessages([]);
    }
    setCenterChatPeerName(name);
    openMsgSocket?.();
  };


  const handleOpenChatFromFavorites = (favUser) => {
    if (guardSensitiveAction()) return;
    const name =
      favUser?.nickname || favUser?.name || favUser?.email || 'Usuario';

    const peer = Number(favUser?.id ?? favUser?.userId);
    if (!Number.isFinite(peer) || peer <= 0) {
      alert('No se pudo determinar el destinatario correcto.');
      return;
    }
    if (Number(sessionUser?.id) === peer) {
      alert('No puedes chatear contigo mismo.');
      return;
    }
    // Fuente de verdad única
    setActivePeer(peer, name, 'chat', favUser);

    // Panel invitación pendiente: mantenemos comportamiento actual
    if (String(favUser?.invited) === 'pending') {
      setCenterMessages([]);
      centerSeenIdsRef.current = new Set();
      openMsgSocket?.();
      return;
    }
    // Cargar historial
    openChatWith(peer, name);
  };


  const acceptInvitation = async () => {
    if (guardSensitiveAction()) return;
    if (!selectedFav?.id) return;
    try {
      await apiFetch(`/favorites/accept/${selectedFav.id}`, { method: 'POST' });

      const name = selectedFav.nickname || 'Usuario';
      setSelectedFav(prev => prev ? { ...prev, invited: 'accepted', status: 'active' } : prev);
      setFavReload(x => x + 1);
      openChatWith(selectedFav.id, name);
    } catch (e) {
      alert(e.message || 'No se pudo aceptar la invitación');
    }
  };


  const rejectInvitation = async () => {
    if (guardSensitiveAction()) return;
    if (!selectedFav?.id) return;
    try {
      await apiFetch(`/favorites/reject/${selectedFav.id}`, { method: 'POST' });

      setSelectedFav(prev => prev ? { ...prev, invited: 'rejected' } : prev);
      setFavReload(x => x + 1);
    } catch (e) {
      alert(e.message || 'No se pudo rechazar la invitación');
    }
  };


  const sendGiftMatch=(giftId)=>{
      if (guardSensitiveAction()) return;
      if(!socketRef.current||socketRef.current.readyState!==WebSocket.OPEN) return;
      socketRef.current.send(JSON.stringify({type:'gift',giftId}));
      setShowGifts(false);
  };


  const sendGiftMsg = (giftId) => {
    if (guardSensitiveAction()) return;
    const interactionTo = Number(interaction?.actionTarget?.giftToUserId) || null;
    const refTo = Number(activePeerRef.current?.id) || null;
    const targetTo = Number(targetPeerId) || null;
    const legacyVisualTo = Number(centerChatPeerId) || null;
    const legacyTo = refTo || targetTo || legacyVisualTo;
    const finalTo = interactionTo || legacyTo;

    console.log('[PEER_AUTHORITY][Client][sendGiftMsg]', {
      giftId,
      interactionTo,
      refTo,
      targetTo,
      legacyVisualTo,
      finalTo,
      source: interactionTo ? 'interaction' : refTo ? 'activePeerRef' : targetTo ? 'targetPeerId' : 'centerChatPeerId'
    });

    if (!Number.isFinite(finalTo) || finalTo <= 0) {
      console.warn('[sendGiftMsg][Client] destinatario inválido', {
        giftId,
        interactionTo,
        activePeer: activePeerRef.current,
        targetPeerId,
        centerChatPeerId,
        finalTo,
      });
      return;
    }
    if (!msgSocketRef.current || msgSocketRef.current.readyState !== WebSocket.OPEN) return;

    msgSocketRef.current.send(JSON.stringify({ type:'msg:gift', to: finalTo, giftId }));
    setShowCenterGifts(false);
  };


  //Activar cámara (Calling)
  const handleCallActivateCamera = async () => {
    if (guardSensitiveAction({ setError: setCallError })) return;
    console.log('[CALL][cam:on] requesting user media');
    resetMediaObserver(callLocalMediaCleanupRef);
    setCallLocalMediaState(createMediaStateSnapshot(null, {
      status: 'requesting',
      lastReason: 'call:getUserMedia:start',
    }));

    //SOLO bloqueamos si se intenta iniciar llamada desde idle (caller)
    if (callStatus === 'idle' && !callAllowed) {
      setCallError('No puedes activar la cámara: la relación aún no está aceptada.');
      setCallLocalMediaState(createMediaStateSnapshot(null, {
        status: 'idle',
        lastReason: 'call:getUserMedia:blocked',
      }));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      callLocalStreamRef.current = stream;
      setCallLocalMediaState(createMediaStateSnapshot(stream, {
        status: 'obtained',
        lastReason: 'call:getUserMedia:success',
      }));
      attachMediaObserver(stream, setCallLocalMediaState, callLocalMediaCleanupRef, 'call:getUserMedia:success');
      setCallCameraActive(true);
      setCallStatus('camera-ready');
      setCallError('');
      // bind inmediato por si el useEffect tarda un frame
      if (callLocalVideoRef.current) {
        callLocalVideoRef.current.srcObject = stream;
      }
      console.log('[CALL][cam:on] success tracks=', stream.getTracks().length);
    } catch (err) {
      console.error('[CALL][cam:on] error', err);
      setCallError('No se pudo activar la cámara. Revisa los permisos e inténtalo de nuevo.');
      setCallLocalMediaState(createMediaStateSnapshot(null, {
        status: 'lost',
        lastReason: 'call:getUserMedia:error',
      }));
      setCallCameraActive(false);
      setCallStatus('idle');
    }
  };


  // Enviar invitación (FIX: no usar 'openChatWith' como ID)
  const handleCallInvite = () => {
    if (guardSensitiveAction({ setError: setCallError })) return;
    if (!callCameraActive || !callLocalStreamRef.current) {
      setCallError('Primero activa la cámara para llamar.');
      return;
    }
    if (!callAllowed) {
      setCallError('Llamadas bloqueadas: la relación no está aceptada.');
      return;
    }
    // Prioridad operativa: ref viva -> state call -> target React -> espejo visual final
    const toId =
      Number(callPeerIdRef.current ?? callPeerId ?? targetPeerId ?? centerChatPeerId);
    let toName = '';
    if (Number.isFinite(toId) && toId > 0) {
      toName =
        callPeerName ||
        targetPeerName ||
        activePeerRef.current?.name ||
        centerChatPeerName ||
        selectedFav?.nickname ||
        selectedFav?.name ||
        selectedFav?.email ||
        'Usuario';
    }
    if (!Number.isFinite(toId) || toId <= 0) {
      setCallError('Abre un chat de Favoritos o selecciona un destinatario para llamar.');
      return;
    }
    if (!msgSocketRef.current || msgSocketRef.current.readyState !== WebSocket.OPEN) {
      setCallError('El chat de mensajes no está conectado.');
      return;
    }
    try {
      console.log('[CALL][invite:send][Client] to=', toId, 'name=', toName);
      setCallPeerId(toId);
      callPeerIdRef.current = toId;
      setCallPeerName(toName);

      msgSocketRef.current.send(JSON.stringify({ type: 'call:invite', to: toId, displayName: toName }));

      setCallRole('caller');
      callRoleRef.current = 'caller';
      setCallStatus('connecting');
      setCallError('');

      if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
      callRingTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'connecting') {
          console.log('[CALL][invite][Client] no ringing -> cancel');
          handleCallEnd(true);
          setCallError('No se pudo iniciar el timbrado.');
        }
      }, 10000);
    } catch (e) {
      console.error('[CALL][invite:send][Client] error', e);
      setCallError('No se pudo enviar la invitación.');
    }
  };


  //Aceptar invitación
  const handleCallAccept = async () => {
    if (guardSensitiveAction({ setError: setCallError })) return;
    if (!callPeerIdRef.current) return;
    if (!callCameraActive || !callLocalStreamRef.current) {
      await handleCallActivateCamera();
      if (!callLocalStreamRef.current) {
        setCallError('No se pudo activar la cámara para aceptar la llamada.');
        return;
      }
    }
    if (!msgSocketRef.current || msgSocketRef.current.readyState !== WebSocket.OPEN) {
      setCallError('El chat de mensajes no está conectado.');
      return;
    }
    try {
      const peer = Number(callPeerIdRef.current);
      console.log('[CALL][accept:send][Client] with=', peer);
      msgSocketRef.current.send(JSON.stringify({ type: 'call:accept', with: peer }));
      setCallRole('callee');
      callRoleRef.current = 'callee';
      setCallStatus('connecting');
      setCallError('');
    } catch (e) {
      console.error('[CALL][accept:send][Client] error', e);
      setCallError('No se pudo aceptar la llamada.');
    }
  };


  //Rechazar invitación
  const handleCallReject = () => {
    if (guardSensitiveAction({ setError: setCallError })) return;
    if (!callPeerId) return;
    if (!msgSocketRef.current || msgSocketRef.current.readyState !== WebSocket.OPEN) {
      setCallError('El chat de mensajes no está conectado.');
      return;
    }
    try {
      console.log('[CALL][reject:send] with=', callPeerId);
      msgSocketRef.current.send(JSON.stringify({ type: 'call:reject', with: Number(callPeerId) }));
      cleanupCall('rejected');
    } catch (e) {
      console.error('[CALL][reject:send] error', e);
      setCallError('No se pudo rechazar la llamada.');
    }
  };


  // Colgar / Cancelar force=true para casos de navegación donde queremos limpiar aunque el WS falle
  const handleCallEnd = (force = false) => {
    try {
      if (callStatus === 'ringing' && callRole === 'caller') {
        if (msgSocketRef.current?.readyState === WebSocket.OPEN) {
          console.log('[CALL][hangup:send] cancel (ringing)');
          msgSocketRef.current.send(JSON.stringify({ type: 'call:cancel', to: Number(callPeerId) }));
        }
      } else if (callStatus === 'in-call' || callStatus === 'connecting') {
        if (msgSocketRef.current?.readyState === WebSocket.OPEN) {
          console.log('[CALL][hangup:send] end (in-call)');
          msgSocketRef.current.send(JSON.stringify({ type: 'call:end' }));
        }
      }
    } catch (e) {
      console.warn('[CALL][hangup] send error', e);
    } finally {
      if (force) cleanupCall('forced-end');
    }
  };


  //Crear Peer y cablear eventos
  const wireCallPeer = (initiator) => {
    if (!callLocalStreamRef.current) {
      setCallError('No hay cámara activa.');
      return;
    }
    if (callPeerRef.current) {
      try { callPeerRef.current.destroy(); } catch {}
      callPeerRef.current = null;
    }

    console.log('[CALL][peer:create][Client] initiator=', initiator);
    const p = new Peer({
      initiator,
      trickle: true,
      stream: callLocalStreamRef.current,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    });
    p.on('signal', (signal) => {
      try {
        const type = signal?.type || (signal?.candidate ? 'candidate' : 'unknown');
        if (type === 'candidate') {
          const cand = signal?.candidate;
          if (!cand || cand.candidate === '' || cand.candidate == null) return;
        }
        const toId   = Number(callPeerIdRef.current);
        const wsOpen = msgSocketRef.current?.readyState === WebSocket.OPEN;
        const validTo = Number.isFinite(toId) && toId > 0;
        console.log('[CALL][signal:out][Client]', { type, toId, wsOpen, validTo });
        if (wsOpen && validTo) {
          msgSocketRef.current.send(JSON.stringify({ type: 'call:signal', to: toId, signal }));
        } else {
          console.warn('[CALL][signal:out][Client] omitido -> socket no abierto o toId inválido', { toId, wsOpen, validTo });
        }
      } catch (e) {
        console.warn('[CALL][signal:out][Client] error', e);
      }
    });
    p.on('connect', () => {
      console.log('[CALL][peer:connected][Client]');
      // Solo el CALLER notifica call:connected para evitar doble startSession
      if (callRoleRef.current !== 'caller') return;
      const ws = msgSocketRef.current;
      const toId = Number(callPeerIdRef.current);
      if (ws?.readyState === WebSocket.OPEN && Number.isFinite(toId) && toId > 0) {
        ws.send(JSON.stringify({ type: 'call:connected', with: toId }));
        console.log('[CALL][connected] enviado ->', toId);
      }
    });
    p.on('stream', (stream) => {
      console.log('[CALL][remote:stream][Client] tracks=', stream.getTracks().length);
      setCallRemoteStream(stream);
    });

    p.on('error', (err) => {
      //console.error('[CALL][peer:error][Client]', err);
      setCallError('No se pudo establecer la llamada. Inténtalo de nuevo.');
    });

    p.on('close', () => {
      console.log('[CALL][peer:close][Client]');
    });

    callPeerRef.current = p;
  };


  //Limpieza integral de llamada
  const cleanupCall = useCallback((reason = 'cleanup') => {
    console.log('[CALL][cleanup] reason=', reason);
    resetCallTechMediaReadySignal();

    // 1) timers
    if (callPingRef.current) {
      clearInterval(callPingRef.current);
      callPingRef.current = null;
    }
    if (callRingTimeoutRef.current) {
      clearTimeout(callRingTimeoutRef.current);
      callRingTimeoutRef.current = null;
    }

    // 2) peer/webrtc
    if (callPeerRef.current) {
      try { callPeerRef.current.destroy(); } catch {}
      callPeerRef.current = null;
    }

    // 3) remote stream + DOM video (evitar “frame congelado”)
    if (callRemoteStream) {
      setCallRemoteMediaState(createMediaStateSnapshot(callRemoteStream, {
        status: 'lost',
        lastReason: `call:cleanup:${reason}`,
      }));
      try { callRemoteStream.getTracks().forEach(t => t.stop()); } catch {}
      setCallRemoteStream(null);
    } else {
      setCallRemoteMediaState(createMediaStateSnapshot(null, {
        status: 'idle',
        lastReason: `call:cleanup:${reason}:remote-idle`,
      }));
    }
    resetMediaObserver(callRemoteMediaCleanupRef);
    if (callRemoteVideoRef?.current) {
      try {
        callRemoteVideoRef.current.srcObject = null;
        // forzamos repaint del elemento
        if (typeof callRemoteVideoRef.current.load === 'function') {
          callRemoteVideoRef.current.load();
        }
      } catch {}
    }

    // 4) local observer siempre; el stream local solo se destruye en cierre total
    resetMediaObserver(callLocalMediaCleanupRef);

    // 4.1) local stream (solo si cierre total)
    if (reason === 'forced-end' || reason === 'ended' || reason === 'canceled') {
      if (callLocalStreamRef.current) {
        setCallLocalMediaState(createMediaStateSnapshot(callLocalStreamRef.current, {
          status: 'lost',
          lastReason: `call:cleanup:${reason}`,
        }));
        try { callLocalStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
      } else {
        setCallLocalMediaState(createMediaStateSnapshot(null, {
          status: 'idle',
          lastReason: `call:cleanup:${reason}:local-idle`,
        }));
      }
      callLocalStreamRef.current = null;
      setCallCameraActive(false);
      if (callLocalVideoRef?.current) {
        try { callLocalVideoRef.current.srcObject = null; callLocalVideoRef.current.load?.(); } catch {}
      }
    }

    // 5) estado UI de Calling (limpiar cabecera/nombre/target)
    setCallStatus('idle');
    setCallRole(null);
    callRoleRef.current = null;
    setCallStreamRecordId(null);
    callStreamRecordIdRef.current = null;
    setCallError('');

    // Opcional: ocultar datos del último peer en la UI de Calling
    setCallPeerId(null);
    callPeerIdRef.current = null;
    setCallPeerName('');
    setCallPeerAvatar('');
    // Volver a modo chat con el mismo contacto (si queremos)
    setContactMode('chat');

    // 6) unlock target
    if (callTargetLockedRef.current) {
      callTargetLockedRef.current = false;
      console.log('[CALL][lock] cleanup -> unlock');
    }
  }, [callRemoteStream, resetCallTechMediaReadySignal]);


  // [CALL] Selección directa desde la lista de favoritos (pestaña Calling): no abre chat, solo fija destino
  const handleSelectCallTargetFromFavorites = (favUser) => {
    if (streamingActivo) {
      alert('No puedes seleccionar destino mientras hay streaming random activo.');
      return;
    }

    const peer = Number(favUser?.id ?? favUser?.userId);
    if (!Number.isFinite(peer) || peer <= 0) {
      alert('No se pudo determinar el destinatario correcto.');
      return;
    }
    if (Number(sessionUser?.id) === peer) {
      alert('No puedes llamarte a ti mismo.');
      return;
    }
    const name =
      favUser?.nickname || favUser?.name || favUser?.email || 'Usuario';

    console.log('[CALL][Client] Target seleccionado desde lista (Calling):', peer, name);

    // Fuente de verdad única
    setActivePeer(peer, name, 'call', favUser);

    // UI específica del flujo calling
    setActiveTab('calling');
    setCenterChatPeerName(name);

    // Sincronizar universo CALL
    setCallPeerId(peer);
    callPeerIdRef.current = peer;
    setCallPeerName(name);

    if (favUser?.avatarUrl) setCallPeerAvatar(favUser.avatarUrl);
  };


  //Volver a la lista (favoritos móvil)
  const backToList = () => {

    activePeerRef.current = { id: null, name: '' };

    // Al volver a lista, dejamos de “tener contacto activo”
    setTargetPeerId(null);
    setTargetPeerName('');

    setCenterChatPeerId(null);
    setCenterChatPeerName('');
    setContactMode('chat');
    setShowCenterGifts(false);
    setCenterMessages([]);
    centerSeenIdsRef.current = new Set();
  };



  // Id activo en lista = el objetivo seleccionado
  const selectedContactId = Number(targetPeerId) || null;
  const hasCallTarget = Number(targetPeerId) > 0;
  const hasActiveDetail = Number(targetPeerId) > 0;

  //---FLAG DE RENDERIZADO--//
  const invited   = String(selectedFav?.invited || '').toLowerCase();
  const favStatus = String(selectedFav?.status  || '').toLowerCase();
  const allowChat      = favStatus === 'active'   && invited === 'accepted';
  const isPendingPanel = favStatus === 'inactive' && invited === 'pending';
  const isSentPanel    = favStatus === 'inactive' && invited === 'sent';

  // Detectar si estamos en flujo de entrada (callee)
  const isIncomingFlow =
    callStatus === 'incoming' ||
    (callStatus === 'connecting' && callRoleRef.current === 'callee');
  // Llamadas: solo si el target seleccionado está ACCEPTED/ACTIVE
  const isAcceptedForCall = favStatus === 'active' && invited === 'accepted';
  const callAllowed =
    isIncomingFlow
      ? true
      : (Number(selectedFav?.id) === Number(callPeerId) && isAcceptedForCall);

  const displayName = sessionUser?.nickname || sessionUser?.name || sessionUser?.email || "Cliente";
  const balanceTextDesktop = loadingSaldo
    ? i18n.t('dashboardClient.balance.loading')
    : saldoError
      ? i18n.t('dashboardClient.balance.unavailable')
      : `${i18n.t('dashboardClient.balance.label')} ${fmtEUR(saldo)}`;

  const balanceTextMobile = loadingSaldo
    ? i18n.t('dashboardClient.balance.loading')
    : saldoError
      ? i18n.t('dashboardClient.balance.unavailable')
      : `${i18n.t('dashboardClient.balance.label')} ${fmtEUR(saldo)}`;


  return(
    <StyledContainer>
      <GlobalBlack/>
      <AuthenticatedConsentModal
        open={consentRequired}
        requiredTermsVersion={consentVersion}
        refreshSession={refresh}
      />
      {/* ========= INICIO NAVBAR  ======== */}
      <NavbarClient
        activeTab={activeTab}
        displayName={displayName}
        balanceTextDesktop={balanceTextDesktop}
        balanceTextMobile={balanceTextMobile}
        avatarUrl={profilePic}
        showBottomNav={!inCall}
        onBrandClick={handleLogoClick}
        onGoVideochat={handleGoVideochat}
        onGoFavorites={handleGoFavorites}
        onGoBlog={handleGoBlog}
        onProfile={handleProfile}
        onBuy={handleAddBalance}
        onLogout={handleLogout}
      />
      {/* ========= FIN NAVBAR  ======== */}

      {/* ========= INICIO MAIN  ======== */}
      <StyledMainContent data-tab={activeTab}>
        {activeTab==='videochat'?(
          <VideoChatRandomCliente
            isMobile={isMobile}
            cameraActive={cameraActive}
            remoteStream={remoteStream}
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            sendRandomMediaReady={sendRandomMediaReady}
            vcListRef={vcListRef}
            messages={messages}
            modelNickname={modelNickname}
            giftRenderReady={giftRenderReady}
            getGiftIcon={getGiftIcon}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
            showGifts={showGifts}
            setShowGifts={setShowGifts}
            gifts={gifts}
            sendGiftMatch={sendGiftMatch}
            fmtEUR={fmtEUR}
            searching={searching}
            stopAll={stopAll}
            handleStartMatch={handleStartMatch}
            handleNext={handleNext}
            handleAddFavorite={handleAddFavorite}
            error={error}
            toggleFullscreen={toggleFullscreen}
            remoteVideoWrapRef={remoteVideoWrapRef}
            modelAvatar={modelAvatar}
            handleActivateCamera={handleActivateCamera}
            handleBlockPeer={handleBlockPeer}
            handleReportPeer={handleReportPeer}
            matchGraceRef={matchGraceRef}
            nextDisabled={nexting}
          />
        ):activeTab==='blog'?(
          /* === BLOG PRIVADO A PANTALLA COMPLETA (SIN COLUMNAS) === */
          <div style={{flex:1,minWidth:0,minHeight:0}}>
            <BlogContent mode="private"/>
          </div>
        ):(
          /* === SOLO FAVORITOS USA EL LAYOUT 3 COLUMNAS === */
          <>
            {!isMobile && !showFavoritesFullCall && (
              <StyledLeftColumn data-rail data-surface="favorites-premium">
                {callStatus==='idle'?(
                  <FavoritesClientList
                    onSelect={handleOpenChatFromFavorites}
                    reloadTrigger={favReload}
                    selectedId={selectedContactId}
                  />
                ):(
                  <div style={{padding:8,color:'#adb5bd'}}>{i18n.t('dashboardClient.favorites.inCallLocked')}</div>
                )}
              </StyledLeftColumn>
            )}
            <StyledCenter data-mode={contactMode==='call'?'call':undefined}>
              <VideoChatFavoritosCliente
                isMobile={isMobile}
                handleOpenChatFromFavorites={handleOpenChatFromFavorites}
                favReload={favReload}
                selectedContactId={selectedContactId}
                hasActiveDetail={hasActiveDetail}
                hasCallTarget={hasCallTarget}
                centerChatPeerId={centerChatPeerId}
                centerChatPeerName={centerChatPeerName}
                centerMessages={centerMessages}
                centerLoading={centerLoading}
                centerListRef={centerListRef}
                chatEndRef={chatEndRef}
                centerInput={centerInput}
                setCenterInput={setCenterInput}
                sendCenterMessage={sendCenterMessage}
                allowChat={allowChat}
                isPendingPanel={isPendingPanel}
                isSentPanel={isSentPanel}
                acceptInvitation={acceptInvitation}
                rejectInvitation={rejectInvitation}
                gifts={gifts}
                giftRenderReady={giftRenderReady}
                fmtEUR={fmtEUR}
                showCenterGifts={showCenterGifts}
                setShowCenterGifts={setShowCenterGifts}
                sendGiftMsg={sendGiftMsg}
                contactMode={contactMode}
                enterCallMode={enterCallMode}
                callStatus={callStatus}
                callCameraActive={callCameraActive}
                callPeerId={callPeerId}
                callPeerName={callPeerName}
                callPeerAvatar={callPeerAvatar}
                callRemoteVideoRef={callRemoteVideoRef}
                callLocalVideoRef={callLocalVideoRef}
                callRemoteWrapRef={callRemoteWrapRef}
                callListRef={callListRef}
                handleCallActivateCamera={handleCallActivateCamera}
                handleCallInvite={handleCallInvite}
                handleCallAccept={handleCallAccept}
                handleCallReject={handleCallReject}
                handleCallEnd={handleCallEnd}
                toggleFullscreen={toggleFullscreen}
                backToList={backToList}
                user={sessionUser}
              />
            </StyledCenter>
            {!showFavoritesFullCall && <StyledRightColumn data-surface="favorites-premium"/>}
          </>
        )}
      </StyledMainContent>
      {/* ======FIN MAIN ======== */}


    </StyledContainer>
  );
};

export default DashboardClient;
