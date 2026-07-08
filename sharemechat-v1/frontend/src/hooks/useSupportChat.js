// Hook del chat con el Agente IA (B.2.1b).
// Gestiona la única conversación OPEN del usuario contra los endpoints de
// support (POST /message, GET history, POST escalate-manual). El backend
// crea la conversación en el primer POST y devuelve su id; se cachea en
// localStorage para retomarla tras reload.
//
// B.3.3 (ADR-046): cuando el bot escala y un agente humano hace claim,
// el backend marca la conversación como HUMAN_HANDLING y devuelve
// resolutionStatus='HUMAN_HANDLING' en el POST /message. A partir de
// entonces el bot deja de responder y los siguientes mensajes de la
// conversación los añade el humano vía panel admin. Como no hay push
// server-side todavía, el cliente hace polling REST del historial cada
// HUMAN_POLLING_MS mientras el status esté en HUMAN_HANDLING, con
// document.hidden guard para no consumir en background.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supportApi } from '../api/supportApi';

const LS_KEY = 'sharemechat.support.conversationId';
const HUMAN_POLLING_MS = 8000;

const readCachedConversationId = () => {
  try {
    const raw = window.localStorage?.getItem(LS_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

const writeCachedConversationId = (id) => {
  try {
    if (id == null) window.localStorage?.removeItem(LS_KEY);
    else window.localStorage?.setItem(LS_KEY, String(id));
  } catch {
    // localStorage puede estar deshabilitado; caemos en memoria solamente.
  }
};

/**
 * @returns {{
 *   messages: Array<{id?: number|string, sender: 'USER'|'LLM'|'SYSTEM', content: string, createdAt?: string}>,
 *   conversationId: number|null,
 *   loading: boolean,
 *   sending: boolean,
 *   error: string|null,
 *   rateLimitState: {
 *     messagesRemainingToday: number|null,
 *     tokensRemainingToday: number|null,
 *     rateLimited: boolean,
 *     exceededAt: string|null,
 *   },
 *   resolutionStatus: string|null,
 *   escalated: boolean,
 *   sendMessage: (text: string) => Promise<void>,
 *   requestEscalation: (reason?: string) => Promise<void>,
 *   clearConversation: () => void,
 * }}
 */
export default function useSupportChat() {
  const [conversationId, setConversationId] = useState(() => readCachedConversationId());
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState(null);
  const [escalated, setEscalated] = useState(false);
  const [rateLimitState, setRateLimitState] = useState({
    messagesRemainingToday: null,
    tokensRemainingToday: null,
    rateLimited: false,
    exceededAt: null,
  });

  // Serial guard: solo la carga inicial más reciente actualiza state.
  const loadTokenRef = useRef(0);

  // Persistir conversationId en localStorage cuando cambie.
  useEffect(() => {
    writeCachedConversationId(conversationId);
  }, [conversationId]);

  // Carga inicial del historial si hay conversationId cacheado.
  useEffect(() => {
    if (!conversationId) return;
    const token = ++loadTokenRef.current;
    setLoading(true);
    setError(null);
    supportApi.getHistory(conversationId)
      .then((rows) => {
        if (token !== loadTokenRef.current) return;
        setMessages(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (token !== loadTokenRef.current) return;
        // Si el backend rechaza (400 conversation no encontrada / ajena),
        // limpiamos el id cacheado para arrancar de cero.
        setMessages([]);
        setConversationId(null);
        setError(err?.message || 'No se pudo cargar el historial');
      })
      .finally(() => {
        if (token === loadTokenRef.current) setLoading(false);
      });
    // Solo depende del conversationId; ignoramos ESLint del cierre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const sendMessage = useCallback(async (text) => {
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) return;
    if (rateLimitState.rateLimited) return;
    const localUserMsg = {
      id: `local-${Date.now()}`,
      sender: 'USER',
      content: clean,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, localUserMsg]);
    setSending(true);
    setError(null);
    try {
      const resp = await supportApi.sendMessage(clean);
      if (resp?.conversationId && resp.conversationId !== conversationId) {
        setConversationId(resp.conversationId);
      }
      const now = new Date().toISOString();
      const persistedUserMsg = {
        ...localUserMsg,
        pending: false,
        id: localUserMsg.id,
      };
      const replyMsg = resp?.reply
        ? {
            id: resp.messageId ?? `reply-${Date.now()}`,
            sender: resp.rateLimited ? 'SYSTEM' : 'LLM',
            content: resp.reply,
            createdAt: resp.timestamp || now,
          }
        : null;
      setMessages((prev) => {
        const withoutLocal = prev.filter((m) => m.id !== localUserMsg.id);
        const next = [...withoutLocal, persistedUserMsg];
        if (replyMsg) next.push(replyMsg);
        return next;
      });
      setResolutionStatus(resp?.resolutionStatus || null);
      setEscalated(!!resp?.escalated);
      const rl = !!resp?.rateLimited;
      setRateLimitState({
        messagesRemainingToday: typeof resp?.messagesRemainingToday === 'number'
          ? resp.messagesRemainingToday
          : null,
        tokensRemainingToday: typeof resp?.tokensRemainingToday === 'number'
          ? resp.tokensRemainingToday
          : null,
        rateLimited: rl,
        exceededAt: rl ? (resp?.timestamp || now) : null,
      });
    } catch (err) {
      // Restauramos: quitamos el mensaje local pending (no llegó al backend).
      setMessages((prev) => prev.filter((m) => m.id !== localUserMsg.id));
      setError(err?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }, [conversationId, rateLimitState.rateLimited]);

  // Polling B.3.3 (ADR-046). Se activa cuando el status entra en
  // HUMAN_HANDLING (via respuesta de POST /message tras el claim del agente).
  // Refetchea el historial cada HUMAN_POLLING_MS y hace merge por id (solo
  // añade mensajes nuevos, no duplica). document.hidden guard: pausa cuando
  // la pestaña no es visible. Cleanup al desmontar o cuando el status deja
  // de ser HUMAN_HANDLING (por ejemplo si el user manda un nuevo mensaje que
  // devuelve otro status). Serial guard con token para descartar respuestas
  // obsoletas si el conversationId cambia mid-polling.
  const humanPollTimerRef = useRef(null);
  const humanPollTokenRef = useRef(0);
  const humanPollInFlightRef = useRef(false);

  const refreshHistoryOnce = useCallback(async () => {
    if (!conversationId) return;
    if (humanPollInFlightRef.current) return;
    humanPollInFlightRef.current = true;
    const token = humanPollTokenRef.current;
    try {
      const rows = await supportApi.getHistory(conversationId);
      if (token !== humanPollTokenRef.current) return;
      if (!Array.isArray(rows)) return;
      setMessages((prev) => {
        const known = new Set();
        prev.forEach((m) => {
          if (m && m.id != null) known.add(String(m.id));
        });
        const fresh = rows.filter((r) => r && r.id != null && !known.has(String(r.id)));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh];
      });
    } catch {
      // Fallo transitorio: se reintenta en el proximo tick del interval.
    } finally {
      humanPollInFlightRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    const isHumanHandling = resolutionStatus === 'HUMAN_HANDLING';
    const stopPolling = () => {
      if (humanPollTimerRef.current) {
        clearInterval(humanPollTimerRef.current);
        humanPollTimerRef.current = null;
      }
    };
    const startPolling = () => {
      if (humanPollTimerRef.current) return;
      humanPollTimerRef.current = setInterval(refreshHistoryOnce, HUMAN_POLLING_MS);
    };

    if (!isHumanHandling || !conversationId) {
      stopPolling();
      return undefined;
    }

    // Invalidar respuestas obsoletas si cambio conversationId mid-polling.
    humanPollTokenRef.current += 1;

    // Fetch inicial inmediato para pintar el mensaje SYSTEM del claim sin
    // esperar el primer tick.
    refreshHistoryOnce();

    if (typeof document !== 'undefined' && !document.hidden) {
      startPolling();
    }

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        stopPolling();
      } else {
        refreshHistoryOnce();
        startPolling();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [resolutionStatus, conversationId, refreshHistoryOnce]);

  const requestEscalation = useCallback(async (reason) => {
    if (!conversationId) {
      throw new Error('No hay conversación activa para escalar');
    }
    setError(null);
    try {
      const resp = await supportApi.escalateManual(conversationId, reason);
      setResolutionStatus(resp?.resolutionStatus || 'ESCALATED');
      setEscalated(true);
    } catch (err) {
      setError(err?.message || 'No se pudo escalar la conversación');
      throw err;
    }
  }, [conversationId]);

  const clearConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setResolutionStatus(null);
    setEscalated(false);
    setRateLimitState({
      messagesRemainingToday: null,
      tokensRemainingToday: null,
      rateLimited: false,
      exceededAt: null,
    });
    setError(null);
  }, []);

  return {
    messages,
    conversationId,
    loading,
    sending,
    error,
    rateLimitState,
    resolutionStatus,
    escalated,
    sendMessage,
    requestEscalation,
    clearConversation,
  };
}
