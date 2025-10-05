// DashboardModel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesModelList from './features/favorites/FavoritesModelList';
import FunnyplacePage from './features/funnyplace/FunnyplacePage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { faSignOutAlt, faUser, faHeart, faVideo, faFilm } from '@fortawesome/free-solid-svg-icons';
import {
  StyledContainer,
  StyledNavbar,
  StyledNavButton,
  StyledIconWrapper,
  StyledMainContent,
  StyledLeftColumn,
  StyledCenter,
  StyledRightColumn,
  StyledActionButton,
  StyledLocalVideo,
  StyledRemoteVideo,
  StyledChatContainer,
  StyledNavGroup,
  StyledNavAvatar,
  StyledIconBtn,
  StyledTopActions,
  StyledVideoTitle,
  StyledVideoArea,
  StyledChatDock,
  StyledChatList,
  StyledChatMessageRow,
  StyledChatBubble,
  StyledChatInput,
  StyledGiftToggle,
  StyledGiftsPanel,
  StyledGiftGrid,
  StyledGiftIcon,
  StyledTitleAvatar,
  StyledTabsBar,
  StyledTabButton,
  StyledTabIcon

} from '../styles/ModelStyles';

const DashboardModel = () => {
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

  // ====== CALLING (1-a-1) ======
  const [callCameraActive, setCallCameraActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle | camera-ready | connecting | ringing | incoming | in-call
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
    const loadUser = async () => {
      try {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          meIdRef.current = Number(data?.id || 0);
        }
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
        const r = await fetch('/api/models/documents/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json();
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
        const r = await fetch(`/api/users/${currentClientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        const nn = d?.nickname || d?.name || d?.email || 'Cliente';
        setClientNickname(nn);
      } catch {/* noop */}
    })();
  }, [token, currentClientId]);

  useEffect(() => {
    if (!token || !currentClientId) return;

    (async () => {
      try {
        const r = await fetch(`/api/users/avatars?ids=${encodeURIComponent(currentClientId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const map = await r.json(); // { [id]: url }
        const url = map?.[currentClientId] || '';
        setClientAvatar(url);
      } catch {/* noop */}
    })();
  }, [token, currentClientId]);

  // [CALL][Model] Usa el chat central contra el peer de la llamada
  useEffect(() => {
    if (activeTab !== 'calling') return;
    if (!callPeerId) return;

    // Apunta el chat central al peer de la llamada (sin abrir pestañas)
    setOpenChatWith(callPeerId);
    setCenterChatPeerName(callPeerName || `Usuario ${callPeerId}`);

    // Garantiza socket de mensajes activo
    openMessagesSocket?.();
  }, [activeTab, callPeerId, callPeerName]);


  useEffect(() => {
    if (localVideoRef.current && localStream.current) {
      localVideoRef.current.srcObject = localStream.current;
    }
  }, [cameraActive]);

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
  }, [callCameraActive]);

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

  useEffect(()=>{
    const tk=localStorage.getItem('token');
    if(!tk) return;
    fetch('/api/gifts',{ headers:{Authorization:`Bearer ${tk}`} })
      .then(r=>r.ok?r.json():[])
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
    queueMicrotask(() => { el.scrollTop = el.scrollHeight; });
  }, [centerMessages, openChatWith]);


  // [CALL][Model] target dinámico desde Favoritos (chat central) o favorito seleccionado
  useEffect(() => {
    // Si la llamada NO está en idle, no recalculamos destino
    if (callStatus !== 'idle') {
      return;
    }

    // 1) Prioridad: chat central -> favorito seleccionado -> sin target
    if (openChatWith) {
      const id = Number(openChatWith);
      const name = centerChatPeerName || `Usuario ${id}`;
      setCallPeerId(id);
      callPeerIdRef.current = id; // REF
      setCallPeerName(name);
      console.log('[CALL][Model] target <- Favorites chat:', id, name);
    } else if (selectedFav?.id) {
      const id = Number(selectedFav.id);
      const name =
        selectedFav?.nickname || selectedFav?.name || selectedFav?.email || `Usuario ${id}`;
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
    // quitamos activeTab de dependencias
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

    if (callPeerName && callPeerName !== `Usuario ${id}`) return;

    (async () => {
      try {
        console.log('[CALL][Model] Resolviendo nombre via /api/users/', id);
        const r = await fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${tk}` } });
        if (!r.ok) return;
        const d = await r.json();
        const nn = d?.nickname || d?.name || d?.email || `Usuario ${id}`;
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
        const r = await fetch(`/api/users/avatars?ids=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        if (!r.ok) return;
        const map = await r.json(); // { [id]: url }
        setCallPeerAvatar(map?.[id] || '');
      } catch {/* noop */}
    })();
  }, [callPeerId]);


  useEffect(() => {
    const tk = localStorage.getItem('token');
    if (!tk) return;

    const fetchSaldoModel = async () => {
      try {
        setLoadingSaldoModel(true);
        const res = await fetch('/api/models/me', {
          headers: { Authorization: `Bearer ${tk}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Error ${res.status}`);
        }
        const data = await res.json();
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
        const res = await fetch(`/api/messages/with/${peer}`, {
          headers: { Authorization: `Bearer ${tk}` }
        });
        if (!res.ok) throw new Error(await res.text() || `Error ${res.status}`);
        const data = await res.json();
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
          await fetch(`/api/messages/with/${peer}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tk}` }
          });
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

  const closeMessagesSocket = () => {
    try { if (msgSocketRef.current) msgSocketRef.current.close(); } catch {}
    msgSocketRef.current = null;
    setMsgConnected(false);
    clearMsgTimers();
  };


  const openMessagesSocket = () => {
    const tk = localStorage.getItem('token');
    if (!tk) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }

    if (msgSocketRef.current && msgSocketRef.current.readyState === WebSocket.OPEN) {
      setMsgConnected(true);
      return;
    }

    closeMessagesSocket();

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host  = window.location.host;
    const url   = `${proto}://${host}/messages?token=${encodeURIComponent(tk)}`;

    const s = new WebSocket(url);
    msgSocketRef.current = s;

    s.onopen = () => {
      console.log('[WS][messages] OPEN (Model)');
      setMsgConnected(true);
      if (msgPingRef.current) clearInterval(msgPingRef.current);
      msgPingRef.current = setInterval(() => {
        try {
          if (msgSocketRef.current && msgSocketRef.current.readyState === WebSocket.OPEN) {
            msgSocketRef.current.send(JSON.stringify({ type: 'ping' }));
            if (callStatus === 'in-call' || callStatus === 'connecting') {
              msgSocketRef.current.send(JSON.stringify({ type: 'call:ping' }));
              console.log('[CALL][ping] sent (model)');
            }
          }
        } catch {}
      }, 30000);
    };

    s.onclose = () => {
      console.log('[WS][messages] CLOSE (Model)');
      setMsgConnected(false);
      clearMsgTimers();
      msgReconnectRef.current = setTimeout(() => {
        openMessagesSocket();
      }, 1500);
    };

    s.onerror = (e) => {
      console.log('[WS][messages] ERROR (Model)', e);
      setMsgConnected(false);
      try { s.close(); } catch {}
    };

    s.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);

        // ==== MENSAJERÍA EXISTENTE ====
        if (data.type === 'msg:new' && data.message) {
          const m = normMsg(data.message);
          if (typeof m.body==='string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts=m.body.slice(2,-2).split(':');
            if (parts.length>=3) m.gift={id:Number(parts[1]),name:parts.slice(2).join(':')};
          }
          const me   = Number(meIdRef.current);
          const peer = Number(peerIdRef.current);
          if (!me || !peer) return;

          const belongsToThisChat =
            (m.senderId === peer && m.recipientId === me) ||
            (m.senderId === me   && m.recipientId === peer);

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
          const me   = Number(meIdRef.current);
          const peer = Number(peerIdRef.current);
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
            (item.senderId === me   && item.recipientId === peer);
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

        // ==== CALLING: eventos call:* ====
        if (data.type === 'call:incoming') {
          console.log('[CALL][incoming][Model] from=', data.from, 'name=', data.displayName);
          setActiveTab('calling');
          const id = Number(data.from);
          setCallPeerId(id);
          callPeerIdRef.current = id;
          setCallPeerName(String(data.displayName || `Usuario ${id}`));
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

          // 🔧 FIX: limpiar el timeout de timbrado si seguía vivo
          if (callRingTimeoutRef.current) {
            clearTimeout(callRingTimeoutRef.current);
            callRingTimeoutRef.current = null;
          }

          const initiator = (callRoleRef.current === 'caller');
          wireCallPeer(initiator);

          setCallStatus('in-call');
          setCallError('');

          // mantener ping periódico de saldo
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
          setCallError('La llamada fue rechazada.');
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
          setCallError('El cliente no tiene saldo suficiente para iniciar la llamada.');
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          return;
        }

        if (data.type === 'call:busy') {
          console.log('[CALL][busy][Model]', data);
          setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
          setCallError('El usuario está ocupado.');
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          return;
        }

        if (data.type === 'call:offline') {
          console.log('[CALL][offline][Model]');
          setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
          setCallError('El usuario no está disponible.');
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          return;
        }

        if (data.type === 'call:error') {
          console.log('[CALL][error][Model]', data.message);
          setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
          setCallError(String(data.message || 'Error en la llamada'));
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          return;
        }
      } catch (e) {
        // silenciar parse errors
      }
    };
  };


  useEffect(() => {
     openMessagesSocket();
     return () => closeMessagesSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      localStream.current = stream;
      setCameraActive(true);

      const tk = localStorage.getItem('token');
      if (!tk) {
        setError('Sesión expirada. Inicia sesión de nuevo.');
        return;
      }

      startWebSocketAndWait(tk);
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const startWebSocketAndWait = (tk) => {
    const wsUrl = `wss://test.sharemechat.com/match?token=${encodeURIComponent(tk)}`;
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
        try {
          if (data.peerRole === 'client' && Number.isFinite(Number(data.peerUserId))) {
            setCurrentClientId(Number(data.peerUserId));
          } else {
            setCurrentClientId(null);
          }
        } catch { setCurrentClientId(null); }

        // reset de peer/remote
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

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError('Error: No hay conexión con el servidor.');
      setSearching(false);
      return;
    }
    try {
      socketRef.current.send(JSON.stringify({ type: 'start-match' }));
    } catch (e) {
      setError('Error enviando start-match.');
      setSearching(false);
    }
  };

  const handleNext = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'next' }));
    } else {
      setError('Error: No hay conexión con el servidor.');
      return;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }

    setCurrentClientId(null);
    setRemoteStream(null);
    setMessages([]);
    setStatus('Buscando nuevo cliente...');
    setSearching(true);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'stats' }));
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

  const handleProfile = () => {
    history.push('/perfil-model');
  };

  const handleRequestPayout = async () => {
    const tk = localStorage.getItem('token');
    if (!tk) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }

    let input = window.prompt('Cantidad a retirar (€):', '10');
    if (input === null) return;

    input = String(input).replace(',', '.').trim();
    const amount = Number(input);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Introduce un importe válido mayor que 0.');
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
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }

      alert('Solicitud de retiro registrada correctamente.');

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
      alert(e.message || 'Error al solicitar retiro.');
      setError(e.message || 'Error al cargar saldo de modelo');
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
    setShowMsgPanel(false);
    setOpenChatWith(null);
    setSearching(false);

    // CALLING
    try { handleCallEnd(true); } catch {}
  };


  const streamingActivo = !!remoteStream;

  const handleGoFunnyplace = () => {
    if (streamingActivo) {
      const ok = window.confirm('Si entras en Funnyplace se cortará el streaming actual. ¿Continuar?');
      if (!ok) return;
      stopAll();
    }
    if (callStatus !== 'idle') {
      const ok = window.confirm('Hay una llamada en curso o sonando. Se colgará la llamada. ¿Continuar?');
      if (!ok) return;
      handleCallEnd(true); // fuerza limpieza
    }
    setActiveTab('funnyplace');
  };


  const handleGoFavorites = () => {
    if (streamingActivo) {
      alert('No puedes salir del Videochat mientras hay streaming. Pulsa Stop o Next si quieres cambiar.');
      return;
    }
    if (callStatus !== 'idle') {
      const ok = window.confirm('Hay una llamada en curso o sonando. Se colgará la llamada. ¿Continuar?');
      if (!ok) return;
      handleCallEnd(true);
    }
    setActiveTab('favoritos');
  };


  const handleAddFavoriteClient = async () => {
    if (!currentClientId) {
      alert('No se pudo identificar al cliente actual (falta peerUserId en el match).');
      return;
    }
    const tk = localStorage.getItem('token');
    if (!tk) { setError('Sesión expirada. Inicia sesión de nuevo.'); return; }
    try {
      const res = await fetch(`/api/favorites/clients/${currentClientId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.status === 204) {
        alert('Cliente añadido a tus favoritos.');
      } else if (res.status === 409) {
        alert('Este cliente ya está en tus favoritos.');
      } else if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      } else {
        alert('Cliente añadido a tus favoritos.');
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'No se pudo añadir a favoritos.');
    }
  };

  const handleOpenChatFromFavorite = (favUser) => {
    const peer = Number(favUser?.id ?? favUser?.userId);
    const name =
      favUser?.nickname || favUser?.name || favUser?.email || `Usuario ${peer || ''}`;

    if (!Number.isFinite(peer) || peer <= 0) {
      alert('No se pudo determinar el destinatario correcto.');
      return;
    }
    if (Number(user?.id) === peer) {
      alert('No puedes chatear contigo mismo.');
      return;
    }

    setSelectedFav(favUser);
    setActiveTab('favoritos');

    if (String(favUser?.invited) === 'pending') {
      setOpenChatWith(peer);
      setCenterChatPeerName(name);
      setCenterMessages([]);
      centerSeenIdsRef.current = new Set();
      setShowMsgPanel(true);
      openMessagesSocket?.();
      return;
    }

    setShowMsgPanel(true);
    openMessagesSocket?.();
    openChatWithPeer(peer, name);
  };

  const openChatWithPeer = async (peerId, displayName) => {
    if (streamingActivo) {
      alert('No puedes abrir el chat central mientras hay streaming. Pulsa Stop si quieres cambiar.');
      return;
    }
    setActiveTab('favoritos');
    setOpenChatWith(peerId);
    setCenterChatPeerName(displayName || `Usuario ${peerId}`);
    setCenterMessages([]);

    openMessagesSocket();

    try {
      const tk = localStorage.getItem('token');
      const res = await fetch(`/api/messages/with/${peerId}`, {
        headers: { Authorization: `Bearer ${tk}` }
      });
      if (res.ok) {
        const data = await res.json();
        const normalized=(data||[]).map(raw=>({
          id: raw.id,
          senderId: Number(raw.senderId ?? raw.sender_id),
          recipientId: Number(raw.recipientId ?? raw.recipient_id),
          body: raw.body,
          createdAt: raw.createdAt ?? raw.created_at,
          readAt: raw.readAt ?? raw.read_at ?? null,
        }));
        // detectar regalos en historial
        normalized.forEach(m=>{
          if (typeof m.body==='string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts=m.body.slice(2,-2).split(':');
            if (parts.length>=3) m.gift={id:Number(parts[1]),name:parts.slice(2).join(':'),icon:'🎁'};
          }
        });
        setCenterMessages(normalized.reverse());
        try {
          await fetch(`/api/messages/with/${peerId}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tk}` }
          });
        } catch {}
      }
    } catch (e) {
      console.warn('Historial chat error:', e?.message);
    }
  };

  const sendCenterMessage = () => {
    if (!openChatWith || !centerInput.trim()) return;
    const s = msgSocketRef.current;
    if (s && s.readyState === WebSocket.OPEN) {
      const payload = { type: 'msg:send', to: Number(openChatWith), body: centerInput.trim() };
      s.send(JSON.stringify(payload));
      setCenterInput('');
    } else {
      alert('Chat de mensajes desconectado. Reabre el panel.');
    }
  };

  const acceptInvitation = async () => {
    if (!selectedFav?.id) return;
    const tk = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/favorites/accept/${selectedFav.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` }
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const name = selectedFav.nickname || `Usuario ${selectedFav.id}`;
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
      const res = await fetch(`/api/favorites/reject/${selectedFav.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` }
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      setSelectedFav(prev => prev ? ({ ...prev, invited: 'rejected' }) : prev);
      setFavReload(x => x + 1);
    } catch (e) {
      alert(e.message || 'No se pudo rechazar la invitación');
    }
  };

  //Activar cámara para Calling
  const handleCallActivateCamera = async () => {
    console.log('[CALL][cam:on][Model] requesting user media');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
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

    let toId = null;
    let toName = '';

    if (openChatWith) {
      toId = Number(openChatWith);
      toName = centerChatPeerName || `Usuario ${openChatWith}`;
    } else if (selectedFav?.id) {
      toId = Number(selectedFav.id);
      toName = selectedFav?.nickname || selectedFav?.name || selectedFav?.email || `Usuario ${selectedFav.id}`;
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
        if (callStatus === 'connecting') {
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
      console.error('[CALL][peer:error][Model]', err);
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

    // Opcional: ocultar datos del último peer en la UI de Calling
    setCallPeerId(null);
    callPeerIdRef.current = null;
    setCallPeerName('');
    setCallPeerAvatar('');
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
      favUser?.nickname || favUser?.name || favUser?.email || `Usuario ${peer}`;

    console.log('[CALL][Model] Target seleccionado desde lista (Calling):', peer, name);

    setActiveTab('calling');     // aseguramos estar en Calling
    setSelectedFav(favUser);     // opcional: mantener la selección
    setOpenChatWith(null);       // NO abrimos chat central
    setCenterChatPeerName('');

    setCallPeerId(peer);
    callPeerIdRef.current = peer;
    setCallPeerName(name);
    // Si FavoriteList te da avatar, úsalo; si no, lo obtendrá el useEffect
    if (favUser?.avatarUrl) setCallPeerAvatar(favUser.avatarUrl);
  };


  const displayName = user?.nickname || user?.name || user?.email || 'Modelo';

  return (

    <StyledContainer>

      {/* ========= INICIO NAVBAR  ======== */}
      <StyledNavbar>
        <span>Mi Logo</span>
        <StyledNavGroup>
          <span className="me-3">Hola, {displayName}</span>

          <span className="me-3">
            {loadingSaldoModel
              ? 'Saldo: ...'
              : saldoModel !== null
              ? `Saldo: €${Number(saldoModel).toFixed(2)}`
              : 'Saldo: -'}
          </span>

          {queuePosition !== null && queuePosition >= 0 && (
            <span className="me-3" style={{ color: '#6c757d' }}>
              Tu posición: {queuePosition + 1}
            </span>
          )}

          <StyledNavButton type="button" title="Estadísticas" aria-label="Estadísticas">
            <FontAwesomeIcon icon={faChartLine} />
            <StyledIconWrapper>Estadísticas</StyledIconWrapper>
          </StyledNavButton>

          <StyledNavButton type="button" onClick={handleRequestPayout}>
            Solicitar retiro
          </StyledNavButton>

          <StyledNavButton type="button" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>
          <StyledNavButton type="button" onClick={handleProfile}>
            <FontAwesomeIcon icon={faUser} />
            <StyledIconWrapper>Perfil</StyledIconWrapper>
          </StyledNavButton>
          <StyledNavAvatar
            src={profilePic || '/img/avatar.png'}
            alt="avatar"
            title="Ver perfil"
            onClick={handleProfile}
          />
        </StyledNavGroup>
      </StyledNavbar>
      {/* ========= FIN NAVBAR  ======== */}

      {/* ========= INICIO MAIN  ======== */}
      <StyledMainContent>

        <StyledLeftColumn data-rail>

          {/* ========= INICIO COLUMNA IZQUIERDA PESTAÑAS ======== */}
          <StyledTabsBar role="tablist" aria-label="Secciones">
            <StyledTabIcon
              role="tab"
              aria-selected={activeTab === 'videochat'}
              data-active={activeTab === 'videochat'}
              onClick={() => setActiveTab('videochat')}
              title="Videochat"
              aria-label="Videochat"
            >
              <FontAwesomeIcon icon={faVideo} />
            </StyledTabIcon>

            <StyledTabIcon
              role="tab"
              aria-selected={activeTab === 'favoritos'}
              data-active={activeTab === 'favoritos'}
              onClick={handleGoFavorites}
              title="Favoritos"
              aria-label="Favoritos"
            >
              <FontAwesomeIcon icon={faHeart} />
            </StyledTabIcon>

            <StyledTabIcon
              role="tab"
              aria-selected={activeTab === 'funnyplace'}
              data-active={activeTab === 'funnyplace'}
              onClick={handleGoFunnyplace}
              title="Funnyplace"
              aria-label="Funnyplace"
            >
              <FontAwesomeIcon icon={faFilm} />
            </StyledTabIcon>

            <StyledTabIcon
              role="tab"
              aria-selected={activeTab === 'calling'}
              data-active={activeTab === 'calling'}
              onClick={() => {
                if (streamingActivo) {
                  alert('No puedes entrar en Calling mientras hay streaming random activo.');
                  return;
                }
                setActiveTab('calling');
              }}
              title="Calling"
              aria-label="Calling"
            >
              <FontAwesomeIcon icon={faVideo} />
            </StyledTabIcon>
          </StyledTabsBar>
          {/* ========= FIN COLUMNA IZQUIERDA PESTAÑAS ======== */}

          {/* Lista izquierda:
              - En Favoritos: abre chat central
              - En Calling: fija destinatario de la llamada (NO abre chat) */}

          {activeTab === 'favoritos' && (
            <FavoritesModelList
              onSelect={handleOpenChatFromFavorite}
              reloadTrigger={favReload}
            />
          )}

          {activeTab === 'calling' && (
            callStatus === 'idle' ? (
              <FavoritesModelList
                onSelect={handleSelectCallTargetFromFavorites}
                reloadTrigger={favReload}
              />
            ) : (
              <div style={{ padding: 8, color: '#adb5bd' }}>
                En llamada: la lista se bloquea hasta colgar.
              </div>
            )
          )}


        </StyledLeftColumn>
        {/* ========= FIN COLUMNA IZQUIERDA PESTAÑAS ======== */}

        {/* ==============INICIO ZONA CENTRAL ========== */}
        <StyledCenter>

          {/*RENDERIZADO VIDEOCHAT */}
          {activeTab === 'videochat' && (
            <>
              {status && <p style={{ color: '#6c757d', marginTop: '10px' }}>{status}</p>}
              {!cameraActive && (
                <StyledActionButton onClick={startCamera}>Activar Cámara</StyledActionButton>
              )}
              {cameraActive && (
                <>
                  <StyledTopActions>
                    {!searching && (
                      <StyledActionButton onClick={handleStartMatch}>Buscar Cliente</StyledActionButton>
                    )}
                    {searching && <p>Buscando cliente...</p>}

                    <StyledActionButton onClick={stopAll} style={{ backgroundColor: '#dc3545' }}>
                      Stop
                    </StyledActionButton>

                    {remoteStream && !searching && (
                      <>
                        <StyledActionButton onClick={handleNext}>Next</StyledActionButton>
                        {currentClientId && (
                          <StyledActionButton onClick={handleAddFavoriteClient}> + Favorito </StyledActionButton>
                        )}
                      </>
                    )}
                  </StyledTopActions>

                  <StyledLocalVideo>
                    <h5 style={{ color: 'white' }}>Tu Cámara</h5>
                    <video
                      ref={localVideoRef}
                      style={{ width: '100%', border: '1px solid black' }}
                      muted
                      autoPlay
                    />
                  </StyledLocalVideo>

                  {remoteStream && (
                    <>
                      {/* 95%: área de vídeo + overlay de mensajes */}
                      <StyledVideoArea>
                        <StyledRemoteVideo>
                          <StyledVideoTitle>
                            {clientAvatar && <StyledTitleAvatar src={clientAvatar} alt="" />}
                            {clientNickname}
                          </StyledVideoTitle>
                          <video
                            ref={remoteVideoRef}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', border: '1px solid black' }}
                            autoPlay
                          />
                        </StyledRemoteVideo>

                        {/* Overlay de mensajes sobre el vídeo */}
                        <StyledChatContainer>
                          <StyledChatList>
                            {messages.map((msg, index) => {
                              const isMe = msg.from === 'me';
                              return (
                                <StyledChatMessageRow key={index} $me={isMe}>
                                  {msg.gift ? (
                                    <StyledChatBubble $me={isMe}>
                                      <strong>{isMe ? 'Yo' : 'Cliente'}:</strong>{' '}
                                      {giftRenderReady && (() => {
                                        const src = getGiftIcon(msg.gift);
                                        return src ? (<StyledGiftIcon src={src} alt="" />) : null;
                                      })()}
                                    </StyledChatBubble>
                                  ) : (
                                    <StyledChatBubble $me={isMe}>
                                      <strong>{isMe ? 'Yo' : 'Cliente'}:</strong> {msg.text}
                                    </StyledChatBubble>
                                  )}
                                </StyledChatMessageRow>
                              );
                            })}
                          </StyledChatList>
                        </StyledChatContainer>
                      </StyledVideoArea>

                      {/* 5%: dock de entrada (fuera del vídeo, mismo ancho que el contenedor) */}
                      <StyledChatDock>
                        <StyledChatInput
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Escribe un mensaje…"
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendChatMessage();
                            }
                          }}
                        />
                        <StyledActionButton type="button" onClick={sendChatMessage}>Enviar</StyledActionButton>
                      </StyledChatDock>
                    </>
                  )}
                </>
              )}

              {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </>
          )}
          {/* FIN RENDERIZADO VIDEOCHAT */}

          {/*RENDERIZADO FUNNYPLACE */}
          {activeTab === 'funnyplace' && <FunnyplacePage />}
          {/*FIN RENDERIZADO VIDEOCHAT */}

         {/*RENDERIZADO FAVORITOS */}
          {activeTab === 'favoritos' && (
            <div
              ref={modelCenterListRef}
              style={{ display:'flex', flexDirection:'column', height:'100%', padding:'8px', width:'100%', maxWidth:'800px', margin:'0 auto' }}
            >
              {!openChatWith ? (
                <div style={{ color:'#adb5bd' }}>
                  Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.
                </div>
              ) : (
                <>
                  {/* Header del panel */}
                  <div style={{ marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <h5 style={{ margin:0, color:'#ff0000' }}>
                      Chat con {centerChatPeerName}
                      {String(selectedFav?.invited) === 'pending' && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: '#ffc107',
                          color: '#212529'
                        }}>
                          Invitación pendiente
                        </span>
                      )}
                    </h5>
                    <div style={{ fontSize:12, color: msgConnected ? '#20c997' : '#adb5bd' }}>
                      {msgConnected ? 'Conectado' : 'Desconectado'}
                    </div>
                  </div>

                  {/* Vista condicional según invitación */}
                  {String(selectedFav?.invited) === 'pending' ? (
                    // ======= MODO INVITACIÓN PENDIENTE =======
                    <div style={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                      borderRadius: 8,
                      padding: 16,
                      background: 'rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ textAlign: 'center', maxWidth: 520 }}>
                        <p style={{ color:'#e9ecef', marginBottom: 16 }}>
                          <strong>{centerChatPeerName}</strong> te ha invitado a ser favoritos mutuos.
                          Acepta para habilitar el chat y que ambos os veáis como favoritos activos.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                          <StyledActionButton
                            onClick={() => acceptInvitation?.(selectedFav)}
                            title="Aceptar invitación"
                          >
                            Aceptar
                          </StyledActionButton>
                          <StyledActionButton
                            onClick={() => rejectInvitation?.(selectedFav)}
                            style={{ backgroundColor: '#dc3545' }}
                            title="Rechazar invitación"
                          >
                            Rechazar
                          </StyledActionButton>
                        </div>
                        <p style={{ color:'#adb5bd', fontSize: 12, marginTop: 12 }}>
                          Esta invitación se mantendrá aquí hasta que decidas.
                        </p>
                      </div>
                    </div>
                  ) : (
                    // ======= CHAT NORMAL (no pendiente) =======
                    <>
                      <div
                        ref={modelCenterListRef}
                        style={{
                          flex:1,
                          minHeight:0,
                          overflowY:'auto',
                          border:'1px solid #333',
                          borderRadius:8,
                          padding:10,
                          background:'rgba(0,0,0,0.2)'
                        }}
                      >
                        {centerMessages.length === 0 && (
                          <div style={{ color:'#adb5bd' }}>No hay mensajes todavía. ¡Escribe el primero!</div>
                        )}
                        {centerMessages.map(m => (
                          <div
                            key={m.id}
                            style={{ textAlign: m.senderId === user?.id ? 'right' : 'left', margin:'6px 0' }}
                          >
                            <span style={{
                               display:'inline-block',
                               padding:'6px 10px',
                               borderRadius:10,
                               background: m.senderId === user?.id ? '#0d6efd' : '#343a40',
                               color:'#fff',
                               maxWidth:'80%'
                            }}>
                              {m.gift ? (
                                 giftRenderReady && (() => {
                                   const src = getGiftIcon(m.gift);
                                   return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null;
                                 })()
                               ) : (
                                 m.body
                               )}
                             </span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display:'flex', gap:8, marginTop:10 }}>
                        <input
                          value={centerInput}
                          onChange={(e)=>setCenterInput(e.target.value)}
                          placeholder="Escribe un mensaje…"
                          onKeyDown={(e)=>{ if (e.key === 'Enter') sendCenterMessage(); }}
                          style={{
                            flex:1,
                            borderRadius:6,
                            border:'1px solid #333',
                            padding:'8px',
                            background:'rgba(255,255,255,0.9)'
                          }}
                        />
                        <StyledActionButton onClick={sendCenterMessage}>Enviar</StyledActionButton>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {/*FIN RENDERIZADO FAVORITOS */}

          {/* RENDERIZADO CALLING */}
          {activeTab === 'calling' && (
            <>
              {callError && <p style={{ color: 'orange', marginTop: 6 }}>[CALL] {callError}</p>}
              <div style={{ color: '#9bd' }}>
                Estado: <strong>{callStatus}</strong>
                {callPeerName ? ` | Con: ${callPeerName} (#${callPeerId||''})` : ''}
              </div>

              <StyledTopActions style={{ gap: 8 }}>
                {!callCameraActive && (
                  <StyledActionButton onClick={handleCallActivateCamera}>
                    Activar Cámara para Llamar
                  </StyledActionButton>
                )}

                {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && (
                  <StyledActionButton
                    onClick={handleCallInvite}
                    disabled={!callPeerId}
                    title={!callPeerId ? 'Abre un chat en Favoritos para elegir destinatario' : `Llamar a ${callPeerName || callPeerId}`}
                  >
                    {callPeerId ? `Llamar a ${callPeerName || callPeerId}` : 'Llamar'}
                  </StyledActionButton>
                )}

                {(callStatus === 'ringing' || callStatus === 'in-call' || callStatus === 'connecting') && (
                  <StyledActionButton onClick={() => handleCallEnd(false)} style={{ backgroundColor: '#dc3545' }}>
                    Colgar
                  </StyledActionButton>
                )}
              </StyledTopActions>

              {/* Área de videollamada (remoto full + local overlay + chat overlay) */}
              <StyledVideoArea>
                <StyledRemoteVideo>
                  <StyledVideoTitle>
                    <StyledTitleAvatar src={callPeerAvatar || '/img/avatar.png'} alt="" />
                    {callPeerName || 'Remoto'}
                  </StyledVideoTitle>
                  <video
                    ref={callRemoteVideoRef}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    autoPlay
                    playsInline
                  />
                </StyledRemoteVideo>

                {/* Local superpuesto */}
                <StyledLocalVideo>
                  <h5 style={{ color: 'white', margin: 0, fontSize: 12 }}>Tu Cámara</h5>
                  <video
                    ref={callLocalVideoRef}
                    style={{ width: '100%', display: 'block', border: '1px solid rgba(255,255,255,0.25)' }}
                    muted
                    autoPlay
                    playsInline
                  />
                </StyledLocalVideo>

                {/* Overlay de mensajes (reutiliza el chat central) */}
                <StyledChatContainer>
                  <StyledChatList>
                    {centerMessages.map((m) => {
                      // Soporte de regalos inline [[GIFT:id:nombre]]
                      let giftData = m.gift;
                      if (
                        !giftData &&
                        typeof m.body === 'string' &&
                        m.body.startsWith('[[GIFT:') &&
                        m.body.endsWith(']]')
                      ) {
                        try {
                          const parts = m.body.slice(2, -2).split(':');
                          giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                        } catch {}
                      }

                      const isMe = Number(m.senderId) === Number(user?.id);
                      return (
                        <StyledChatMessageRow key={m.id} $me={isMe}>
                          {giftData ? (
                            giftRenderReady && (() => {
                              const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null;
                              return src ? (
                                <StyledChatBubble $me={isMe}>
                                  <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} />
                                </StyledChatBubble>
                              ) : null;
                            })()
                          ) : (
                            <StyledChatBubble $me={isMe}>
                              {m.body}
                            </StyledChatBubble>
                          )}
                        </StyledChatMessageRow>
                      );
                    })}
                  </StyledChatList>
                </StyledChatContainer>
              </StyledVideoArea>

              {/* Dock de entrada para el chat central durante la llamada */}
              <StyledChatDock>
                <StyledChatInput
                  type="text"
                  value={centerInput}
                  onChange={(e) => setCenterInput(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendCenterMessage();
                    }
                  }}
                />
                <StyledActionButton type="button" onClick={sendCenterMessage}>
                  Enviar
                </StyledActionButton>
              </StyledChatDock>

              {callStatus === 'incoming' && (
                <div style={{
                  marginTop: 12, padding: 12, border: '1px solid #333', borderRadius: 8,
                  background:'rgba(0,0,0,0.35)'
                }}>
                  <div style={{ color:'#fff', marginBottom: 8 }}>
                    Te está llamando <strong>{callPeerName || `Usuario ${callPeerId}`}</strong>.
                  </div>
                  <div style={{ display:'flex', gap: 10 }}>
                    <StyledActionButton onClick={handleCallAccept}>Aceptar</StyledActionButton>
                    <StyledActionButton onClick={handleCallReject} style={{ backgroundColor:'#dc3545' }}>
                      Rechazar
                    </StyledActionButton>
                  </div>
                </div>
              )}

              {callStatus === 'ringing' && (
                <div style={{ marginTop: 12, color:'#fff' }}>
                  Llamando a {callPeerName || `Usuario ${callPeerId}`}… (sonando)
                </div>
              )}
            </>
          )}

          {/* FIN RENDERIZADO CALLING */}

        </StyledCenter>
        {/* ================FIN ZONA CENTRAL =================*/}

        <StyledRightColumn />

      </StyledMainContent>
      {/* ======FIN MAIN ======== */}

    </StyledContainer>
  );
};

export default DashboardModel;
