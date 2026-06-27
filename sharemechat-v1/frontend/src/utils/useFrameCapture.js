import { useEffect, useRef } from 'react';
import { apiFetch } from '../config/http';

/**
 * Hook de captura cliente-side del frente Moderacion IA (P2.1; ADR-036
 * bloque 1, captura cliente-side desde el browser del modelo).
 *
 * <p>Crea un <video> oculto + <canvas> offscreen ligados al
 * MediaStream local del modelo. Cada {@code cadenceMs} ms dibuja un
 * frame al canvas, lo serializa a JPEG quality 0.7, y lo envia como
 * multipart al endpoint POST /api/streams/{streamId}/frames. Primera
 * captura inmediata (tick 0; DEC-14 P2.1).
 *
 * <p>Politica errores cliente:
 *   - 401/403/404/409 -> sesion cerrada server-side: clearInterval y
 *     no reintentar mas hasta que el efecto se reinicie.
 *   - 5xx / timeout / AbortError: log warn y continuar; proxima
 *     captura en {@code cadenceMs}.
 *
 * <p>Cleanup en unmount o cuando alguna dependencia cambia: clearInterval +
 * AbortController.abort() de la peticion en vuelo + liberar srcObject.
 *
 * @param activeStreamId {number|null} streamRecordId del stream activo. Si
 *        no es positivo, el hook queda inerte.
 * @param localStreamRef React.MutableRefObject<MediaStream|null> ref al
 *        MediaStream local del modelo (ya abierto por getUserMedia).
 * @param enabled {boolean} flag adicional; tipicamente cameraActive.
 * @param cadenceMs {number} cadencia de muestreo en ms (default 15000 = DEC-5).
 */
export default function useFrameCapture(activeStreamId, localStreamRef, enabled, cadenceMs = 15000) {
  // Mantenemos el aborter en una ref para que el cleanup pueda
  // abortar la peticion en vuelo aunque se este re-renderizando.
  const aborterRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const sid = Number(activeStreamId);
    if (!Number.isFinite(sid) || sid <= 0) return undefined;
    const stream = localStreamRef && localStreamRef.current;
    if (!stream) return undefined;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    try { video.srcObject = stream; } catch { /* noop */ }
    const canvas = document.createElement('canvas');
    let stopped = false;
    let timer = null;

    const sendOne = async () => {
      if (stopped) return;
      try {
        if (!video.videoWidth || !video.videoHeight) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
        if (!blob) return;

        const form = new FormData();
        form.append('frame', blob, `frame-${Date.now()}.jpg`);
        const aborter = new AbortController();
        aborterRef.current = aborter;
        try {
          await apiFetch(`/streams/${sid}/frames`, {
            method: 'POST',
            body: form,
            signal: aborter.signal,
          });
        } finally {
          if (aborterRef.current === aborter) aborterRef.current = null;
        }
      } catch (err) {
        const s = err && err.status;
        if (s === 401 || s === 403 || s === 404 || s === 409) {
          // Sesion cerrada server-side: detener loop hasta que reabra el effect.
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          stopped = true;
          // eslint-disable-next-line no-console
          console.warn('[FRAME-CAPTURE] stopped status=', s);
          return;
        }
        // 5xx, timeout, AbortError: log y continuar.
        // eslint-disable-next-line no-console
        console.warn('[FRAME-CAPTURE] tick failed', s || (err && err.message));
      }
    };

    // Tick 0 inmediato (DEC-14).
    sendOne();
    timer = setInterval(sendOne, cadenceMs);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (aborterRef.current) {
        try { aborterRef.current.abort(); } catch { /* noop */ }
        aborterRef.current = null;
      }
      try { video.srcObject = null; } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStreamId, enabled, cadenceMs]);
}
