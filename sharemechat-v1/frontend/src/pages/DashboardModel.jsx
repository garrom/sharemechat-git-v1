import React, { useState, useRef, useEffect } from 'react';
import Peer from 'simple-peer';

const DashboardModel = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');

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
    }
  }, [remoteStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      setCameraActive(true);

      // Iniciar WebSocket después de activar cámara
      startWebSocketAndWait();
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
      // El modelo no envía ningún mensaje, solo queda disponible para que lo emparejen
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
          console.error('Error en peer (modelo):', err);
        });
      }

      if (data.type === 'signal' && peerRef.current) {
        console.log('Modelo recibió signal del cliente');
        peerRef.current.signal(data.signal);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error en modelo:', err);
      setError('Error de conexión con el servidor.');
    };

    socket.onclose = () => {
      console.log('WebSocket cerrado (modelo)');
    };
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
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Dashboard Modelo</h2>

      {!cameraActive && (
        <button onClick={startCamera}>Activar Cámara</button>
      )}

      {cameraActive && (
        <button onClick={stopAll}>Apagar Cámara y Desconectar</button>
      )}

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
      </div>
    </div>
  );
};

export default DashboardModel;
