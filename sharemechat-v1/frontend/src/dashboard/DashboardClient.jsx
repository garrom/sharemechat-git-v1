// DashboardClient.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesClientList from './features/favorites/FavoritesClientList';
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
  StyledNavAvatar,
  StyledIconBtn,
  StyledTopActions,
  StyledVideoTitle

}  from '../styles/ClientStyles';

const DashboardClient = () => {
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

  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const token = localStorage.getItem('token');

  const lastSentRef = useRef({ text: null, at: 0 });
  const isEcho = (incoming) => {
    const now = Date.now();
    return (
      incoming === lastSentRef.current.text &&
      now - lastSentRef.current.at < 1500
    );
  };

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

  useEffect(() => {
    const el = centerListRef.current;
    if (!el) return;
    queueMicrotask(() => { el.scrollTop = el.scrollHeight; });
  }, [centerMessages, centerLoading, centerChatPeerId]);

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
      setWsReady(true);
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
      setWsReady(false);
      clearMsgTimers();
      msgReconnectRef.current = setTimeout(() => {
          openMsgSocket();
      }, 1500);
    };

    s.onerror = () => {
      setWsReady(false);
      try { s.close(); } catch {}
    };

    s.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);

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
      } catch (e) {
        // silenciar parse errors
      }
    };

  };

  useEffect(() => {
      openMsgSocket();
      return () => closeMsgSocket();
  }, []);

  const handleActivateCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
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
        setSearching(true);
        setError('Buscando nuevo modelo...');
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
    setSearching(true);
    setError('Buscando nuevo modelo...');
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
    setCenterChatPeerId(null);
    setCenterChatPeerName('');
    setCenterMessages([]);
    setCenterInput('');
    setShowGifts(false);
    setShowCenterGifts(false);
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

  const handleAddFavorite = async () => {
    if (!currentModelId) {
      alert('No se pudo identificar a la modelo actual).');
      return;
    }
    const tk = localStorage.getItem('token');
    if (!tk) { setError('Sesión expirada. Inicia sesión de nuevo.'); return; }
    try {
      const res = await fetch(`/api/favorites/models/${currentModelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.status === 204) {
        alert('Modelo añadida a favoritos.');
      } else if (res.status === 409) {
        alert('Esta modelo ya está en tus favoritos.');
      } else if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Error ${res.status}`);
      } else {
        alert('Modelo añadida a favoritos.');
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'No se pudo añadir a favoritos.');
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

  const displayName = user?.nickname || user?.name || user?.email || "Cliente";

  return (
    <StyledContainer>

      {/* ========= INICIO NAVBAR  ======== */}
       <StyledNavbar>
         <span>Mi Logo</span>
         <StyledNavGroup>
           <span className="me-3">Hola, {displayName}</span>
           <span className="me-3">
             {loadingSaldo ? 'Saldo: …' : saldoError ? 'Saldo: n/d' : `Saldo: ${fmtEUR(saldo)}`}
           </span>

           <StyledNavButton type="button" onClick={handleAddBalance} style={{ marginRight: '8px' }}>
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
            <StyledIconBtn title="Videochat" onClick={() => setActiveTab('videochat')}>
              <FontAwesomeIcon icon={faVideo} size="lg" />
            </StyledIconBtn>
            <StyledIconBtn title="Favoritos" onClick={handleGoFavorites}>
              <FontAwesomeIcon icon={faHeart} size="lg" />
            </StyledIconBtn>
            <StyledIconBtn title="Funnyplace" onClick={handleGoFunnyplace}>
              <FontAwesomeIcon icon={faFilm} size="lg" />
            </StyledIconBtn>
          </div>

          <ul className="list-group">
            {activeTab === 'favoritos' && (
              <li className="list-group-item p-0 border-0">
                <FavoritesClientList
                  onSelect={handleOpenChatFromFavorites} reloadTrigger={favReload}
                />
              </li>
            )}
            {activeTab === 'videochat' && (
              <li className="list-group-item">Selecciona “Buscar Modelo” para empezar</li>
            )}
            {activeTab === 'funnyplace' && (
              <li className="list-group-item">Explora Funnyplace en la zona central</li>
            )}
          </ul>
        </StyledLeftColumn>
        {/* ========= FIN COLUMNA IZQUIERDA  ======== */}

       {/* ================INICIO ZONA CENTRAL =================*/}
        <StyledCenter>
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
                      style={{ width: '100%', border: '1px solid black' }}
                      muted
                      autoPlay
                    />
                  </StyledLocalVideo>

                  {remoteStream && (
                    <StyledRemoteVideo>
                      <StyledVideoTitle>Modelo</StyledVideoTitle>
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
                                  <div>
                                    <strong>{msg.from === 'me' ? 'Yo' : 'Modelo'}:</strong>{' '}
                                    {giftRenderReady && (() => {
                                      const src = getGiftIcon(msg.gift);
                                      return src ? (
                                        <img src={src} alt="" style={{ width:28, height:28, marginLeft:6, verticalAlign:'middle' }} />
                                      ) : null;
                                    })()}
                                  </div>
                              ) : (
                                <>
                                  <strong>{msg.from === 'me' ? 'Yo' : 'Modelo'}:</strong> {msg.text}
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems:'center', position:'relative' }}>
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

                          <StyledActionButton onClick={()=>setShowGifts(s=>!s)} title="Enviar regalo" style={{ marginLeft: 8 }}>
                            🎁
                          </StyledActionButton>
                          {showGifts && (
                            <div style={{
                              position:'absolute', bottom:44, right:0, background:'rgba(0,0,0,0.85)',
                              padding:10, borderRadius:8, zIndex:10, border:'1px solid #333'
                            }}>
                              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 80px)', gap:8, maxHeight:240, overflowY:'auto'}}>
                                {gifts.map(g=>(
                                  <button key={g.id}
                                    onClick={()=>sendGiftMatch(g.id)}
                                    style={{ background:'transparent', border:'1px solid #555', borderRadius:8, padding:6, cursor:'pointer', color:'#fff' }}>
                                    <img src={g.icon} alt={g.name} style={{ width:32, height:32, display:'block', margin:'0 auto' }} />
                                    <div style={{ fontSize:12 }}>{g.name}</div>
                                    <div style={{ fontSize:12, opacity:.8 }}>{fmtEUR(g.cost)}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </StyledChatContainer>
                    </StyledRemoteVideo>
                  )}
                </>
              )}

              {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </>
          )}

          {activeTab === 'funnyplace' && ( <FunnyplacePage /> )}

          {activeTab === 'favoritos' && (
            <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'8px', position:'relative', width:'100%', maxWidth:'800px', margin:'0 auto' }}>
              {!centerChatPeerId ? (
                <div style={{ color:'#adb5bd' }}>
                  Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <h5 style={{ margin:0, color:'#ff0000' }}>
                      {selectedFav?.invited === 'pending'
                        ? `Invitación de ${centerChatPeerName}`
                        : `Chat con ${centerChatPeerName}`}
                    </h5>
                    <div style={{ fontSize:12, color: wsReady ? '#20c997' : '#adb5bd' }}>
                      {wsReady ? 'Conectado' : 'Desconectado'}
                    </div>
                  </div>

                  {selectedFav?.invited === 'pending' ? (
                    <div style={{
                      flex:1,
                      minHeight: 0,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      border:'1px solid #333',
                      borderRadius:8,
                      padding:16,
                      background:'rgba(0,0,0,0.2)'
                    }}>
                      <div style={{ textAlign:'center' }}>
                        <p style={{ color:'#fff', marginBottom:16 }}>
                          {centerChatPeerName} te ha invitado a favoritos.
                        </p>
                        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                          <StyledActionButton onClick={acceptInvitation}>Aceptar</StyledActionButton>
                          <StyledActionButton onClick={rejectInvitation} style={{ backgroundColor:'#dc3545' }}>
                            Rechazar
                          </StyledActionButton>
                        </div>
                      </div>
                    </div>
                  ) : (
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
                          <div style={{ color:'#adb5bd' }}>No hay mensajes todavía. ¡Escribe el primero!</div>
                        )}
                        {centerMessages.map(m => {
                          let giftData = m.gift;
                          if (!giftData && typeof m.body === 'string' && m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) {
                            try {
                              const parts = m.body.slice(2, -2).split(':');
                              giftData = { id: Number(parts[1]), name: parts.slice(2).join(':') };
                            } catch {}
                          }
                          return (
                            <div key={m.id}
                                 style={{ textAlign: m.senderId === user?.id ? 'right' : 'left', margin:'6px 0' }}>
                              <span style={{
                                  display:'inline-block',
                                  padding:'6px 10px',
                                  borderRadius:10,
                                  background: m.senderId === user?.id ? '#0d6efd' : '#343a40',
                                  color:'#fff',
                                  maxWidth:'80%'

                              }}>
                                {giftData ? (
                                  giftRenderReady && (() => {
                                    const src = (gifts.find(gg => Number(gg.id) === Number(giftData.id))?.icon) || null;
                                    return src ? <img src={src} alt="" style={{ width:24, height:24, verticalAlign:'middle' }} /> : null;
                                  })()
                                ) : (
                                  m.body
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center', position:'relative' }}>
                        <input
                          value={centerInput}
                          onChange={(e)=>setCenterInput(e.target.value)}
                          placeholder="Escribe un mensaje…"
                          onKeyDown={(e)=>{ if (e.key === 'Enter') sendCenterMessage(); }}
                          style={{ flex:1, borderRadius:6, border:'1px solid #333', padding:'8px', background:'rgba(255,255,255,0.9)' }}
                        />
                        <StyledActionButton onClick={sendCenterMessage}>Enviar</StyledActionButton>

                        <StyledActionButton onClick={()=>setShowCenterGifts(s=>!s)} title="Enviar regalo">🎁</StyledActionButton>
                        {showCenterGifts && (
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
        </StyledCenter>
        {/* ================FIN ZONA CENTRAL =================*/}

        <StyledRightColumn />

      </StyledMainContent>
      {/* ======FIN MAIN ======== */}

    </StyledContainer>
  );
};

export default DashboardClient;