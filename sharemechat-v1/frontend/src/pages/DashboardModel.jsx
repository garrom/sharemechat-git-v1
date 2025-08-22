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
} from '../styles/ModelStyles';

const DashboardModel = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('models');
  const [user, setUser] = useState(null);
  const [saldoModel, setSaldoModel] = useState(null);
  const [loadingSaldoModel, setLoadingSaldoModel] = useState(false);
  const [saldoModelError, setSaldoModelError] = useState('');


  const history = useHistory();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const token = localStorage.getItem('token');

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

  // Muestra video local cuando cámara está activa
  useEffect(() => {
    if (localVideoRef.current && localStream.current) {
      localVideoRef.current.srcObject = localStream.current;
    }
  }, [cameraActive]);

  // Muestra video remoto cuando hay conexión
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

    const fetchSaldoModel = async () => {
      try {
        setLoadingSaldoModel(true);
        const res = await fetch('/api/models/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Error ${res.status}`);
        }
        const data = await res.json();
        setSaldoModel(data.saldoActual);
        setSaldoModelError('');
      } catch (e) {
        console.error(e);
        setSaldoModelError(e.message || 'Error al cargar saldo de modelo');
      } finally {
        setLoadingSaldoModel(false);
      }
    };

    fetchSaldoModel();
  }, []);


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }, // DESARROLLO reducir ancho de banda
        audio: true
      });
      localStream.current = stream;
      setCameraActive(true);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Sesión expirada. Inicia sesión de nuevo.');
        return;
      }

      startWebSocketAndWait(token);

    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara.');
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('token');
    history.push('/');
  };

  const startWebSocketAndWait = (token) => {
    const wsUrl = `wss://test.sharemechat.com/match?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Modelo conectado al WebSocket');
      // --- Keepalive cada 30s ---
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      socket.send(JSON.stringify({ type: 'set-role', role: 'model' }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'match') {
        console.log('Modelo emparejado con cliente. PeerID:', data.peerId);
        const peer = new Peer({
          initiator: false,
          trickle: true,
          stream: localStream.current,
        });
        peerRef.current = peer;

        peer.on('signal', (signal) => {
          // Ignorar candidatos vacíos
          if (signal?.type === 'candidate' && signal?.candidate?.candidate === '') return;
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'signal', signal }));
          }
        });

        peer.on('stream', (stream) => {
          console.log('Modelo recibió stream remoto');
          setRemoteStream(stream);
        });

        peer.on('error', (err) => {
          setError('Error en la conexión WebRTC: ' + err.message);
        });

      } else if (data.type === 'signal' && peerRef.current) {
        peerRef.current.signal(data.signal);
      } else if (data.type === 'chat') {
        setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
      } else if (data.type === 'no-client-available') {
        setError('No hay clientes disponibles.');
      } else if (data.type === 'peer-disconnected') {
        console.log('Recibido peer-disconnected');
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
          console.log('Peer destruido');
        }
        if (remoteStream) {
          remoteStream.getTracks().forEach(track => track.stop());
        }
        setRemoteStream(null);
        setMessages([]);
        setError('El cliente se ha desconectado.');
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error en modelo:', err);
      setError('Error de conexión con el servidor.');
    };

    socket.onclose = () => {

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      console.log('WebSocket cerrado (modelo)');

    };
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
    setRemoteStream(null);
    setMessages([]);
    setError('Buscando nuevo cliente...');
  };

  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput };
    socketRef.current.send(JSON.stringify(message));
    setMessages(prev => [...prev, { from: 'me', text: chatInput }]);
    setChatInput('');
  };

   const handleProfile = () => {
      history.push('/perfil-model');
   };

  const stopAll = () => {

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Cierra cámara local
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    // Cierra peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Cierra WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setCameraActive(false);
    setRemoteStream(null);
    setError('');
    setMessages([]);
  };

  const handleRequestPayout = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }

    let input = window.prompt('Cantidad a retirar (€):', '10');
    if (input === null) return; // cancelado

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
          Authorization: `Bearer ${token}`,
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

      // Refrescar saldo tras el retiro
      const res2 = await fetch('/api/models/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res2.ok) {
        const txt = await res2.text();
        throw new Error(txt || `Error refrescando saldo: ${res2.status}`);
      }
      const data = await res2.json();
      setSaldoModel(data.saldoActual);
      setSaldoModelError('');

    } catch (e) {
      console.error(e);
      alert(e.message || 'Error al solicitar retiro.');
      setSaldoModelError(e.message || 'Error al cargar saldo de modelo');
    } finally {
      setLoadingSaldoModel(false);
    }
  };


  const displayName = user?.nickname || user?.name || user?.email || "Modelo";

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <span className="me-3">Hola, {displayName}</span>

            {/* Ver saldo */}
            <span className="me-3">
              {loadingSaldoModel ? 'Saldo: ...' :
                (saldoModel !== null ? `Saldo: €${Number(saldoModel).toFixed(2)}` : 'Saldo: -')}
            </span>
           {/* Botón retiro */}
           <StyledNavButton type="button" onClick={handleRequestPayout}>
             Solicitar retiro
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
              title="Listar Favoritos"
              onClick={() => setActiveTab('models')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faHeart} size="lg" />
            </button>
            <button
              title="Mensajes"
              onClick={() => setActiveTab('messages')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faEnvelope} size="lg" />
            </button>
            <button
              title="Añadir a Favoritos"
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
            {activeTab === 'models' && <li className="list-group-item">Aquí iría la lista de clientes favoritos</li>}
            {activeTab === 'messages' && <li className="list-group-item">Aquí irían los mensajes</li>}
            {activeTab === 'notifications' && <li className="list-group-item">Aquí irían las notificaciones</li>}
          </ul>
        </StyledLeftColumn>

        <StyledCenter>
          {!cameraActive && (
            <StyledActionButton onClick={startCamera}>Activar Cámara</StyledActionButton>
          )}

          {cameraActive && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <StyledActionButton onClick={stopAll} style={{ backgroundColor: '#dc3545' }}>
                  Stop
                </StyledActionButton>
                {remoteStream && (
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
                          <strong>{msg.from === 'me' ? 'Yo' : 'Cliente'}:</strong> {msg.text}
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

export default DashboardModel;
