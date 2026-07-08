import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../config/http';

/**
 * Polling del detalle de una conversacion abierta en AdminSupportPanel
 * (frente B.3.2, ADR-046). Consume GET /api/admin/support/conversations/{id}
 * (summary + hilo completo) y devuelve el payload + refresh() manual.
 *
 * Pausa polling cuando document.hidden. Se apaga si enabled=false. Cleanup en
 * unmount. Recomendado usar solo cuando la conversacion esta HUMAN_HANDLING y
 * assigned_agent_id === currentUserId.
 *
 * @param {number|string|null} conversationId
 * @param {object} opts
 * @param {boolean} [opts.enabled=true] - deshabilita sin desmontar (ej: conv
 *   pasa a RESOLVED, deja de pollear).
 * @param {number} [opts.pollingSec=8]
 */
const useConversationPolling = (conversationId, { enabled = true, pollingSec = 8 } = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (!conversationId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const payload = await apiFetch(`/admin/support/conversations/${conversationId}`);
      setData(payload);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [conversationId]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current || !enabled || !conversationId) return;
    intervalRef.current = setInterval(fetchOnce, Math.max(pollingSec, 3) * 1000);
  }, [enabled, conversationId, fetchOnce, pollingSec]);

  useEffect(() => {
    // Reset estado al cambiar de conversacion.
    setData(null);
    stop();

    if (!conversationId) return undefined;

    // Fetch inicial siempre (aunque enabled=false, para tener el snapshot
    // actual del hilo aunque no polleemos).
    fetchOnce();

    if (!enabled) return undefined;

    if (typeof document !== 'undefined' && !document.hidden) {
      start();
    }

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        stop();
      } else {
        fetchOnce();
        start();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [conversationId, enabled, fetchOnce, start, stop]);

  return {
    data,
    loading,
    error,
    refresh: fetchOnce,
  };
};

export default useConversationPolling;
