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
/**
 * @param {object} [options]
 * @param {number|null} [options.pinnedConversationId] - si viene, el hook
 *   fija la conversacion a ese id (no lee ni escribe localStorage). Uso:
 *   vista de detalle de un ticket, donde el chat debe estar scoped a la
 *   conversacion vinculada al ticket (ADR-054 D8). Sin este parametro,
 *   comportamiento historico: cache en localStorage de la conversacion
 *   activa unica del user.
 */
export default function useSupportChat(options) {
  const pinnedConversationId = options && options.pinnedConversationId
    ? Number(options.pinnedConversationId)
    : null;
  const isPinned = pinnedConversationId != null && Number.isFinite(pinnedConversationId);

  const [conversationId, setConversationId] = useState(() =>
    isPinned ? pinnedConversationId : readCachedConversationId()
  );
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState(null);
  const [escalated, setEscalated] = useState(false);
  // ADR-054 D8: meta de la conversacion para pintar el badge en la UI.
  // Solo poblada cuando pinnedConversationId != null (vista de ticket).
  const [meta, setMeta] = useState(null);
  const [rateLimitState, setRateLimitState] = useState({
    messagesRemainingToday: null,
    tokensRemainingToday: null,
    rateLimited: false,
    exceededAt: null,
  });

  // Serial guard: solo la carga inicial más reciente actualiza state.
  const loadTokenRef = useRef(0);

  // Si el pinnedConversationId del padre cambia, re-sincroniza.
  useEffect(() => {
    if (isPinned && pinnedConversationId !== conversationId) {
      setConversationId(pinnedConversationId);
      setMessages([]);
      setMeta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedConversationId]);

  // Persistir conversationId en localStorage cuando cambie (solo si NO
  // esta pinned; en modo pinned el chat esta scoped al ticket y no debe
  // afectar al chat "vivo" del user en /client Soporte).
  useEffect(() => {
    if (isPinned) return;
    writeCachedConversationId(conversationId);
  }, [conversationId, isPinned]);

  // Carga inicial del historial + meta (si es pinned) cuando hay conversationId.
  useEffect(() => {
    if (!conversationId) return;
    const token = ++loadTokenRef.current;
    setLoading(true);
    setError(null);
    const historyP = supportApi.getHistory(conversationId);
    const metaP = isPinned ? supportApi.getConversationMeta(conversationId) : Promise.resolve(null);
    Promise.all([historyP, metaP])
      .then(([rows, metaResp]) => {
        if (token !== loadTokenRef.current) return;
        setMessages(Array.isArray(rows) ? rows : []);
        if (metaResp) {
          setMeta(metaResp);
          if (metaResp.resolutionStatus) setResolutionStatus(metaResp.resolutionStatus);
        }
      })
      .catch(() => {
        if (token !== loadTokenRef.current) return;
        // Modo unpinned (chat vivo /client Soporte): el id cacheado en LS
        // puede pertenecer a otra sesion; se limpia silenciosamente. En
        // modo pinned (vista ticket) NO se limpia el id — el fallo es
        // accionable (bug de scoping o permiso) y se propaga como error.
        setMessages([]);
        if (!isPinned) setConversationId(null);
        else setError('No se pudo cargar el historial de esta conversación');
      })
      .finally(() => {
        if (token === loadTokenRef.current) setLoading(false);
      });
    // Solo depende del conversationId; ignoramos ESLint del cierre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isPinned]);

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
      // ADR-054 D8 Fase F (2026-08-07): en modo pinned (vista de ticket)
      // usamos el endpoint SCOPED que persiste en la conv del ticket
      // (sin bot). En modo unpinned (chat casual) seguimos con el POST
      // /message que resuelve conv activa + bot LLM.
      const resp = isPinned
        ? await supportApi.sendTicketMessage(pinnedConversationId, clean)
        : await supportApi.sendMessage(clean);
      // Solo actualizamos conversationId cuando NO está pinned. En modo
      // pinned el id es fijo — si el backend devolviera otro (no debería,
      // pero por defensa) lo ignoramos para no cambiar de contexto.
      if (!isPinned && resp?.conversationId && resp.conversationId !== conversationId) {
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
            // En modo pinned el reply SIEMPRE es SYSTEM (acuse del backend
            // sin bot). En unpinned puede ser LLM o SYSTEM (rateLimited).
            sender: isPinned || resp.rateLimited ? 'SYSTEM' : 'LLM',
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
  }, [conversationId, rateLimitState.rateLimited, isPinned, pinnedConversationId]);

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
      // Fix bug 2 post-B.3.3: politica "backend fuente de verdad + preservar
      // pending". El merge anterior comparaba por id y duplicaba los
      // mensajes USER porque sendMessage genera un id local `local-<ts>`
      // (necesario para pintar responsive antes de que el POST resuelva) y
      // el polling recupera ese mismo mensaje con el id numerico real de BD.
      // El backend no expone el id BD del user message en la respuesta del
      // POST /message (solo devuelve messageId del reply LLM), asi que no
      // se puede reconciliar por id. Solucion: al llegar el polling, el
      // historial del backend es la fuente de verdad y solo se preservan
      // los mensajes con pending=true (todavia en vuelo, sin confirmar por
      // backend). Los locales ya confirmados se descartan del state y
      // quedan representados por su version BD del polling.
      setMessages((prev) => {
        const pendingLocal = prev.filter((m) => m && m.pending === true);
        return [...rows, ...pendingLocal];
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
    meta,
    sendMessage,
    requestEscalation,
    clearConversation,
  };
}
