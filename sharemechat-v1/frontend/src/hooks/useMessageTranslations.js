import { useEffect, useRef, useState } from 'react';
import { translateBatch } from '../api/translationApi';

// pending-hardening §5.3 (2026-08-08): hook que resuelve traducciones de
// una lista de mensajes al idioma del viewer. Diseño:
//
//  - Traduce SOLO los mensajes cuyo sender NO es el viewer (opcion MVP,
//    igual que WhatsApp translation: se traducen los recibidos, tu propio
//    texto lo conoces). El opcion "traducir tambien mensajes propios al
//    idioma del peer" (CooMeet exacto) queda para T7 si el operador lo pide.
//  - Cache en memoria (Map por sesion) via useRef; los mensajes ya
//    traducidos no se re-piden aunque re-renderice el componente.
//  - Fetch batch a /api/messages/translate-batch: una sola llamada backend
//    por lote de misses, ahorra latencia N*RTT.
//  - Skip si feature no configurada, no hay viewerLang o showOriginal activo.
//  - Skip mensajes cuyo body sea gift o vacio (no tiene sentido traducir).
//
// Uso:
//   const translations = useMessageTranslations({
//     messages, viewerId: user.id, viewerLang, enabled, showOriginal
//   });
//   // translations es un Map { msgId: translatedText } listo para lookup.
export function useMessageTranslations({ messages, viewerId, viewerLang, enabled, showOriginal }) {
  const cacheRef = useRef(new Map()); // key: `${msgId}|${lang}` -> translatedText
  const [tick, setTick] = useState(0);
  const inFlightRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!viewerLang) return;
    if (showOriginal) return;
    if (!Array.isArray(messages) || messages.length === 0) return;

    // Detectar mensajes traducibles no cacheados.
    const missIds = [];
    for (const m of messages) {
      if (!m || !m.id) continue;
      if (m.gift) continue;
      if (typeof m.body !== 'string' || m.body.trim() === '') continue;
      // Solo mensajes recibidos (sender != viewer).
      if (Number(m.senderId) === Number(viewerId)) continue;
      // Skip los que empiezan por marker gift, aunque no vengan como m.gift.
      if (m.body.startsWith('[[GIFT:') && m.body.endsWith(']]')) continue;
      const key = `${m.id}|${viewerLang}`;
      if (cacheRef.current.has(key)) continue;
      if (inFlightRef.current.has(key)) continue;
      missIds.push(m.id);
      inFlightRef.current.add(key);
    }

    if (missIds.length === 0) return;

    let cancelled = false;
    translateBatch(missIds, viewerLang)
      .then((results) => {
        if (cancelled) return;
        if (!Array.isArray(results)) return;
        for (const r of results) {
          if (!r || r.messageId == null) continue;
          const key = `${r.messageId}|${viewerLang}`;
          cacheRef.current.set(key, r.translatedText);
        }
        // Trigger re-render (los ref no lo hacen).
        setTick((t) => t + 1);
      })
      .catch((e) => {
        // Si es 503 (TRANSLATION_UNAVAILABLE) o error red, no rompemos.
        // El bubble simplemente no muestra la traduccion.
        if (e && e.status !== 503) {
          console.warn('translateBatch failed:', e.message || e);
        }
      })
      .finally(() => {
        for (const id of missIds) {
          inFlightRef.current.delete(`${id}|${viewerLang}`);
        }
      });

    return () => { cancelled = true; };
  }, [messages, viewerId, viewerLang, enabled, showOriginal]);

  // Devolver un getter estable que consulta el cache actual.
  const getTranslation = (msgId) => {
    if (!enabled || !viewerLang || showOriginal) return null;
    return cacheRef.current.get(`${msgId}|${viewerLang}`) || null;
  };

  return { getTranslation, tick };
}
