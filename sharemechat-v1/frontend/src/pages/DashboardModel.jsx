import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const DashboardModel = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
    } catch (error) {
      console.error('Error accediendo a la cámara:', error);
    }
  };

  const startWebSocketAndWait = () => {
    if (!localStream) {
      alert('Primero debes encender la cámara');
      return;
    }

    const socketInstance = io('wss://test.sharemechat.com/match'); // <-- cambia esto por tu backend real
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('Conectado al WebSocket como modelo');
      socketInstance.emit('model-available'); // Marca este socket como "modelo disponible"
      setIsAvailable(true);
    });

    socketInstance.on('matched', ({ peerId }) => {
      console.log('¡Emparejado con cliente!', peerId);

      const newPeer = new Peer({
        initiator: false,
        trickle: false,
        stream: localStream,
      });

      newPeer.on('signal', data => {
        socketInstance.emit('signal', { to: peerId, signal: data });
      });

      newPeer.on('stream', stream => {
        console.log('Stream recibido del cliente');
        setRemoteStream(stream);
      });

      socketInstance.on('signal', ({ signal }) => {
        newPeer.signal(signal);
      });

      setPeer(newPeer);
    });

    socketInstance.on('peer-disconnected', () => {
      console.log('Cliente se desconectó');
      setRemoteStream(null);
      if (peer) {
        peer.destroy();
        setPeer(null);
      }
    });
  };

  const stopAll = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (peer) {
      peer.destroy();
      setPeer(null);
    }

    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsAvailable(false);
    }

    setRemoteStream(null);
  };

  return (
    <div>
      <h2>Panel Modelo</h2>

      <div>
        <button onClick={startCamera} disabled={!!localStream}>
          Encender cámara
        </button>
        <button onClick={startWebSocketAndWait} disabled={!localStream || isAvailable}>
          Disponible para emparejamiento
        </button>
        <button onClick={stopAll}>Detener</button>
      </div>

      <div style={{ display: 'flex', marginTop: '20px' }}>
        <div style={{ width: '30%', marginRight: '20px' }}>
          <h4>Tu cámara</h4>
          <video ref={localVideoRef} autoPlay muted style={{ width: '100%' }} />
        </div>
        <div style={{ width: '70%' }}>
          <h4>Cliente</h4>
          <video ref={remoteVideoRef} autoPlay style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
};

export default DashboardModel;
