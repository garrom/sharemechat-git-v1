// DashboardModel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesModelList from './features/favorites/FavoritesModelList';
import FunnyplacePage from './features/funnyplace/FunnyplacePage';

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
  StyledNavAvatar
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

  useEffect(() => { meIdRef.current = Number(user?.id) || null; }, [user?.id]);
  useEffect(() => { peerIdRef.current = Number(openChatWith) || null; }, [openChatWith]);

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
        // === NUEVO: detectar marcadores de regalo en historial ===
        normalized.forEach(m=>{
          if (typeof m.body==='string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
            const parts=m.body.slice(2,-2).split(':'); // GIFT:id:name
            if (parts.length>=3) m.gift={id:Number(parts[1]),name:parts.slice(2).join(':')};
          }
        });
        centerSeenIdsRef.current = new Set((normalized || []).map(m => m.id));  // nuevo
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
      setMsgConnected(true);
      if (msgPingRef.current) clearInterval(msgPingRef.current);
      msgPingRef.current = setInterval(() => {
        try {
          if (msgSocketRef.current && msgSocketRef.current.readyState === WebSocket.OPEN) {
            msgSocketRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        } catch {}
      }, 30000);
    };

    s.onclose = () => {
      setMsgConnected(false);
      clearMsgTimers();
      msgReconnectRef.current = setTimeout(() => {
          openMessagesSocket();
      }, 1500);
    };

    s.onerror = () => {
      setMsgConnected(false);
      try { s.close(); } catch {}
    };

    s.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);

        if (data.type === 'msg:new' && data.message) {
          const m = normMsg(data.message);

          // === NUEVO: si viene como mensaje normal pero lleva marcador de regalo, enriquecer ===
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
        }

        // === NUEVO: evento explícito de regalo por WS mensajes ===
        if (data.type === 'msg:gift' && data.gift) {
          const me   = Number(meIdRef.current);
          const peer = Number(peerIdRef.current);
          if (!me || !peer) return;
          const item = {
            id: data.messageId || `${Date.now()}`,
            senderId: data.from,
            recipientId: data.to,
            body: `[[GIFT:${data.gift.id}:${data.gift.name}]]`,
            gift: { id: data.gift.id, name: data.gift.name}
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
      // OJO: Igual que en el cliente, el start-match se lanza desde el botón/handler,
      // no automáticamente al abrir el socket. (Se replica patrón del cliente)
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

        // === Igual que el cliente: reset de peer/remote ===
        try { if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; } } catch {}
        try { if (remoteStream) { remoteStream.getTracks().forEach((t) => t.stop()); } } catch {}
        setRemoteStream(null);
        setMessages([]);
        setError('');
        setStatus('');
        setSearching(false); // <=== NUEVO: como en el cliente, deja de "buscar"

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
        // === NUEVO: recepción de regalo en streaming ===
        const mine = Number(data.fromUserId) === Number(user?.id);
        setMessages(prev=>[...prev,{ from: mine ? 'me' : 'peer', text: '', gift: { id: data.gift.id, name: data.gift.name } }]);

      } else if (data.type === 'no-client-available') {
        // === Réplica del cliente: queda "searching" y espera en cola ===
        setError('');
        setStatus('Esperando cliente...');
        setSearching(true);
        // (El cliente no reenvía start-match aquí; se queda en la cola. Replicado.)
      } else if (data.type === 'queue-stats') {
        if (typeof data.position === 'number') {
          setQueuePosition(data.position);
        }
      } else if (data.type === 'peer-disconnected') {
        // === Réplica del cliente: limpiar, poner searching y reenviar start-match ===
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
      setSearching(false); // proteger estado
    };
  };

  // === NUEVO: mismo handler que en el cliente para iniciar/relanzar búsqueda ===
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
    setSearching(true); // espejo del cliente al hacer NEXT
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
    setSearching(false); // === NUEVO: espejo del cliente
  };

  const streamingActivo = !!remoteStream;

  const handleGoFunnyplace = () => {
    if (streamingActivo) {
      const ok = window.confirm('Si entras en Funnyplace se cortará el streaming actual. ¿Continuar?');
      if (!ok) return;
      stopAll();
    }
    setActiveTab('funnyplace');
  };

  const handleGoFavorites = () => {
    if (streamingActivo) {
      alert('No puedes salir del Videochat mientras hay streaming. Pulsa Stop o Next si quieres cambiar.');
      return;
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
        // === NUEVO: detectar regalos en historial también aquí (por si se usa este loader) ===
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


       {/* ========= INICIO COLUMNA IZQUIERDA  ======== */}
        <StyledLeftColumn>
          <div className="d-flex justify-content-around mb-3">
            <button
              title="Videochat"
              onClick={() => setActiveTab('videochat')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faVideo} size="lg" />
            </button>
            <button
              title="Favoritos"
              onClick={handleGoFavorites}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faHeart} size="lg" />
            </button>
            <button
              title="Funnyplace"
              onClick={handleGoFunnyplace}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faFilm} size="lg" />
            </button>
          </div>

          <ul className="list-group">
            {activeTab === 'favoritos' && (
              <li className="list-group-item p-0 border-0">
                <FavoritesModelList
                  onSelect={handleOpenChatFromFavorite} reloadTrigger={favReload}
                />
              </li>
            )}
            {activeTab === 'videochat' && (
              <li className="list-group-item">Selecciona “Buscar cliente” para empezar</li>
            )}
            {activeTab === 'funnyplace' && (
              <li className="list-group-item">Explora Funnyplace en la zona central</li>
            )}
          </ul>

        </StyledLeftColumn>
        {/* ========= FIN COLUMNA IZQUIERDA  ======== */}


        {/* ==============INICIO ZONA CENTRAL ========== */}
        <StyledCenter>
          {activeTab === 'videochat' && (
            <>
              {status && <p style={{ color: '#6c757d', marginTop: '10px' }}>{status}</p>}
              {!cameraActive && (
                <StyledActionButton onClick={startCamera}>Activar Cámara</StyledActionButton>
              )}
              {cameraActive && (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    {/* === NUEVO: botón Buscar Cliente y estado 'buscando', como en el cliente === */}
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
                  </div>

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
                    <StyledRemoteVideo>
                      <h5
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          color: 'white',
                          zIndex: 2,
                        }}
                      >
                        Cliente
                      </h5>
                      <video
                        ref={remoteVideoRef}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', border: '1px solid black' }}
                        autoPlay
                      />
                      <StyledChatContainer>
                        <div
                          style={{
                            maxHeight: '150px',
                            overflowY: 'auto',
                            marginBottom: '10px',
                          }}
                        >
                          {messages.map((msg, index) => (
                            <div
                              key={index}
                              style={{ textAlign: msg.from === 'me' ? 'right' : 'left', color: 'white' }}
                            >
                              {msg.gift ? (
                                <>
                                  {giftRenderReady && (() => {
                                    const src = getGiftIcon(msg.gift);
                                    return src ? <img src={src} alt="" style={{ width:28, height:28, marginLeft:6 }} /> : null;
                                  })()}
                                </>
                              ) : (
                                <>
                                  <strong>{msg.from === 'me' ? 'Yo' : 'Cliente'}:</strong> {msg.text}
                                </>
                              )}

                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex' }}>
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            style={{
                              flex: 1,
                              marginRight: '10px',
                              background: 'rgba(255, 255, 255, 0.9)',
                              border: 'none',
                              borderRadius: '5px',
                              padding: '5px',
                            }}
                          />
                          <StyledActionButton onClick={sendChatMessage}>Enviar</StyledActionButton>
                        </div>
                      </StyledChatContainer>
                    </StyledRemoteVideo>
                  )}
                </>
              )}

              {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </>
          )}
          {activeTab === 'funnyplace' && <FunnyplacePage />}
          {activeTab === 'favoritos' && (
            <div
              ref={modelCenterListRef}
              style={{ display:'flex', flexDirection:'column', height:'100%', padding:'8px' }}
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
                    // ======= MODO INVITACIÓN PENDIENTE: botones persistentes =======
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

        </StyledCenter>
       {/* ================FIN ZONA CENTRAL =================*/}

        <StyledRightColumn />


      </StyledMainContent>
      {/* ======FIN MAIN ======== */}

    </StyledContainer>
  );
};

export default DashboardModel;