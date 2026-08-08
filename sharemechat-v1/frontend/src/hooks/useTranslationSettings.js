import { useCallback, useEffect, useState } from 'react';
import { getTranslationConfig } from '../api/translationApi';

// pending-hardening §5.3 (2026-08-08): estado global de la feature de
// traduccion automatica chat P2P. Se debe consumir en el nivel superior
// del chat para que:
//   - el toggle "Ver original" sea global por conversacion (opcion C tipo CooMeet),
//   - solo se pida /translation-config una vez por sesion,
//   - los componentes hijos (bubbles) reciban translation ya resuelta.
//
// STORAGE_KEY guarda el toggle showOriginal en localStorage: sobrevive
// refresh de la pagina, pero se resetea si el user limpia storage.
const STORAGE_KEY = 'sharemechat.chat.showOriginal';

export function useTranslationSettings(viewerUser) {
  const [config, setConfig] = useState({ enabled: false, provider: null, langs: [] });
  const [loading, setLoading] = useState(true);
  const [showOriginal, setShowOriginalState] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    getTranslationConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig({
          enabled: !!data?.enabled,
          provider: data?.provider || null,
          langs: Array.isArray(data?.langs) ? data.langs : [],
        });
      })
      .catch(() => {
        // Sin config = feature apagada. No es error visible.
        if (!cancelled) setConfig({ enabled: false, provider: null, langs: [] });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setShowOriginal = useCallback((v) => {
    setShowOriginalState(!!v);
    try { window.localStorage.setItem(STORAGE_KEY, !!v ? 'true' : 'false'); } catch {}
  }, []);

  const toggleShowOriginal = useCallback(() => {
    setShowOriginal(!showOriginal);
  }, [showOriginal, setShowOriginal]);

  // Idioma del viewer para traducir mensajes recibidos. Prioriza
  // preferredChatLang (setter explicito del perfil) sobre uiLocale (idioma
  // de la UI, seteado en registro/switcher). Null si ninguno esta poblado.
  const viewerLang = (viewerUser && (viewerUser.preferredChatLang || viewerUser.uiLocale)) || null;

  return {
    loading,
    enabled: config.enabled,
    provider: config.provider,
    supportedLangs: config.langs,
    viewerLang,
    showOriginal,
    toggleShowOriginal,
    setShowOriginal,
  };
}
