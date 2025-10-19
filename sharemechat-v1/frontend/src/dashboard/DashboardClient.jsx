// DashboardClient.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesClientList from './favorites/FavoritesClientList';
import { useModal } from '../components/ModalProvider';
import FunnyplacePage from './funnyplace/FunnyplacePage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
  StyledChatList,
  StyledChatMessageRow,
  StyledChatBubble,
  StyledChatControls,
  StyledChatInput,
  StyledGiftToggle,
  StyledGiftsPanel,
  StyledGiftGrid,
  StyledGiftIcon,
  StyledVideoArea,
  StyledChatDock,
  StyledTitleAvatar,
  StyledTabsBar,
  StyledTabButton,
  StyledTabIcon,
  StyledBrand

}  from '../styles/ClientStyles';

const DashboardClient = () => {

  const { alert } = useModal();
  const [cameraActive, setCameraActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('videochat');
  const [currentModelId, setCurrentModelId] = useState(null);
  const [user, setUser] = useState(null);
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

  // ====== CALLING (1-a-1) ======
  const [callCameraActive, setCallCameraActive] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callPeerId, setCallPeerId] = useState(null);
  const [callPeerName, setCallPeerName] = useState('');
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [callError, setCallError] = useState('');
  const [callRole, setCallRole] = useState(null); // 'caller' | 'callee'
  const [callPeerAvatar, setCallPeerAvatar] = useState('');
  const [ctxUser, setCtxUser] = useState(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });

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
  const centerSeenIdsRef = useRef(new Set());  //nuevo
  const meIdRef = useRef(null);
  const peerIdRef = useRef(null);
  const lastSentRef = useRef({ text: null, at: 0 });

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
    const close = () => setCtxUser(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

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
        console.error("Error cargando usuario:", e);
      }
    };
    if (token) loadUser();
  }, [token]);

  // Cargar foto de perfil del cliente
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch('/api/clients/documents/me', {
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
    if (!token || !currentModelId) return;
    (async () => {
      try {
        const r = await fetch(`/api/users/${currentModelId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json(); // <-- ‘d’ es el user
        const nn = d?.nickname || d?.name || d?.email || 'Modelo';
        setModelNickname(nn);
      } catch {/* noop */}
    })();
  }, [token, currentModelId]);

  useEffect(() => {
    if (!token || !currentModelId) return;

    (async () => {
      try {
        const r = await fetch(`/api/users/avatars?ids=${encodeURIComponent(currentModelId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const map = await r.json(); // { [id]: url }
        const url = map?.[currentModelId] || '';
        setModelAvatar(url);
      } catch {/* noop */}
    })();
  }, [token, currentModelId]);

  // [CALL] Enlaza el chat central al peer de la llamada para poder chatear durante la llamada
  useEffect(() => {
    if (activeTab !== 'calling') return;
    if (!callPeerId) return;

    // No cambiamos pestañas, solo “apuntamos” el chat central al peer activo de la llamada
    setCenterChatPeerId(callPeerId);
    setCenterChatPeerName(callPeerName || `Usuario ${callPeerId}`);
    // IMPORTANT: peerIdRef ya se actualiza cuando cambia centerChatPeerId (tienes un useEffect para eso)
  }, [activeTab, callPeerId, callPeerName]);

  useEffect(() => {
      meIdRef.current = Number(user?.id) || null;
  }, [user?.id]);

  useEffect(() => {
      peerIdRef.current = Number(centerChatPeerId) || null;
  }, [centerChatPeerId]);

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
      const name = centerChatPeerName || `Usuario ${id}`;
      setCallPeerId(id);
      callPeerIdRef.current = id;
      setCallPeerName(name);
      console.log('[CALL][Client] target <- Favorites chat:', id, name);
    } else if (selectedFav?.id) {
      const id = Number(selectedFav.id);
      const name =
        selectedFav?.nickname || selectedFav?.name || selectedFav?.email || `Usuario ${id}`;
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

    // Solo refresca si no tenemos un nombre “bonito”
    if (callPeerName && callPeerName !== `Usuario ${id}`) return;

    (async () => {
      try {
        console.log('[CALL] Resolviendo nombre remoto via /api/users/', id);
        const r = await fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${tk}` } });
        if (!r.ok) return;
        const d = await r.json();
        const nn = d?.nickname || d?.name || d?.email || `Usuario ${id}`;
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
        const r = await fetch(`/api/users/avatars?ids=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        if (!r.ok) return;
        const map = await r.json(); // { [id]: url }
        setCallPeerAvatar(map?.[id] || '');
      } catch {/* noop */}
    })();
  }, [callPeerId]);

  // [CALL][Client] Efecto anti-deriva: si hay llamada activa y el chat apunta a otro peer, corrige.
  useEffect(() => {
    if (callStatus === 'idle') return;
    const callPeer = Number(callPeerId);
    const chatPeer = Number(centerChatPeerId);
    if (Number.isFinite(callPeer) && callPeer > 0 && chatPeer !== callPeer) {
      console.log('[CALL][drift] centerChatPeerId=', chatPeer, 'vs callPeerId=', callPeer, '-> force-sync to callPeerId');
      setCenterChatPeerId(callPeer);
      setCenterChatPeerName(callPeerName || `Usuario ${callPeer}`);
    }
  }, [callStatus, callPeerId, callPeerName, centerChatPeerId]);


  useEffect(() => {
    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) return;

    const loadSaldo = async () => {
      setLoadingSaldo(true);
      setSaldoError('');
      try {
        const res = await fetch('/api/clients/me', {
          headers: { Authorization: `Bearer ${tokenLS}` }
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Error ${res.status}`);
        }
        const data = await res.json();
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
    fetch('/api/gifts',{ headers:{Authorization:`Bearer ${tk}`} })
      .then(r=>r.ok?r.json():[])
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
    const tk = localStorage.getItem('token');
    if (!tk) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host  = window.location.host;
    const url   = `${proto}://${host}/messages?token=${encodeURIComponent(tk)}`;

    if (msgSocketRef.current && msgSocketRef.current.readyState === WebSocket.OPEN) {
      setWsReady(true);
      return;
    }

    closeMsgSocket();

    const s = new WebSocket(url);
    msgSocketRef.current = s;

    s.onopen = () => {
      console.log('[WS][messages] OPEN');
      setWsReady(true);
      if (msgPingRef.current) clearInterval(msgPingRef.current);
      msgPingRef.current = setInterval(() => {
        try {
          if (msgSocketRef.current && msgSocketRef.current.readyState === WebSocket.OPEN) {
            msgSocketRef.current.send(JSON.stringify({ type: 'ping' }));
            // si hay llamada activa, además envio call:ping
            if (callStatus === 'in-call' || callStatus === 'connecting') {
              msgSocketRef.current.send(JSON.stringify({ type: 'call:ping' }));
              console.log('[CALL][ping] sent');
            }
          }
        } catch {}
      }, 30000);
    };

    s.onclose = () => {
      console.log('[WS][messages] CLOSE');
      setWsReady(false);
      clearMsgTimers();
      msgReconnectRef.current = setTimeout(() => {
          openMsgSocket();
      }, 1500);
    };

    s.onerror = (e) => {
      console.log('[WS][messages] ERROR', e);
      setWsReady(false);
      try { s.close(); } catch {}
    };

    s.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // ====== GESTIÓN DE REGALOS/MENSAJES EXISTENTES (sin tocar) ======
        if (data.type === 'msg:gift' && data.gift) {
          const me   = Number(meIdRef.current);
          const peer = Number(peerIdRef.current);
          const from = Number(data.from);
          const to   = Number(data.to);
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
          queueMicrotask(() => { const el = centerListRef.current; if (el) el.scrollTop = el.scrollHeight; });
          return;
        }

        if (data.type === 'msg:new' && data.message) {
          const m = normMsg(data.message);

          if (typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts = m.body.slice(2, -2).split(':');
            if (parts.length >= 3 && parts[0] === 'GIFT') {
              m.gift = { id: Number(parts[1]), name: parts.slice(2).join(':') };
            }
          }

          const me = Number(meIdRef.current);
          const peer = Number(peerIdRef.current);
          if (!me || !peer) return;

          const belongsToThisChat =
            (m.senderId === peer && m.recipientId === me) ||
            (m.senderId === me   && m.recipientId === peer);

          if (belongsToThisChat) {
            if (m.id && centerSeenIdsRef.current.has(m.id)) return;
            if (m.id) centerSeenIdsRef.current.add(m.id);
            setCenterMessages(prev => [...prev, m]);
            queueMicrotask(() => { const el = centerListRef.current; if (el) el.scrollTop = el.scrollHeight; });
          }
          return;
        }

        // ====== CALLING: EVENTOS call:* ======
        if (data.type === 'call:incoming') {
          const id = Number(data.from);
          const name = String(data.displayName || `Usuario ${id}`);
          console.log('[CALL][incoming][Client] from=', id, 'name=', name);

          // Lock duro del target
          callTargetLockedRef.current = true;
          console.log('[CALL][lock] incoming -> lock on', id, '| prev selectedFav=', selectedFav?.id, 'centerChatPeerId=', centerChatPeerId);

          // Forzar pestaña y sincronizar TODO a A
          setActiveTab('calling');
          setCallPeerId(id);
          callPeerIdRef.current = id;
          setCallPeerName(name);

          // Sincroniza chat central con el peer de la llamada
          setCenterChatPeerId(id);
          setCenterChatPeerName(name);

          // Limpia selección que pueda confundir UI
          setSelectedFav(null);

          setCallStatus('incoming');
          setCallError('');
          return;
        }

        if (data.type === 'call:ringing') {
          console.log('[CALL][ringing] to=', callPeerId);
          setCallStatus('ringing');
          setCallError('');
          // timeout de 45s si nadie responde
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          callRingTimeoutRef.current = setTimeout(() => {
            console.log('[CALL][ringing] timeout -> cancel local');
            handleCallEnd(true); // fuerza limpieza y envia cancel si procede
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

          // Reforzar sincronización (por si hubiera drift)
          const peer = Number(callPeerIdRef.current);
          if (Number.isFinite(peer) && peer > 0) {
            console.log('[CALL][lock] accepted -> keep lock; peer=', peer);
            setCenterChatPeerId(peer);
            setCenterChatPeerName(callPeerName || `Usuario ${peer}`);
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
          setCallError('La llamada fue rechazada.');
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
          cleanupCall('ended');
          return;
        }

        if (data.type === 'call:no-balance') {
          console.log('[CALL][no-balance]');
          setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
          setCallError('Saldo insuficiente para iniciar la llamada.');
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          return;
        }

        if (data.type === 'call:busy') {
          console.log('[CALL][busy]', data);
          setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
          setCallError('El usuario está ocupado.');
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
          return;
        }

        if (data.type === 'call:offline') {
          console.log('[CALL][offline]');
          setCallStatus(callCameraActive ? 'camera-ready' : 'idle');
          setCallError('El usuario no está disponible.');
          if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const handleStartMatch = () => {
    if (!cameraActive || !localStream.current) {
      setError('Primero activa la cámara.');
      return;
    }
    setSearching(true);
    setError('');

    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      setSearching(false);
      return;
    }

    const wsUrl = `wss://test.sharemechat.com/match?token=${encodeURIComponent(tokenLS)}`;
    console.log('WS(Client) ->', wsUrl);

    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      socketRef.current.send(JSON.stringify({ type: 'set-role', role: 'client' }));
      socketRef.current.send(JSON.stringify({ type: 'start-match' }));
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'match') {
        try {
          if (data.peerRole === 'model' && Number.isFinite(Number(data.peerUserId))) {
            setCurrentModelId(Number(data.peerUserId));
          } else {
            setCurrentModelId(null);
          }
        } catch { setCurrentModelId(null); }

        try { if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } } catch {}
        try { if (remoteStream) { remoteStream.getTracks().forEach((t) => t.stop()); } } catch {}
        setRemoteStream(null);
        setMessages([]);

        const peer = new Peer({
          initiator: true,
          trickle: true,
          stream: localStream.current,
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

        peer.on('stream', (stream) => setRemoteStream(stream));
        peer.on('error', (err) => {
          console.error('Peer error:', err);
          setError('Error en la conexión WebRTC: ' + err.message);
          setSearching(false);
        });

        peerRef.current = peer;
        setSearching(false);
        return;
      }

      if (data.type === 'signal' && peerRef.current) {
        peerRef.current.signal(data.signal);
        return;
      }

      if (data.type === 'chat') {
        if (!isEcho(data.message)) {
          setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
        }
        return;
      }

      if (data.type === 'gift') {
        const mine = Number(data.fromUserId) === Number(user?.id);
        setMessages(p=>[...p,{ from: mine ? 'me' : 'peer', text: '', gift: { id: data.gift.id, name: data.gift.name } }]);

        // newBalance viene del backend en gifts de streaming (MatchingHandler)
        if (mine && data.newBalance != null) {
          const nb = Number.parseFloat(String(data.newBalance));
          if (Number.isFinite(nb)) setSaldo(nb);
        }
        return;
      }


      if(data.type==='gift:error'){
          setError(data.message||'No se pudo enviar el regalo');
          return;
      }

      if (data.type === 'no-model-available') {
        setError('');
        setSearching(true);
        return;
      }

      if (data.type === 'no-balance') {
        setError('No tienes saldo suficiente para iniciar una sesión.');
        setSearching(false);
        return;
      }

      if (data.type === 'peer-disconnected') {
        setCurrentModelId(null);
        try { if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } } catch {}
        try { if (remoteStream) { remoteStream.getTracks().forEach((t) => t.stop()); } } catch {}
        setRemoteStream(null);
        setMessages([]);
        setStatus('Buscando nueva modelo...');
        setSearching(true);

        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'start-match' }));
          socketRef.current.send(JSON.stringify({ type: 'stats' }));
        }
        return;
      }
    };

    socketRef.current.onerror = (e) => {
      console.error('WebSocket error (client):', e);
      setError('Error WebSocket');
      setSearching(false);
    };

    socketRef.current.onclose = (e) => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      setSearching(false);
    };
  };

  const handleNext = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'next' }));
      } catch (e) {
        console.error('Error enviando NEXT:', e);
        setError('Error: no se pudo solicitar NEXT.');
        return;
      }
    } else {
      setError('Error: No hay conexión con el servidor.');
      return;
    }

    try { if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } } catch {}
    try { if (remoteStream) { remoteStream.getTracks().forEach((t) => t.stop()); } } catch {}

    setCurrentModelId(null);
    setRemoteStream(null);
    setMessages([]);
    setStatus('Buscando nueva modelo...');
    setSearching(true);

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

  const handleProfile = () => {
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
      return;
    }

    let input = window.prompt('Cantidad a añadir (€):', '10');
    if (input === null) return;

    input = String(input).replace(',', '.').trim();
    const amount = Number(input);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Introduce un importe válido mayor que 0.');
      return;
    }

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
          description: 'Recarga de saldo',
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      }

      alert('Saldo añadido correctamente.');

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
      alert(e.message || 'Error al añadir saldo.');
      setSaldoError(e.message || 'Error al cargar saldo');
    } finally {
      setLoadingSaldo(false);
    }
  };

  const streamingActivo = !!remoteStream;
  const showCallMedia = callStatus === 'in-call';

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


  const handleAddFavorite = async () => {
    if (!currentModelId) {
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
      const res = await fetch(`/api/favorites/models/${currentModelId}`, {
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
            .find(x => Number(x.id) === Number(currentModelId));

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


  const openChatWith = async (peerId, displayName) => {
    if (streamingActivo) {
      alert('No puedes abrir el chat central mientras hay streaming. Pulsa Stop si quieres cambiar.');
      return;
    }
    setActiveTab('favoritos');
    setCenterChatPeerId(peerId);
    setCenterChatPeerName(displayName || `Usuario ${peerId}`);
    setCenterMessages([]);
    centerSeenIdsRef.current = new Set();  // nuevo
    setCenterLoading(true);
    openMsgSocket();

    try {
      const tk = localStorage.getItem('token');
      const res = await fetch(`/api/messages/with/${peerId}`, {
        headers: { Authorization: { toString(){ return `Bearer ${tk}`; } }['toString']() }
      });
      const res2 = await fetch(`/api/messages/with/${peerId}`, { headers: { Authorization: `Bearer ${tk}` }});
      const okRes = res.ok ? res : res2;

      if (okRes.ok) {
        const data = await okRes.json();
        const normalized = (data || []).map(raw => ({
          id: raw.id,
          senderId: Number(raw.senderId ?? raw.sender_id),
          recipientId: Number(raw.recipientId ?? raw.recipient_id),
          body: raw.body,
          createdAt: raw.createdAt ?? raw.created_at,
          readAt: raw.readAt ?? raw.read_at ?? null,
        }));
        centerSeenIdsRef.current = new Set((normalized || []).map(m => m.id)); // nuevo
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
    } finally {
      setCenterLoading(false);
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

  const sendCenterMessage = () => {
    if (!centerChatPeerId || !centerInput.trim()) return;
    const s = msgSocketRef.current;
    if (s && s.readyState === WebSocket.OPEN) {
      const payload = { type: 'msg:send', to: Number(centerChatPeerId), body: centerInput.trim() };
      s.send(JSON.stringify(payload));
      setCenterInput('');
    } else {
      alert('Chat de mensajes desconectado. Reabre el panel.');
    }
  };

  const handleOpenChatFromFavorites = (favUser) => {
    const name =
      favUser?.nickname || favUser?.name || favUser?.email || `Usuario ${favUser?.id || ''}`;

    const peer = Number(favUser?.id ?? favUser?.userId);
    if (!Number.isFinite(peer) || peer <= 0) {
      alert('No se pudo determinar el destinatario correcto.');
      return;
    }
    if (Number(user?.id) === peer) {
      alert('No puedes chatear contigo mismo.');
      return;
    }

    setSelectedFav(favUser);
    if (String(favUser?.invited) === 'pending') {
      setActiveTab('favoritos');
      setCenterChatPeerId(peer);
      setCenterChatPeerName(name);
      setCenterMessages([]);
      return;
    }
    openChatWith(peer, name);
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
      const res = await fetch(`/api/favorites/reject/${selectedFav.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` }
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
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

  const sendGiftMsg=(giftId)=>{
      if(!centerChatPeerId||!msgSocketRef.current||msgSocketRef.current.readyState!==WebSocket.OPEN) return;
      msgSocketRef.current.send(JSON.stringify({type:'msg:gift',to:Number(centerChatPeerId),giftId}));
      setShowCenterGifts(false);
  };

  //Activar cámara (Calling)
  const handleCallActivateCamera = async () => {
    console.log('[CALL][cam:on] requesting user media');
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

  //Enviar invitación
  // Enviar invitación (FIX: no usar 'openChatWith' como ID)
  const handleCallInvite = () => {
    if (!callCameraActive || !callLocalStreamRef.current) {
      setCallError('Primero activa la cámara para llamar.');
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
        `Usuario ${toId}`;
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

      msgSocketRef.current.send(JSON.stringify({ type: 'call:invite', to: toId }));

      setCallRole('caller');
      callRoleRef.current = 'caller';
      setCallStatus('connecting');
      setCallError('');

      if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
      callRingTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'connecting') {
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
        // Normalizamos tipo de señal
        const type =
          signal?.type ||
          (signal?.candidate ? 'candidate' : 'unknown');

        // 1) Ignorar candidates vacíos o fin de candidates
        if (type === 'candidate') {
          const cand = signal?.candidate;
          if (!cand || cand.candidate === '' || cand.candidate == null) return;
        }

        // 2) Destinatario SIEMPRE el remoto (ref)
        const toId = Number(callPeerIdRef.current);

        // 3) Comprobaciones previas
        const wsOpen = msgSocketRef.current?.readyState === WebSocket.OPEN;
        const validTo = Number.isFinite(toId) && toId > 0;

        console.log('[CALL][signal:out][Client]', { type, toId, wsOpen, validTo });

        if (wsOpen && validTo) {
          msgSocketRef.current.send(JSON.stringify({
            type: 'call:signal',
            to: toId,
            signal
          }));
        } else {
          console.warn('[CALL][signal:out][Client] omitido -> socket no abierto o toId inválido', { toId, wsOpen, validTo });
        }
      } catch (e) {
        console.warn('[CALL][signal:out][Client] error', e);
      }
    });


    p.on('stream', (stream) => {
      console.log('[CALL][remote:stream][Client] tracks=', stream.getTracks().length);
      setCallRemoteStream(stream);
    });

    p.on('error', (err) => {
      console.error('[CALL][peer:error][Client]', err);
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
    if (Number(user?.id) === peer) {
      alert('No puedes llamarte a ti mismo.');
      return;
    }

    const name =
      favUser?.nickname || favUser?.name || favUser?.email || `Usuario ${peer}`;

    console.log('[CALL] Target seleccionado desde lista (Calling):', peer, name);

    setActiveTab('calling');     // asegurar que estamos en Calling
    setSelectedFav(favUser);     // opcional: conservar selección
    setCenterChatPeerId(null);   // no abrimos chat central
    setCenterChatPeerName('');

    setCallPeerId(peer);
    callPeerIdRef.current = peer;
    setCallPeerName(name);
    // avatar se resolverá por el useEffect de callPeerId; si lo tienes en favUser, setéalo:
    if (favUser?.avatarUrl) setCallPeerAvatar(favUser.avatarUrl);
  };

  // Id “activo” para resaltar en la lista de contactos (favoritos/calling)
  const selectedContactId = (() => {
    // En Calling, prioriza el peer de la llamada si lo hay
    if (activeTab === 'calling') {
      return Number(callPeerId ?? selectedFav?.id ?? centerChatPeerId) || null;
    }
    // En Favoritos, prioriza el chat abierto; si no, el seleccionado
    if (activeTab === 'favoritos') {
      return Number(centerChatPeerId ?? selectedFav?.id ?? callPeerId) || null;
    }
    // Otras pestañas: intenta mantener algo coherente
    return Number(centerChatPeerId ?? selectedFav?.id ?? callPeerId) || null;
  })();

  //---FLAG DE RENDERIZADO favoritos---//
  const invited   = String(selectedFav?.invited || '').toLowerCase();
  const favStatus = String(selectedFav?.status  || '').toLowerCase();
  const allowChat      = favStatus === 'active'   && invited === 'accepted';
  const isPendingPanel = favStatus === 'inactive' && invited === 'pending';
  const isSentPanel    = favStatus === 'inactive' && invited === 'sent';


  const displayName = user?.nickname || user?.name || user?.email || "Cliente";

  return (

    <StyledContainer>

      {/* ========= INICIO NAVBAR  ======== */}
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" />
        <StyledNavGroup>
          <span className="me-3">Hola, {displayName}</span>
          <span className="me-3">
            {loadingSaldo ? 'Saldo: …' : saldoError ? 'Saldo: n/d' : `Saldo: ${fmtEUR(saldo)}`}
          </span>

          <StyledNavButton type="button" onClick={handleAddBalance}>
            + Saldo
          </StyledNavButton>

          <StyledNavButton type="button" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>

          <StyledNavButton type="button" onClick={handleProfile}>
            <FontAwesomeIcon icon={faUser} />
            <StyledIconWrapper>Perfil</StyledIconWrapper>
          </StyledNavButton>

          {/* Avatar (click = ir a Perfil) */}
          <StyledNavAvatar
            src={profilePic || '/img/avatarChico.png'}
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

          {/* Lista de usuarios a la izquierda:
              - En Favoritos: abre chat central (handler original)
              - En Calling: fija destinatario de la llamada (NO abre chat) */}

          {activeTab === 'favoritos' && (
            <FavoritesClientList
              onSelect={handleOpenChatFromFavorites}
              reloadTrigger={favReload}
              selectedId={selectedContactId}
              onContextMenu={(user, pos) => { setCtxUser(user); setCtxPos(pos); }}
            />
          )}

          {activeTab === 'calling' && (
            callStatus === 'idle' ? (
              <FavoritesClientList
                onSelect={handleSelectCallTargetFromFavorites}
                reloadTrigger={favReload}
                selectedId={selectedContactId}
                onContextMenu={(user, pos) => { setCtxUser(user); setCtxPos(pos); }}
              />
            ) : (
              <div style={{ padding: 8, color: '#adb5bd' }}>
                En llamada: la lista se bloquea hasta colgar.
              </div>
            )
          )}


        </StyledLeftColumn>
        {/* ========= FIN COLUMNA IZQUIERDA PESTAÑAS ======== */}

        {/* ================INICIO ZONA CENTRAL =================*/}
        <StyledCenter>

          {/*RENDERIZADO VIDEOCHAT */}
          {activeTab === 'videochat' && (
            <>
              {!cameraActive && (
                <StyledActionButton onClick={handleActivateCamera}>Activar Cámara </StyledActionButton>
              )}

              {cameraActive && (
                <>
                  <StyledTopActions>
                    {!searching && (
                      <StyledActionButton onClick={handleStartMatch}>Buscar Modelo </StyledActionButton>
                    )}
                    {searching && <p>Buscando modelo...</p>}
                    <StyledActionButton onClick={stopAll} style={{ backgroundColor: '#dc3545' }}> Stop </StyledActionButton>
                    {remoteStream && !searching && (
                      <>
                        <StyledActionButton onClick={handleNext}>Next </StyledActionButton>
                        <StyledActionButton onClick={handleAddFavorite}> + Favorito </StyledActionButton>
                      </>
                    )}
                  </StyledTopActions>

                  <StyledLocalVideo>
                    <h5 style={{ color: 'white' }}>Tu Cámara</h5>
                    <video
                      ref={localVideoRef}
                      style={{ width: '100%' }}
                      muted
                      autoPlay
                    />
                  </StyledLocalVideo>

                  {remoteStream && (
                    <>
                      {/* 90%: área de vídeo + overlay de mensajes */}
                      <StyledVideoArea>
                        <StyledRemoteVideo ref={remoteVideoWrapRef}>
                          <StyledVideoTitle>
                            <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                            {modelNickname || 'Modelo'}
                            {/* Botón expandir */}
                            <button
                              type="button"
                              onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                              title="Pantalla completa"
                              style={{
                                marginLeft: 8,
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(255,255,255,.6)',
                                background: 'rgba(0,0,0,.25)',
                                color: '#fff',
                                cursor: 'pointer'
                              }}
                            >⤢</button>
                          </StyledVideoTitle>
                          <video
                            ref={remoteVideoRef}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            autoPlay
                            onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                          />
                        </StyledRemoteVideo>

                        {/* Overlay de mensajes sobre el vídeo */}
                        <StyledChatContainer data-wide="true">
                          <StyledChatList ref={vcListRef}>
                            {messages.map((msg, index) => {
                              const isMe = msg.from === 'me';
                              const variant = isMe ? 'me' : 'peer';
                              const prefix = isMe ? 'me' : (modelNickname || 'Modelo');

                              return (
                                <StyledChatMessageRow key={index}>
                                  {msg.gift ? (
                                    <StyledChatBubble $variant={variant}>
                                      <strong>{prefix} :</strong>{' '}
                                      {giftRenderReady && (() => {
                                        const src = getGiftIcon(msg.gift);
                                        return src ? (<StyledGiftIcon src={src} alt="" />) : null;
                                      })()}
                                    </StyledChatBubble>
                                  ) : (
                                    <StyledChatBubble $variant={variant}>
                                      <strong>{prefix} :</strong> {msg.text}
                                    </StyledChatBubble>
                                  )}
                                </StyledChatMessageRow>
                              );
                            })}

                          </StyledChatList>
                        </StyledChatContainer>
                      </StyledVideoArea>

                      {/* 10%: dock de entrada (fuera del vídeo, mismo ancho que el contenedor) */}
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

                        <StyledGiftToggle
                          type="button"
                          onClick={() => setShowGifts(s => !s)}
                          title="Enviar regalo"
                        >
                          🎁
                        </StyledGiftToggle>

                        {showGifts && (
                          <StyledGiftsPanel>
                            <StyledGiftGrid>
                              {gifts.map(g => (
                                <button key={g.id} onClick={() => sendGiftMatch(g.id)}>
                                  <img src={g.icon} alt={g.name} />
                                  <div>{g.name}</div>
                                  <div>{fmtEUR(g.cost)}</div>
                                </button>
                              ))}
                            </StyledGiftGrid>
                          </StyledGiftsPanel>
                        )}
                      </StyledChatDock>
                    </>
                  )}
                </>
              )}

              {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </>
          )}
          {/*FIN RENDERIZADO VIDEOCHAT */}


          {/*RENDERIZADO FUNNYPLACE */}
          {activeTab === 'funnyplace' && ( <FunnyplacePage /> )}
          {/*FIN RENDERIZADO FUNNYPLACE */}

          {/*RENDERIZADO FAVORITOS */}
          {activeTab === 'favoritos' && (
            <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'8px', position:'relative', width:'100%', maxWidth:'800px', margin:'0 auto' }}>
              {!centerChatPeerId ? (
                <div style={{ color:'#adb5bd' }}>
                  Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <h5 style={{ margin:0, color: allowChat ? '#20c997' : (isPendingPanel || isSentPanel ? '#ffc107' : '#ff0000') }}>
                      {isPendingPanel
                        ? `Invitación de ${centerChatPeerName}`
                        : isSentPanel
                        ? `Invitación enviada a ${centerChatPeerName}`
                        : `Chat con ${centerChatPeerName}`}
                    </h5>
                    <div style={{ fontSize:12, color: wsReady ? '#20c997' : '#adb5bd' }}>
                      {wsReady ? 'Conectado' : 'Desconectado'}
                    </div>
                  </div>

                  {/* Panel PENDIENTE (receptor) */}
                  {isPendingPanel && (
                    <div style={{
                      flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center',
                      border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ textAlign:'center' }}>
                        <p style={{ color:'#fff', marginBottom:16 }}>
                          {centerChatPeerName} te ha invitado a favoritos. Acepta para habilitar el chat.
                        </p>
                        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                          <StyledActionButton onClick={acceptInvitation}>Aceptar</StyledActionButton>
                          <StyledActionButton onClick={rejectInvitation} style={{ backgroundColor:'#dc3545' }}>
                            Rechazar
                          </StyledActionButton>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel ENVIADA (emisor) */}
                  {isSentPanel && (
                    <div style={{
                      flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center',
                      border:'1px solid #333', borderRadius:8, padding:16, background:'rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ textAlign:'center', color:'#e9ecef' }}>
                        <p style={{ marginBottom:8 }}>
                          Invitación enviada. Esperando respuesta de <strong>{centerChatPeerName}</strong>.
                        </p>
                        <p style={{ fontSize:12, color:'#adb5bd' }}>
                          El chat se habilitará cuando acepte tu invitación.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* CHAT (no pendiente ni enviada) */}
                  {!isPendingPanel && !isSentPanel && (
                    <>
                      <div
                        ref={centerListRef}
                        style={{
                          flex:1,
                          minHeight: 0,
                          overflowY:'auto',
                          border:'1px solid #333',
                          borderRadius:8,
                          padding:10,
                          background:'rgba(0,0,0,0.2)'
                        }}
                      >
                        {centerLoading && <div style={{ color:'#adb5bd' }}>Cargando historial…</div>}
                        {!centerLoading && centerMessages.length === 0 && (
                          <div style={{ color:'#adb5bd' }}>
                            {allowChat ? 'No hay mensajes todavía. ¡Escribe el primero!' : 'Este chat no está activo.'}
                          </div>
                        )}
                        {centerMessages.map(m => {
                          let giftData = m.gift;
                          if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                            try {
                              const parts = m.body.slice(2, -2).split(':');
                              giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                            } catch {}
                          }

                          const isMe = Number(m.senderId) === Number(user?.id);
                          const variant = isMe ? 'me' : 'peer';
                          const prefix = isMe ? 'me' : (centerChatPeerName || `Usuario ${centerChatPeerId || ''}`);

                          return (
                            <StyledChatMessageRow key={m.id}>
                              <StyledChatBubble $variant={variant}>
                                {giftData ? (
                                  <>
                                    <strong>{prefix} :</strong>{' '}
                                    {giftRenderReady && (() => {
                                      const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null;
                                      return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null;
                                    })()}
                                  </>
                                ) : (
                                  <>
                                    <strong>{prefix} :</strong> {m.body}
                                  </>
                                )}
                              </StyledChatBubble>
                            </StyledChatMessageRow>
                          );
                        })}

                      </div>

                      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center', position:'relative' }}>
                        <input
                          value={centerInput}
                          onChange={(e)=>setCenterInput(e.target.value)}
                          placeholder={allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'}
                          onKeyDown={(e)=>{ if (e.key === 'Enter' && allowChat) sendCenterMessage(); }}
                          disabled={!allowChat}
                          style={{ flex:1, borderRadius:6, border:'1px solid #333', padding:'8px', background:'rgba(255,255,255,0.9)' }}
                        />
                        <StyledActionButton onClick={sendCenterMessage} disabled={!allowChat}>Enviar</StyledActionButton>

                        <StyledActionButton onClick={()=>setShowCenterGifts(s=>!s)} title="Enviar regalo" disabled={!allowChat}>🎁</StyledActionButton>
                        {showCenterGifts && allowChat && (
                          <div style={{
                            position:'absolute', bottom:44, right:0, background:'rgba(0,0,0,0.85)',
                            padding:10, borderRadius:8, zIndex:10, border:'1px solid #333'
                          }}>
                            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 80px)', gap:8, maxHeight:240, overflowY:'auto'}}>
                              {gifts.map(g=>(
                                <button key={g.id}
                                  onClick={()=>sendGiftMsg(g.id)}
                                  style={{ background:'transparent', border:'1px solid #555', borderRadius:8, padding:6, cursor:'pointer', color:'#fff' }}>
                                  <img src={g.icon} alt={g.name} style={{ width:32, height:32, display:'block', margin:'0 auto' }}/>
                                  <div style={{ fontSize:12 }}>{g.name}</div>
                                  <div style={{ fontSize:12, opacity:.8 }}>{fmtEUR(g.cost)}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {/*FIN RENDERIZADO FAVORITOS */}

            {/*RENDERIZADO CALLING */}
            {activeTab === 'calling' && (
              <>
                {/* Estado y error */}
                {callError && <p style={{ color: 'orange', marginTop: 6 }}>[CALL] {callError}</p>}
                <div style={{ color: '#9bd' }}>
                  Estado: <strong>{callStatus}</strong>
                  {callPeerName ? ` | Con: ${callPeerName} (#${callPeerId||''})` : ''}
                </div>
                 {/* Controles superiores */}
                <StyledTopActions style={{ gap: 8 }}>
                  {!callCameraActive && (
                    <StyledActionButton onClick={handleCallActivateCamera}>
                      Activar Cámara para Llamar
                    </StyledActionButton>
                  )}

                  {callCameraActive && callStatus !== 'in-call' && callStatus !== 'ringing' && (
                    <>
                      <StyledActionButton
                        onClick={handleCallInvite}
                        disabled={!callPeerId}
                        title={!callPeerId ? 'Abre un chat en Favoritos para elegir destinatario' : `Llamar a ${callPeerName || callPeerId}`}
                      >
                        {callPeerId ? `Llamar a ${callPeerName || callPeerId}` : 'Llamar'}
                      </StyledActionButton>
                    </>
                  )}

                  {(callStatus === 'ringing' || callStatus === 'in-call' || callStatus === 'connecting') && (
                    <StyledActionButton onClick={() => handleCallEnd(false)} style={{ backgroundColor: '#dc3545' }}>
                      Colgar
                    </StyledActionButton>
                  )}
                </StyledTopActions>
                {/* Área de videollamada (remoto full + local overlay, como en videochat) */}
                <StyledVideoArea style={{ display: showCallMedia ? 'block' : 'none' }}>
                  <StyledRemoteVideo ref={callRemoteWrapRef}>
                    <StyledVideoTitle>
                      <StyledTitleAvatar src={callPeerAvatar || '/img/avatarChica.png'} alt="" />
                      {callPeerName || 'Remoto'}
                      {/* Botón expandir */}
                      <button
                        type="button"
                        onClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                        title="Pantalla completa"
                        style={{
                          marginLeft: 8,
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,.6)',
                          background: 'rgba(0,0,0,.25)',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >⤢</button>
                    </StyledVideoTitle>
                    <video
                      ref={callRemoteVideoRef}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      autoPlay
                      playsInline
                      onDoubleClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                    />
                  </StyledRemoteVideo>
                  {/* Video Local superpuesto */}
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

                  {/* Overlay de mensajes (reuso de Favoritos/videochat) */}
                  <StyledChatContainer data-wide="true">
                    <StyledChatList ref={callListRef}>
                      {centerMessages.map((m) => {
                        let giftData = m.gift;
                        if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                          try {
                            const parts = m.body.slice(2, -2).split(':');
                            giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                          } catch {}
                        }

                        const isMe = Number(m.senderId) === Number(user?.id);
                        const variant = isMe ? 'me' : 'peer';
                        const prefix = isMe ? 'me' : (callPeerName || `Usuario ${callPeerId || ''}`);

                        return (
                          <StyledChatMessageRow key={m.id}>
                            {giftData ? (
                              giftRenderReady && (() => {
                                const src = gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon || null;
                                return src ? (
                                  <StyledChatBubble $variant={variant}>
                                    <strong>{prefix} :</strong>{' '}
                                    <img src={src} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} />
                                  </StyledChatBubble>
                                ) : null;
                              })()
                            ) : (
                              <StyledChatBubble $variant={variant}>
                                <strong>{prefix} :</strong> {m.body}
                              </StyledChatBubble>
                            )}
                          </StyledChatMessageRow>
                        );
                      })}


                    </StyledChatList>
                  </StyledChatContainer>
                </StyledVideoArea>

                {/* Dock de entrada (mismo que videochat, usando el chat central con el peer de la llamada) */}
                <StyledChatDock style={{ display: showCallMedia ? 'flex' : 'none' }}>
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

                  {/* (Opcional) regalos en llamada, igual que en favoritos */}
                  <StyledGiftToggle
                    type="button"
                    onClick={() => setShowCenterGifts(s => !s)}
                    title="Enviar regalo"
                  >
                    🎁
                  </StyledGiftToggle>

                  {showCenterGifts && (
                    <StyledGiftsPanel>
                      <StyledGiftGrid>
                        {gifts.map(g => (
                          <button key={g.id} onClick={() => sendGiftMsg(g.id)}>
                            <img src={g.icon} alt={g.name} />
                            <div>{g.name}</div>
                            <div>{fmtEUR(g.cost)}</div>
                          </button>
                        ))}
                      </StyledGiftGrid>
                    </StyledGiftsPanel>
                  )}
                </StyledChatDock>


                {/* Incoming: aceptar / rechazar */}
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
                {/* Ringing: indicador */}
                {callStatus === 'ringing' && (
                  <div style={{ marginTop: 12, color:'#fff' }}>
                    Llamando a {callPeerName || `Usuario ${callPeerId}`}… (sonando)
                  </div>
                )}
              </>
            )}

            {/*FIN RENDERIZADO CALLING */}

        </StyledCenter>
        {/* ================FIN ZONA CENTRAL =================*/}

        <StyledRightColumn />

      </StyledMainContent>
      {/* ======FIN MAIN ======== */}

      {/*INICIO CLICK DERECHO */}
       {ctxUser && (
         <div
           style={{
             position: 'fixed',
             left: ctxPos.x,
             top: ctxPos.y,
             zIndex: 9999,
             background: '#fff',
             border: '1px solid #dee2e6',
             borderRadius: 8,
             boxShadow: '0 8px 24px rgba(0,0,0,.12)'
           }}
           onClick={(e) => e.stopPropagation()}
         >
           <button
             type="button"
             style={{
               display: 'block',
               padding: '10px 14px',
               background: 'transparent',
               border: 'none',
               cursor: 'pointer'
             }}
             onClick={async () => {
               try {
                 const tk = localStorage.getItem('token');
                 if (!tk) return;
                 // Cliente elimina a una MODELO de sus favoritos:
                 await fetch(`/api/favorites/models/${ctxUser.id}`, {
                   method: 'DELETE',
                   headers: { Authorization: `Bearer ${tk}` }
                 });
                 setCtxUser(null);
                 setFavReload(x => x + 1);
                 // Opcional: si el chat abierto es justo este contacto, límpialo:
                 if (Number(centerChatPeerId) === Number(ctxUser.id)) {
                   setCenterChatPeerId(null);
                   setCenterChatPeerName('');
                   setCenterMessages([]);
                 }
               } catch (e) {
                 alert(e.message || 'No se pudo eliminar de favoritos');
               }
             }}
           >
             Eliminar de favoritos
           </button>
         </div>
       )}
      {/*FIN CLICK DERECHO */}

    </StyledContainer>
  );
};
export default DashboardClient;