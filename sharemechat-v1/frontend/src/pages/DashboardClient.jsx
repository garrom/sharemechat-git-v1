import React, { useState, useRef, useEffect } from 'react';
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


  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);

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

  const handleActivateCamera = async () => {
    try {
      //const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); //PRODUCCION
      const stream = await navigator.mediaDevices.getUserMedia({video: { width: 640, height: 480 },audio: true}); //DESARROLLO reduce ancho banda
      localStream.current = stream;
      setCameraActive(true);
    } catch (err) {
      setError('Error al activar la cámara: ' + err.message);
      console.error(err);
    }
  };

  const handleStartMatch = () => {
    if (!cameraActive || !localStream.current) {
      setError('Primero activa la cámara.');
      return;
    }
    setSearching(true);
    setError('');

    socketRef.current = new WebSocket('wss://test.sharemechat.com/match');

    socketRef.current.onopen = () => {
      console.log('WebSocket abierto, enviando start-match');
      socketRef.current.send(JSON.stringify({ type: 'set-role', role: 'client' }));
      socketRef.current.send(JSON.stringify({ type: 'start-match' }));
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'match') {
        console.log('Emparejado con modelo', data.peerId);
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
          socketRef.current.send(JSON.stringify({ type: 'signal', signal }));
        });

        peer.on('stream', (stream) => {
          setRemoteStream(stream);
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          setError('Error en la conexión WebRTC: ' + err.message);
          setSearching(false);
        });

        peerRef.current = peer;
        setSearching(false);

      } else if (data.type === 'signal' && peerRef.current) {
          peerRef.current.signal(data.signal);
      } else if (data.type === 'chat') {
          setMessages(prev => [...prev, { from: 'peer', text: data.message }]);
      } else if (data.type === 'no-model-available') {
          setError('No hay modelos disponibles.');
          setSearching(false);
      } else if (data.type === 'peer-disconnected') {
          console.log('Recibido peer-disconnected');
          if(peerRef.current){
             peerRef.current.destroy();
             peerRef.current = null;
             console.log('Peer destruido');
          }
          if (remoteStream) {
              remoteStream.getTracks().forEach(track => track.stop());
          }
          setRemoteStream(null);
          setMessages([]);
          setError('El modelo se ha desconectado.');
      }
    };

    socketRef.current.onerror = (e) => {
      setError('Error WebSocket');
      setSearching(false);
      console.error(e);
    };

    socketRef.current.onclose = () => {
      console.log('WebSocket cerrado');
      setSearching(false);
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
    setError('Buscando nuevo modelo...');
  };

  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput };
    socketRef.current.send(JSON.stringify(message));
    setMessages(prev => [...prev, { from: 'me', text: chatInput }]);
    setChatInput('');
  };

  const stopAll = () => {
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

  return (
    <StyledContainer>
      <StyledNavbar>
        <span>Mi Logo</span>
        <div>
          <span className="me-3">Hola, Cliente</span>
          <StyledNavButton>
            <FontAwesomeIcon icon={faSignOutAlt} />
            <StyledIconWrapper>Salir</StyledIconWrapper>
          </StyledNavButton>
          <StyledNavButton>
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
