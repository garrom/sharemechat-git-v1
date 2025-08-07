import React, { useState, useRef, useEffect } from 'react';
import Peer from 'simple-peer';

const DashboardClient = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

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
    }
  }, [remoteStream]);

  const handleActivateCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
      } else if (data.type === 'signal') {
        if (peerRef.current) {
          peerRef.current.signal(data.signal);
        }
      } else if (data.type === 'chat'){
          setMessages(prev => [...prev, { from: 'peer', text: data.message }]);
      } else if (data.type === 'no-model-available'){
          setError('No hay modelos disponibles.');
          setSearching(false);
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
    <div>
      <h2>Panel Cliente</h2>

      <div>
        {!cameraActive && <button onClick={handleActivateCamera}>Activar cámara</button>}
        {cameraActive && !searching && <button onClick={handleStartMatch}>Buscar Modelo</button>}
        {cameraActive && searching && <p>Buscando modelo...</p>}
        {cameraActive && <button onClick={stopAll}>Detener</button>}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', marginTop: '20px' }}>
        <div style={{ width: '30%', marginRight: '20px' }}>
          <h4>Tu cámara</h4>
          <video ref={localVideoRef} autoPlay muted style={{ width: '100%' }} />
        </div>
        <div style={{ width: '70%' }}>
          <h4>Modelo</h4>
          <video ref={remoteVideoRef} autoPlay style={{ width: '100%' }} />
        </div>

        <div style={{ marginTop: '20px' }}>
          <h4>Chat</h4>
          <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid gray', padding: '10px' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ textAlign: msg.from === 'me' ? 'right' : 'left' }}>
                <strong>{msg.from === 'me' ? 'Yo' : 'Modelo'}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: '10px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={{ flex: 1, marginRight: '10px' }}
            />
            <button onClick={sendChatMessage}>Enviar</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardClient;
