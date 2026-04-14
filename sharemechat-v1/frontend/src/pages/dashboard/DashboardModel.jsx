// DashboardModel.jsx
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import i18n from '../../i18n';
import { getResolvedLocale } from '../../i18n/localeUtils';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesModelList from '../favorites/FavoritesModelList';
import { useAppModals } from '../../components/useAppModals';
import { useCallUi } from '../../components/CallUiContext';
import BlogContent from '../blog/BlogContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { faHeart, faVideo, faFilm, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import {
  StyledContainer,StyledIconWrapper,StyledMainContent,
  StyledLeftColumn,StyledCenter,StyledRightColumn,
  StyledLocalVideo,StyledRemoteVideo,
  StyledChatContainer,StyledNavGroup,
  StyledIconBtn,StyledTopActions,StyledVideoTitle,
  StyledVideoArea,StyledChatDock, StyledChatList,
  StyledChatMessageRow,StyledChatBubble,StyledChatInput,
  StyledGiftsPanel,StyledGiftGrid,
  StyledGiftIcon,StyledTitleAvatar,StyledSelectableRow,
  StyledSplit2,StyledPane, StyledThumbsGrid,
  StyledCenterPanel, StyledCenterBody,
  StyledChatScroller,StyledCenterVideochat, StyledFavoritesShell,
  StyledFavoritesColumns,GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';
import NavbarModel from '../../components/navbar/NavbarModel';
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
import VideoChatRandomModelo from './VideoChatRandomModelo';
import VideoChatFavoritosModelo from './VideoChatFavoritosModelo';
import { buildApiUrl, buildWsUrl, WS_PATHS } from '../../config/api';
import { apiFetch } from '../../config/http';
import { useSession } from '../../components/SessionProvider';
import { createMatchSocketEngine } from '../../realtime/matchSocketEngine';
import { createMsgSocketEngine } from '../../realtime/msgSocketEngine';
import {
  attachIceDebugObservers,
  createSelectedIcePairLogger,
  getIceSignalLogDetails,
} from '../../realtime/iceObserver';
import { loadWebRtcPeerConfig } from '../../realtime/webrtcConfig';
import useActiveInteraction from '../../domain/useActiveInteraction';
import Estadistica from './Estadistica';
import { attachMediaObserver, createIdleMediaState, createMediaStateSnapshot, resetMediaObserver } from '../../utils/mediaState';
import AuthenticatedConsentModal from '../../consent/AuthenticatedConsentModal';
import { isAdminSurface } from '../../utils/runtimeSurface';
import { canAccessBackoffice } from '../../utils/backofficeAccess';

const MEDIA_ACK_STABILITY_MS = 1200;

function wireCallingIceObservers({ pc, roleLabel, setConnectionState, setIceConnectionState }) {
  const logSelectedPair = createSelectedIcePairLogger(`scope=calling role=${roleLabel}`);

  attachIceDebugObservers({
    pc,
    logPrefix: `scope=calling role=${roleLabel}`,
    logSelectedPair,
    onStateChange: () => {
      setConnectionState(pc?.connectionState || null);
      setIceConnectionState(pc?.iceConnectionState || null);
      console.log(
        `[ICE_TRACE] ts=${Date.now()} scope=calling role=${roleLabel} event=state iceConnectionState=${pc?.iceConnectionState || 'unknown'} connectionState=${pc?.connectionState || 'unknown'}`
      );
    },
  });

  logSelectedPair(pc);
}

const DashboardModel = () => {
  const {
    alert,
    confirm,
    openPayoutModal,
    openActiveSessionGuard,
    openBlockReasonModal,
    openReportAbuseModal,
    openNextWaitModal
  } = useAppModals();

  const { user: sessionUser, updateUiLocale, refresh } = useSession();
  const { inCall, setInCall } = useCallUi();
  const {
    interaction,
    activateFavoritesChat,
    clearInteraction
  } = useActiveInteraction();
  const [cameraActive, setCameraActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [randomLocalMediaState, setRandomLocalMediaState] = useState(() => createIdleMediaState('random:idle'));
  const [randomRemoteMediaState, setRandomRemoteMediaState] = useState(() => createIdleMediaState('random:remote-idle'));
  const [randomConnectionState, setRandomConnectionState] = useState(null);
  const [randomIceConnectionState, setRandomIceConnectionState] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('videochat');
  const [saldoModel, setSaldoModel] = useState(null);
  const [loadingSaldoModel, setLoadingSaldoModel] = useState(false);
  const [status, setStatus] = useState('');
  const [queuePosition, setQueuePosition] = useState(null);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [currentClientRole, setCurrentClientRole] = useState(null);
  const [favReload, setFavReload] = useState(0);
  const [selectedFav, setSelectedFav] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [giftsLoaded, setGiftsLoaded] = useState(false);
  const [giftRenderReady, setGiftRenderReady] = useState(false);
  const [webrtcPeerConfig, setWebrtcPeerConfig] = useState(null);
  const [webrtcConfigReady, setWebrtcConfigReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [centerMessages, setCenterMessages] = useState([]);
  const [centerInput, setCenterInput] = useState('');
  const [centerChatPeerName, setCenterChatPeerName] = useState('');
  const [centerLoading, setCenterLoading] = useState(false);
  const [showMsgPanel, setShowMsgPanel] = useState(false);
  const [openChatWith, setOpenChatWith] = useState(null);
  const [msgConnected, setMsgConnected] = useState(false);
  const [clientNickname, setClientNickname] = useState('Cliente');
  const [clientAvatar, setClientAvatar] = useState('');
  const [targetPeerId, setTargetPeerId] = useState(null);
  const [targetPeerName, setTargetPeerName] = useState('');
  const [contactMode, setContactMode] = useState(null); // 'chat' | 'call' | null
  const [nexting, setNexting] = useState(false);


  // ====== CALLING (1-a-1) ======
  const [callCameraActive, setCallCameraActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callPeerId, setCallPeerId] = useState(null);
  const [callPeerName, setCallPeerName] = useState('');
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [callLocalMediaState, setCallLocalMediaState] = useState(() => createIdleMediaState('call:idle'));
  const [callRemoteMediaState, setCallRemoteMediaState] = useState(() => createIdleMediaState('call:remote-idle'));
  const [callConnectionState, setCallConnectionState] = useState(null);
  const [callIceConnectionState, setCallIceConnectionState] = useState(null);
  const [callError, setCallError] = useState('');
  const [callRole, setCallRole] = useState(null); // 'caller' | 'callee'
  const [callStreamRecordId, setCallStreamRecordId] = useState(null);
  const [callPeerAvatar, setCallPeerAvatar] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [mobileFavMode, setMobileFavMode] = useState('list');
  // ====== STATS (Model tier snapshot summary) ======
  const [modelStatsSummary, setModelStatsSummary] = useState(null);
  const [modelStatsLoading, setModelStatsLoading] = useState(false);
  const [modelStatsError, setModelStatsError] = useState('');
  const [modelStats, setModelStats] = useState(null); // { current, history, tiers }
  const [modelStatsDays, setModelStatsDays] = useState(30);
  const [modelStatsDetailLoading, setModelStatsDetailLoading] = useState(false);
  const [modelStatsDetailError, setModelStatsDetailError] = useState('');
  // ====== SALDO CLIENTE RANDOM ======
  const [clientSaldo, setClientSaldo] = useState(null);
  const [clientSaldoLoading, setClientSaldoLoading] = useState(false);
  // ====== SALDO CLIENTE (CALL 1-a-1) ======
  const [callClientSaldo, setCallClientSaldo] = useState(null);
  const [callClientSaldoLoading, setCallClientSaldoLoading] = useState(false);

  // ===  UseRef ===
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
  const callStatusRef = useRef(callStatus);
  const msgSocketRef = useRef(null);
  const msgPingRef = useRef(null);
  const msgReconnectRef = useRef(null);
  const centerSeenIdsRef = useRef(new Set());
  const modelCenterListRef = useRef(null);
  const activeTabRef = useRef(activeTab);

  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const meIdRef = useRef(null);
  const peerIdRef = useRef(null);
  const nextGuardRef = useRef(false);
  const statsSummaryLoadedRef = useRef(false);
  const activePeerRef = useRef({ id: null, name: '' });
  const [activeStreamRecordId, setActiveStreamRecordId] = useState(null);
  const activeStreamRecordIdRef = useRef(null);
  const matchEngineRef = useRef(null);
  const msgEngineRef = useRef(null);
  const lastSentRef = useRef({ text: null, at: 0 });
  const cameraActiveRef = useRef(false);
  const mediaReadySentRef = useRef(false);
  const randomTechMediaReadySentRef = useRef(false);
  const callTechMediaReadySentRef = useRef(false);
  const randomMediaAckSentRef = useRef(false);
  const randomMediaAckTimerRef = useRef(null);
  const callMediaAckSentRef = useRef(false);
  const callMediaAckTimerRef = useRef(null);
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

  const resetRandomMediaAckSignal = useCallback(() => {
    randomMediaAckSentRef.current = false;
    if (randomMediaAckTimerRef.current) {
      clearTimeout(randomMediaAckTimerRef.current);
      randomMediaAckTimerRef.current = null;
    }
  }, []);

  const resetCallMediaAckSignal = useCallback(() => {
    callMediaAckSentRef.current = false;
    if (callMediaAckTimerRef.current) {
      clearTimeout(callMediaAckTimerRef.current);
      callMediaAckTimerRef.current = null;
    }
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

  const sendRandomMediaAck = useCallback(async () => {
    const streamId = Number(activeStreamRecordIdRef.current);
    if (randomMediaAckSentRef.current) return;
    if (!Number.isFinite(streamId) || streamId <= 0) return;

    randomMediaAckSentRef.current = true;
    try {
      await apiFetch(`/streams/${streamId}/ack-media`, { method: 'POST' });
    } catch (err) {
      randomMediaAckSentRef.current = false;
      console.error('[RANDOM][ack-media][Model] failed', err);
    }
  }, []);

  const sendCallMediaAck = useCallback(async () => {
    const streamId = Number(callStreamRecordIdRef.current);
    if (callMediaAckSentRef.current) return;
    if (!Number.isFinite(streamId) || streamId <= 0) return;

    callMediaAckSentRef.current = true;
    try {
      await apiFetch(`/streams/${streamId}/ack-media`, { method: 'POST' });
    } catch (err) {
      callMediaAckSentRef.current = false;
      console.error('[CALL][ack-media][Model] failed', err);
    }
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

    if (typeof gift.icon === 'string' && gift.icon.trim()) {
      return gift.icon;
    }

    const giftId = Number(gift.giftId ?? gift.id);
    if (!Number.isFinite(giftId) || giftId <= 0) return null;

    const found = gifts.find(gg => Number(gg.id) === giftId);
    return found?.icon || null;
  };


  const normalizeGiftFromPayload = (gift) => {
    if (!gift) return null;

    const giftId = Number(gift.giftId ?? gift.id);
    if (!Number.isFinite(giftId) || giftId <= 0) return null;

    const costValue = gift.cost;
    const parsedCost =
      costValue === null || costValue === undefined || costValue === ''
        ? null
        : Number(costValue);

    return {
      giftId,
      id: giftId,
      code: gift.code ?? null,
      name: gift.name ?? '',
      icon: gift.icon ?? null,
      cost: Number.isFinite(parsedCost) ? parsedCost : null,
      tier: gift.tier ?? null,
      featured: typeof gift.featured === 'boolean' ? gift.featured : null,
    };
  };


  const buildLegacyGiftFromBody = (body) => {
    if (typeof body !== 'string') return null;
    if (!body.startsWith('[[GIFT:') || !body.endsWith(']]')) return null;

    try {
      const parts = body.slice(2, -2).split(':');
      if (parts.length < 3 || parts[0] !== 'GIFT') return null;

      const giftId = Number(parts[1]);
      if (!Number.isFinite(giftId) || giftId <= 0) return null;

      const catalogGift = gifts.find(gg => Number(gg.id) === giftId);

      return {
        giftId,
        id: giftId,
        code: catalogGift?.code ?? null,
        name: catalogGift?.name ?? parts.slice(2).join(':'),
        icon: catalogGift?.icon ?? null,
        cost: catalogGift?.cost != null ? Number(catalogGift.cost) : null,
        tier: catalogGift?.tier ?? null,
        featured: typeof catalogGift?.featured === 'boolean' ? catalogGift.featured : null,
      };
    } catch {
      return null;
    }
  };

  const resolveGiftMessage = (raw) => {
    const structuredGift = normalizeGiftFromPayload(raw?.gift);
    if (structuredGift) return structuredGift;
    return buildLegacyGiftFromBody(raw?.body);
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

    console.log('[ActiveInteraction][Model] synced favorites chat', {
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
    console.log('[ActiveInteraction][Model] current state', interaction);
  }, [interaction]);


  useEffect(() => {
    let active = true;

    loadWebRtcPeerConfig()
      .then((config) => {
        if (!active) return;
        setWebrtcPeerConfig(config);
        setWebrtcConfigReady(true);
      })
      .catch((err) => {
        console.error('[WEBRTC][config][Model] load failed', err);
        if (!active) return;
        setWebrtcPeerConfig(null);
        setWebrtcConfigReady(false);
      });

    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
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

      role: 'model',
      initiator: false,

      cameraActiveGetter: () => cameraActiveRef.current,

      // Payload exacto de tu startWebSocketAndWait (lang/country)
      getRolePayload: () => {
        const lang = String(sessionUser?.lang || sessionUser?.language || navigator.language || 'es').toLowerCase().split('-')[0];
        const country = String(sessionUser?.country || 'ES').toUpperCase();
        return { type: 'set-role', role: 'model', lang, country };
      },

      // Model: ping más “normal” y stats en ping (como tu startWebSocketAndWait)
      useFastPingOnOpen: false,
      pingEveryMs: 15000,
      sendStatsOnPing: true,
      peerConfig: webrtcPeerConfig,

      // Model: meta por rol (streamRecordId, currentClientId, clientBalance)
      onMatchMeta: (data) => {
        mediaReadySentRef.current = false;
        resetRandomTechMediaReadySignal();
        resetRandomMediaAckSignal();
        setRandomConnectionState(null);
        setRandomIceConnectionState(null);
        // streamRecordId
        try {
          const sid = data?.streamRecordId;
          const parsed = (sid !== null && sid !== undefined && Number.isFinite(Number(sid))) ? Number(sid) : null;
          setActiveStreamRecordId(parsed);
          activeStreamRecordIdRef.current = parsed;
        } catch {
          setActiveStreamRecordId(null);
          activeStreamRecordIdRef.current = null;
        }

        // currentClientId
        try {
          if (data.peerRole === 'client' && Number.isFinite(Number(data.peerUserId))) {
            setCurrentClientId(Number(data.peerUserId));
          } else {
            setCurrentClientId(null);
          }
        } catch {
          setCurrentClientId(null);
        }

        // client balance
        try {
          setClientSaldoLoading(true);
          const v = data?.clientBalance;
          setClientSaldo(v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
        } catch {
          setClientSaldo(null);
        } finally {
          setClientSaldoLoading(false);
        }
      },

      onPeerStateChange: (peerState) => {
        setRandomConnectionState(peerState?.connectionState || null);
        setRandomIceConnectionState(peerState?.iceConnectionState || null);
      },

      // Chat / Gift como tu código original
      isEcho,
      onChatMessage: (data) => {
        if (!isEcho(data.message)) {
          setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
        }
      },

      onGiftMessage: (data) => {
        const mine = Number(data.fromUserId) === Number(sessionUser?.id);
        const gift = normalizeGiftFromPayload(data.gift);

        setMessages((prev) => [
          ...prev,
          {
            from: mine ? 'me' : 'peer',
            text: '',
            gift,
          },
        ]);
      },

      // Model: no-client-available
      noPeerAvailableType: 'no-client-available',
      onNoPeerAvailable: () => {
        setError('');
        setStatus(i18n.t('dashboardModel.status.waitingClient'));
        setSearching(true);
      },

      // Model: peer-disconnected (tu startWebSocketAndWait)
      onPeerDisconnectedPost: (data) => {
        resetRandomTechMediaReadySignal();
        setCurrentClientId(null);
        setClientSaldo(null);
        setClientSaldoLoading(false);

        setRemoteStream(null);
        setMessages([]);
        setError('');
        setStatus(i18n.t('dashboardModel.status.searchingNewClient'));
        setSearching(true);

        try {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'start-match' }));
            socketRef.current.send(JSON.stringify({ type: 'stats' }));
          }
        } catch {}
      },

      // Model: cola
      onUnhandled: (data) => {
        if (data.type === 'queue-stats' && typeof data.position === 'number') {
          setQueuePosition(data.position);
        }
      },
    });

    msgEngineRef.current = createMsgSocketEngine({
      buildWsUrl,
      WS_PATHS,

      msgSocketRef,
      msgPingRef,
      msgReconnectRef,

      setReady: setMsgConnected,
      clearMsgTimers,

      callStatusRef,
      callPeerIdRef,

      beforeCallPing: () => setCallClientSaldoLoading(true),

      onMessage: (ev) => {
        handleMsgSocketMessageModel(ev);
      },
    });
  }, [webrtcPeerConfig]);


  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);


  useEffect(() => {
    meIdRef.current = Number(sessionUser?.id) || null;
  }, [sessionUser?.id]);


  // Autoscroll en el chat central
  useLayoutEffect(() => {
    const el = modelCenterListRef?.current;
    if (!el) return;
    const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 120;
    if (nearBottom || !centerMessages.length) {
      el.scrollTop = el.scrollHeight;
    }
  }, [centerMessages, centerLoading]);


  //**** MOVIL ****/
  useEffect(() => {
    const mq = window.matchMedia('(max-width:768px)');
    const onChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange); // Safari viejo
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);


  useEffect(() => {
    if (!sessionUser?.id) return;

    (async () => {
      try {
        const d = await apiFetch('/models/documents/me');
        setProfilePic(d?.urlPic || null);
      } catch {}
    })();
  }, [sessionUser?.id]);


  useEffect(() => {
    if (!sessionUser?.id || !currentClientId) {
      setClientNickname('Cliente');
      setCurrentClientRole(null);
      return;
    }
    (async () => {
      try {
        const d = await apiFetch(`/users/${currentClientId}`);
        const nn = d?.nickname || d?.name || d?.email || 'Cliente';
        const role = String(d?.role || '').toUpperCase() || null;
        setClientNickname(nn);
        setCurrentClientRole(role);
      } catch {
        setClientNickname('Cliente');
        setCurrentClientRole(null);
      }
    })();
  }, [sessionUser?.id, currentClientId]);


  useEffect(() => {
    if (!sessionUser?.id || !currentClientId) return;

    (async () => {
      try {
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(currentClientId)}`); // { [id]: url }
        const url = map?.[currentClientId] || '';
        setClientAvatar(url);
      } catch {/* noop */}

    })();
  }, [sessionUser?.id, currentClientId]);


  // [CALL][Model] Solo aseguramos UI (nombre) y socket. El peer “verdadero
  useEffect(() => {
    if (contactMode !== 'call') return;
    const peerId = Number(activePeerRef.current?.id);
    if (!Number.isFinite(peerId) || peerId <= 0) return;

    const nm = activePeerRef.current?.name || callPeerName || targetPeerName || 'Usuario';
    setCenterChatPeerName(nm);
    openMsgSocket?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactMode]);


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
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=bindRemoteVideo streamId=${remoteStream.id || 'null'} trackCount=${tracks.length} tracks=${trackSummary} assignSrcObject=true`
      );
      remoteVideoRef.current.srcObject = remoteStream;
    } else if (remoteVideoRef.current) {
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=bindRemoteVideo streamId=null trackCount=0 tracks= assignSrcObject=false clearSrcObject=true`
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
    if (!remoteStream || !currentClientId) {
      resetRandomTechMediaReadySignal();
      resetRandomMediaAckSignal();
    }
  }, [remoteStream, currentClientId, resetRandomMediaAckSignal, resetRandomTechMediaReadySignal]);


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
      resetCallMediaAckSignal();
    }
  }, [callStatus, resetCallMediaAckSignal, resetCallTechMediaReadySignal]);

  useEffect(() => {
    resetCallTechMediaReadySignal();
    resetCallMediaAckSignal();
  }, [callPeerId, callStreamRecordId, resetCallMediaAckSignal, resetCallTechMediaReadySignal]);

  useEffect(() => {
    if (randomLocalMediaState.status !== 'live') return;
    if (randomRemoteMediaState.status !== 'live') return;
    if (!Number.isFinite(Number(currentClientId)) || Number(currentClientId) <= 0) return;
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    if (randomTechMediaReadySentRef.current) return;
    sendRandomTechMediaReady();
  }, [
    currentClientId,
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

  useEffect(() => {
    const usableConnection =
      randomConnectionState === 'connected'
      || randomIceConnectionState === 'connected'
      || randomIceConnectionState === 'completed';

    if (randomLocalMediaState.status !== 'live'
      || randomRemoteMediaState.status !== 'live'
      || !usableConnection
      || !Number.isFinite(Number(activeStreamRecordId))
      || Number(activeStreamRecordId) <= 0) {
      if (randomMediaAckTimerRef.current) {
        clearTimeout(randomMediaAckTimerRef.current);
        randomMediaAckTimerRef.current = null;
      }
      return;
    }

    if (randomMediaAckSentRef.current || randomMediaAckTimerRef.current) return;

    randomMediaAckTimerRef.current = setTimeout(() => {
      randomMediaAckTimerRef.current = null;
      void sendRandomMediaAck();
    }, MEDIA_ACK_STABILITY_MS);

    return () => {
      if (randomMediaAckTimerRef.current) {
        clearTimeout(randomMediaAckTimerRef.current);
        randomMediaAckTimerRef.current = null;
      }
    };
  }, [
    activeStreamRecordId,
    randomConnectionState,
    randomIceConnectionState,
    randomLocalMediaState.status,
    randomRemoteMediaState.status,
    sendRandomMediaAck,
  ]);

  useEffect(() => {
    const usableConnection =
      callConnectionState === 'connected'
      || callIceConnectionState === 'connected'
      || callIceConnectionState === 'completed';

    if (callLocalMediaState.status !== 'live'
      || callRemoteMediaState.status !== 'live'
      || !usableConnection
      || !Number.isFinite(Number(callStreamRecordId))
      || Number(callStreamRecordId) <= 0
      || (callStatus !== 'connecting' && callStatus !== 'in-call')) {
      if (callMediaAckTimerRef.current) {
        clearTimeout(callMediaAckTimerRef.current);
        callMediaAckTimerRef.current = null;
      }
      return;
    }

    if (callMediaAckSentRef.current || callMediaAckTimerRef.current) return;

    callMediaAckTimerRef.current = setTimeout(() => {
      callMediaAckTimerRef.current = null;
      void sendCallMediaAck();
    }, MEDIA_ACK_STABILITY_MS);

    return () => {
      if (callMediaAckTimerRef.current) {
        clearTimeout(callMediaAckTimerRef.current);
        callMediaAckTimerRef.current = null;
      }
    };
  }, [
    callConnectionState,
    callIceConnectionState,
    callLocalMediaState.status,
    callRemoteMediaState.status,
    callStatus,
    callStreamRecordId,
    sendCallMediaAck,
  ]);

  useEffect(() => () => {
    resetMediaObserver(randomLocalMediaCleanupRef);
    resetMediaObserver(randomRemoteMediaCleanupRef);
    resetMediaObserver(callLocalMediaCleanupRef);
    resetMediaObserver(callRemoteMediaCleanupRef);
    resetRandomMediaAckSignal();
    resetCallMediaAckSignal();
  }, []);


  useEffect(() => {
      peerIdRef.current = Number(openChatWith) || null;
  }, [openChatWith]);


  // Mantener compatibilidad: reflejar target -> openChatWith (mientras migramos)
  useEffect(() => {
    if (Number(targetPeerId) > 0) {
      const id = Number(targetPeerId);
      const name = targetPeerName || 'Usuario';

      setOpenChatWith(id);
      setCenterChatPeerName(name);

      // NUEVO: mantener ref sincronizado en modo compat
      activePeerRef.current = { id, name };
    } else {
      setOpenChatWith(null);
      setCenterChatPeerName('');
      activePeerRef.current = { id: null, name: '' };
    }
  }, [targetPeerId, targetPeerName]);


  useEffect(()=>{

    apiFetch('/gifts')
      .then(arr=>{
        setGifts(Array.isArray(arr)?arr:[]);
        setGiftsLoaded(true);
      })
      .catch(()=> setGiftsLoaded(true));

  },[]);


  useEffect(() => {
    if (!giftsLoaded) { setGiftRenderReady(false); return; }
    const t = setTimeout(() => setGiftRenderReady(true), 200);
    return () => clearTimeout(t);
  }, [giftsLoaded]);


  // Autoscroll chat central
  useEffect(() => {
    const el = modelCenterListRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [centerMessages, centerLoading, openChatWith]);


  // Autoscroll overlay de VIDEOCHAT (messages)
  useEffect(() => {
    const el = vcListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);


  // Autoscroll overlay de CALLING (centerMessages) solo cuando hay llamada
  useEffect(() => {
    if (callStatus !== 'in-call') return;
    const el = callListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [centerMessages, callStatus]);


  // [CALL][Model] target dinámico desde Favoritos (chat central) o favorito seleccionado
  useEffect(() => {
    // Si hay llamada activa O hay lock, no recalculamos destino
    if (callStatus !== 'idle') {
      console.log('[CALL][effect] target-from-favorites skipped (status!=idle) [Model]');
      return;
    }
    if (callTargetLockedRef.current) {
      console.log('[CALL][effect] target-from-favorites skipped (locked) [Model]');
      return;
    }
    const targetId = Number(targetPeerId) || null;
    const legacyVisualId = Number(openChatWith) || null;

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
      callPeerIdRef.current = id; // REF
      setCallPeerName(name);
      console.log('[CALL][Model] target <- targetPeerId:', id, name);
    } else if (legacyVisualId) {
      const id = legacyVisualId;
      const name =
        centerChatPeerName ||
        targetPeerName ||
        activePeerRef.current?.name ||
        'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id; // REF
      setCallPeerName(name);
      console.log('[CALL][Model] target <- openChatWith fallback:', id, name);
    } else {
      setCallPeerId(null);
      callPeerIdRef.current = null; // REF
      setCallPeerName('');
      console.log('[CALL][Model] sin target: abre un chat de Favoritos para elegir destinatario');
    }
  }, [
    callStatus,
    targetPeerId,
    targetPeerName,
    openChatWith,
    centerChatPeerName,
    selectedFav?.id,
    selectedFav?.nickname,
    selectedFav?.name,
    selectedFav?.email
  ]);


  // [CALL][Model] Si tenemos peerId pero el nombre no está “bonito”, lo resolvemos vía API
  useEffect(() => {
    if (!sessionUser?.id) return;
    const id = Number(callPeerId);
    if (!Number.isFinite(id) || id <= 0) return;

    if (callPeerName) return;

    (async () => {
      try {
        console.log('[CALL][Model] Resolviendo nombre via /api/users/', id);
        const d = await apiFetch(`/users/${id}`);
        const nn = d?.nickname || d?.name || d?.email || 'Usuario';
        setCallPeerName(nn);

      } catch {/* noop */}
    })();
  }, [callPeerId, callPeerName]);


  // [CALL][Model] Avatar del destinatario
  useEffect(() => {
    if (!sessionUser?.id) return;
    const id = Number(callPeerId);
    if (!Number.isFinite(id) || id <= 0) return;

    (async () => {
      try {
        console.log('[CALL][Model] Resolviendo avatar via /api/users/avatars?ids=', id);
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(id)}`); // { [id]: url }
        setCallPeerAvatar(map?.[id] || '');

      } catch {/* noop */}
    })();
  }, [callPeerId]);


  // [CALL][Model] Anti-deriva: con llamada activa, target <- call
  useEffect(() => {
    if (callStatus === 'idle') return;
    const cId = Number(callPeerId);
    if (Number.isFinite(cId) && cId > 0 && Number(targetPeerId) !== cId) {
      console.log('[CALL][drift][Model] targetPeerId != callPeerId -> forzar target');
      setTargetPeerId(cId);
      setTargetPeerName(callPeerName || 'Usuario');
    }
  }, [callStatus, callPeerId, callPeerName, targetPeerId]);


  useEffect(() => {
    if (!sessionUser?.id) return;
    const fetchSaldoModel = async () => {
      try {
        setLoadingSaldoModel(true);
        const data = await apiFetch('/models/me');
        setSaldoModel(data.saldoActual);
        setError('');
      } catch (e) {
        console.error(e);
        setError(e.message || 'Error al cargar saldo de modelo');
      } finally {
        setLoadingSaldoModel(false);
      }
    };
    fetchSaldoModel();
  }, []);


  useEffect(() => {
    const peer = Number(targetPeerId);
    if (!peer || activeTab !== 'favoritos') return;
    if (!sessionUser?.id) return;

    console.log('[HISTORY_OWNER][Model] load via effect', { peer });

    const expectedPeer = peer;
    let canceled = false;

    const load = async () => {
      setCenterLoading(true);
      try {
        const data = await apiFetch(`/messages/with/${expectedPeer}`);

        if (canceled) return;
        if (Number(targetPeerId) !== expectedPeer) return;
        if (activeTab !== 'favoritos') return;

        const normalized = (data || []).map(raw => normMsg(raw));

        centerSeenIdsRef.current = new Set((normalized || []).map(m => m.id));
        setCenterMessages(normalized.reverse());

        try {
          await apiFetch(`/messages/with/${expectedPeer}/read`, { method: 'POST' });
        } catch {}

        queueMicrotask(() => {
          const el = modelCenterListRef?.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      } catch (e) {
        console.warn('Historial chat MODEL error:', e?.message);
        setCenterMessages([]);
      } finally {
        if (!canceled) setCenterLoading(false);
      }
    };

    load();

    return () => {
      canceled = true;
    };
  }, [targetPeerId, activeTab, sessionUser?.id]);



  // === Sincronizar flag global inCall (RANDOM + CALLING) ===
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


  // UseEffect Stats
  // 1) Summary: se carga al entrar en Videochat (una vez)
  useEffect(() => {
    if (activeTab !== 'videochat') return;
    if (statsSummaryLoadedRef.current) return;

    if (!sessionUser?.id) return;

    statsSummaryLoadedRef.current = true;

    const loadSummary = async () => {
      try {
        setModelStatsLoading(true);
        setModelStatsError('');
        const data = await apiFetch('/models/stats/summary');
        setModelStatsSummary(data || null);
      } catch (e) {
        console.warn('[MODEL][stats/summary] error:', e?.message);
        setModelStatsError(e?.message || 'Error cargando estadísticas');
        setModelStatsSummary(null);
      } finally {
        setModelStatsLoading(false);
      }
    };

    loadSummary();
  }, [activeTab]);


  // 2) Tiers para Videochat: si estamos en Videochat y NO tenemos tiers todavía,
  useEffect(() => {
    if (activeTab !== 'videochat') return;

    if (!sessionUser?.id) return;

    const tiersCount = Array.isArray(modelStats?.tiers) ? modelStats.tiers.length : 0;
    if (tiersCount > 0) return;

    const loadTiersForVideochat = async () => {
      try {
        setModelStatsDetailLoading(true);
        setModelStatsDetailError('');
        const data = await apiFetch(`/models/stats?days=${encodeURIComponent(30)}`);
        setModelStats(data || null);
      } catch (e) {
        console.warn('[MODEL][stats tiers for videochat] error:', e?.message);
        setModelStatsDetailError(e?.message || 'Error cargando tiers');
        //setModelStats(null);
      } finally {
        setModelStatsDetailLoading(false);
      }
    };

    loadTiersForVideochat();
  }, [activeTab, modelStats?.tiers]);


  const fetchModelStats = useCallback(async (days) => {
    const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
    try {
      setModelStatsDetailLoading(true);
      setModelStatsDetailError('');
      const data = await apiFetch(`/models/stats?days=${encodeURIComponent(safeDays)}`);
      setModelStats(data || null);
    } catch (e) {
      console.warn('[MODEL][stats] error:', e?.message);
      setModelStatsDetailError(e?.message || 'Error cargando estadísticas');
      setModelStats(null);
    } finally {
      setModelStatsDetailLoading(false);
    }
  }, []);

  // 3) Detail para pestaña Estadística: cargar al entrar y al cambiar rango
  useEffect(() => {
    if (activeTab !== 'stats') return;
    if (!sessionUser?.id) return;
    fetchModelStats(modelStatsDays);
  }, [activeTab, modelStatsDays, sessionUser?.id, fetchModelStats]);


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


  const normMsg = (raw) => ({
    id: raw.id,
    senderId: Number(raw.senderId ?? raw.sender_id),
    recipientId: Number(raw.recipientId ?? raw.recipient_id),
    body: raw.body,
    createdAt: raw.createdAt ?? raw.created_at,
    readAt: raw.readAt ?? raw.read_at ?? null,
    gift: resolveGiftMessage(raw),
  });


  const closeMsgSocket = useCallback(() => {
    try { if (msgSocketRef.current) msgSocketRef.current.close(); } catch {}
    msgSocketRef.current = null;
    setMsgConnected(false);
    clearMsgTimers();
  }, [clearMsgTimers]);


  const openMsgSocket = () => {
    if (guardSensitiveAction()) return;
    msgEngineRef.current?.open();
  };

  const handleMsgSocketMessageModel = (ev) => {
    try {
      const data = JSON.parse(ev.data);

      // ==== MENSAJERÍA EXISTENTE ====
      if (data.type === 'msg:new' && data.message) {
        const m = normMsg(data.message);

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
            const el = modelCenterListRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        }
        return;
      }

      if (data.type === 'msg:gift' && data.gift) {
        const me = Number(meIdRef.current);
        const peer = Number(activePeerRef.current?.id);
        if (!me || !peer) return;

        const item = {
          id: data.messageId || `${Date.now()}`,
          senderId: Number(data.from),
          recipientId: Number(data.to),
          body: `[[GIFT:${data.gift.giftId ?? data.gift.id}:${data.gift.name}]]`,
          gift: normalizeGiftFromPayload(data.gift),
          createdAt: data.createdAt ?? new Date().toISOString(),
          readAt: null,
        };

        const belongsToThisChat =
          (item.senderId === peer && item.recipientId === me) ||
          (item.senderId === me && item.recipientId === peer);

        if (belongsToThisChat) {
          const mid = data.messageId;
          if (mid && centerSeenIdsRef.current.has(mid)) return;
          if (mid) centerSeenIdsRef.current.add(mid);

          setCenterMessages(prev => [...prev, item]);
          queueMicrotask(() => {
            const el = modelCenterListRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        }
        return;
      }

      // ==== CALLING ====
      if (data.type === 'call:incoming') {
        const id = Number(data.from);
        const name = String(data.displayName || 'Usuario');

        console.log('[CALL][incoming][Model] from=', id, 'name=', name);

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
            console.error('[CALL][incoming:auto-reject][Model] error', e);
          }

          (async () => {
            try {
              await alert({
                title: 'Llamada entrante',
                message: `${name} te ha intentado llamar. Para recibir llamadas, entra en Favoritos o Videochat.`,
                variant: 'info',
              });
            } catch (e) {
              console.error('[CALL][incoming:auto-reject][Model][modal] error', e);
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
        console.log('[CALL][ringing][Model] to=', callPeerId);

        setCallStatus('ringing');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        callRingTimeoutRef.current = setTimeout(() => {
          console.log('[CALL][ringing] timeout -> cancel local (Model)');
          handleCallEnd(true);
        }, 45000);

        return;
      }

      if (data.type === 'call:accepted') {
        console.log('[CALL][accepted][...] peer=', callPeerIdRef.current, 'role=', callRoleRef.current);

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
          const nm = callPeerName || activePeerRef.current?.name || 'Usuario';
          activePeerRef.current = { id: peer, name: nm };
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
              setCallClientSaldoLoading(true);
              msgSocketRef.current.send(JSON.stringify({
                type: 'call:ping',
                with: Number(callPeerIdRef.current)
              }));
              console.log('[CALL][ping] sent (in-call loop)');
            }
          } catch {}
        }, 30000);

        return;
      }

      if (data.type === 'call:signal' && data.signal) {
        const details = getIceSignalLogDetails(data.signal);
        console.log('[CALL][signal:in][Model]', details.signalType);
        if (details.signalType === 'candidate') {
          console.log(
            `[ICE_TRACE] ts=${Date.now()} scope=calling role=model event=signal-in candidateType=${details.candidateType || 'unknown'} protocol=${details.protocol || 'unknown'} candidateEmpty=${details.candidateEmpty}`
          );
        }

        if (callPeerRef.current) {
          callPeerRef.current.signal(data.signal);
        }
        return;
      }

      if (data.type === 'call:rejected') {
        console.log('[CALL][rejected][Model]');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        setCallStatus('idle');
        setCallError('');

        (async () => {
          try {
            await alert({
              title: 'Llamada rechazada',
              message: data.reason === 'unavailable'
                ? 'La otra persona no está disponible en este momento.'
                : 'El cliente ha rechazado tu llamada.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal de rechazo (Model):', e);
          }
        })();

        return;
      }

      if (data.type === 'call:canceled') {
        console.log('[CALL][canceled][Model] reason=', data.reason);

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        cleanupCall('canceled');
        return;
      }

      if (data.type === 'call:ended') {
        console.log('[CALL][ended][Model] reason=', data.reason);

        cleanupCall('ended');
        return;
      }

      if (data.type === 'call:no-balance') {
        console.log('[CALL][no-balance][Model]');

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        (async () => {
          try {
            await alert({
              title: 'Sin saldo del cliente',
              message: 'El cliente no tiene saldo suficiente para continuar la llamada.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal no-balance (Model):', e);
          }
        })();

        return;
      }

      if (data.type === 'call:busy') {
        console.log('[CALL][busy][Model]', data);

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        (async () => {
          try {
            await alert({
              title: 'Cliente ocupado',
              message: 'El cliente está en otra llamada o en streaming.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal de ocupado (Model):', e);
          }
        })();

        return;
      }

      if (data.type === 'call:offline') {
        console.log('[CALL][offline][Model]');

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError('');

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        (async () => {
          try {
            await alert({
              title: 'Cliente no disponible',
              message: 'El cliente no está conectado en este momento.',
              variant: 'info',
            });
          } catch (e) {
            console.error('Error mostrando modal de offline (Model):', e);
          }
        })();

        return;
      }

      if (data.type === 'call:error') {
        console.log('[CALL][error][Model]', data.message);

        setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
        setCallError(String(data.message || 'Error en la llamada'));

        if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

        return;
      }

      if (data.type === 'call:saldo') {
        const v = data?.clientBalance;

        setCallClientSaldo(
          v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null
        );

        setCallClientSaldoLoading(false);
        return;
      }
    } catch (e) {
      // silenciar parse errors
    }
  };


  useEffect(() => {
     if (!sensitiveEnabled) {
       closeMsgSocket();
       return undefined;
     }
     openMsgSocket();
     return () => closeMsgSocket();
     // eslint-disable-next-line react-hooks/exhaustive-deps
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
      `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=activateCamera start=true`
    );
    resetMediaObserver(randomLocalMediaCleanupRef);
    setRandomLocalMediaState(createMediaStateSnapshot(null, {
      status: 'requesting',
      lastReason: 'getUserMedia:start',
    }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const tracks = stream.getTracks ? stream.getTracks() : [];
      const trackSummary = tracks.map((t) => `${t.kind}:${t.id}`).join(',');
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=activateCamera success=true trackCount=${tracks.length} tracks=${trackSummary}`
      );
      localStream.current = stream;
      setRandomLocalMediaState(createMediaStateSnapshot(stream, {
        status: 'obtained',
        lastReason: 'getUserMedia:success',
      }));
      attachMediaObserver(stream, setRandomLocalMediaState, randomLocalMediaCleanupRef, 'getUserMedia:success');
      setCameraActive(true);
      setError('');
    } catch (err) {
      console.warn(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=activateCamera success=false message=${err?.message || 'unknown'}`
      );
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara.');
      setRandomLocalMediaState(createMediaStateSnapshot(null, {
        status: 'lost',
        lastReason: 'getUserMedia:error',
      }));
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



  const handleGoStats = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    setActiveTab('stats');
  };


  const handleStartMatch = () => {
    if (guardSensitiveAction({ setError })) return;
    if (!webrtcConfigReady || !Array.isArray(webrtcPeerConfig?.iceServers) || webrtcPeerConfig.iceServers.length === 0) {
      console.error('[WEBRTC][config][Model] unavailable for random match');
      setError(i18n.t('common.errors.connectionSetupFailedRetry'));
      return;
    }

    setActiveStreamRecordId(null);
    activeStreamRecordIdRef.current = null;

    matchEngineRef.current?.start();
  };


  const handleNext = () => {
    if (guardSensitiveAction({ setError })) return;
    // Guard local (doble click rápido)
    if (nexting) return;

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError('No se pudo conectar. Inténtalo de nuevo.');
      return;
    }

    // Si no hay remoto y ya estamos buscando, no spameamos NEXT
    if (!remoteStream && searching) {
      return;
    }

    try {
      setNexting(true);
      resetRandomTechMediaReadySignal();
      socketRef.current.send(JSON.stringify({ type: 'next' }));
    } catch (e) {
      console.error('[MODEL][NEXT] send error', e);
      setNexting(false);
      setError('No se pudo pasar a la siguiente persona. Inténtalo de nuevo.');
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
      setMessages((prev) => [...prev, { from: 'me', text: message.message }]);
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


  // REPORT/ABUSE (RANDOM) - MODEL SIDE
  const handleReportPeer = async () => {
    const id = Number(currentClientId);

    if (!Number.isFinite(id) || id <= 0) {
      await alert({
        title: 'Reportar abuso',
        message: 'No se pudo identificar al cliente actual.',
        variant: 'warning',
      });
      return;
    }

    const displayName = clientNickname || `Usuario #${id}`;

    // Modal de report (el nuevo, igual que cliente)
    const report = await openReportAbuseModal({ displayName });
    if (!report?.confirmed) return;

    // StreamRecordId: en Model lo tienes
    const streamRecordId = Number(activeStreamRecordIdRef.current);
    const streamIdToSend =
      Number.isFinite(streamRecordId) && streamRecordId > 0 ? streamRecordId : null;

    try {
      await apiFetch('/reports/abuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedUserId: id,
          streamRecordId: streamIdToSend,
          reportType: report.reportType || 'ABUSE',
          description: report.description || '',
          alsoBlock: !!report.alsoBlock,
        }),
      });

      // UX moderación: igual que cliente → salir del peer actual
      if (remoteStream) {
        try {
          handleNext();
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
      console.error('Error reportando abuso (Model):', e);
      await alert({
        title: 'Error',
        message: e?.message || 'No se pudo enviar el reporte.',
        variant: 'danger',
      });
    }
  };


  // ===== BLOQUEOS (RANDOM) - MODEL SIDE =====
  const handleBlockPeer = async () => {
    const id = Number(currentClientId);
    if (!Number.isFinite(id) || id <= 0) {
      await alert({ title:'Bloquear', message:'No se pudo identificar al cliente actual.', variant:'warning' });
      return;
    }

    const displayName = clientNickname || `Usuario #${id}`;
    const pick = await openBlockReasonModal({ displayName });
    if (!pick?.confirmed) return;

    if (!sessionUser?.id) {
      await alert({ title:'Sesión', message:'Sesión expirada. Inicia sesión de nuevo.', variant:'warning' });
      return;
    }

    try {
      await apiFetch(`/blocks/${id}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ reason: pick.reason || 'random-block' }) });

    } catch (e) {
      await alert({ title:'Bloquear', message: e?.message || 'No se pudo bloquear en el servidor.', variant:'danger' });
      return;
    }

    if (remoteStream) {
      try { handleNext(); } catch { stopAll(); }
    } else {
      setSearching(false);
    }

    await alert({ title:'Bloquear', message:'Cliente bloqueado.', variant:'success' });
  };


  const handleProfile = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    history.push('/perfil-model');
  };


  const handleRequestPayout = async () => {

    if (!sessionUser?.id) {
      await alert({
        title: i18n.t('dashboardModel.payout.sessionExpiredTitle'),
        message: i18n.t('dashboardModel.payout.sessionExpiredMessage'),
        variant: 'warning',
      });
      return;
    }

    // 1) Abrimos nuestro modal propio para pedir el importe
    const result = await openPayoutModal({
      title: i18n.t('dashboardModel.payout.requestTitle'),
      message: i18n.t('dashboardModel.payout.requestMessage'),
      initialAmount: 50,
    });

    // Si cierra o cancela el modal
    if (!result || !result.confirmed) return;

    const amount = Number(result.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      await alert({
        title: i18n.t('dashboardModel.payout.invalidAmountTitle'),
        message: i18n.t('dashboardModel.payout.invalidAmountMessage'),
        variant: 'warning',
      });
      return;
    }

    try {
      setLoadingSaldoModel(true);

      // 2) Crear payout con manejo específico de saldo insuficiente
      const payoutRes = await fetch(buildApiUrl('/transactions/payout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: 'Solicitud de retiro',
        }),
      });

      const payoutContentType = payoutRes.headers.get('content-type') || '';
      const payoutData = payoutContentType.includes('application/json')
        ? await payoutRes.json().catch(() => null)
        : null;

      const payoutText = payoutData ? '' : await payoutRes.text().catch(() => '');
      const payoutStatus = Number(payoutData?.status) || payoutRes.status;
      const payoutCode = typeof payoutData?.code === 'string' ? payoutData.code : '';
      const payoutError = typeof payoutData?.error === 'string' ? payoutData.error : '';
      const payoutMessage = typeof payoutData?.message === 'string' ? payoutData.message : payoutText;
      const normalizePayoutSignal = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

      if (!payoutRes.ok) {
        const normalizedCode = normalizePayoutSignal(payoutCode);
        const normalizedError = normalizePayoutSignal(payoutError);
        const normalizedMessage = normalizePayoutSignal(payoutMessage);
        let payoutIssue = null;

        if (payoutStatus === 400) {
          if (normalizedCode === 'insufficient_balance') {
            payoutIssue = 'insufficient_balance';
          } else if (normalizedCode === 'minimum_amount' || normalizedCode === 'payout_minimum_amount') {
            payoutIssue = 'minimum_amount';
          } else if (normalizedError === 'insufficient_balance') {
            payoutIssue = 'insufficient_balance';
          } else if (normalizedError === 'minimum_amount' || normalizedError === 'payout_minimum_amount') {
            payoutIssue = 'minimum_amount';
          } else if (normalizedMessage.includes('saldo insuficiente')) {
            payoutIssue = 'insufficient_balance';
          } else if (
            normalizedMessage.includes('retiro minimo') ||
            normalizedMessage.includes('importe minimo') ||
            normalizedMessage.includes('monto minimo')
          ) {
            payoutIssue = 'minimum_amount';
          }
        }

        if (payoutIssue === 'insufficient_balance') {
          await alert({
            title: i18n.t('dashboardModel.payout.insufficientBalanceTitle'),
            message: i18n.t('dashboardModel.payout.insufficientBalanceMessage'),
            variant: 'warning',
            size: 'sm',
          });
          return;
        }

        if (payoutIssue === 'minimum_amount') {
          await alert({
            title: i18n.t('dashboardModel.payout.minimumAmountTitle'),
            message: i18n.t('dashboardModel.payout.minimumAmountMessage', { amount: 50 }),
            variant: 'warning',
            size: 'sm',
          });
          return;
        }

        throw new Error(payoutMessage || `HTTP ${payoutStatus}`);
      }

      await alert({
        title: i18n.t('dashboardModel.payout.successTitle'),
        message: i18n.t('dashboardModel.payout.successMessage'),
        variant: 'success',
      });

      // 3) Refrescar saldo de la modelo
      const me = await apiFetch('/models/me');
      setSaldoModel(me?.saldoActual ?? null);

    } catch (e) {
      console.error(e);

      await alert({
        title: i18n.t('dashboardModel.payout.errorTitle'),
        message: i18n.t('dashboardModel.payout.errorMessage'),
        variant: 'danger',
      });

    } finally {
      setLoadingSaldoModel(false);
    }
  };


  const stopAll = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // CALLING primero para hacer el teardown más determinista antes de limpiar random/favoritos
    try { handleCallEnd(true); } catch {}
    resetRandomTechMediaReadySignal();
    resetRandomMediaAckSignal();
    setActiveStreamRecordId(null);
    activeStreamRecordIdRef.current = null;
    setRandomConnectionState(null);
    setRandomIceConnectionState(null);

    // RANDOM
    if (localStream.current) {
      setRandomLocalMediaState(createMediaStateSnapshot(localStream.current, {
        status: 'lost',
        lastReason: 'random:stopAll',
      }));
      localStream.current.getTracks().forEach((track) => track.stop());
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

    setCurrentClientId(null);
    setCameraActive(false);
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
    setStatus('');
    setQueuePosition(null);
    setMessages([]);
    setClientSaldo(null);
    setClientSaldoLoading(false);
    setShowMsgPanel(false);
    activePeerRef.current = { id: null, name: '' };
    setTargetPeerId(null);
    setTargetPeerName('');
    setSelectedFav(null);
    setContactMode(null);
    setOpenChatWith(null);
    setCenterChatPeerName('');
    setCenterMessages([]);
    setCenterInput('');
    setSearching(false);
    console.log('[FAVORITES_CONTEXT][Model][stopAll] cleared');
  };

  stopAllRef.current = stopAll;
  closeMsgSocketRef.current = closeMsgSocket;


  const streamingActivo = !!remoteStream;
  const showCallMedia = callStatus === 'in-call';


  // Llamada 1 a 1 en curso (no solo cámara encendida)
  const callEnCurso =
    callStatus === 'connecting' ||
    callStatus === 'in-call' ||
    callStatus === 'ringing' ||
    callStatus === 'incoming';


  // Layout “full call” en Favoritos (escritorio)
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
      alert({ title:'Sesión activa', message:'Tienes una comunicación activa. Pulsa STOP para salir.', variant:'warning' });
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
    // Regla: ACCEPTED + ACTIVE
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


  const handleAddFavorite = async () => {
    if (guardSensitiveAction()) return;
    if (!currentClientId) {
      await alert({
        variant: 'warning',
        title: 'Favoritos',
        message: 'No se pudo identificar al cliente actual.',
      });
      return;
    }

    if (!sessionUser?.id) {
      await alert({
        variant: 'warning',
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
      });
      return;
    }
    if (String(currentClientRole || '').toUpperCase() !== 'CLIENT') {
      await alert({
        variant: 'info',
        title: 'Favoritos no disponibles',
        message: 'Los usuarios trial todavía no pueden añadirse a favoritos.',
      });
      return;
    }

    try {
      // === POST add favorite ===
      try {
        await apiFetch(`/favorites/clients/${currentClientId}`, {
          method: 'POST',
        });
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
            title: i18n.t('dashboardModel.favoriteAlerts.title'),
            message: i18n.t('dashboardModel.favoriteAlerts.clientAlreadyFavorite'),
          });
          return;
        }
        throw e;
      }

      // === META para mensaje contextual ===
      try {
        const meta = await apiFetch('/favorites/clients/meta');

        const found = (meta || [])
          .map(d => ({
            id: d?.user?.id,
            invited: d?.invited,
            status: d?.status,
          }))
          .find(x => Number(x.id) === Number(currentClientId));

        const inv = String(found?.invited || '').toLowerCase();

        if (inv === 'pending') {
          await alert({
            variant: 'success',
            title: 'Solicitud enviada',
            message: 'Se activará cuando el cliente acepte.',
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
            message: 'El cliente rechazó previamente la invitación.',
          });
        } else {
          await alert({
            variant: 'success',
            title: 'Favoritos',
            message: 'Solicitud procesada.',
          });
        }
      } catch {
        // fallback si meta falla
        await alert({
          variant: 'success',
          title: 'Favoritos',
          message: 'Solicitud enviada.',
        });
      }

      // refrescar listas
      setFavReload(x => x + 1);

    } catch (e) {
      console.error(e);
      await alert({
        variant: 'danger',
        title: 'Error',
        message: e?.message || 'No se pudo añadir a favoritos.',
      });
    }
  };


  const setActivePeer = (peerId, peerName, mode, favUser = null) => {
    if (guardSensitiveAction()) return;
    const id = Number(peerId);
    const name = peerName || 'Usuario';

    if (!Number.isFinite(id) || id <= 0) {
      console.warn('[ActivePeer][Model] peerId inválido:', peerId);
      return;
    }

    const prevId = Number(activePeerRef.current?.id) || null;
    const isSamePeer = prevId === id;

    // Autoridad única "viva"
    activePeerRef.current = { id, name };

    // Fuente de verdad del contacto activo (estado React)
    setTargetPeerId(id);
    setTargetPeerName(name);

    if (favUser) setSelectedFav(favUser);

    setContactMode(mode || 'chat');
    setActiveTab('favoritos');
    setShowMsgPanel(true);

    // Solo limpiamos buffers si CAMBIA el peer
    if (!isSamePeer) {
      centerSeenIdsRef.current = new Set();
      setCenterMessages([]);
    }
    setCenterChatPeerName(name);
    openMsgSocket?.();
  };


  const handleOpenChatFromFavorites = (favUser) => {
    if (guardSensitiveAction()) return;
    const peer = Number(favUser?.id ?? favUser?.userId);
    const name =
      favUser?.nickname || favUser?.name || favUser?.email || 'Usuario';

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

    // Panel de invitación pendiente: mantenemos el comportamiento actual
    if (String(favUser?.invited) === 'pending') {
      setCenterMessages([]);
      centerSeenIdsRef.current = new Set();
      setShowMsgPanel(true);
      openMsgSocket?.();
      return;
    }

    // Cargar historial del peer seleccionado (sin tocar openChatWith aquí)
    openChatWithPeer(peer, name);
  };


  const openChatWithPeer = async (peerId, displayName) => {
    if (guardSensitiveAction()) return;
    const peer = Number(peerId);

    if (streamingActivo) {
      alert('No puedes abrir el chat central mientras hay streaming. Pulsa Stop si quieres cambiar.');
      return;
    }

    if (!Number.isFinite(peer) || peer <= 0) {
      console.warn('[openChatWithPeer][Model] peerId inválido:', peerId);
      return;
    }

    setActiveTab('favoritos');
    setCenterChatPeerName(displayName || 'Usuario');
    setCenterMessages([]);
    centerSeenIdsRef.current = new Set();

    openMsgSocket();
    console.log('[HISTORY_OWNER][Model] openChatWithPeer delegated', { peer });
  };


  const sendCenterMessage = () => {
    if (guardSensitiveAction()) return;
    const body = String(centerInput || '').trim();
    if (!body) return;
    const interactionTo = Number(interaction?.actionTarget?.messageToUserId) || null;

    const refTo = Number(activePeerRef.current?.id) || null;
    const targetTo = Number(targetPeerId) || null;
    const legacyVisualTo = Number(openChatWith) || null;
    const legacyTo = refTo || targetTo || legacyVisualTo;
    const finalTo = interactionTo || legacyTo;

    console.log('[PEER_AUTHORITY][Model][sendCenterMessage]', {
      interactionTo,
      refTo,
      targetTo,
      legacyVisualTo,
      finalTo,
      source: interactionTo ? 'interaction' : refTo ? 'activePeerRef' : targetTo ? 'targetPeerId' : 'openChatWith'
    });

    if (!Number.isFinite(finalTo) || finalTo <= 0) {
      console.warn('[sendCenterMessage][Model] destinatario inválido', {
        interactionTo,
        activePeer: activePeerRef.current,
        openChatWith,
        targetPeerId,
        finalTo
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
        console.warn('[sendCenterMessage][Model] error enviando WS', e);
        alert('No se pudo enviar el mensaje. Reintenta.');
      }
    } else {
      alert('Chat de mensajes desconectado. Reabre el panel.');
    }
  };


  const acceptInvitation = async () => {
    if (guardSensitiveAction()) return;
    if (!selectedFav?.id) return;

    try {
      await apiFetch(`/favorites/accept/${selectedFav.id}`, { method: 'POST' });

      const nextFav = selectedFav
        ? { ...selectedFav, invited: 'accepted', status: 'active' }
        : selectedFav;
      const name = nextFav?.nickname || 'Usuario';
      setSelectedFav(prev => prev ? ({ ...prev, invited: 'accepted', status: 'active' }) : prev);
      setFavReload(x => x + 1);
      setShowMsgPanel(false);
      setTimeout(() => setShowMsgPanel(true), 0);

      setActivePeer(nextFav?.id, name, 'chat', nextFav);
      openChatWithPeer(nextFav?.id, name);
      console.log('[INVITATION_ACCEPT][Model] local favorite synced', { peerId: nextFav?.id });
    } catch (e) {
      alert(e.message || 'No se pudo aceptar la invitación');
    }
  };


  const rejectInvitation = async () => {
    if (guardSensitiveAction()) return;
    if (!selectedFav?.id) return;

    try {
      await apiFetch(`/favorites/reject/${selectedFav.id}`, { method: 'POST' });

      setSelectedFav(prev => prev ? ({ ...prev, invited: 'rejected' }) : prev);
      setFavReload(x => x + 1);
    } catch (e) {
      alert(e.message || 'No se pudo rechazar la invitación');
    }
  };


  //Activar cámara para Calling
  const handleCallActivateCamera = async () => {
    if (guardSensitiveAction({ setError: setCallError })) return;
    console.log('[CALL][cam:on][Model] requesting user media');
    resetMediaObserver(callLocalMediaCleanupRef);
    setCallLocalMediaState(createMediaStateSnapshot(null, {
      status: 'requesting',
      lastReason: 'call:getUserMedia:start',
    }));

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
        audio: true,
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
      if (callLocalVideoRef.current) {
        callLocalVideoRef.current.srcObject = stream;
      }
      console.log('[CALL][cam:on][Model] success tracks=', stream.getTracks().length);
    } catch (err) {
      console.error('[CALL][cam:on][Model] error', err);
      setCallError('No se pudo activar la cámara. Revisa los permisos e inténtalo de nuevo.');
      setCallLocalMediaState(createMediaStateSnapshot(null, {
        status: 'lost',
        lastReason: 'call:getUserMedia:error',
      }));
      setCallCameraActive(false);
      setCallStatus('idle');
    }
  };


  //Enviar invitación (modelo llama)
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

    const toId = Number(callPeerIdRef.current ?? callPeerId ?? targetPeerId ?? openChatWith);
    const toName =
      callPeerName ||
      targetPeerName ||
      activePeerRef.current?.name ||
      centerChatPeerName ||
      selectedFav?.nickname ||
      selectedFav?.name ||
      selectedFav?.email ||
      'Usuario';

    if (!Number.isFinite(toId) || toId <= 0) {
      setCallError('Abre un chat de Favoritos para elegir a quién llamar.');
      return;
    }

    if (!msgSocketRef.current || msgSocketRef.current.readyState !== WebSocket.OPEN) {
      setCallError('El chat de mensajes no está conectado.');
      return;
    }

    try {
      console.log('[CALL][invite:send][Model] to=', toId, 'name=', toName);

      setCallPeerId(toId);
      callPeerIdRef.current = toId;
      setCallPeerName(toName);

      msgSocketRef.current.send(JSON.stringify({ type: 'call:invite', to: toId }));

      setCallRole('caller');
      callRoleRef.current = 'caller';

      setCallStatus('connecting');
      setCallError('');

      if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);

      callRingTimeoutRef.current = setTimeout(() => {
        // IMPORTANTE: estado vivo desde ref
        if (callStatusRef.current === 'connecting') {
          console.log('[CALL][invite][Model] no ringing -> cancel');
          handleCallEnd(true);
          setCallError('No se pudo iniciar el timbrado.');
        }
      }, 20000);
    } catch (e) {
      console.error('[CALL][invite:send][Model] error', e);
      setCallError('No se pudo enviar la invitación.');
    }
  };



  //Aceptar invitación (modelo responde)
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
      console.log('[CALL][accept:send][Model] with=', peer);
      msgSocketRef.current.send(JSON.stringify({ type: 'call:accept', with: peer }));
      setCallRole('callee');
      callRoleRef.current = 'callee';
      setCallStatus('connecting');
      setCallError('');
    } catch (e) {
      console.error('[CALL][accept:send][Model] error', e);
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
      console.log('[CALL][reject:send][Model] with=', callPeerId);
      msgSocketRef.current.send(JSON.stringify({ type: 'call:reject', with: Number(callPeerId) }));
      cleanupCall('rejected');
    } catch (e) {
      console.error('[CALL][reject:send][Model] error', e);
      setCallError('No se pudo rechazar la llamada.');
    }
  };


  //Colgar / Cancelar
  const handleCallEnd = (force = false) => {
    try {
      if (callStatus === 'ringing' && callRole === 'caller') {
        if (msgSocketRef.current?.readyState === WebSocket.OPEN) {
          console.log('[CALL][hangup:send][Model] cancel (ringing)');
          msgSocketRef.current.send(JSON.stringify({ type: 'call:cancel', to: Number(callPeerId) }));
        }
      } else if (callStatus === 'in-call' || callStatus === 'connecting') {
        if (msgSocketRef.current?.readyState === WebSocket.OPEN) {
          console.log('[CALL][hangup:send][Model] end (in-call)');
          msgSocketRef.current.send(JSON.stringify({ type: 'call:end' }));
        }
      }
    } catch (e) {
      console.warn('[CALL][hangup][Model] send error', e);
    } finally {
      if (force) cleanupCall('forced-end');
    }
  };


  //Crear Peer y cablear eventos
  const wireCallPeer = (initiator) => {
    if (!webrtcConfigReady || !Array.isArray(webrtcPeerConfig?.iceServers) || webrtcPeerConfig.iceServers.length === 0) {
      console.error('[WEBRTC][config][Model] unavailable for calling peer');
      setCallError(i18n.t('common.errors.connectionSetupFailedRetry'));
      return;
    }
    if (!callLocalStreamRef.current) {
      setCallError('No hay cámara activa.');
      return;
    }
    if (callPeerRef.current) {
      try { callPeerRef.current.destroy(); } catch {}
      callPeerRef.current = null;
    }
    console.log('[CALL][peer:create][Model] initiator=', initiator);
    const p = new Peer({
      initiator,
      trickle: true,
      stream: callLocalStreamRef.current,
      config: webrtcPeerConfig,
    });

    p.on('signal', (signal) => {
      try {
        const details = getIceSignalLogDetails(signal);

        if (details.signalType === 'candidate') {
          const cand = signal?.candidate;
          if (!cand || cand.candidate === '' || cand.candidate == null) return;
        }

        const toId = Number(callPeerIdRef.current);
        const wsOpen = msgSocketRef.current?.readyState === WebSocket.OPEN;
        const validTo = Number.isFinite(toId) && toId > 0;

        console.log('[CALL][signal:out][Model]', { type: details.signalType, toId, wsOpen, validTo });
        if (details.signalType === 'candidate') {
          console.log(
            `[ICE_TRACE] ts=${Date.now()} scope=calling role=model event=signal-out candidateType=${details.candidateType || 'unknown'} protocol=${details.protocol || 'unknown'} candidateEmpty=${details.candidateEmpty}`
          );
        }

        if (wsOpen && validTo) {
          msgSocketRef.current.send(JSON.stringify({
            type: 'call:signal',
            to: toId,
            signal
          }));
        } else {
          console.warn('[CALL][signal:out][Model] omitido -> socket no abierto o toId inválido', { toId, wsOpen, validTo });
        }
      } catch (e) {
        console.warn('[CALL][signal:out][Model] error', e);
      }
    });


    p.on('stream', (stream) => {
      console.log('[CALL][remote:stream][Model] tracks=', stream.getTracks().length);
      setCallRemoteStream(stream);
    });

    p.on('error', (err) => {
      //console.error('[CALL][peer:error][Model]', err);
      setCallError('No se pudo establecer la llamada. Inténtalo de nuevo.');
    });

    p.on('close', () => {
      console.log('[CALL][peer:close][Model]');
    });

    if (p?._pc && typeof p._pc.addEventListener === 'function') {
      wireCallingIceObservers({
        pc: p._pc,
        roleLabel: 'model',
        setConnectionState: setCallConnectionState,
        setIceConnectionState: setCallIceConnectionState,
      });
    }

    callPeerRef.current = p;
  };


  //Limpieza integral de llamada
  const cleanupCall = useCallback((reason = 'cleanup') => {
    console.log('[CALL][cleanup] reason=', reason);
    resetCallTechMediaReadySignal();
    resetCallMediaAckSignal();
    setCallConnectionState(null);
    setCallIceConnectionState(null);

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

    setCallClientSaldo(null);
    setCallClientSaldoLoading(false);

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
      console.log('[CALL][lock] cleanup -> unlock [Model]');
    }
  }, [callRemoteStream, resetCallTechMediaReadySignal]);


  // [CALL][Model] Selección directa desde Favoritos en pestaña Calling (NO abre chat, solo fija destino)
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
      alert('No puedes llamarte a ti misma.');
      return;
    }

    const name =
      favUser?.nickname || favUser?.name || favUser?.email || 'Usuario';

    console.log('[CALL][Model] Target seleccionado desde lista (Calling):', peer, name);

    // Fuente de verdad única
    setActivePeer(peer, name, 'call', favUser);

    // UI específica del flujo calling
    setActiveTab('calling');
    setCenterChatPeerName(name);

    // Sincronizar universo CALL
    setCallPeerId(peer);
    callPeerIdRef.current = peer;
    setCallPeerName(name);

    // Si FavoriteList te da avatar, úsalo; si no, lo obtendrá el useEffect
    if (favUser?.avatarUrl) setCallPeerAvatar(favUser.avatarUrl);
  };



  // Volver a la lista (favoritos móvil)
  const backToList = () => {

    activePeerRef.current = { id: null, name: '' };
    setTargetPeerId(null);
    setTargetPeerName('');
    setOpenChatWith(null);
    setCenterChatPeerName('');
    setContactMode('chat');
    setCenterMessages([]);
    centerSeenIdsRef.current = new Set();
  };


  // Id activo en lista = el objetivo seleccionado
  const selectedContactId = Number(targetPeerId) || null;
  const hasActiveDetail = Number(targetPeerId) > 0;
  const hasCallTarget = Number(targetPeerId) > 0;

  //---FLAG DE RENDERIZADO---//
  const invited   = String(selectedFav?.invited || '').toLowerCase();
  const favStatus = String(selectedFav?.status  || '').toLowerCase();
  const allowChat      = favStatus === 'active'   && invited === 'accepted';
  const isPendingPanel = favStatus === 'inactive' && invited === 'pending';
  const isSentPanel    = favStatus === 'inactive' && invited === 'sent';

  // detectar si estamos en flujo de entrada (callee)
  const isIncomingFlow =
    callStatus === 'incoming' ||
    (callStatus === 'connecting' && callRoleRef.current === 'callee');
  // Solo se puede llamar si el target seleccionado está ACCEPTED/ACTIVE
  const isAcceptedForCall = favStatus === 'active' && invited === 'accepted';
  const callAllowed =
    isIncomingFlow
      ? true
      : (Number(selectedFav?.id) === Number(callPeerId) && isAcceptedForCall);

  const displayName = sessionUser?.nickname || sessionUser?.name || sessionUser?.email || 'Modelo';

  const queueText =
    queuePosition !== null && queuePosition >= 0
      ? `${i18n.t('dashboardModel.queue.label')} ${queuePosition}`
      : null;

  const balanceTextDesktop = loadingSaldoModel
    ? i18n.t('dashboardModel.balance.loading')
    : saldoModel == null
      ? i18n.t('dashboardModel.balance.unavailable')
      : `${i18n.t('dashboardModel.balance.label')} ${fmtEUR(saldoModel)}`;

  const balanceTextMobile = loadingSaldoModel
    ? i18n.t('dashboardModel.balance.loading')
    : saldoModel == null
      ? i18n.t('dashboardModel.balance.unavailableMobile')
      : `${i18n.t('dashboardModel.balance.label')} ${fmtEUR(saldoModel)}`;



  return (
    <StyledContainer>
      <GlobalBlack />
      <AuthenticatedConsentModal
        open={consentRequired}
        requiredTermsVersion={consentVersion}
        refreshSession={refresh}
      />
      {/* ========= INICIO NAVBAR  ======== */}
      <NavbarModel
        activeTab={activeTab}
        displayName={displayName}
        queueText={queueText}
        balanceTextDesktop={balanceTextDesktop}
        balanceTextMobile={balanceTextMobile}
        avatarUrl={profilePic}
        showBottomNav={!inCall}
        onBrandClick={handleLogoClick}
        onGoVideochat={handleGoVideochat}
        onGoFavorites={handleGoFavorites}
        onGoBlog={handleGoBlog}
        onGoStats={handleGoStats}
        onProfile={handleProfile}
        onWithdraw={handleRequestPayout}
        onLogout={handleLogout}
      />
      {/* ========= FIN NAVBAR  ======== */}

      {/* ========= INICIO MAIN  ======== */}
      <StyledMainContent data-tab={activeTab}>
        {activeTab === 'videochat' ? (
          <VideoChatRandomModelo
            cameraActive={cameraActive}
            handleActivateCamera={handleActivateCamera}
            localVideoRef={localVideoRef}
            vcListRef={vcListRef}
            messages={messages}
            giftRenderReady={giftRenderReady}
            getGiftIcon={getGiftIcon}
            remoteStream={remoteStream}
            isMobile={isMobile}
            remoteVideoWrapRef={remoteVideoWrapRef}
            stopAll={stopAll}
            searching={searching}
            handleNext={handleNext}
            currentClientId={currentClientId}
            handleAddFavorite={handleAddFavorite}
            clientAvatar={clientAvatar}
            clientNickname={clientNickname}
            remoteVideoRef={remoteVideoRef}
            sendRandomMediaReady={sendRandomMediaReady}
            toggleFullscreen={toggleFullscreen}
            handleStartMatch={handleStartMatch}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
            handleBlockPeer={handleBlockPeer}
            handleReportPeer={handleReportPeer}
            error={error}
            modelStatsSummary={modelStatsSummary}
            modelStatsTiers={modelStats?.tiers}
            clientSaldo={clientSaldo}
            clientSaldoLoading={clientSaldoLoading}
            nextDisabled={nexting}
          />
        ) : activeTab === 'stats' ? (
          <Estadistica
            modelStatsDays={modelStatsDays}
            setModelStatsDays={setModelStatsDays}
            onReload={() => fetchModelStats(modelStatsDays)}
            loading={modelStatsDetailLoading}
            error={modelStatsDetailError}
            modelStats={modelStats}
          />
        ) : activeTab === 'blog' ? (
          /* === BLOG PRIVADO A PANTALLA COMPLETA (SIN COLUMNAS) === */
          <div style={{flex:1,minWidth:0,minHeight:0}}>
            <BlogContent mode="private" />
          </div>
        ) : (
          /* === SOLO FAVORITOS USA EL LAYOUT 3 COLUMNAS === */
          <>
            {!isMobile && !showFavoritesFullCall && (
              <StyledLeftColumn data-rail data-surface="favorites-premium">
                {callStatus === 'idle' ? (
                  <FavoritesModelList
                    onSelect={handleOpenChatFromFavorites}
                    reloadTrigger={favReload}
                    selectedId={selectedContactId}
                  />
                ) : (
                  <div style={{padding:8,color:'#adb5bd'}}>{i18n.t('dashboardModel.favorites.inCallLocked')}</div>
                )}
              </StyledLeftColumn>
            )}

            <StyledCenter data-mode={contactMode === 'call' ? 'call' : undefined}>
              {activeTab === 'favoritos' && (
                <VideoChatFavoritosModelo
                  isMobile={isMobile}
                  allowChat={allowChat}
                  isPendingPanel={isPendingPanel}
                  isSentPanel={isSentPanel}
                  contactMode={contactMode}
                  openChatWith={openChatWith}
                  centerChatPeerName={centerChatPeerName}
                  callPeerName={callPeerName}
                  callPeerId={callPeerId}
                  callPeerAvatar={callPeerAvatar}
                  callError={callError}
                  callStatus={callStatus}
                  callCameraActive={callCameraActive}
                  centerMessages={centerMessages}
                  centerInput={centerInput}
                  callRemoteWrapRef={callRemoteWrapRef}
                  callRemoteVideoRef={callRemoteVideoRef}
                  callLocalVideoRef={callLocalVideoRef}
                  callListRef={callListRef}
                  modelCenterListRef={modelCenterListRef}
                  setContactMode={setContactMode}
                  enterCallMode={enterCallMode}
                  sendCenterMessage={sendCenterMessage}
                  setCenterInput={setCenterInput}
                  acceptInvitation={acceptInvitation}
                  rejectInvitation={rejectInvitation}
                  handleCallActivateCamera={handleCallActivateCamera}
                  handleCallInvite={handleCallInvite}
                  handleCallEnd={handleCallEnd}
                  toggleFullscreen={toggleFullscreen}
                  user={sessionUser}
                  gifts={gifts}
                  giftRenderReady={giftRenderReady}
                  handleOpenChatFromFavorites={handleOpenChatFromFavorites}
                  favReload={favReload}
                  selectedContactId={selectedContactId}
                  hasActiveDetail={hasActiveDetail}
                  hasCallTarget={hasCallTarget}
                  backToList={backToList}
                  handleCallAccept={handleCallAccept}
                  handleCallReject={handleCallReject}
                  callClientSaldo={callClientSaldo}
                  callClientSaldoLoading={callClientSaldoLoading}

                />
              )}
            </StyledCenter>

            {!showFavoritesFullCall && <StyledRightColumn data-surface="favorites-premium" />}
          </>
        )}
      </StyledMainContent>
      {/* ======FIN MAIN ======== */}


      {/*FIN CLICK DERECHO */}
    </StyledContainer>
  );

};

export default DashboardModel;
