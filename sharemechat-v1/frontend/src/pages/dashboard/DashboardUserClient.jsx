// src/pages/dashboard/DashboardUserClient.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Peer from 'simple-peer';
import { useAppModals } from '../../components/useAppModals';

import VideoChatRandomUser from './VideoChatRandomUser';
import TrialCooldownModal from '../../components/TrialCooldownModal';

import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';

import {
  StyledNavbar, StyledBrand, NavText,
  HamburgerButton, MobileMenu,
} from '../../styles/NavbarStyles';

import {
  NavButton,
} from '../../styles/ButtonStyles';

const DashboardUserClient = () => {
  const history = useHistory();
  const { alert, openPurchaseModal } = useAppModals();

  const [userName, setUserName] = useState('Usuario');
  const [user, setUser] = useState(null);

  // Estado de streaming trial
  const [cameraActive, setCameraActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  const [loadingFirstPayment, setLoadingFirstPayment] = useState(false);

  // Modal de cooldown (sin más trials)
  const [showTrialCooldownModal, setShowTrialCooldownModal] = useState(false);
  const [trialRemainingMs, setTrialRemainingMs] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideoWrapRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const pingIntervalRef = useRef(null);

  const token = localStorage.getItem('token');

  // ======= Responsive (móvil) =======
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ======= Carga de usuario =======
  useEffect(() => {
    if (!token) {
      history.push('/');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('token');
          history.push('/');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setUserName(data.nickname || data.name || data.email || 'Usuario');
        }
      } catch (e) {
        console.error('Error cargando usuario USER:', e);
      }
    })();
  }, [token, history]);

  // ======= Unión de streams a los <video> =======
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    } else if (localVideoRef.current && !cameraActive) {
      localVideoRef.current.srcObject = null;
    }
  }, [cameraActive, remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    } else if (remoteVideoRef.current && !remoteStream) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // ======= Helpers =======
  const clearPing = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const closeSocket = () => {
    try {
      if (socketRef.current) socketRef.current.close();
    } catch {
      // noop
    }
    socketRef.current = null;
    clearPing();
  };

  const toggleFullscreen = (el) => {
    if (!el) return;
    const d = document;
    const isFs =
      d.fullscreenElement ||
      d.webkitFullscreenElement ||
      d.mozFullScreenElement ||
      d.msFullscreenElement;

    if (!isFs) {
      const req =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen;
      try {
        req && req.call(el);
      } catch {
        /* noop */
      }
    } else {
      const exit =
        d.exitFullscreen ||
        d.webkitExitFullscreen ||
        d.mozCancelFullScreen ||
        d.msExitFullscreen;
      try {
        exit && exit.call(d);
      } catch {
        /* noop */
      }
    }
  };

  // ======= Cámara local =======
  const handleActivateCamera = async () => {
    setError('');
    setStatusText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setCameraActive(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error al activar la cámara (USER):', err);
      setError('Error al activar la cámara: ' + err.message);
      setCameraActive(false);
      localStreamRef.current = null;
    }
  };

  // ======= STOP / limpieza completa =======
  const stopAll = () => {
    setSearching(false);
    setStatusText('');
    setError('');

    clearPing();

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        /* noop */
      }
      peerRef.current = null;
    }

    if (remoteStream) {
      try {
        remoteStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      setRemoteStream(null);
    }

    closeSocket();

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        /* noop */
      }
      localStreamRef.current = null;
    }

    setCameraActive(false);
  };

  // ======= Logout =======
  const handleLogout = async () => {
    stopAll();
    localStorage.removeItem('token');
    history.push('/');
  };

  // ======= Primer pago -> hacerme CLIENT =======
  const handleFirstPayment = async () => {
    setError('');
    setStatusText('');

    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      await alert({
        title: 'Sesión expirada',
        message: 'Inicia sesión de nuevo para completar el pago.',
        variant: 'warning',
        size: 'sm',
      });
      history.push('/');
      return;
    }

    const result = await openPurchaseModal({
      context: 'first-payment-user',
    });

    if (!result.confirmed || !result.pack) return;

    const { pack } = result;
    const amount = Number(pack.price);

    setLoadingFirstPayment(true);
    try {
      const res = await fetch('/api/transactions/first', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenLS}`,
        },
        body: JSON.stringify({
          amount,
          operationType: 'INGRESO',
          description: `Primer pago (${pack.minutes} minutos) para activar cuenta premium`,
        }),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || 'Error al procesar el pago');

      await alert({
        title: 'Pago realizado',
        message: `Se ha procesado el pack de ${pack.minutes} minutos. Tu cuenta ya está activada como CLIENT.`,
        variant: 'success',
        size: 'sm',
      });

      history.push('/client');
    } catch (e) {
      const msgErr = e.message || 'Error al procesar el pago.';
      setError(msgErr);
      await alert({
        title: 'Error',
        message: msgErr,
        variant: 'danger',
        size: 'sm',
      });
    } finally {
      setLoadingFirstPayment(false);
    }
  };

  // ======= WebSocket + WebRTC (trial) =======
  const handleStartMatch = () => {
    setError('');
    setStatusText('');
    setShowTrialCooldownModal(false);

    if (!cameraActive || !localStreamRef.current) {
      setError('Primero activa la cámara.');
      return;
    }

    const tokenLS = localStorage.getItem('token');
    if (!tokenLS) {
      setError('Sesión expirada. Inicia sesión de nuevo.');
      history.push('/');
      return;
    }

    closeSocket();
    setSearching(true);

    const wsUrl = `wss://test.sharemechat.com/match?token=${encodeURIComponent(
      tokenLS
    )}`;
    console.log('[USER][WS] ->', wsUrl);

    const s = new WebSocket(wsUrl);
    socketRef.current = s;

    s.onopen = () => {
      console.log('[USER][WS] OPEN');

      clearPing();
      pingIntervalRef.current = setInterval(() => {
        try {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        } catch {
          /* noop */
        }
      }, 30000);

      // IMPORTANTE: rol "client" para que el handler use el lado viewer.
      // El rol REAL (USER/CLIENT) se mira en la BBDD.
      s.send(JSON.stringify({ type: 'set-role', role: 'client' }));
      s.send(JSON.stringify({ type: 'start-match' }));
    };

    s.onerror = (e) => {
      console.error('[USER][WS] ERROR', e);
      setError('Error WebSocket');
      setSearching(false);
    };

    s.onclose = () => {
      console.log('[USER][WS] CLOSE');
      clearPing();
      setSearching(false);
    };

    s.onmessage = async (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      // === MATCH ENCONTRADO ===
      if (data.type === 'match') {
        console.log('[USER][WS] match=', data);

        try {
          if (peerRef.current) {
            peerRef.current.destroy();
          }
        } catch {
          /* noop */
        }
        peerRef.current = null;

        try {
          if (remoteStream) {
            remoteStream.getTracks().forEach((t) => t.stop());
          }
        } catch {
          /* noop */
        }
        setRemoteStream(null);

        const peer = new Peer({
          initiator: true,
          trickle: true,
          stream: localStreamRef.current,
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
          if (
            signal?.type === 'candidate' &&
            signal?.candidate?.candidate === ''
          ) {
            return;
          }
          if (
            socketRef.current &&
            socketRef.current.readyState === WebSocket.OPEN
          ) {
            socketRef.current.send(JSON.stringify({ type: 'signal', signal }));
          }
        });

        peer.on('stream', (stream) => {
          console.log('[USER][Peer] remote stream recibido');
          setRemoteStream(stream);
          setSearching(false);
          setStatusText('');
        });

        peer.on('error', (err) => {
          console.error('[USER][Peer] error:', err);
          setError('Error en la conexión WebRTC: ' + err.message);
          setSearching(false);
        });

        peerRef.current = peer;
        return;
      }

      // === Señal WebRTC ===
      if (data.type === 'signal' && peerRef.current) {
        peerRef.current.signal(data.signal);
        return;
      }

      // === No hay modelos disponibles ===
      if (data.type === 'no-model-available') {
        console.log('[USER][WS] no-model-available');
        setStatusText('No hay modelos disponibles ahora mismo. Inténtalo de nuevo en unos segundos.');
        setSearching(false);
        return;
      }

      // === Trials agotados: no se puede iniciar otro ===
      if (data.type === 'trial-unavailable') {
        console.log('[USER][WS] trial-unavailable', data);

        setSearching(false);
        setStatusText('Has agotado las pruebas gratuitas por ahora.');

        // Si el backend empieza a mandar data.remainingMs, lo usamos.
        setTrialRemainingMs(
          typeof data.remainingMs === 'number' ? data.remainingMs : null
        );
        setShowTrialCooldownModal(true);

        // Cerramos solo el socket; mantenemos la cámara encendida
        closeSocket();
        return;
      }

      // === Desconexión del peer ===
      if (data.type === 'peer-disconnected') {
        console.log('[USER][WS] peer-disconnected', data);
        const reason = data.reason || '';

        try {
          if (peerRef.current) {
            peerRef.current.destroy();
          }
        } catch {
          /* noop */
        }
        peerRef.current = null;

        try {
          if (remoteStream) {
            remoteStream.getTracks().forEach((t) => t.stop());
          }
        } catch {
          /* noop */
        }
        setRemoteStream(null);
        setSearching(false);

        if (reason === 'trial-ended') {
          setStatusText('Tu prueba gratuita con esta modelo ha terminado.');

          // Enganchamos el modal de COMPRAR (1ª y 2ª prueba)
          try {
            await openPurchaseModal({ context: 'trial-ended' });
          } catch {
            /* noop */
          }
        } else if (reason === 'cooldown') {
          setStatusText('Has agotado las pruebas gratuitas por ahora. Vuelve más tarde para nuevas pruebas.');
        } else {
          setStatusText('La conexión con la modelo se ha cerrado.');
        }

        return;
      }

      // Otros mensajes en modo trial los ignoramos por ahora
    };
  };

  // ======= NEXT =======
  const handleNext = () => {
    setError('');
    setStatusText('');

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError('No hay conexión con el servidor. Pulsa "Buscar" de nuevo.');
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'next' }));
    } catch (e) {
      console.error('[USER] Error enviando NEXT:', e);
      setError('No se pudo solicitar NEXT.');
      return;
    }

    try {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    } catch {
      /* noop */
    }
    peerRef.current = null;

    try {
      if (remoteStream) {
        remoteStream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      /* noop */
    }
    setRemoteStream(null);
    setSearching(true);
    setStatusText('Buscando nueva modelo…');
  };

  const displayName = userName || 'Usuario';

  return (
    <StyledContainer>
      <GlobalBlack />

      {/* NAVBAR */}
      <StyledNavbar>
        <StyledBrand
          href="#"
          aria-label="SharemeChat"
          onClick={(e) => {
            e.preventDefault();
          }}
        />

        {/* Desktop */}
        <div
          className="desktop-only"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginLeft: 'auto',
          }}
        >
          <NavText className="me-3">{displayName}</NavText>

          <NavButton
            type="button"
            onClick={handleFirstPayment}
            disabled={loadingFirstPayment}
            title="Hacerme CLIENT (premium)"
          >
            {loadingFirstPayment ? 'Procesando…' : 'Hazte Premium'}
          </NavButton>

          <NavButton
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            Salir
          </NavButton>
        </div>

        {/* Móvil: hamburguesa */}
        <HamburgerButton
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menú"
          title="Menú"
        >
          ☰
        </HamburgerButton>

        <MobileMenu className={!menuOpen && 'hidden'}>
          <NavText style={{ marginBottom: 8 }}>Hola, {displayName}</NavText>

          <NavButton
            type="button"
            onClick={() => {
              handleFirstPayment();
              setMenuOpen(false);
            }}
            disabled={loadingFirstPayment}
          >
            {loadingFirstPayment ? 'Procesando…' : 'Hazte Premium'}
          </NavButton>

          <NavButton
            type="button"
            onClick={() => {
              handleLogout();
              setMenuOpen(false);
            }}
          >
            Salir
          </NavButton>
        </MobileMenu>
      </StyledNavbar>

      {/* MAIN */}
      <StyledMainContent data-tab="videochat">
        <VideoChatRandomUser
          isMobile={isMobile}
          cameraActive={cameraActive}
          remoteStream={remoteStream}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          searching={searching}
          stopAll={stopAll}
          handleStartMatch={handleStartMatch}
          handleNext={handleNext}
          toggleFullscreen={toggleFullscreen}
          remoteVideoWrapRef={remoteVideoWrapRef}
          handleActivateCamera={handleActivateCamera}
          statusText={statusText}
          error={error}
        />
      </StyledMainContent>

      {/* MODAL: trials agotados */}
      <TrialCooldownModal
        open={showTrialCooldownModal}
        remainingMs={trialRemainingMs}
        onClose={() => setShowTrialCooldownModal(false)}
        onPurchase={async () => {
          setShowTrialCooldownModal(false);
          try {
            await openPurchaseModal({ context: 'trial-exhausted' });
          } catch {
            /* noop */
          }
        }}
      />
    </StyledContainer>
  );
};

export default DashboardUserClient;
