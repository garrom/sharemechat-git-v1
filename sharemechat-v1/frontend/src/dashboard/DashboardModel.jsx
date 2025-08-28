import React, { useState, useRef, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import FavoritesModelList from './features/favorites/FavoritesModelList';
import FunnyplacePage from './features/funnyplace/FunnyplacePage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser, faHeart, faEnvelope, faVideo, faFilm, faUserPlus } from '@fortawesome/free-solid-svg-icons';
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
  const [activeTab, setActiveTab] = useState('videochat');
  const [user, setUser] = useState(null);
  const [saldoModel, setSaldoModel] = useState(null);
  const [loadingSaldoModel, setLoadingSaldoModel] = useState(false);
  const [status, setStatus] = useState('');
  const [queuePosition, setQueuePosition] = useState(null);
  const [currentClientId, setCurrentClientId] = useState(null);

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
        console.error('Error cargando usuario:', e);
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

  // Cargar saldo de la modelo
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }, // DESARROLLO reducir ancho de banda
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
      console.log('Modelo conectado al WebSocket');
      setStatus('Esperando cliente...');
      // --- Keepalive cada 30s ---
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
        // Guardar el id del cliente si el backend lo envía
        try {
          if (data.peerRole === 'client' && Number.isFinite(Number(data.peerUserId))) {
            setCurrentClientId(Number(data.peerUserId));
          } else {
            setCurrentClientId(null);
          }
        } catch { setCurrentClientId(null); }

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
        // Emparejada: limpiar estados de "buscando/esperando"
        setError('');
        setStatus('');
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
          // Confirmación definitiva de emparejamiento: limpiar cualquier mensaje de estado
          setError('');
          setStatus('');
          setRemoteStream(stream);
        });

        peer.on('error', (err) => {
          setError('Error en la conexión WebRTC: ' + err.message);
        });
      } else if (data.type === 'signal' && peerRef.current) {
        // Progreso en la señalización → limpiar "buscando/esperando"
        setError('');
        setStatus('');
        peerRef.current.signal(data.signal);
      } else if (data.type === 'chat') {
        setMessages((prev) => [...prev, { from: 'peer', text: data.message }]);
      } else if (data.type === 'no-client-available') {
        // Estado neutro: seguir esperando sin marcar error
        setStatus('Esperando cliente...');
        // (Opcional) pedir stats para refrescar posición
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'stats' }));
        }
      } else if (data.type === 'queue-stats') {
        // Actualiza solo posición de la modelo (0 = primera en cola)
        if (typeof data.position === 'number') {
          setQueuePosition(data.position);
        }
      } else if (data.type === 'peer-disconnected') {
        console.log('Recibido peer-disconnected');
        setCurrentClientId(null);
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
          console.log('Peer destruido');
        }
        if (remoteStream) {
          remoteStream.getTracks().forEach((track) => track.stop());
        }
        setRemoteStream(null);
        setMessages([]);

        // Volver a estado de espera (mensaje neutro, no error)
        setError('');
        setStatus('Esperando cliente...');
        // (Opcional) refrescar stats
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'stats' }));
        }
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

    setCurrentClientId(null);
    setRemoteStream(null);
    setMessages([]);
    setStatus('Buscando nuevo cliente...');
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'stats' }));
    }
  };

  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput };
    socketRef.current.send(JSON.stringify(message));
    setMessages((prev) => [...prev, { from: 'me', text: chatInput }]);
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

    setCurrentClientId(null);
    setCameraActive(false);
    setRemoteStream(null);
    setError('');
    setStatus('');
    setQueuePosition(null);
    setMessages([]);
  };

  // RETIRO DINERO
  const handleRequestPayout = async () => {
    const tk = localStorage.getItem('token');
    if (!tk) {
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

      // Refrescar saldo tras el retiro
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

  // =========FIN GUARDAS DE NAVEGACION STREAMING================================

   // AÑADIR CLIENTE A FAVORITOS
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


  const displayName = user?.nickname || user?.name || user?.email || 'Modelo';

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <span className="me-3">Hola, {displayName}</span>

          {/* Saldo */}
          <span className="me-3">
            {loadingSaldoModel
              ? 'Saldo: ...'
              : saldoModel !== null
              ? `Saldo: €${Number(saldoModel).toFixed(2)}`
              : 'Saldo: -'}
          </span>

          {/* Solo la posición en la cola (modelo) */}
          {queuePosition !== null && queuePosition >= 0 && (
            <span className="me-3" style={{ color: '#6c757d' }}>
              Tu posición: {queuePosition + 1}
            </span>
          )}

          {/* Botón retiro */}
          <StyledNavButton type="button" onClick={handleRequestPayout}>
            Solicitar retiro
          </StyledNavButton>

          {/* Salir y perfil */}
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
                {/* Lista de clientes favoritos de la MODELO */}
                <FavoritesModelList />
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

        <StyledCenter>
           {/* CENTRO: o VideoChat (RTC) o Funnyplace */}

         {activeTab === 'videochat' && (
          <>

          {status && <p style={{ color: '#6c757d', marginTop: '10px' }}>{status}</p>}

          {!cameraActive && (
            <StyledActionButton onClick={startCamera}>Activar Cámara</StyledActionButton>
          )}
          {cameraActive && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <StyledActionButton onClick={stopAll} style={{ backgroundColor: '#dc3545' }}> Stop </StyledActionButton>
                {remoteStream && (
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
                          <strong>{msg.from === 'me' ? 'Yo' : 'Cliente'}:</strong> {msg.text}
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

         {activeTab === 'funnyplace' && ( <FunnyplacePage />
          )}

        </StyledCenter>

        <StyledRightColumn />
      </StyledMainContent>
    </StyledContainer>
  );
};

export default DashboardModel;
