// src/realtime/msgSocketEngine.js

/**
 * Motor común para WS de messages/calls: OPEN/CONNECTING guard, manualClose,
 * ping loop, reconnect, ignore old sockets.
 *
 * Nivel 1: DashboardClient/Model usan el mismo motor. Solo cambian adaptadores.
 */
export function createMsgSocketEngine(adapter) {
  const {
    buildWsUrl,
    WS_PATHS,

    msgSocketRef,
    msgPingRef,
    msgReconnectRef,

    setReady, // client: setWsReady, model: setMsgConnected

    clearMsgTimers, // tu función existente
    onMessage, // callback (ev, s) => void

    callStatusRef,
    callPeerIdRef,

    // Opcional: acciones extra en ping loop (model setCallClientSaldoLoading, logs, etc.)
    beforeCallPing,
    afterCallPing,

    // Reconnect
    reconnectAfterMs = 1500,
    pingEveryMs = 30000,
  } = adapter;

  function safeSend(ws, obj) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
        return true;
      }
    } catch {}
    return false;
  }

  function open() {
    // Cookies JWT -> NO token en querystring
    const url = buildWsUrl(WS_PATHS.messages);

    const cur = msgSocketRef.current;

    // 1) OPEN -> no hacer nada
    if (cur && cur.readyState === WebSocket.OPEN) {
      setReady(true);
      return;
    }

    // 2) CONNECTING -> no reabrir
    if (cur && cur.readyState === WebSocket.CONNECTING) return;

    // 3) cerrar viejo
    if (cur) {
      try {
        cur.__manualClose = true;
        cur.close();
      } catch {}
    }

    msgSocketRef.current = null;
    setReady(false);
    clearMsgTimers?.();

    const s = new WebSocket(url);
    window.ws = s;
    msgSocketRef.current = s;

    s.onopen = () => {
      if (msgSocketRef.current !== s) return;

      setReady(true);

      if (msgPingRef.current) clearInterval(msgPingRef.current);

      msgPingRef.current = setInterval(() => {
        try {
          if (msgSocketRef.current !== s) return;
          if (s.readyState !== WebSocket.OPEN) return;

          safeSend(s, { type: 'ping' });

          const st = callStatusRef?.current;
          if (st === 'in-call' || st === 'connecting') {
            try { beforeCallPing?.(); } catch {}
            safeSend(s, { type: 'call:ping', with: Number(callPeerIdRef?.current) });
            try { afterCallPing?.(); } catch {}
          }
        } catch {}
      }, pingEveryMs);
    };

    s.onmessage = (ev) => {
      if (msgSocketRef.current !== s) return;
      try { onMessage?.(ev, s); } catch {}
    };

    s.onerror = () => {
      if (msgSocketRef.current !== s) return;
      setReady(false);
      try { s.close(); } catch {}
    };

    s.onclose = () => {
      if (msgSocketRef.current !== s) return;

      setReady(false);
      clearMsgTimers?.();
      msgSocketRef.current = null;

      if (s.__manualClose) return;

      msgReconnectRef.current = setTimeout(() => {
        const now = msgSocketRef.current;
        if (now && (now.readyState === WebSocket.OPEN || now.readyState === WebSocket.CONNECTING)) return;
        open();
      }, reconnectAfterMs);
    };
  }

  return { open };
}
