// DashboardClient.jsx
import React, { useState, useRef, useEffect,useLayoutEffect  } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesClientList from '../favorites/FavoritesClientList';
import { useAppModals } from '../../components/useAppModals';
import { useCallUi } from '../../components/CallUiContext';
import BlogContent from '../blog/BlogContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser, faHeart, faVideo, faFilm, faBars, faArrowLeft,faGem } from '@fortawesome/free-solid-svg-icons';
import {
  StyledContainer,StyledIconWrapper,StyledMainContent,
  StyledLeftColumn,StyledCenter,StyledRightColumn,
  StyledLocalVideo,StyledRemoteVideo,
  StyledChatContainer,StyledNavGroup,StyledNavAvatar,
  StyledTopActions,StyledVideoTitle,StyledTitleAvatar,
  StyledChatDock,StyledChatList,StyledChatMessageRow,
  StyledChatBubble,StyledChatControls,StyledChatInput,
  StyledGiftsPanel,StyledGiftGrid,
  StyledGiftIcon,StyledIconBtn,StyledSelectableRow,
  StyledNavTab,StyledVideoArea,StyledSplit2,
  StyledPane,StyledThumbsGrid, StyledCenterPanel,
  StyledCenterBody,StyledChatScroller, StyledCenterVideochat,
  StyledFavoritesShell,StyledFavoritesColumns,GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';
import {
  StyledNavbar, StyledBrand,NavText, SaldoText,
  HamburgerButton, MobileMenu, MobileBottomNav, BottomNavButton
} from '../../styles/NavbarStyles';
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



const DashboardClient = () => {

  const { alert, confirm, openPurchaseModal, openActiveSessionGuard, openBlockReasonModal, openNextWaitModal } = useAppModals();
  const { inCall, setInCall } = useCallUi();
  const { user: sessionUser } = useSession();
  const [cameraActive, setCameraActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  // ====== CALLING (1-a-1) ======
  const [callCameraActive, setCallCameraActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callPeerId, setCallPeerId] = useState(null);
  const [callPeerName, setCallPeerName] = useState('');
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [callError, setCallError] = useState('');
  const [callRole, setCallRole] = useState(null); // 'caller' | 'callee'
  const [callPeerAvatar, setCallPeerAvatar] = useState('');
  const callLocalVideoRef = useRef(null);
  const callRemoteVideoRef = useRef(null);
  const callLocalStreamRef = useRef(null);
  const callPeerRef = useRef(null);
  const callPingRef = useRef(null);
  const callRingTimeoutRef = useRef(null);
  const callRoleRef = useRef(null);
  const callPeerIdRef = useRef(null);
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
  const token = localStorage.getItem('token');
  const msgSocketRef = useRef(null);
  const centerListRef = useRef(null);
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
  const activePeerRef = useRef({ id: null, name: '' });
  const matchEngineRef = useRef(null);
  const msgEngineRef = useRef(null);
  const cameraActiveRef = useRef(false);



  const isEcho = (incoming) => {
    const now = Date.now();
    return (
      incoming === lastSentRef.current.text &&
      now - lastSentRef.current.at < 1500
    );
  };

  const fmtEUR = (v) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
      .format(Number(v || 0));

  // Devuelve el icono del regalo estrictamente desde el catálogo
  const getGiftIcon = (gift) => {
    if (!gift) return null;
    const found = gifts.find(gg => Number(gg.id) === Number(gift.id));
    return found?.icon || null;
  };


  useEffect(() => {
    cameraActiveRef.current = cameraActive;
  }, [cameraActive]);


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
        setMessages((p) => [...p, { from: mine ? 'me' : 'peer', text: '', gift: { id: data.gift.id, name: data.gift.name } }]);

        if (mine && data.newBalance != null) {
          const nb = Number.parseFloat(String(data.newBalance));
          if (Number.isFinite(nb)) setSaldo(nb);
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

        setCurrentModelId(null);
        setRemoteStream(null);
        setMessages([]);

        if (reason === 'low-balance') {
          setStatus('');
          setSearching(false);
          try { await handlePurchaseFromRandom(); } catch (e) { console.error(e); }
          return;
        }

        setStatus('Buscando nueva modelo...');
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
      remoteVideoRef.current.srcObject = remoteStream;
    } else if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

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

    // 1) Prioridad: chat central -> favorito seleccionado -> sin target
    if (centerChatPeerId) {
      const id = Number(centerChatPeerId);
      const name = centerChatPeerName || 'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id;
      setCallPeerName(name);
      console.log('[CALL][Client] target <- Favorites chat:', id, name);
    } else if (selectedFav?.id) {
      const id = Number(selectedFav.id);
      const name =
        selectedFav?.nickname || selectedFav?.name || selectedFav?.email || 'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id;
      setCallPeerName(name);
      console.log('[CALL][Client] target <- Selected favorite:', id, name);
    } else {
      // 2) Sin target: deshabilita el botón de llamar
      setCallPeerId(null);
      callPeerIdRef.current = null;
      setCallPeerName('');
      console.log('[CALL][Client] sin target: abre un chat de Favoritos para elegir destinatario');
    }
  }, [
    callStatus,
    centerChatPeerId,
    centerChatPeerName,
    selectedFav?.id,
    selectedFav?.nickname,
    selectedFav?.name,
    selectedFav?.email
  ]);


  // [CALL] Si tenemos peerId pero no nombre coherente, lo resolvemos desde /api/users/{id}
  useEffect(() => {
    const tk = localStorage.getItem('token');
    if (!tk) return;
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
    const tk = localStorage.getItem('token');
    if (!tk) return;
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
    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) return;

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
    const tk=localStorage.getItem('token');
    if(!tk) return;
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


  // carga historial del chat central al cambiar peer (FUENTE DE VERDAD: targetPeerId)
  useEffect(() => {
    const peer = Number(targetPeerId);
    if (!peer || activeTab !== 'favoritos') return;

    const tk = localStorage.getItem('token');
    if (!tk) return;

    // Guard contra carreras: si cambias rápido de contacto, no pintamos históricos viejos
    const expectedPeer = peer;
    let canceled = false;

    const load = async () => {
      setCenterLoading(true);
      try {
        const data = await apiFetch(`/messages/with/${expectedPeer}`);

        // Si mientras tanto cambió el target o se salió de Favoritos, abortamos
        if (canceled) return;
        if (Number(targetPeerId) !== expectedPeer) return;
        if (activeTab !== 'favoritos') return;

        const normalized = (data || []).map(raw => ({
          id: raw.id,
          senderId: Number(raw.senderId ?? raw.sender_id),
          recipientId: Number(raw.recipientId ?? raw.recipient_id),
          body: raw.body,
          createdAt: raw.createdAt ?? raw.created_at,
          readAt: raw.readAt ?? raw.read_at ?? null,
        }));

        // detectar marcadores de regalo en historial (SIMÉTRICO al Model)
        normalized.forEach(m => {
          if (typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts = m.body.slice(2, -2).split(':'); // GIFT:id:name
            if (parts.length >= 3) m.gift = { id: Number(parts[1]), name: parts.slice(2).join(':') };
          }
        });

        centerSeenIdsRef.current = new Set((normalized || []).map(m => m.id));
        setCenterMessages(normalized.reverse());

        try {
          await apiFetch(`/messages/with/${expectedPeer}/read`, { method: 'POST' });

          // (mantengo tu evento, pero ahora atado al peer correcto)
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


  const clearMsgTimers = () => {
    if (msgPingRef.current) {
      clearInterval(msgPingRef.current);
      msgPingRef.current = null;
    }
    if (msgReconnectRef.current) {
      clearTimeout(msgReconnectRef.current);
      msgReconnectRef.current = null;
    }
  };

  const closeMsgSocket = () => {
    try { if (msgSocketRef.current) msgSocketRef.current.close(); } catch {}
    msgSocketRef.current = null;
    setWsReady(false);
    clearMsgTimers();
  };


  const openMsgSocket = () => {
    msgEngineRef.current?.open();
  };


  useEffect(() => {
      openMsgSocket();
      return () => closeMsgSocket();
  }, []);


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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStream.current = stream;
      setCameraActive(true);
    } catch (err) {
      setError('Error al activar la cámara: ' + err.message);
      console.error(err);
    }
  };


  const handleLogout = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    localStorage.removeItem('token');
    history.push('/');
  };


  const handleStartMatch = () => {
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

        setCenterMessages(prev => [...prev, {
          id: mid || `${Date.now()}`,
          senderId: from,
          recipientId: to,
          body: `[[GIFT:${data.gift.id}:${data.gift.name}]]`,
          gift: { id: data.gift.id, name: data.gift.name }
        }]);

        queueMicrotask(() => {
          const el = centerListRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });

        return;
      }

      if (data.type === 'msg:new' && data.message) {
        const m = normMsg(data.message);

        if (typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
          try {
            const parts = m.body.slice(2, -2).split(':');
            if (parts.length >= 3 && parts[0] === 'GIFT') {
              m.gift = { id: Number(parts[1]), name: parts.slice(2).join(':') };
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
          try {
            await handleAddBalance();
          } catch (e) {
            console.error('Error en handleAddBalance (gift no-balance):', e);
          }
        })();

        return;
      }

      // ====== CALLING: EVENTOS call:* ======
      if (data.type === 'call:incoming') {
        const id = Number(data.from);
        const name = String(data.displayName || 'Usuario');

        console.log('[CALL][incoming][Client] from=', id, 'name=', name);

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
              message: 'La otra persona ha rechazado tu llamada.',
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
    // Guard: si estamos ya en transición de NEXT, no spameamos
    if (nexting) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        setNexting(true);
        socketRef.current.send(JSON.stringify({ type: 'next' }));
      } catch (e) {
        console.error('Error enviando NEXT:', e);
        setNexting(false);
        setError('Error: no se pudo solicitar NEXT.');
        return;
      }
    } else {
      setNexting(false);
      setError('Error: No hay conexión con el servidor.');
      return;
    }

    // MUY IMPORTANTE (industrial):
    // - No destruimos peerRef ni paramos tracks aquí.
    // - El cierre real vendrá por 'peer-disconnected' (reason NEXT) o por el flujo normal del backend.
    // - Si el backend responde con next-wait/next-rate-limited, mantenemos la llamada intacta.
  };


  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput.trim() };
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      lastSentRef.current = { text: message.message, at: Date.now() };
      socketRef.current.send(JSON.stringify(message));
      setMessages(prev => [...prev, { from: 'me', text: message.message }]);
      setChatInput('');
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

    // RANDOM
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
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
    setRemoteStream(null);
    setError('');
    setMessages([]);

    // FAVORITOS
    setCenterChatPeerId(null);
    setCenterChatPeerName('');
    setCenterMessages([]);
    setCenterInput('');
    setShowGifts(false);
    setShowCenterGifts(false);

    // CALLING
    try { handleCallEnd(true); } catch {}
  };


  const handleAddBalance = async () => {
    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      await alert({
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
        variant: 'warning',
      });
      return;
    }
    // model copra generico
    const result = await openPurchaseModal({
      context: 'navbar-comprar', // etiqueta opcional por si quieres loguear contexto
    });
    if (!result.confirmed || !result.pack) return;
    const { pack } = result;
    const amount = Number(pack.price);
    try {
      setLoadingSaldo(true);
      const res = await fetch('/api/transactions/add-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenLS}`,
        },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (${pack.minutes} minutos)`,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      await alert({
        title: 'Saldo actualizado',
        message: `Se ha añadido el pack de ${pack.minutes} minutos.`,
        variant: 'success',
      });

      const res2 = await fetch('/api/clients/me', {
        headers: { Authorization: `Bearer ${tokenLS}` },
      });

      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(txt || `Error refrescando saldo: ${res2.status}`);
      }

      const data = await res2.json();
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
    } finally {
      setLoadingSaldo(false);
    }
  };


  const handlePurchaseFromRandom = async () => {
    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      await alert({
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
        variant: 'warning',
      });
      return;
    }
    // Abrimos el modal de compra reutilizando la plantilla #3
    const result = await openPurchaseModal({
      context: 'random', // etiqueta para distinguir el contexto
    });
    if (!result.confirmed || !result.pack) {
      // El usuario canceló o cerró el modal
      return;
    }
    const { pack } = result;
    const amount = Number(pack.price);
    try {
      setLoadingSaldo(true);
      // Llamada al backend para crear la recarga
      const res = await fetch('/api/transactions/add-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenLS}`,
        },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (random ${pack.minutes} minutos)`,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      // Refrescamos saldo
      const res2 = await fetch('/api/clients/me', {
        headers: { Authorization: `Bearer ${tokenLS}` },
      });
      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(txt || `Error refrescando saldo: ${res2.status}`);
      }
      const data = await res2.json();
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
    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      await alert({
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
        variant: 'warning',
      });
      return;
    }
    const result = await openPurchaseModal({
      context: 'calling',
    });

    if (!result.confirmed || !result.pack) return;
    const { pack } = result;
    const amount = Number(pack.price);

    try {
      setLoadingSaldo(true);
      const res = await fetch('/api/transactions/add-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenLS}`,
        },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (llamada 1 a 1, ${pack.minutes} minutos)`,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      const res2 = await fetch('/api/clients/me', {
        headers: { Authorization: `Bearer ${tokenLS}` },
      });

      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(txt || `Error refrescando saldo: ${res2.status}`);
      }
      const data = await res2.json();
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
    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      await alert({
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
        variant: 'warning',
      });
      return;
    }
    const result = await openPurchaseModal({
      context: 'gift',
    });
    if (!result.confirmed || !result.pack) return;
    const { pack } = result;
    const amount = Number(pack.price);

    try {
      setLoadingSaldo(true);
      const res = await fetch('/api/transactions/add-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenLS}`,
        },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Recarga de saldo (envío de regalos, ${pack.minutes} minutos)`,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      const res2 = await fetch('/api/clients/me', {
        headers: { Authorization: `Bearer ${tokenLS}` },
      });

      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(txt || `Error refrescando saldo: ${res2.status}`);
      }
      const data = await res2.json();
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
      const token = localStorage.getItem('token');
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
    const modelId = explicitModelId || currentModelId;

    if (!modelId) {
      await alert({
        variant: 'warning',
        title: 'Favoritos',
        message: 'No se pudo identificar a la modelo actual.',
      });
      return;
    }
    const tk = localStorage.getItem('token');
    if (!tk) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      await alert({
        variant: 'warning',
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
      });
      return;
    }
    try {
      const res = await fetch(`/api/favorites/models/${modelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
      });

      if (res.status === 409) {
        await alert({
          variant: 'info',
          title: 'Favoritos',
          message: 'Esta modelo ya está en tus favoritos.',
        });
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }
      // 204 => consultamos meta para mensaje contextual
      try {
        const metaRes = await fetch('/api/favorites/models/meta', {
          headers: { Authorization: `Bearer ${tk}` }
        });

        if (metaRes.ok) {
          const meta = await metaRes.json();
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
        } else {
          await alert({
            variant: 'success',
            title: 'Favoritos',
            message: 'Solicitud enviada.',
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
      console.error(e);
      await alert({
        variant: 'danger',
        title: 'Error',
        message: e.message || 'No se pudo añadir a favoritos.',
      });
    }
  };


  const openChatWith = (peerId, displayName) => {
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
  });


  const sendCenterMessage = () => {
    const body = String(centerInput || '').trim();
    if (!body) return;
    // Prioridad: autoridad (ref) -> centerChatPeerId -> targetPeerId
    const to =
      Number(activePeerRef.current?.id) ||
      Number(centerChatPeerId) ||
      Number(targetPeerId);

    if (!Number.isFinite(to) || to <= 0) {
      console.warn('[sendCenterMessage][Client] destinatario inválido', {
        activePeer: activePeerRef.current,
        centerChatPeerId,
        targetPeerId,
      });
      return;
    }
    const s = msgSocketRef.current;
    if (s && s.readyState === WebSocket.OPEN) {
      const payload = { type: 'msg:send', to, body };
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
    if (!selectedFav?.id) return;
    const tk = localStorage.getItem('token');
    try {
      await apiFetch(`/favorites/accept/${selectedFav.id}`, { method: 'POST' });

      const name = selectedFav.nickname || 'Usuario';
      setSelectedFav(prev => prev ? { ...prev, invited: 'accepted' } : prev);
      setFavReload(x => x + 1);
      openChatWith(selectedFav.id, name);
    } catch (e) {
      alert(e.message || 'No se pudo aceptar la invitación');
    }
  };


  const rejectInvitation = async () => {
    if (!selectedFav?.id) return;
    const tk = localStorage.getItem('token');
    try {
      await apiFetch(`/favorites/reject/${selectedFav.id}`, { method: 'POST' });

      setSelectedFav(prev => prev ? { ...prev, invited: 'rejected' } : prev);
      setFavReload(x => x + 1);
    } catch (e) {
      alert(e.message || 'No se pudo rechazar la invitación');
    }
  };


  const sendGiftMatch=(giftId)=>{
      if(!socketRef.current||socketRef.current.readyState!==WebSocket.OPEN) return;
      socketRef.current.send(JSON.stringify({type:'gift',giftId}));
      setShowGifts(false);
  };


  const sendGiftMsg = (giftId) => {
    const to =
      Number(activePeerRef.current?.id) ||
      Number(targetPeerId) ||
      Number(centerChatPeerId);
    if (!Number.isFinite(to) || to <= 0) return;
    if (!msgSocketRef.current || msgSocketRef.current.readyState !== WebSocket.OPEN) return;

    msgSocketRef.current.send(JSON.stringify({ type:'msg:gift', to, giftId }));
    setShowCenterGifts(false);
  };


  //Activar cámara (Calling)
  const handleCallActivateCamera = async () => {
    console.log('[CALL][cam:on] requesting user media');

    //SOLO bloqueamos si se intenta iniciar llamada desde idle (caller)
    if (callStatus === 'idle' && !callAllowed) {
      setCallError('No puedes activar la cámara: la relación aún no está aceptada.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      callLocalStreamRef.current = stream;
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
      setCallError('Error al activar la cámara: ' + err.message);
      setCallCameraActive(false);
      setCallStatus('idle');
    }
  };


  // Enviar invitación (FIX: no usar 'openChatWith' como ID)
  const handleCallInvite = () => {
    if (!callCameraActive || !callLocalStreamRef.current) {
      setCallError('Primero activa la cámara para llamar.');
      return;
    }
    if (!callAllowed) {
      setCallError('Llamadas bloqueadas: la relación no está aceptada.');
      return;
    }
    // Prioridad: ref -> state -> chat central -> favorito seleccionado
    const toId =
      Number(callPeerIdRef.current ?? callPeerId ?? centerChatPeerId ?? selectedFav?.id);
    let toName = '';
    if (Number.isFinite(toId) && toId > 0) {
      toName =
        callPeerName ||
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
      setCallError('Error en la conexión WebRTC: ' + err.message);
    });

    p.on('close', () => {
      console.log('[CALL][peer:close][Client]');
    });

    callPeerRef.current = p;
  };


  //Limpieza integral de llamada
  const cleanupCall = (reason = 'cleanup') => {
    console.log('[CALL][cleanup] reason=', reason);

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
      try { callRemoteStream.getTracks().forEach(t => t.stop()); } catch {}
      setCallRemoteStream(null);
    }
    if (callRemoteVideoRef?.current) {
      try {
        callRemoteVideoRef.current.srcObject = null;
        // forzamos repaint del elemento
        if (typeof callRemoteVideoRef.current.load === 'function') {
          callRemoteVideoRef.current.load();
        }
      } catch {}
    }

    // 4) local stream (solo si cierre total)
    if (reason === 'forced-end' || reason === 'ended' || reason === 'canceled') {
      if (callLocalStreamRef.current) {
        try { callLocalStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
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
  };


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

  return(
    <StyledContainer>
      <GlobalBlack/>
      {/* ========= INICIO NAVBAR  ======== */}
      <StyledNavbar style={{padding:'0 24px'}}>
        <div style={{display:'flex',alignItems:'center'}}>
          <StyledBrand href="#" aria-label="SharemeChat" onClick={handleLogoClick}/>
          <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:8,marginLeft:16}}>
            <StyledNavTab type="button" data-active={activeTab==='videochat'} aria-pressed={activeTab==='videochat'} onClick={handleGoVideochat} title="Videochat">Videochat</StyledNavTab>
            <StyledNavTab type="button" data-active={activeTab==='favoritos'} aria-pressed={activeTab==='favoritos'} onClick={handleGoFavorites} title="Favoritos">Favoritos</StyledNavTab>
            <StyledNavTab type="button" data-active={activeTab==='blog'} aria-pressed={activeTab==='blog'} onClick={handleGoBlog} title="Blog">Blog</StyledNavTab>
          </div>
        </div>
        <div className="desktop-only" data-nav-group style={{display:'flex',alignItems:'center',gap:12,marginLeft:'auto'}}>
          <NavText className="me-3">{displayName}</NavText>
          <SaldoText className="me-3">{loadingSaldo?'Saldo: …':saldoError?'Saldo: n/d':`Saldo: ${fmtEUR(saldo)}`}</SaldoText>
          <NavButton type="button" onClick={handleAddBalance}><FontAwesomeIcon icon={faGem} style={{color:'#22c55e',fontSize:'1rem'}}/><span>Comprar</span></NavButton>
          <NavButton type="button" onClick={handleLogout} title="Cerrar sesión"><FontAwesomeIcon icon={faSignOutAlt}/><span>Salir</span></NavButton>
          <StyledNavAvatar src={profilePic || '/img/avatarChico.png'} alt="avatar" title="Ver perfil" onClick={handleProfile}/>
        </div>
        <HamburgerButton onClick={()=>setMenuOpen(!menuOpen)} aria-label="Abrir menú" title="Menú"><FontAwesomeIcon icon={faBars}/></HamburgerButton>
        <MobileMenu className={!menuOpen&&'hidden'}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <NavText>{displayName}</NavText>
            <SaldoText>{loadingSaldo?'Saldo: …':saldoError?'Saldo: n/d':`Saldo: ${fmtEUR(saldo)}`}</SaldoText>
          </div>
          <NavButton onClick={()=>{handleProfile();setMenuOpen(false);}}><FontAwesomeIcon icon={faUser}/><StyledIconWrapper>Perfil</StyledIconWrapper></NavButton>
          <NavButton onClick={()=>{handleAddBalance();setMenuOpen(false);}}><FontAwesomeIcon icon={faGem} style={{color:'#22c55e',fontSize:'1rem'}}/><span>Comprar</span></NavButton>
          <NavButton onClick={()=>{handleLogout();setMenuOpen(false);}}><FontAwesomeIcon icon={faSignOutAlt}/><StyledIconWrapper>Salir</StyledIconWrapper></NavButton>
        </MobileMenu>
      </StyledNavbar>
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
            {showFavoritesFullCall?(
              <StyledCenter data-mode={contactMode==='call'?'call':undefined}>
                <VideoChatFavoritosCliente
                  isMobile={isMobile}
                  handleOpenChatFromFavorites={handleOpenChatFromFavorites}
                  favReload={favReload}
                  selectedContactId={selectedContactId}
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
            ):(
              <>
                {!isMobile&&(
                  <StyledLeftColumn data-rail>
                    {callStatus==='idle'?(
                      <FavoritesClientList
                        onSelect={handleOpenChatFromFavorites}
                        reloadTrigger={favReload}
                        selectedId={selectedContactId}
                      />
                    ):(
                      <div style={{padding:8,color:'#adb5bd'}}>En llamada: la lista se bloquea hasta colgar.</div>
                    )}
                  </StyledLeftColumn>
                )}
                <StyledCenter data-mode={contactMode==='call'?'call':undefined}>
                  <VideoChatFavoritosCliente
                    isMobile={isMobile}
                    handleOpenChatFromFavorites={handleOpenChatFromFavorites}
                    favReload={favReload}
                    selectedContactId={selectedContactId}
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
                <StyledRightColumn/>
              </>
            )}
          </>
        )}
      </StyledMainContent>
      {/* ======FIN MAIN ======== */}

      {!inCall && (
        <MobileBottomNav>
          <BottomNavButton active={activeTab==='videochat'} onClick={handleGoVideochat}><span>Videochat</span></BottomNavButton>
          <BottomNavButton active={activeTab==='favoritos'} onClick={handleGoFavorites}><span>Favoritos</span></BottomNavButton>
          <BottomNavButton active={activeTab==='blog'} onClick={handleGoBlog}><span>Blog</span></BottomNavButton>
        </MobileBottomNav>
      )}

    </StyledContainer>
  );
};

export default DashboardClient;