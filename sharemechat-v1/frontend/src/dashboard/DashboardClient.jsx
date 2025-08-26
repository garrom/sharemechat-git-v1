import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser, faHeart, faEnvelope, faUserPlus, faBell } from '@fortawesome/free-solid-svg-icons';
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
  const [activeTab, setActiveTab] = useState('models');
  const [user, setUser] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [saldoError, setSaldoError] = useState('');
  const [status, setStatus] = useState('');
  const [nexting, setNexting] = useState(false);

  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const token = localStorage.getItem('token');
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
        }
      } catch (e) {
        console.error("Error cargando usuario:", e);
      }
    };
    if (token) loadUser();
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const loadSaldo = async () => {
      setLoadingSaldo(true);
      setSaldoError('');
      try {
        const res = await fetch('/api/clients/me', {
          headers: { Authorization: `Bearer ${token}` }
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


  const handleActivateCamera = async () => {
    try {

      const stream = await navigator.mediaDevices.getUserMedia({video: { width: 640, height: 480 },audio: true}); //DESARROLLO reduce ancho banda
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

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      setSearching(false);
      return;
    }

    const wsUrl = `wss://test.sharemechat.com/match?token=${encodeURIComponent(token)}`;
    console.log('WS(Client) ->', wsUrl);

    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('WebSocket abierto (client), enviando start-match');
      // --- Keepalive cada 30s ---
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
        // 🔒 Asegura que no queda ningún peer/stream previo
        try {
          if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
          }
        } catch {}
        try {
          if (remoteStream) {
            remoteStream.getTracks().forEach((t) => t.stop());
          }
        } catch {}
        setRemoteStream(null);
        setMessages([]);

        // ⬇️ crea el nuevo peer como ya hacías
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
        setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
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
        // limpieza defensiva (por si fue el peer quien cortó)
        try {
          if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
          }
        } catch {}
        try {
          if (remoteStream) {
            remoteStream.getTracks().forEach((t) => t.stop());
          }
        } catch {}
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
      console.log('WebSocket cerrado (client):', e.code, e.reason);
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

    try {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    } catch {}
    try {
      if (remoteStream) {
        remoteStream.getTracks().forEach((t) => t.stop());
      }
    } catch {}

    setRemoteStream(null);
    setMessages([]);
    setSearching(true);           // mostramos “buscando…”
    setError('Buscando nuevo modelo...');
  };


  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput };
    socketRef.current.send(JSON.stringify(message));
    setMessages(prev => [...prev, { from: 'me', text: chatInput }]);
    setChatInput('');
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
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setCameraActive(false);
    setSearching(false);
    setRemoteStream(null);
    setError('');
    setMessages([]);
  };

  const handleAddBalance = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }

    // Ventana simple para introducir el importe
    let input = window.prompt('Cantidad a añadir (€):', '10');
    if (input === null) return; // usuario canceló

    // Permite coma o punto
    input = String(input).replace(',', '.').trim();
    const amount = Number(input);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Introduce un importe válido mayor que 0.');
      return;
    }

    try {
      setLoadingSaldo(true);

      // Llamada al endpoint de recarga (INGRESO)
      const res = await fetch('/api/transactions/add-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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

      // Refrescar saldo en navbar
      const res2 = await fetch('/api/clients/me', {
        headers: { Authorization: `Bearer ${token}` },
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


  const displayName = user?.nickname || user?.name || user?.email || "Cliente";

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <span className="me-3">Hola, {displayName}</span>
          {/* Ver saldo */}
          <span className="me-3">
            {loadingSaldo ? 'Saldo: …' : saldoError ? 'Saldo: n/d' : `Saldo: ${fmtEUR(saldo)}`}
          </span>
          {/* Añadir saldo */}
          <StyledNavButton type="button" onClick={handleAddBalance} style={{ marginRight: '8px' }}>
            + Saldo
          </StyledNavButton>
          {/* Salir y perfil*/}
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
              title="videochat"
              onClick={() => setActiveTab('videochat')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faHeart} size="lg" />
            </button>
            <button
              title="favoritos"
              onClick={() => setActiveTab('favoritos')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faEnvelope} size="lg" />
            </button>
            <button
              title="ligoteo"
              onClick={() => setActiveTab('ligoteo')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faUserPlus} size="lg" />
            </button>
            <button
              title="Notificaciones"
              onClick={() => setActiveTab('notifications')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faBell} size="lg" />
            </button>
          </div>
          <ul className="list-group">
            {activeTab === 'models' && <li className="list-group-item">Aquí iría la lista de modelos favoritos</li>}
            {activeTab === 'messages' && <li className="list-group-item">Aquí irían los mensajes</li>}
            {activeTab === 'notifications' && <li className="list-group-item">Aquí irían las notificaciones</li>}
          </ul>
        </StyledLeftColumn>

        <StyledCenter>
          {!cameraActive && (
            <StyledActionButton onClick={handleActivateCamera}>Activar Cámara</StyledActionButton>
          )}

          {cameraActive && (
            <>
              <div style={{ marginBottom: '10px' }}>
                {!searching && <StyledActionButton onClick={handleStartMatch}>Buscar Modelo</StyledActionButton>}
                {searching && <p>Buscando modelo...</p>}
                <StyledActionButton onClick={stopAll} style={{ backgroundColor: '#dc3545' }}>
                  Stop
                </StyledActionButton>
                {remoteStream && !searching && (
                  <StyledActionButton onClick={handleNext}>Next</StyledActionButton>
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
                  <h5 style={{ position: 'absolute', top: '10px', left: '10px', color: 'white', zIndex: 2 }}>
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
                        style={{ flex: 1, marginRight: '10px', background: 'rgba(255, 255, 255, 0.9)', border: 'none', borderRadius: '5px', padding: '5px' }}
                      />
                      <StyledActionButton onClick={sendChatMessage}>Enviar</StyledActionButton>
                    </div>
                  </StyledChatContainer>
                </StyledRemoteVideo>
              )}
            </>
          )}

          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </StyledCenter>

        <StyledRightColumn />
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardClient;
