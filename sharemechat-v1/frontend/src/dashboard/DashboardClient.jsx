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
  const [favReload, setFavReload] = useState(0);           // refresca la lista tras cambios
  const [selectedFav, setSelectedFav] = useState(null);    // { id, nickname, invited, status, role }


  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const token = localStorage.getItem('token');

  // --- Dedupe de eco para chat de streaming (RTC)
  const lastSentRef = useRef({ text: null, at: 0 });
  const isEcho = (incoming) => {
    const now = Date.now();
    return (
      incoming === lastSentRef.current.text &&
      now - lastSentRef.current.at < 1500 // ventana corta para ecos
    );
  };

  // ======== estados/refs para chat central (favoritos) ========
  const msgSocketRef = useRef(null);                       // WS /messages
  const centerListRef = useRef(null);
  const [wsReady, setWsReady] = useState(false);           // estado conexión WS mensajes
  const [centerChatPeerId, setCenterChatPeerId] = useState(null);
  const [centerChatPeerName, setCenterChatPeerName] = useState('');
  const [centerMessages, setCenterMessages] = useState([]);
  const [centerInput, setCenterInput] = useState('');
  const [centerLoading, setCenterLoading] = useState(false);
  const msgPingRef = useRef(null);                         // keepalive ping
  const msgReconnectRef = useRef(null);                    // timeout reconexión

  const meIdRef = useRef(null);
  const peerIdRef = useRef(null);

  const fmtEUR = (v) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
      .format(Number(v || 0));

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

  useEffect(() => { meIdRef.current = Number(user?.id) || null; }, [user?.id]);
  useEffect(() => { peerIdRef.current = Number(centerChatPeerId) || null; }, [centerChatPeerId]);

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

  // ======== helpers WS mensajes (abrir/cerrar/reconectar/keepalive) ========
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

        if (data.type === 'msg:new' && data.message) {
          const m = normMsg(data.message);

          const me   = Number(meIdRef.current);
          const peer = Number(peerIdRef.current);

          if (!me || !peer) return;

          const belongsToThisChat =
            (m.senderId === peer && m.recipientId === me) ||
            (m.senderId === me   && m.recipientId === peer);

          if (belongsToThisChat) {
            setCenterMessages(prev => [...prev, m]);

            queueMicrotask(() => {
                const el = centerListRef.current;
                if (el) el.scrollTop = el.scrollHeight;
            });
          }
        }
      } catch (e) {
        // silenciar parse errors
      }
    };
  };

  // WS /messages siempre abierto mientras el dashboard esté montado
  useEffect(() => {
      openMsgSocket();
      return () => closeMsgSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // evita eco de mi propio mensaje
        if (!isEcho(data.message)) {
          setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
        }
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
      // marca para evitar eco
      lastSentRef.current = { text: message.message, at: Date.now() };
      socketRef.current.send(JSON.stringify(message));
      // append optimista
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

    // limpiar chat central
    setCenterChatPeerId(null);
    setCenterChatPeerName('');
    setCenterMessages([]);
    setCenterInput('');
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

  // ======== GUARDAS DE NAVEGACIÓN DURANTE STREAMING ========
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
      alert('No se pudo identificar a la modelo actual. (Necesitamos que el backend envíe peerUserId en el mensaje "match").');
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

  // ======== helpers de chat central (REST + WS mensajes) ========
  const openChatWith = async (peerId, displayName) => {
    if (streamingActivo) {
      alert('No puedes abrir el chat central mientras hay streaming. Pulsa Stop si quieres cambiar.');
      return;
    }
    setActiveTab('favoritos');
    setCenterChatPeerId(peerId);
    setCenterChatPeerName(displayName || `Usuario ${peerId}`);
    setCenterMessages([]);
    setCenterLoading(true);
    openMsgSocket();

    try {
      const tk = localStorage.getItem('token');
      const res = await fetch(`/api/messages/with/${peerId}`, {
        headers: { Authorization: { toString(){ return `Bearer ${tk}`; } }['toString']() } // evita minificador raro
      });
      // fallback simple:
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
      // sin optimista; el eco msg:new lo añadirá
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

    setSelectedFav(favUser); // guardamos meta
    // si está pendiente, mostramos botones en el centro; si no, abrimos chat
    if (String(favUser?.invited) === 'pending') {
      setActiveTab('favoritos');
      setCenterChatPeerId(peer);
      setCenterChatPeerName(name);
      setCenterMessages([]); // limpio visual, pero no cargo historial aún
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
      // actualizar UI: este peer pasa a accepted
      const name = selectedFav.nickname || `Usuario ${selectedFav.id}`;
      setSelectedFav(prev => prev ? { ...prev, invited: 'accepted' } : prev);
      setFavReload(x => x + 1); // refrescar lista
      openChatWith(selectedFav.id, name); // abrir chat directamente
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
      setFavReload(x => x + 1); // refrescar lista
      // nos quedamos en el panel central mostrando rechazado
    } catch (e) {
      alert(e.message || 'No se pudo rechazar la invitación');
    }
  };


  const displayName = user?.nickname || user?.name || user?.email || "Cliente";

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
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
        </div>
      </StyledNavbar>

      <StyledMainContent>
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

        {/* ============================INICIO ZONA CENTRAL ================================ */}

        <StyledCenter>
          {activeTab === 'videochat' && (
            <>
              {!cameraActive && (
                <StyledActionButton onClick={handleActivateCamera}>Activar Cámara </StyledActionButton>
              )}
              {cameraActive && (
                <>
                  <div style={{ marginBottom: '10px' }}>
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
                        Modelo
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
                              <strong>{msg.from === 'me' ? 'Yo' : 'Modelo'}:</strong> {msg.text}
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

          {activeTab === 'funnyplace' && ( <FunnyplacePage /> )}

          {activeTab === 'favoritos' && (
            <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'8px' }}>
              {!centerChatPeerId ? (
                <div style={{ color:'#adb5bd' }}>
                  Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <h5 style={{ margin:0, color:'#fff' }}>
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
                        {centerMessages.map(m => (
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
                              {m.body}
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
                          style={{ flex:1, borderRadius:6, border:'1px solid #333', padding:'8px', background:'rgba(255,255,255,0.9)' }}
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

        {/* ============================FIN ZONA CENTRAL ================================ */}

        <StyledRightColumn />
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardClient;