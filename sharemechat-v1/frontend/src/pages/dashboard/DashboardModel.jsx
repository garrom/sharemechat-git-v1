// DashboardModel.jsx
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesModelList from '../favorites/FavoritesModelList';
import { useAppModals } from '../../components/useAppModals';
import { useCallUi } from '../../components/CallUiContext';
import BlogContent from '../blog/BlogContent';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { faSignOutAlt, faUser, faHeart, faVideo, faFilm, faBars, faArrowLeft,faGem } from '@fortawesome/free-solid-svg-icons';
import {
  StyledContainer,StyledIconWrapper,StyledMainContent,
  StyledLeftColumn,StyledCenter,StyledRightColumn,
  StyledLocalVideo,StyledRemoteVideo,
  StyledChatContainer,StyledNavGroup,StyledNavAvatar,
  StyledIconBtn,StyledTopActions,StyledVideoTitle,
  StyledVideoArea,StyledChatDock, StyledChatList,
  StyledChatMessageRow,StyledChatBubble,StyledChatInput,
  StyledGiftsPanel,StyledGiftGrid,
  StyledGiftIcon,StyledTitleAvatar,StyledSelectableRow,
  StyledSplit2,StyledPane, StyledThumbsGrid,
  StyledNavTab,StyledCenterPanel, StyledCenterBody,
  StyledChatScroller,StyledCenterVideochat, StyledFavoritesShell,
  StyledFavoritesColumns,GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';
import {
    StyledNavbar, StyledBrand, NavText, SaldoText, QueueText,
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
import VideoChatRandomModelo from './VideoChatRandomModelo';
import VideoChatFavoritosModelo from './VideoChatFavoritosModelo';
import { buildWsUrl, WS_PATHS } from '../../config/api';
import { apiFetch } from '../../config/http';
import Estadistica from './Estadistica';


const DashboardModel = () => {

  const { alert, confirm, openPayoutModal,openActiveSessionGuard,openBlockReasonModal } = useAppModals();
  const { inCall, setInCall } = useCallUi();
  const [cameraActive, setCameraActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('videochat');
  const [user, setUser] = useState(null);
  const [saldoModel, setSaldoModel] = useState(null);
  const [loadingSaldoModel, setLoadingSaldoModel] = useState(false);
  const [status, setStatus] = useState('');
  const [queuePosition, setQueuePosition] = useState(null);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [favReload, setFavReload] = useState(0);
  const [selectedFav, setSelectedFav] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [giftsLoaded, setGiftsLoaded] = useState(false);
  const [giftRenderReady, setGiftRenderReady] = useState(false);
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
  const [menuOpen, setMenuOpen] = useState(false);

  // ====== CALLING (1-a-1) ======
  const [callCameraActive, setCallCameraActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callPeerId, setCallPeerId] = useState(null);
  const [callPeerName, setCallPeerName] = useState('');
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [callError, setCallError] = useState('');
  const [callRole, setCallRole] = useState(null); // 'caller' | 'callee'
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

  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const token = localStorage.getItem('token');
  const meIdRef = useRef(null);
  const peerIdRef = useRef(null);
  const nextGuardRef = useRef(false);
  const statsSummaryLoadedRef = useRef(false);
  const statsDetailLoadedRef = useRef(false);
  const activePeerRef = useRef({ id: null, name: '' });


  // --- Dedupe de eco para chat de streaming (RTC)
  const lastSentRef = useRef({ text: null, at: 0 });
  const isEcho = (incoming) => {
    const now = Date.now();
    return (
      incoming === lastSentRef.current.text &&
      now - lastSentRef.current.at < 1500
    );
  };

  const getGiftIcon = (gift) => {
    if (!gift) return null;
    const found = gifts.find(gg => Number(gg.id) === Number(gift.id));
    return found?.icon || null;
  };

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

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
    const loadUser = async () => {
      try {
        const data = await apiFetch('/users/me');
        setUser(data);
        meIdRef.current = Number(data?.id || 0);
      } catch (e) {
        console.error('Error cargando usuario:', e);
      }

    };
    if (token) loadUser();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const d = await apiFetch('/models/documents/me');
        setProfilePic(d?.urlPic || null);
      } catch {
        /* noop */
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !currentClientId) return;

    (async () => {
      try {
        const d = await apiFetch(`/users/${currentClientId}`);
        const nn = d?.nickname || d?.name || d?.email || 'Cliente';
        setClientNickname(nn);
      } catch {/* noop */}
    })();
  }, [token, currentClientId]);

  useEffect(() => {
    if (!token || !currentClientId) return;

    (async () => {
      try {
        const map = await apiFetch(`/users/avatars?ids=${encodeURIComponent(currentClientId)}`); // { [id]: url }
        const url = map?.[currentClientId] || '';
        setClientAvatar(url);
      } catch {/* noop */}

    })();
  }, [token, currentClientId]);


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
      meIdRef.current = Number(user?.id) || null;
  }, [user?.id]);

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
    const tk=localStorage.getItem('token');
    if(!tk) return;
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

    // 1) Prioridad: chat central -> favorito seleccionado -> sin target
    if (openChatWith) {
      const id = Number(openChatWith);
      const name = centerChatPeerName || 'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id; // REF
      setCallPeerName(name);
      console.log('[CALL][Model] target <- Favorites chat:', id, name);
    } else if (selectedFav?.id) {
      const id = Number(selectedFav.id);
      const name =
        selectedFav?.nickname || selectedFav?.name || selectedFav?.email || 'Usuario';
      setCallPeerId(id);
      callPeerIdRef.current = id; // REF
      setCallPeerName(name);
      console.log('[CALL][Model] target <- Selected favorite:', id, name);
    } else {
      // 2) Sin target: deshabilita el botón de llamar
      setCallPeerId(null);
      callPeerIdRef.current = null; // REF
      setCallPeerName('');
      console.log('[CALL][Model] sin target: abre un chat de Favoritos para elegir destinatario');
    }
  }, [
    callStatus,
    openChatWith,
    centerChatPeerName,
    selectedFav?.id,
    selectedFav?.nickname,
    selectedFav?.name,
    selectedFav?.email
  ]);


  // [CALL][Model] Si tenemos peerId pero el nombre no está “bonito”, lo resolvemos vía API
  useEffect(() => {
    const tk = localStorage.getItem('token');
    if (!tk) return;
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
    const tk = localStorage.getItem('token');
    if (!tk) return;
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
    const tk = localStorage.getItem('token');
    if (!tk) return;
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


  // carga historial del chat central al cambiar peer
  useEffect(() => {
    const peer = Number(openChatWith);
    if (!peer || activeTab !== 'favoritos') return;

    const tk = localStorage.getItem('token');
    if (!tk) return;

    const load = async () => {
      setCenterLoading(true);
      try {
        const data = await apiFetch(`/messages/with/${peer}`);

        const normalized = (data || []).map(raw => ({
          id: raw.id,
          senderId: Number(raw.senderId ?? raw.sender_id),
          recipientId: Number(raw.recipientId ?? raw.recipient_id),
          body: raw.body,
          createdAt: raw.createdAt ?? raw.created_at,
          readAt: raw.readAt ?? raw.read_at ?? null,
        }));
        // detectar marcadores de regalo en historial
        normalized.forEach(m=>{
          if (typeof m.body==='string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts=m.body.slice(2,-2).split(':'); // GIFT:id:name
            if (parts.length>=3) m.gift={id:Number(parts[1]),name:parts.slice(2).join(':')};
          }
        });
        centerSeenIdsRef.current = new Set((normalized || []).map(m => m.id));
        setCenterMessages(normalized.reverse());
        try {
          await apiFetch(`/messages/with/${peer}/read`, { method: 'POST' });
        } catch {}
        queueMicrotask(() => {
          const el = modelCenterListRef?.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      } catch (e) {
        console.warn('Historial chat MODEL error:', e?.message);
        setCenterMessages([]);
      } finally {
        setCenterLoading(false);
      }
    };
    load();
  }, [openChatWith, activeTab]);


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

    const tk = localStorage.getItem('token');
    if (!tk) return;

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

    const tk = localStorage.getItem('token');
    if (!tk) return;

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

  // 3) Detail para pestaña Estadística: lógica original
  useEffect(() => {
    if (activeTab !== 'stats') return;
    if (statsDetailLoadedRef.current) return;

    const currentDays = Number(modelStats?.current?.days);
    if (Number(modelStatsDays) === 30 && currentDays === 30) {
      statsDetailLoadedRef.current = true;
      return;
    }

    const tk = localStorage.getItem('token');
    if (!tk) return;

    statsDetailLoadedRef.current = true;

    const loadStats = async () => {
      try {
        setModelStatsDetailLoading(true);
        setModelStatsDetailError('');
        const data = await apiFetch(`/models/stats?days=${encodeURIComponent(modelStatsDays)}`);
        setModelStats(data || null);
      } catch (e) {
        console.warn('[MODEL][stats] error:', e?.message);
        setModelStatsDetailError(e?.message || 'Error cargando estadísticas');
        setModelStats(null);
      } finally {
        setModelStatsDetailLoading(false);
      }
    };

    loadStats();
  }, [activeTab, modelStatsDays]);


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

  const normMsg = (raw) => ({
    id: raw.id,
    senderId: Number(raw.senderId ?? raw.sender_id),
    recipientId: Number(raw.recipientId ?? raw.recipient_id),
    body: raw.body,
    createdAt: raw.createdAt ?? raw.created_at,
    readAt: raw.readAt ?? raw.read_at ?? null,
  });

  const closeMsgSocket = () => {
    try { if (msgSocketRef.current) msgSocketRef.current.close(); } catch {}
    msgSocketRef.current = null;
    setMsgConnected(false);
    clearMsgTimers();
  };


  const openMsgSocket = () => {
    const tk = localStorage.getItem('token');
    if (!tk) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }

    const url = buildWsUrl(WS_PATHS.messages, { token: tk });
    const cur = msgSocketRef.current;

    // 1) Si ya está OPEN, no hacemos nada
    if (cur && cur.readyState === WebSocket.OPEN) {
      setMsgConnected(true);
      return;
    }

    // 2) Si está CONNECTING, NO reabrimos
    if (cur && cur.readyState === WebSocket.CONNECTING) {
      return;
    }

    // 3) Si había uno viejo (CLOSING/CLOSED), cerramos de forma silenciosa
    if (cur) {
      try {
        cur.__manualClose = true;
        cur.close();
      } catch {}
    }

    msgSocketRef.current = null;
    setMsgConnected(false);
    clearMsgTimers();

    // 4) Abrimos socket nuevo
    const s = new WebSocket(url);
    msgSocketRef.current = s;

    s.onopen = () => {
      // Ignorar si este socket ya no es el actual
      if (msgSocketRef.current !== s) return;

      console.log('[WS][messages] OPEN (Model)');
      setMsgConnected(true);

      if (msgPingRef.current) clearInterval(msgPingRef.current);

      msgPingRef.current = setInterval(() => {
        try {
          if (msgSocketRef.current !== s) return;
          if (s.readyState !== WebSocket.OPEN) return;

          s.send(JSON.stringify({ type: 'ping' }));

          // IMPORTANTE: leer callStatus "vivo" desde ref, no desde closure
          const st = callStatusRef.current;
          if (st === 'in-call' || st === 'connecting') {
            setCallClientSaldoLoading(true);
            s.send(JSON.stringify({
              type: 'call:ping',
              with: Number(callPeerIdRef.current),
            }));
            console.log('[CALL][ping] sent (model)');
          }
        } catch {}
      }, 30000);
    };

    s.onclose = () => {
      // Ignorar cierre de sockets viejos
      if (msgSocketRef.current !== s) return;

      console.log('[WS][messages] CLOSE (Model)');
      setMsgConnected(false);
      clearMsgTimers();
      msgSocketRef.current = null;

      // Si fue cierre manual, no reconectamos
      if (s.__manualClose) return;

      // Reconexión segura
      msgReconnectRef.current = setTimeout(() => {
        const now = msgSocketRef.current;
        if (now && (
          now.readyState === WebSocket.OPEN ||
          now.readyState === WebSocket.CONNECTING
        )) {
          return;
        }
        openMsgSocket();
      }, 1500);
    };

    s.onerror = (e) => {
      // Ignorar errores de sockets viejos
      if (msgSocketRef.current !== s) return;

      console.log('[WS][messages] ERROR (Model)', e);
      setMsgConnected(false);

      try {
        // Forzamos cierre; onclose decidirá si reconectar
        s.close();
      } catch {}
    };

    s.onmessage = (ev) => {
      // Ignorar mensajes de sockets viejos
      if (msgSocketRef.current !== s) return;

      try {
        const data = JSON.parse(ev.data);

        // ==== MENSAJERÍA EXISTENTE ====
        if (data.type === 'msg:new' && data.message) {
          const m = normMsg(data.message);

          if (typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts = m.body.slice(2, -2).split(':');
            if (parts.length >= 3) m.gift = { id: Number(parts[1]), name: parts.slice(2).join(':') };
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
            senderId: data.from,
            recipientId: data.to,
            body: `[[GIFT:${data.gift.id}:${data.gift.name}]]`,
            gift: { id: data.gift.id, name: data.gift.name }
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

          // Lock duro del target
          callTargetLockedRef.current = true;

          // Autoridad única: fijar peer activo en modo call
          setActivePeer(id, name, 'call', null);

          // Sincroniza universo CALL
          setCallPeerId(id);
          callPeerIdRef.current = id;
          setCallPeerName(name);

          // Limpia selección que pueda confundir UI
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

          const peer = Number(callPeerIdRef.current);
          if (Number.isFinite(peer) && peer > 0) {
            console.log('[CALL][lock] accepted -> keep lock [Model]; peer=', peer);

            // Refuerzo: ActivePeer debe ser el peer de la llamada
            const nm = callPeerName || activePeerRef.current?.name || 'Usuario';
            activePeerRef.current = { id: peer, name: nm };

            // UI
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
                msgSocketRef.current.send(JSON.stringify({ type: 'call:ping', with: Number(callPeerIdRef.current) }));
                console.log('[CALL][ping] sent (in-call loop)');
              }
            } catch {}
          }, 30000);

          return;
        }

        if (data.type === 'call:signal' && data.signal) {
          console.log('[CALL][signal:in][Model]', data.signal?.type || (data.signal?.candidate ? 'candidate' : 'unknown'));
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
                message: 'El cliente ha rechazado tu llamada.',
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

        // ==== CALL SALDO (1-a-1) ====
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
  };


  useEffect(() => {
     openMsgSocket();
     return () => closeMsgSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        audio: true,
      });
      localStream.current = stream;
      setCameraActive(true);
      setError('');
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara.');
    }
  };


  const handleLogout = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;

    stopAll();
    localStorage.removeItem('token');
    history.push('/');
  };

  const handleGoStats = async () => {
    const ok = await confirmarSalidaSesionActiva();
    if (!ok) return;
    stopAll();
    setActiveTab('stats');
  };


  const startWebSocketAndWait = (tk) => {
    const wsUrl = buildWsUrl(WS_PATHS.match, { token: tk });
    const socket = new WebSocket(wsUrl);

    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('Esperando cliente...');
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'ping' }));
          socketRef.current.send(JSON.stringify({ type: 'stats' }));
        }
      }, 30000);

      socket.send(JSON.stringify({ type: 'set-role', role: 'model' }));
      socket.send(JSON.stringify({ type: 'stats' }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'match') {

        // ping inmediato
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          try { socketRef.current.send(JSON.stringify({ type: 'ping' })); } catch {}
        }

        // setCurrentClientId robusto
        let matchedClientId = null;
        try {
          if (data.peerRole === 'client' && Number.isFinite(Number(data.peerUserId))) {
            matchedClientId = Number(data.peerUserId);
            setCurrentClientId(matchedClientId);
          } else {
            setCurrentClientId(null);
          }
        } catch {
          setCurrentClientId(null);
        }

        // saldo del cliente (viene por WS en el match; se usará en UI)
        try {
          setClientSaldoLoading(true);
          const v = data?.clientBalance;
          setClientSaldo(v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
        } catch {
          setClientSaldo(null);
        } finally {
          setClientSaldoLoading(false);
        }

        // reset de peer/remote (incluye limpieza de saldo anterior si hubiera)
        try { if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } } catch {}
        try { if (remoteStream) { remoteStream.getTracks().forEach((t) => t.stop()); } } catch {}
        setRemoteStream(null);
        setMessages([]);
        setError('');
        setStatus('');
        setSearching(false);

        const peer = new Peer({
          initiator: false,
          trickle: true,
          stream: localStream.current,
        });
        peerRef.current = peer;

        peer.on('signal', (signal) => {
          if (signal?.type === 'candidate' && signal?.candidate?.candidate === '') return;
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'signal', signal }));
          }
        });

        peer.on('stream', (stream) => {
          setError('');
          setStatus('');
          setRemoteStream(stream);
        });

        peer.on('error', (err) => {
          setError('Error en la conexión WebRTC: ' + err.message);
        });
      } else if (data.type === 'signal' && peerRef.current) {
        setError('');
        setStatus('');
        peerRef.current.signal(data.signal);
      } else if (data.type === 'chat') {
        if (!isEcho(data.message)) {
          setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
        }
      } else if (data.type === 'gift') {
        const mine = Number(data.fromUserId) === Number(user?.id);
        setMessages(prev=>[...prev,{ from: mine ? 'me' : 'peer', text: '', gift: { id: data.gift.id, name: data.gift.name } }]);

      } else if (data.type === 'no-client-available') {
        setError('');
        setStatus('Esperando cliente...');
        setSearching(true);
      } else if (data.type === 'queue-stats') {
        if (typeof data.position === 'number') {
          setQueuePosition(data.position);
        }
      } else if (data.type === 'peer-disconnected') {
        setCurrentClientId(null);
        setClientSaldo(null);
        setClientSaldoLoading(false);
        try { if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } } catch {}
        try { if (remoteStream) { remoteStream.getTracks().forEach((track) => track.stop()); } } catch {}
        setRemoteStream(null);
        setMessages([]);
        setError('Buscando nuevo cliente...');
        setStatus('');
        setSearching(true);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'start-match' }));
          socketRef.current.send(JSON.stringify({ type: 'stats' }));
        }
      }
    };

    socket.onerror = () => {
      setError('Error de conexión con el servidor.');
    };

    socket.onclose = () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      setSearching(false);
    };
  };

  const handleStartMatch = () => {
    if (!cameraActive || !localStream.current) {
      setError('Primero activa la cámara.');
      return;
    }
    setSearching(true);
    setError('');

    const tk = localStorage.getItem('token');
    if (!tk) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      setSearching(false);
      return;
    }

    // Primera vez: no hay socket, lo abrimos aquí
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      startWebSocketAndWait(tk);
      return;
    }

    // Si ya hay socket abierto, opcionalmente pedimos otro match
    try {
      socketRef.current.send(JSON.stringify({ type: 'start-match' }));
    } catch (e) {
      setError('Error enviando start-match.');
      setSearching(false);
    }
  };

  const handleNext = () => {
    if (nextGuardRef.current) return;
    nextGuardRef.current = true;

    try {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        setError('Error: No hay conexión con el servidor.');
        return;
      }

      // Si NO hay remoto todavía y ya estamos "searching", no dispares next en bucle
      if (!remoteStream && searching) {
        return;
      }

      socketRef.current.send(JSON.stringify({ type: 'next' }));

      if (peerRef.current) { try { peerRef.current.destroy(); } catch {} peerRef.current = null; }
      if (remoteStream) { try { remoteStream.getTracks().forEach((track) => track.stop()); } catch {} }

      setCurrentClientId(null);
      setRemoteStream(null);
      setMessages([]);
      setClientSaldo(null);
      setClientSaldoLoading(false);
      setStatus('Buscando nuevo cliente...');
      setSearching(true);

      try { socketRef.current?.readyState === WebSocket.OPEN && socketRef.current.send(JSON.stringify({ type: 'stats' })); } catch {}
    } finally {
      setTimeout(() => { nextGuardRef.current = false; }, 700);
    }
  };


  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput.trim() };
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      lastSentRef.current = { text: message.message, at: Date.now() };
      socketRef.current.send(JSON.stringify(message));
      setMessages((prev) => [...prev, { from: 'me', text: message.message }]);
      setChatInput('');
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

    const tk = localStorage.getItem('token');
    if (!tk) {
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
    const tk = localStorage.getItem('token');
    if (!tk) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      await alert({
        title: 'Sesión',
        message: 'Sesión expirada. Inicia sesión de nuevo.',
        variant: 'warning',
      });
      return;
    }

    // 1) Abrimos nuestro modal propio para pedir el importe
    const result = await openPayoutModal({
      title: 'Solicitud de retiro',
      message: 'Introduce la cantidad que deseas retirar:',
      initialAmount: 10,
    });

    // Si cierra o cancela el modal
    if (!result || !result.confirmed) return;

    const amount = Number(result.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      await alert({
        title: 'Importe no válido',
        message: 'Introduce un importe válido mayor que 0.',
        variant: 'warning',
      });
      return;
    }

    try {
      setLoadingSaldoModel(true);

      const res = await fetch('/api/transactions/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tk}`,
        },
        body: JSON.stringify({
          amount,
          description: 'Solicitud de retiro',
        }),
      });

      if (!res.ok) {
        let friendlyMsg = `Error ${res.status}`;
        try {
          const data = await res.json();
          if (data && data.message) {
            friendlyMsg = data.message;
          }
        } catch {
          try {
            const txt = await res.text();
            if (txt) friendlyMsg = txt;
          } catch {
            // nos quedamos con friendlyMsg por defecto
          }
        }

        throw new Error(friendlyMsg);
      }

      await alert({
        title: 'Solicitud enviada',
        message: 'Tu solicitud de retiro se ha registrado correctamente.',
        variant: 'success',
      });

      // Refrescar saldo de la modelo
      const res2 = await fetch('/api/models/me', {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(txt || `Error refrescando saldo: ${res2.status}`);
      }
      const data = await res2.json();
      setSaldoModel(data.saldoActual);
      setError('');
    } catch (e) {
      console.error(e);
      const msg = e.message || 'Error al solicitar retiro.';
      await alert({
        title: 'Error',
        message: msg,
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

    // RANDOM
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
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

    setCurrentClientId(null);
    setCameraActive(false);
    setRemoteStream(null);
    setError('');
    setStatus('');
    setQueuePosition(null);
    setMessages([]);
    setClientSaldo(null);
    setClientSaldoLoading(false);
    setShowMsgPanel(false);
    setOpenChatWith(null);
    setSearching(false);

    // CALLING
    try { handleCallEnd(true); } catch {}
  };


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
    if (!currentClientId) {
      await alert({
        variant: 'warning',
        title: 'Favoritos',
        message: 'No se pudo identificar al cliente actual.',
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
      const res = await fetch(`/api/favorites/clients/${currentClientId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
      });

      if (res.status === 409) {
        await alert({
          variant: 'info',
          title: 'Favoritos',
          message: 'Este cliente ya está en tus favoritos.',
        });
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }

      // 204 => consultamos meta para mensaje contextual
      try {
        const metaRes = await fetch('/api/favorites/clients/meta', {
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

  const setActivePeer = (peerId, peerName, mode, favUser = null) => {
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
    const peer = Number(favUser?.id ?? favUser?.userId);
    const name =
      favUser?.nickname || favUser?.name || favUser?.email || 'Usuario';

    if (!Number.isFinite(peer) || peer <= 0) {
      alert('No se pudo determinar el destinatario correcto.');
      return;
    }
    if (Number(user?.id) === peer) {
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
    const peer = Number(peerId);

    if (streamingActivo) {
      alert('No puedes abrir el chat central mientras hay streaming. Pulsa Stop si quieres cambiar.');
      return;
    }

    if (!Number.isFinite(peer) || peer <= 0) {
      console.warn('[openChatWithPeer][Model] peerId inválido:', peerId);
      return;
    }

    // IMPORTANTE:
    // Aquí NO volvemos a fijar openChatWith.
    // La fuente de verdad es targetPeerId, y el effect de compatibilidad lo reflejará.
    setActiveTab('favoritos');
    setCenterChatPeerName(displayName || 'Usuario');
    setCenterMessages([]);

    openMsgSocket();

    try {
      const data = await apiFetch(`/messages/with/${peer}`);
      if (data) {
        const normalized = (data || []).map(raw => ({
          id: raw.id,
          senderId: Number(raw.senderId ?? raw.sender_id),
          recipientId: Number(raw.recipientId ?? raw.recipient_id),
          body: raw.body,
          createdAt: raw.createdAt ?? raw.created_at,
          readAt: raw.readAt ?? raw.read_at ?? null,
        }));

        // detectar regalos en historial
        normalized.forEach(m => {
          if (typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts = m.body.slice(2, -2).split(':');
            if (parts.length >= 3) m.gift = { id: Number(parts[1]), name: parts.slice(2).join(':'), icon: '🎁' };
          }
        });

        setCenterMessages(normalized.reverse());

        try {
          await apiFetch(`/messages/with/${peer}/read`, { method: 'POST' });
        } catch {}
      }
    } catch (e) {
      console.warn('Historial chat error:', e?.message);
    }
  };

  const sendCenterMessage = () => {
    const body = String(centerInput || '').trim();
    if (!body) return;

    // Prioridad: autoridad (ref) -> openChatWith -> targetPeerId
    const to =
      Number(activePeerRef.current?.id) ||
      Number(openChatWith) ||
      Number(targetPeerId);

    if (!Number.isFinite(to) || to <= 0) {
      console.warn('[sendCenterMessage][Model] destinatario inválido', {
        activePeer: activePeerRef.current,
        openChatWith,
        targetPeerId
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
        console.warn('[sendCenterMessage][Model] error enviando WS', e);
        alert('No se pudo enviar el mensaje. Reintenta.');
      }
    } else {
      alert('Chat de mensajes desconectado. Reabre el panel.');
    }
  };


  const acceptInvitation = async () => {
    if (!selectedFav?.id) return;
    const tk = localStorage.getItem('token');
    try {
      await apiFetch(`/favorites/accept/${selectedFav.id}`, { method: 'POST' });

      const name = selectedFav.nickname || 'Usuario';
      setSelectedFav(prev => prev ? ({ ...prev, invited: 'accepted' }) : prev);
      setFavReload(x => x + 1);
      setOpenChatWith(selectedFav.id);
    } catch (e) {
      alert(e.message || 'No se pudo aceptar la invitación');
    }
  };

  const rejectInvitation = async () => {
    if (!selectedFav?.id) return;
    const tk = localStorage.getItem('token');
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
    console.log('[CALL][cam:on][Model] requesting user media');

    if (callStatus === 'idle' && !callAllowed) {
      setCallError('No puedes activar la cámara: la relación aún no está aceptada.');
      return;
    }

    try {

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      callLocalStreamRef.current = stream;
      setCallCameraActive(true);
      setCallStatus('camera-ready');
      setCallError('');
      if (callLocalVideoRef.current) {
        callLocalVideoRef.current.srcObject = stream;
      }
      console.log('[CALL][cam:on][Model] success tracks=', stream.getTracks().length);
    } catch (err) {
      console.error('[CALL][cam:on][Model] error', err);
      setCallError('Error al activar la cámara: ' + err.message);
      setCallCameraActive(false);
      setCallStatus('idle');
    }
  };

  //Enviar invitación (modelo llama)
  const handleCallInvite = () => {
    if (!callCameraActive || !callLocalStreamRef.current) {
      setCallError('Primero activa la cámara para llamar.');
      return;
    }

    if (!callAllowed) {
      setCallError('Llamadas bloqueadas: la relación no está aceptada.');
      return;
    }

    let toId = null;
    let toName = '';

    if (openChatWith) {
      toId = Number(openChatWith);
      toName = centerChatPeerName || 'Usuario';
    } else if (selectedFav?.id) {
      toId = Number(selectedFav.id);
      toName = selectedFav?.nickname || selectedFav?.name || selectedFav?.email || 'Usuario';
    }

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
        const type =
          signal?.type ||
          (signal?.candidate ? 'candidate' : 'unknown');

        if (type === 'candidate') {
          const cand = signal?.candidate;
          if (!cand || cand.candidate === '' || cand.candidate == null) return;
        }

        const toId = Number(callPeerIdRef.current);
        const wsOpen = msgSocketRef.current?.readyState === WebSocket.OPEN;
        const validTo = Number.isFinite(toId) && toId > 0;

        console.log('[CALL][signal:out][Model]', { type, toId, wsOpen, validTo });

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
      setCallError('Error en la conexión WebRTC: ' + err.message);
    });

    p.on('close', () => {
      console.log('[CALL][peer:close][Model]');
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

  };


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
    if (Number(user?.id) === peer) {
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

  const displayName = user?.nickname || user?.name || user?.email || 'Modelo';

  return (
    <StyledContainer>
      <GlobalBlack />
      {/* ========= INICIO NAVBAR  ======== */}
      <StyledNavbar style={{padding:'0 24px'}}>
        <div style={{display:'flex',alignItems:'center'}}>
          <StyledBrand href="#" aria-label="SharemeChat" onClick={handleLogoClick} />
          <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:8,marginLeft:16}}>
            <StyledNavTab type="button" data-active={activeTab === 'videochat'} aria-pressed={activeTab === 'videochat'} onClick={handleGoVideochat} title="Videochat">
              Videochat
            </StyledNavTab>
            <StyledNavTab type="button" data-active={activeTab === 'favoritos'} aria-pressed={activeTab === 'favoritos'} onClick={handleGoFavorites} title="Favoritos">
              Favoritos
            </StyledNavTab>
            <StyledNavTab type="button" data-active={activeTab === 'blog'} aria-pressed={activeTab === 'blog'} onClick={handleGoBlog} title="Blog">
              Blog
            </StyledNavTab>
          </div>
        </div>

        <StyledNavGroup className="desktop-only" data-nav-group style={{display:'flex',alignItems:'center',gap:12,marginLeft:'auto'}}>

          {queuePosition !== null && queuePosition >= 0 && (
            <QueueText className="me-3">Pos.: {queuePosition + 1}</QueueText>
          )}
          <NavText className="me-3">{displayName}</NavText>
          <SaldoText className="me-3">
            {loadingSaldoModel ? 'Saldo: ...' : saldoModel !== null ? `Saldo: €${Number(saldoModel).toFixed(2)}` : 'Saldo: -'}
          </SaldoText>
          <NavButton type="button" onClick={handleGoStats} title="Estadísticas">
            <FontAwesomeIcon icon={faChartLine} style={{color:'#22c55e',fontSize:'1rem'}} />
            <span>Estadísticas</span>
          </NavButton>

          <NavButton type="button" onClick={handleRequestPayout} title="Retirar">
            <FontAwesomeIcon icon={faGem} style={{color:'#f97316',fontSize:'1rem'}} />
            <span>Retirar</span>
          </NavButton>

          <NavButton type="button" onClick={handleLogout} title="Salir">
            <FontAwesomeIcon icon={faSignOutAlt} />
            <span>Salir</span>
          </NavButton>

          <StyledNavAvatar src={profilePic || '/img/avatarChica.png'} alt="avatar" title="Ver perfil" onClick={handleProfile} />
        </StyledNavGroup>

        <HamburgerButton onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú" title="Menú">
          <FontAwesomeIcon icon={faBars} />
        </HamburgerButton>

        <MobileMenu className={!menuOpen && 'hidden'}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <NavText>{displayName}</NavText>
            <SaldoText>
              {loadingSaldoModel ? 'Saldo: …' : saldoModel !== null ? `Saldo: €${Number(saldoModel).toFixed(2)}` : 'Saldo: n/d'}
            </SaldoText>
          </div>

          <NavButton onClick={() => { handleProfile(); setMenuOpen(false); }}>
            <FontAwesomeIcon icon={faUser} />
            <StyledIconWrapper>Perfil</StyledIconWrapper>
          </NavButton>

          <NavButton onClick={() => { handleGoStats(); setMenuOpen(false); }} title="Estadísticas">
            <FontAwesomeIcon icon={faChartLine} style={{color:'#22c55e',fontSize:'1rem'}} />
            <span>Estadísticas</span>
          </NavButton>

          <NavButton onClick={() => { handleRequestPayout(); setMenuOpen(false); }} title="Retirar">
            <FontAwesomeIcon icon={faGem} style={{color:'#f97316',fontSize:'1rem'}} />
            <span>Retirar</span>
          </NavButton>

          <NavButton onClick={() => { handleLogout(); setMenuOpen(false); }} title="Salir">
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </NavButton>
        </MobileMenu>
      </StyledNavbar>
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
            toggleFullscreen={toggleFullscreen}
            handleStartMatch={handleStartMatch}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
            handleBlockPeer={handleBlockPeer}
            error={error}
            modelStatsSummary={modelStatsSummary}
            modelStatsTiers={modelStats?.tiers}
            clientSaldo={clientSaldo}
            clientSaldoLoading={clientSaldoLoading}
          />
        ) : activeTab === 'stats' ? (
          <Estadistica
            modelStatsDays={modelStatsDays}
            setModelStatsDays={(v) => {
              setModelStatsDays(v);
              statsDetailLoadedRef.current = false;
            }}
            onReload={() => {
              statsDetailLoadedRef.current = false;
              setActiveTab('stats');
            }}
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
              <StyledLeftColumn data-rail>
                {callStatus === 'idle' ? (
                  <FavoritesModelList
                    onSelect={handleOpenChatFromFavorites}
                    reloadTrigger={favReload}
                    selectedId={selectedContactId}
                  />
                ) : (
                  <div style={{padding:8,color:'#adb5bd'}}>En llamada: la lista se bloquea hasta colgar.</div>
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
                  user={user}
                  gifts={gifts}
                  giftRenderReady={giftRenderReady}
                  handleOpenChatFromFavorites={handleOpenChatFromFavorites}
                  favReload={favReload}
                  selectedContactId={selectedContactId}
                  setTargetPeerId={setTargetPeerId}
                  setTargetPeerName={setTargetPeerName}
                  setSelectedFav={setSelectedFav}
                  handleCallAccept={handleCallAccept}
                  handleCallReject={handleCallReject}
                  callClientSaldo={callClientSaldo}
                  callClientSaldoLoading={callClientSaldoLoading}

                />
              )}
            </StyledCenter>

            {!showFavoritesFullCall && <StyledRightColumn />}
          </>
        )}
      </StyledMainContent>
      {/* ======FIN MAIN ======== */}

      {!inCall && (
        <MobileBottomNav>
          <BottomNavButton active={activeTab === 'videochat'} onClick={handleGoVideochat}><span>Videochat</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'favoritos'} onClick={handleGoFavorites}><span>Favoritos</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'blog'} onClick={handleGoBlog}><span>Blog</span></BottomNavButton>
        </MobileBottomNav>
      )}

      {/*FIN CLICK DERECHO */}
    </StyledContainer>
  );

};

export default DashboardModel;

