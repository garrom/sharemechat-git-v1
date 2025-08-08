import React, { useState, useRef, useEffect } from 'react';
import Peer from 'simple-peer';

const DashboardModel = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStream = useRef(null);
  const peerRef = useRef(null);

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

  const startCamera = async () => {
    try {
      //const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); //PRODUCCION
      const stream = await navigator.mediaDevices.getUserMedia({video: { width: 640, height: 480 },audio: true}); //DESARROLLO reducir ancho banda
      localStream.current = stream;
      setCameraActive(true);
      startWebSocketAndWait();// Iniciar WebSocket después de activar cámara
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('No se pudo acceder a la cámara.');
    }
  };

  const startWebSocketAndWait = () => {
    const socket = new WebSocket('wss://test.sharemechat.com/match');
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Modelo conectado al WebSocket');
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
          console.log('Modelo enviando signal:', signal);
          socket.send(JSON.stringify({ type: 'signal', signal }));
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
          setMessages(prev => [...prev, { from: 'peer', text: data.message }]);
      } else if (data.type === 'no-client-available') {
          setError('No hay clientes disponibles.');
      } else if (data.type === 'peer-disconnected') {
          console.log('Recibido peer-disconnected');
          if(peerRef.current){
              peerRef.current.destroy();
              peerRef.current = null;
              console.log('Peer destruido');
          }if(remoteStream){
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
      console.log('WebSocket cerrado (modelo)');
    };

    socket.onclose = () => {};
  };

  const handleNext = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setRemoteStream(null);
    setMessages([]);
    socketRef.current.send(JSON.stringify({ type: 'next' }));
  };

  const sendChatMessage = () => {
    if (chatInput.trim() === '') return;
    const message = { type: 'chat', message: chatInput };
    socketRef.current.send(JSON.stringify(message));
    setMessages(prev => [...prev, { from: 'me', text: chatInput }]);
    setChatInput('');
  };

  const stopAll = () => {
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

  return (
    <div style={{ padding: '20px' }}>
      <h2>Dashboard Modelo</h2>

      {!cameraActive && (<button onClick={startCamera}>Activar Cámara</button>)}
      {cameraActive && (<button onClick={stopAll}>Apagar Cámara y Desconectar</button>)}
      {remoteStream && <button onClick={handleNext}>Next</button>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', marginTop: '20px' }}>
        <div style={{ flex: 1, marginRight: '10px' }}>
          <h4>Tu cámara (Modelo)</h4>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: 'auto', border: '1px solid gray' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h4>Webcam remota (Cliente)</h4>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: 'auto', border: '1px solid gray' }} />
        </div>

        <div style={{ marginTop: '20px' }}>
          <h4>Chat</h4>
          <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid gray', padding: '10px' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ textAlign: msg.from === 'me' ? 'right' : 'left' }}>
                <strong>{msg.from === 'me' ? 'Yo' : 'Cliente'}:</strong> {msg.text}
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

export default DashboardModel;
