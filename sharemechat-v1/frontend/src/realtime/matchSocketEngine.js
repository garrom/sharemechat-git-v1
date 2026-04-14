// src/realtime/matchSocketEngine.js
import Peer from 'simple-peer';
import { NEXT_WAIT_MODAL_MIN_MS, NEXT_WAIT_MODAL_MAX_MS } from '../config/appConfig';
import i18n from '../i18n';
import {
  attachIceDebugObservers,
  createSelectedIcePairLogger,
  getIceSignalLogDetails,
} from './iceObserver';
/**
 * Motor común para WS de matching + WebRTC signaling.
 */
export function createMatchSocketEngine(adapter) {
  const {
    // Core deps
    buildWsUrl,
    WS_PATHS,

    // Refs
    socketRef,
    pingIntervalRef,
    peerRef,
    localStreamRef,

    // State accessors (valores "vivos")
    getRemoteStream,
    getIsMobile,
    getSessionUser,

    // UI setters
    setSearching,
    setError,
    setStatus,
    setRemoteStream,
    setMessages,
    setNexting,

    // Helpers de UX
    openNextWaitModal,

    // Helpers de negocio (opcionales, según rol)
    isEcho,
    onChatMessage,
    onGiftMessage,
    onGiftError,
    onNoPeerAvailable,
    onNoBalance,
    onPeerDisconnectedPost,
    onMatchMeta, // (data) => void, para setCurrentModelId / setCurrentClientId / streamRecordId / clientBalance etc.
    onPeerStateChange,

    // Config rol
    role, // 'client' | 'model'
    getRolePayload, // () => object, p.ej. model: {role, lang, country}
    initiator, // boolean (client=true, model=false)

    // Eventos de NEXT (comunes)
    handleNextWait = true,

    // Si quieres stats en loop/pings (model lo manda, client no necesariamente)
    sendStatsOnPing = false,
    pingEveryMs = 15000,
    pingFastEveryMs = 5000, // client: durante arranque/matchmaking
    useFastPingOnOpen = false, // client: true
  } = adapter;

  function clearPing() {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }

  function safeSend(obj) {
    try {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
        return true;
      }
    } catch {}
    return false;
  }

  function cleanupPeerAndRemote() {
    const rs = getRemoteStream?.();
    const remoteTrackCount = rs ? rs.getTracks().length : 0;
    console.log(
      `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=cleanupPeerAndRemote hasPeer=${!!peerRef.current} willDestroyPeer=${!!peerRef.current} hasRemoteStream=${!!rs} remoteTrackCount=${remoteTrackCount}`
    );
    try {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    } catch {}

    try {
      if (rs) rs.getTracks().forEach((t) => t.stop());
    } catch {}

    try {
      onPeerStateChange?.({
        iceConnectionState: null,
        connectionState: null,
        iceGatheringState: null,
        signalingState: null,
      });
    } catch {}

    setRemoteStream(null);
  }

  function handleNextControl(data) {
    if (!handleNextWait) return false;

    if (data.type === 'next-wait' || data.type === 'next-rate-limited' || data.type === 'next-ignored') {
      const retryAfterMs = Number(data.retryAfterMs || 0);
      const reason = String(data.reason || 'cooldown');

      setNexting(false);

      let title = 'Preparando el siguiente match';
      let message = 'Espera un instante…';

      if (data.type === 'next-rate-limited') {
        title = 'Demasiados saltos';
        message = role === 'model'
          ? 'Has pulsado “Next” muy rápido. Espera un momento.'
          : 'Has pulsado “Next” muy rápido. Espera un momento para continuar.';
      } else if (reason === 'grace') {
        title = 'Espera un momento';
        message = 'Acabas de emparejarte. Espera un instante antes de pasar al siguiente.';
      } else {
        title = role === 'model' ? 'Preparando el siguiente cliente' : 'Preparando el siguiente match';
        message = 'Estamos cerrando la sesión y preparando el siguiente emparejamiento…';
      }

      try {
        openNextWaitModal?.({
          title,
          message,
          durationMs: Math.max(NEXT_WAIT_MODAL_MIN_MS, Math.min(NEXT_WAIT_MODAL_MAX_MS, retryAfterMs || 1500)),
        });
      } catch {}

      return true;
    }

    if (data.type === 'next-accepted') {
      setNexting(false);
      return true;
    }

    return false;
  }

  function createPeerAndWire() {
    let peerConnected = false;
    let streamReceived = false;
    const localTrackCount = localStreamRef.current?.getTracks?.().length || 0;
    const iceServerCount = Array.isArray(adapter.peerConfig?.iceServers) ? adapter.peerConfig.iceServers.length : 0;
    console.log(
      `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=createPeer initiator=${!!initiator} hasLocalStream=${!!localStreamRef.current} localTrackCount=${localTrackCount} hasPeerConfig=${!!adapter.peerConfig} iceServerCount=${iceServerCount}`
    );
    if (!Array.isArray(adapter.peerConfig?.iceServers) || adapter.peerConfig.iceServers.length === 0) {
      console.error(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=createPeerBlocked reason=missingPeerConfig`
      );
      setError(i18n.t('common.errors.connectionSetupFailedRetry'));
      setSearching(false);
      return;
    }
    const p = new Peer({
      initiator: !!initiator,
      trickle: true,
      stream: localStreamRef.current,
      // Client usa ICE config custom en tu código; si lo necesitas igual aquí,
      // pásalo por adapter como `peerConfig` (no invento valores).
      config: adapter.peerConfig,
    });
    const logSelectedPair = createSelectedIcePairLogger(`scope=random role=${role}`);

    const emitPeerState = () => {
      try {
        onPeerStateChange?.({
          iceConnectionState: p._pc?.iceConnectionState || null,
          connectionState: p._pc?.connectionState || null,
          iceGatheringState: p._pc?.iceGatheringState || null,
          signalingState: p._pc?.signalingState || null,
        });
      } catch {}
    };

    p.on('signal', (signal) => {
      const details = getIceSignalLogDetails(signal);
      if (details.signalType !== 'candidate') {
        console.log(
          `[RANDOM_TRACE_SIGNAL] ts=${Date.now()} role=${role} signalType=${details.signalType} candidateEmpty=${details.candidateEmpty}`
        );
      } else {
        console.log(
          `[ICE_TRACE] ts=${Date.now()} scope=random role=${role} event=signal-out candidateType=${details.candidateType || 'unknown'} protocol=${details.protocol || 'unknown'} candidateEmpty=${details.candidateEmpty}`
        );
      }
      if (signal?.type === 'candidate' && signal?.candidate?.candidate === '') return;
      safeSend({ type: 'signal', signal });
    });

    p.on('stream', (stream) => {
      streamReceived = true;
      const tracks = Array.isArray(stream?.getTracks?.()) ? stream.getTracks() : [];
      const trackSummary = tracks.map((t) => `${t.kind}:${t.id}`).join(',');
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=peerStream streamId=${stream?.id || 'null'} trackCount=${tracks.length} tracks=${trackSummary} peerConnected=${peerConnected} streamReceived=${streamReceived} willSetRemoteStream=true willSendPing=true`
      );
      setRemoteStream(stream);

      // “ACK operativo” por media real: ping extra (tu model ya lo hace; en client no estorba)
      try { safeSend({ type: 'ping' }); } catch {}
    });

    p.on('connect', () => {
      peerConnected = true;
      emitPeerState();
      logSelectedPair(p._pc);
      console.log(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=peerConnect peerConnected=${peerConnected} streamReceived=${streamReceived}`
      );
    });

    p.on('error', (err) => {
      const rawMessage = String(err?.message || '');
      const normalizedMessage = rawMessage.toLowerCase();

      const isExpectedPeerClose =
        normalizedMessage.includes('user-initiated abort') ||
        normalizedMessage.includes('close called');

      if (isExpectedPeerClose) {
        console.log(
          `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=peerCloseExpected message=${rawMessage || 'unknown'}`
        );
        return;
      }

      console.warn(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=peerError message=${rawMessage || 'unknown'}`
      );
      setError(i18n.t('common.errors.connectionSetupFailedRetry'));
      setSearching(false);
    });

    if (p?._pc && typeof p._pc.addEventListener === 'function') {
      attachIceDebugObservers({
        pc: p._pc,
        logPrefix: `scope=random role=${role}`,
        logSelectedPair,
        onStateChange: () => {
          emitPeerState();
          console.log(
            `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=pcState iceConnectionState=${p._pc?.iceConnectionState || 'unknown'}`
          );
          console.log(
            `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=pcState connectionState=${p._pc?.connectionState || 'unknown'}`
          );
          console.log(
            `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=pcState iceGatheringState=${p._pc?.iceGatheringState || 'unknown'}`
          );
          console.log(
            `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=pcState signalingState=${p._pc?.signalingState || 'unknown'}`
          );
        },
      });
    }

    peerRef.current = p;
    emitPeerState();
  }

  function onWsOpen() {
    clearPing();
    console.log(
      `[RANDOM_TRACE_WS] ts=${Date.now()} role=${role} action=wsOpen socketOpen=true willSendPing=true willSendSetRole=true willStartMatchOnOpen=${!!adapter.startMatchOnOpen}`
    );

    // Ping inmediato para acelerar confirmación
    safeSend({ type: 'ping' });

    // Intervalo ping
    const interval = (useFastPingOnOpen ? pingFastEveryMs : pingEveryMs);
    pingIntervalRef.current = setInterval(() => {
      safeSend({ type: 'ping' });
      if (sendStatsOnPing) safeSend({ type: 'stats' });
    }, interval);

    // set-role (con payload por rol)
    const payload = (typeof getRolePayload === 'function')
      ? getRolePayload()
      : (role ? { type: 'set-role', role } : { type: 'set-role' });

    safeSend(payload);

    // stats inicial opcional
    safeSend({ type: 'stats' });

    // start-match inicial (solo client en tu metodo; model lo dispara desde handleStartMatch si socket ya abierto)
    if (adapter.startMatchOnOpen) {
      safeSend({ type: 'start-match' });
    }
  }

  function onWsMessage(event) {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (!data?.type) return;

    // NEXT control
    if (handleNextControl(data)) return;

    if (data.type === 'match') {
      console.log(
        `[RANDOM_TRACE_WS] ts=${Date.now()} role=${role} action=match peerUserId=${data?.peerUserId ?? 'null'} peerRole=${data?.peerRole || 'null'} streamRecordId=${data?.streamRecordId ?? 'null'} willSendPing=true willCleanupPeer=true willCreatePeer=true`
      );
      // Señal de “grace” solo en client (si aplica)
      if (role === 'client' && adapter.onMatchGrace) {
        adapter.onMatchGrace(getIsMobile?.());
      }

      // ping inmediato
      safeSend({ type: 'ping' });

      // meta por rol (ids, streamRecordId, saldo cliente, etc.)
      try { onMatchMeta?.(data); } catch {}

      // reset común
      try { cleanupPeerAndRemote(); } catch {}
      setMessages([]);
      setError('');
      setStatus('');
      setSearching(false);
      setNexting(false);

      // crear peer
      createPeerAndWire();
      return;
    }

    if (data.type === 'signal') {
      const details = getIceSignalLogDetails(data?.signal);
      if (details.signalType !== 'candidate') {
        console.log(
          `[RANDOM_TRACE_SIGNAL] ts=${Date.now()} role=${role} action=signalReceived signalType=${details.signalType} candidateEmpty=${details.candidateEmpty} hasPeer=${!!peerRef.current}`
        );
      } else {
        console.log(
          `[ICE_TRACE] ts=${Date.now()} scope=random role=${role} event=signal-in candidateType=${details.candidateType || 'unknown'} protocol=${details.protocol || 'unknown'} candidateEmpty=${details.candidateEmpty} hasPeer=${!!peerRef.current}`
        );
      }
      if (peerRef.current) {
        try { peerRef.current.signal(data.signal); } catch {}
      }
      return;
    }

    if (data.type === 'chat') {
      // Si dashboard quiere custom (tu client/model lo hacen igual)
      if (typeof onChatMessage === 'function') {
        onChatMessage(data);
        return;
      }
      const msg = data.message;
      if (isEcho && isEcho(msg)) return;
      setMessages((prev) => [...prev, { from: 'peer', text: msg }]);
      return;
    }

    if (data.type === 'gift') {
      if (typeof onGiftMessage === 'function') {
        onGiftMessage(data);
        return;
      }
      // Si no hay handler, lo ignoramos (no invento UI).
      return;
    }

    if (data.type === 'gift:error') {
      try { onGiftError?.(data); } catch {}
      return;
    }

    // No peer disponible (client/model difiere)
    if (data.type === adapter.noPeerAvailableType) {
      try { onNoPeerAvailable?.(data); } catch {}
      return;
    }

    // No balance (solo client random en tu flujo)
    if (data.type === 'no-balance') {
      try { onNoBalance?.(data); } catch {}
      return;
    }

    if (data.type === 'peer-disconnected') {
      setNexting(false);

      // Limpieza común
      try { cleanupPeerAndRemote(); } catch {}
      setMessages([]);

      // Hook específico por rol (auto-restart, reason low-balance, etc.)
      try { onPeerDisconnectedPost?.(data); } catch {}

      return;
    }

    // Otros tipos: el dashboard puede engancharse
    try { adapter.onUnhandled?.(data); } catch {}
  }

  function onWsClose() {
    clearPing();
    setSearching(false);
  }

  function onWsError() {
    setSearching(false);
  }

  function ensureSocketOpen() {
    const wsUrl = buildWsUrl(WS_PATHS.match);

    // Si hay OPEN, no tocar
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

    // Si hay CONNECTING, no duplicar
    if (socketRef.current && socketRef.current.readyState === WebSocket.CONNECTING) return;

    // Si hay uno viejo, cerrarlo
    if (socketRef.current) {
      try { socketRef.current.close(); } catch {}
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = onWsOpen;
    ws.onmessage = onWsMessage;
    ws.onerror = onWsError;
    ws.onclose = onWsClose;
  }

  function start() {
    if (!adapter.cameraActiveGetter?.() || !localStreamRef.current) {
      setError(i18n.t('common.media.cameraRequired'));
      return;
    }

    if (!Array.isArray(adapter.peerConfig?.iceServers) || adapter.peerConfig.iceServers.length === 0) {
      console.error(
        `[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=${role} action=startBlocked reason=missingPeerConfig`
      );
      setError(i18n.t('common.errors.connectionSetupFailedRetry'));
      setSearching(false);
      return;
    }

    setSearching(true);
    setError('');

    // Auth industrial por cookie:
    // la sesión viva es la del SessionProvider (/users/me).
    const me = (typeof getSessionUser === 'function') ? getSessionUser() : null;
    if (!me) {
      setError(i18n.t('common.auth.sessionExpired'));
      setSearching(false);
      return;
    }

    ensureSocketOpen();

    // Si ya estaba abierto, pedimos match aquí (simétrico)
    safeSend({ type: 'start-match' });
    safeSend({ type: 'stats' });
  }

  function stop() {
    clearPing();
    try {
      if (socketRef.current) socketRef.current.close();
    } catch {}
    socketRef.current = null;
    setSearching(false);
  }

  return { start, stop, ensureSocketOpen };
}
