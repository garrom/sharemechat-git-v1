import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../config/http';

/**
 * Polling del contador de escaladas para el badge del sidebar admin del frente
 * B.3.2 (ADR-046). Consume GET /api/admin/support/pending-count y devuelve el
 * payload rico {pendingUnassigned, myAssigned, otherAssigned} + un refresh()
 * manual para forzar recarga tras acciones (claim/release/resolve).
 *
 * Pausa el polling cuando document.hidden (ahorro batería/red del admin) y
 * relanza al volver a visible. Cleanup en unmount.
 *
 * @param {object} opts
 * @param {number} [opts.pollingSec=25] - intervalo entre polls cuando visible.
 * @param {boolean} [opts.enabled=true] - permite deshabilitar sin desmontar.
 */
const useSupportPendingCount = ({ pollingSec = 25, enabled = true } = {}) => {
  const [counts, setCounts] = useState({ pendingUnassigned: 0, myAssigned: 0, otherAssigned: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const data = await apiFetch('/admin/support/pending-count');
      setCounts({
        pendingUnassigned: Number(data?.pendingUnassigned) || 0,
        myAssigned: Number(data?.myAssigned) || 0,
        otherAssigned: Number(data?.otherAssigned) || 0,
      });
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current || !enabled) return;
    intervalRef.current = setInterval(fetchOnce, Math.max(pollingSec, 5) * 1000);
  }, [enabled, fetchOnce, pollingSec]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return undefined;
    }

    // Primer fetch inmediato al montar (para no esperar el intervalo).
    fetchOnce();

    // Iniciar el interval solo si la pestaña esta visible.
    if (typeof document !== 'undefined' && !document.hidden) {
      start();
    }

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        stop();
      } else {
        // Al volver a visible: fetch inmediato + relanzar el interval.
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
  }, [enabled, fetchOnce, start, stop]);

  return {
    counts,
    loading,
    error,
    refresh: fetchOnce,
  };
};

export default useSupportPendingCount;
